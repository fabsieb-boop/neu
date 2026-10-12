-- ============================================================================
--  Auswertungs-Views: Belegkreise, KLR, Deckungsbeitragsrechnung DB1-DB4, GuV
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Datenqualitaet: aus Excel uebernommene Summenzeilen ausschliessen
-- ---------------------------------------------------------------------------
ALTER TABLE controlling.buchungen
  ADD COLUMN IF NOT EXISTS gueltig BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE controlling.buchungen
   SET gueltig = (auftrag IS NOT NULL AND auftrag <> '' AND geschaeftsjahr IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 1. Basisview: jede Buchung fachlich angereichert und vorzeichenbereinigt
--
--  Belegkreise (aus der Belegnummer abgeleitet):
--    PRIMAER      68.../69...  Eingangsrechnung, Faktura, Sachbeleg  -> echte Aussenwirkung
--    VERRECHNUNG  9028/9029/9030  innerbetriebliche Leistungsverrechnung
--                                 (Lohnstunden, Geraetestunden) -> echte Projektkosten
--    UMLAGE       9900...      Gemeinkostenzuschlag Region -> Projekt
--                              (Entlastung Innenauftrag / Belastung Projekt, saldiert auf 0)
--    ABRECHNUNG   80...        Auftragsabrechnung auf die Ergebnis-Kostenstelle.
--                              Reiner Innenumsatz: der Empfaenger liegt ausserhalb des
--                              Auftragsberichts. Fuer jede Ergebnisrechnung auszuschliessen,
--                              sonst ist jedes Projektergebnis rechnerisch null.
--
--  Vorzeichen: Quelle liefert Kosten positiv, Erloese negativ.
--    leistung = -wert  (Erloese positiv dargestellt)
--    k_var / k_fix / neutral = +wert (Kosten positiv)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS controlling.v_klr CASCADE;
DROP VIEW IF EXISTS controlling.v_projekt_db CASCADE;
DROP VIEW IF EXISTS controlling.v_db_monat CASCADE;
DROP VIEW IF EXISTS controlling.v_db_monat_region CASCADE;
DROP VIEW IF EXISTS controlling.v_guv CASCADE;
DROP VIEW IF EXISTS controlling.v_kostenart_monat CASCADE;
DROP VIEW IF EXISTS controlling.v_buchung CASCADE;

CREATE VIEW controlling.v_buchung AS
SELECT
  b.buchung_id,
  b.geschaeftsjahr                                AS jahr,
  b.periode                                       AS monat,
  b.buchungsdatum, b.belegdatum, b.belegart, b.belegnummer,
  b.waehrung, b.kostenstelle, b.auftrag,
  COALESCE(p.projekt_nr, b.auftrag)               AS projekt_nr,
  COALESCE(p.projektname, b.objektbezeichnung)    AS projektname,
  p.projekt_id,
  COALESCE(p.auftragstyp,'SONSTIGES')             AS auftragstyp,
  COALESCE(p.regionscode,'--')                    AS regionscode,
  COALESCE(p.region,'Ohne Zuordnung')             AS region,
  b.kostenart                                     AS kostenart_nr,
  k.kostenart_id,
  COALESCE(k.bezeichnung,'Nicht zugeordnet')      AS kostenart_bez,
  COALESCE(k.klr_typ,'SONSTIGES')                 AS klr_typ,
  COALESCE(k.klr_gruppe,'Sonstiges')              AS klr_gruppe,
  COALESCE(k.guv_gruppe,'8 Sonstige betriebliche Aufwendungen') AS guv_gruppe,
  COALESCE(k.sortierung,999)                      AS guv_sort,
  COALESCE(k.db_stufe,2)                          AS db_stufe,
  b.wert,
  CASE
    WHEN b.belegnummer LIKE '80%'   THEN 'ABRECHNUNG'
    WHEN b.belegnummer LIKE '9900%' THEN 'UMLAGE'
    WHEN b.belegnummer LIKE '9%'    THEN 'VERRECHNUNG'
    ELSE 'PRIMAER'
  END                                             AS belegkreis,
  (b.belegnummer NOT LIKE '80%')                  AS ergebnisrelevant,
  CASE WHEN COALESCE(k.db_stufe,2)=0 THEN -b.wert ELSE 0 END AS leistung,
  CASE WHEN COALESCE(k.db_stufe,2)=1 THEN  b.wert ELSE 0 END AS k_var,
  CASE WHEN COALESCE(k.db_stufe,2)=2 AND b.belegnummer NOT LIKE '9900%' THEN b.wert ELSE 0 END AS k_fix,
  CASE WHEN b.belegnummer LIKE '9900%' THEN b.wert ELSE 0 END AS umlage,
  CASE WHEN COALESCE(k.db_stufe,2)=9 THEN  b.wert ELSE 0 END AS neutral,
  CASE
    WHEN COALESCE(p.auftragstyp,'SONSTIGES') = 'PROJEKT'      THEN 'PROJEKT'
    WHEN COALESCE(p.regionscode,'--') = '50'                  THEN 'ZENTRALE'
    WHEN COALESCE(p.auftragstyp,'SONSTIGES') = 'INNENAUFTRAG' THEN 'BEREICH'
    ELSE 'NICHT_ZUGEORDNET'
  END AS kostentraeger
FROM controlling.buchungen b
LEFT JOIN controlling.projekte    p ON p.projekt_id   = b.projekt_id
LEFT JOIN controlling.kostenarten k ON k.kostenart_id = b.kostenart_id
WHERE b.gueltig;

-- ---------------------------------------------------------------------------
-- 2. Stufenweise Deckungsbeitragsrechnung je Monat und Region
--
--    Betriebsleistung          Erloese + Bestandsveraenderung der Projekte
--  - variable Einzelkosten     Material, Fremdleistungen, Lohn-/Geraeteverrechnung
--  = DB1
--  - fixe Projektkosten        sonstige direkt auf dem Projekt gebuchte Kosten
--  = DB2
--  - verrechnete Bereichs-GK   Gemeinkostenzuschlag Region -> Projekt (Beleg 9900)
--  = DB3                       Projektergebnis nach verrechneten Gemeinkosten
--  -/+ Ueber-/Unterdeckung     Ist-Kosten der Innenauftraege der Region
--                              abzueglich der an Projekte verrechneten Zuschlaege
--  - Unternehmensgemeinkosten  Innenauftraege der Zentrale (Regionscode 50)
--  = DB4                       Betriebsergebnis
--  - neutrales Ergebnis        Zinsen, Steuern, kalkulatorisch, periodenfremd
--  = Ergebnis vor Steuern
-- ---------------------------------------------------------------------------
CREATE VIEW controlling.v_db_monat_region AS
WITH basis AS (
  SELECT jahr, monat, regionscode, region,
    SUM(CASE WHEN kostentraeger='PROJEKT'  THEN leistung ELSE 0 END) AS leistung,
    SUM(CASE WHEN kostentraeger='PROJEKT'  THEN k_var    ELSE 0 END) AS variable_kosten,
    SUM(CASE WHEN kostentraeger='PROJEKT'  THEN k_fix    ELSE 0 END) AS fixe_projektkosten,
    SUM(CASE WHEN kostentraeger='PROJEKT'  THEN umlage   ELSE 0 END) AS verrechnete_gk,
    SUM(CASE WHEN kostentraeger='BEREICH'  THEN k_var+k_fix-leistung ELSE 0 END) AS bereichskosten_ist,
    SUM(CASE WHEN kostentraeger='BEREICH'  THEN umlage   ELSE 0 END) AS bereichsentlastung,
    SUM(CASE WHEN kostentraeger='ZENTRALE' THEN k_var+k_fix-leistung ELSE 0 END) AS unternehmensgemeinkosten,
    SUM(CASE WHEN kostentraeger='ZENTRALE' THEN umlage   ELSE 0 END) AS zentralentlastung,
    SUM(neutral)                                                     AS neutrales_ergebnis,
    SUM(wert)                                                        AS saldo_wert,
    COUNT(*)                                                         AS belege
  FROM controlling.v_buchung
  WHERE ergebnisrelevant
  GROUP BY jahr, monat, regionscode, region
)
SELECT b.*,
  bereichskosten_ist + bereichsentlastung                        AS bereichs_deckungsdifferenz,
  unternehmensgemeinkosten + zentralentlastung                   AS zentral_deckungsdifferenz,
  leistung - variable_kosten                                     AS db1,
  leistung - variable_kosten - fixe_projektkosten                AS db2,
  leistung - variable_kosten - fixe_projektkosten - verrechnete_gk AS db3,
  leistung - variable_kosten - fixe_projektkosten - verrechnete_gk
    - (bereichskosten_ist + bereichsentlastung)
    - (unternehmensgemeinkosten + zentralentlastung)             AS db4
FROM basis b;

-- ---------------------------------------------------------------------------
-- 3. Stufenrechnung je Monat, Unternehmen gesamt
-- ---------------------------------------------------------------------------
CREATE VIEW controlling.v_db_monat AS
SELECT jahr, monat,
  SUM(leistung) leistung, SUM(variable_kosten) variable_kosten,
  SUM(fixe_projektkosten) fixe_projektkosten, SUM(verrechnete_gk) verrechnete_gk,
  SUM(bereichskosten_ist) bereichskosten_ist, SUM(bereichsentlastung) bereichsentlastung,
  SUM(bereichs_deckungsdifferenz) bereichs_deckungsdifferenz,
  SUM(unternehmensgemeinkosten) unternehmensgemeinkosten,
  SUM(zentralentlastung) zentralentlastung,
  SUM(zentral_deckungsdifferenz) zentral_deckungsdifferenz,
  SUM(neutrales_ergebnis) neutrales_ergebnis,
  SUM(db1) db1, SUM(db2) db2, SUM(db3) db3, SUM(db4) db4,
  SUM(db4) - SUM(neutrales_ergebnis) AS ergebnis_vor_steuern,
  SUM(belege) belege
FROM controlling.v_db_monat_region
GROUP BY jahr, monat;

-- ---------------------------------------------------------------------------
-- 4. Projekt-Ergebnisrechnung je Geschaeftsjahr
--    DB1-DB3 vollstaendig verursachungsgerecht aus den Belegen.
--    DB4: zusaetzlich Umlage der Unternehmensgemeinkosten nach Leistungsanteil.
-- ---------------------------------------------------------------------------
CREATE VIEW controlling.v_projekt_db AS
WITH proj AS (
  SELECT jahr, projekt_id, projekt_nr, projektname, regionscode, region,
         SUM(leistung) leistung, SUM(k_var) variable_kosten,
         SUM(k_fix) fixe_projektkosten, SUM(umlage) verrechnete_gk,
         SUM(neutral) neutral, COUNT(*) belege,
         MIN(buchungsdatum) erste_buchung, MAX(buchungsdatum) letzte_buchung
  FROM controlling.v_buchung
  WHERE ergebnisrelevant AND kostentraeger='PROJEKT'
  GROUP BY jahr, projekt_id, projekt_nr, projektname, regionscode, region
), zentrale AS (
  SELECT jahr, SUM(k_var+k_fix-leistung+umlage) AS unternehmens_gk
  FROM controlling.v_buchung
  WHERE ergebnisrelevant AND kostentraeger='ZENTRALE'
  GROUP BY jahr
), bezug AS (
  SELECT jahr, SUM(GREATEST(leistung,0)) AS gesamt_leistung FROM proj GROUP BY jahr
)
SELECT p.*,
  p.leistung - p.variable_kosten                                          AS db1,
  p.leistung - p.variable_kosten - p.fixe_projektkosten                   AS db2,
  p.leistung - p.variable_kosten - p.fixe_projektkosten - p.verrechnete_gk AS db3,
  ROUND(COALESCE(z.unternehmens_gk,0)
        * CASE WHEN bz.gesamt_leistung > 0 THEN GREATEST(p.leistung,0)/bz.gesamt_leistung
               ELSE 0 END, 2)                                             AS umlage_zentrale,
  p.leistung - p.variable_kosten - p.fixe_projektkosten - p.verrechnete_gk
    - ROUND(COALESCE(z.unternehmens_gk,0)
        * CASE WHEN bz.gesamt_leistung > 0 THEN GREATEST(p.leistung,0)/bz.gesamt_leistung
               ELSE 0 END, 2)                                             AS db4,
  CASE WHEN p.leistung <> 0
       THEN (p.leistung - p.variable_kosten) / p.leistung * 100 END       AS db1_marge,
  CASE WHEN p.leistung <> 0
       THEN (p.leistung - p.variable_kosten - p.fixe_projektkosten - p.verrechnete_gk)
            / p.leistung * 100 END                                        AS db3_marge
FROM proj p
LEFT JOIN zentrale z ON z.jahr = p.jahr
LEFT JOIN bezug   bz ON bz.jahr = p.jahr;

-- ---------------------------------------------------------------------------
-- 5. GuV-Staffel (Ertraege positiv, Aufwendungen negativ)
-- ---------------------------------------------------------------------------
CREATE VIEW controlling.v_guv AS
SELECT jahr, monat, guv_sort, guv_gruppe, SUM(-wert) betrag, COUNT(*) belege
FROM controlling.v_buchung
WHERE ergebnisrelevant
GROUP BY jahr, monat, guv_sort, guv_gruppe;

-- ---------------------------------------------------------------------------
-- 6. Kostenartenrechnung: Kostenart x Periode
-- ---------------------------------------------------------------------------
CREATE VIEW controlling.v_kostenart_monat AS
SELECT jahr, monat, kostenart_nr, kostenart_bez, klr_typ, klr_gruppe, db_stufe,
       SUM(wert) wert, SUM(leistung) leistung, SUM(k_var) k_var,
       SUM(k_fix) k_fix, SUM(umlage) umlage, SUM(neutral) neutral, COUNT(*) belege
FROM controlling.v_buchung
WHERE ergebnisrelevant
GROUP BY jahr, monat, kostenart_nr, kostenart_bez, klr_typ, klr_gruppe, db_stufe;

-- ---------------------------------------------------------------------------
-- 7. Abstimmbruecke: Belegkreise -> Exportsumme (Nachweis der Vollstaendigkeit)
-- ---------------------------------------------------------------------------
CREATE VIEW controlling.v_abstimmung AS
SELECT jahr, belegkreis, kostentraeger,
       COUNT(*) belege, SUM(wert) saldo,
       SUM(leistung) leistung, SUM(k_var) k_var, SUM(k_fix) k_fix,
       SUM(umlage) umlage, SUM(neutral) neutral
FROM controlling.v_buchung
GROUP BY jahr, belegkreis, kostentraeger;

-- ---------------------------------------------------------------------------
-- 8. Kompatibilitaets-View
-- ---------------------------------------------------------------------------
CREATE VIEW controlling.v_klr AS
SELECT jahr, monat, leistung AS wert, variable_kosten AS variabel,
       fixe_projektkosten + verrechnete_gk + bereichskosten_ist + unternehmensgemeinkosten AS fix
FROM controlling.v_db_monat;

COMMIT;
