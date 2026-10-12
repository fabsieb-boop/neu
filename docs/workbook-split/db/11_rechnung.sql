-- Identitaeten der Deckungsbeitragsrechnung und der abgeschlossenen Monate.
--
-- DB IV war als DB III abzueglich der Deckungsdifferenzen beschrieben,
-- die Sicht hat aber die vollen Bereichs- und Zentralkosten abgezogen und
-- die Entlastung aus dem Gemeinkostenzuschlag (Konto 7801020, Beleg 9900)
-- liegengelassen. Dadurch fehlten im Unternehmensergebnis 1.515.238,07 Euro,
-- genau die Entlastung der Bereiche.
--
-- Acht Auftraege aus 2026 standen in den Buchungen, aber nicht im
-- Projektstamm. Ohne Stamm bleiben sie keinem Kostentraeger zugeordnet
-- und fehlen in der Staffel, darunter 1.212,62 Euro Umlage.

CREATE OR REPLACE VIEW controlling.v_db_monat_region AS
 WITH basis AS (
         SELECT v_buchung.jahr,
            v_buchung.monat,
            v_buchung.regionscode,
            v_buchung.region,
            sum(CASE WHEN v_buchung.kostentraeger = 'PROJEKT' THEN v_buchung.leistung ELSE 0 END) AS leistung,
            sum(CASE WHEN v_buchung.kostentraeger = 'PROJEKT' THEN v_buchung.k_var ELSE 0 END) AS variable_kosten,
            sum(CASE WHEN v_buchung.kostentraeger = 'PROJEKT' THEN v_buchung.k_fix ELSE 0 END) AS fixe_projektkosten,
            sum(CASE WHEN v_buchung.kostentraeger = 'PROJEKT' THEN v_buchung.umlage ELSE 0 END) AS verrechnete_gk,
            sum(CASE WHEN v_buchung.kostentraeger = 'BEREICH' THEN v_buchung.k_var + v_buchung.k_fix - v_buchung.leistung ELSE 0 END) AS bereichskosten_ist,
            sum(CASE WHEN v_buchung.kostentraeger = 'BEREICH' THEN v_buchung.umlage ELSE 0 END) AS bereichsentlastung,
            sum(CASE WHEN v_buchung.kostentraeger = 'ZENTRALE' THEN v_buchung.k_var + v_buchung.k_fix - v_buchung.leistung ELSE 0 END) AS unternehmensgemeinkosten,
            sum(CASE WHEN v_buchung.kostentraeger = 'ZENTRALE' THEN v_buchung.umlage ELSE 0 END) AS zentralentlastung,
            sum(v_buchung.neutral) AS neutrales_ergebnis,
            sum(v_buchung.wert) AS saldo_wert,
            count(*) AS belege
           FROM controlling.v_buchung
          WHERE v_buchung.ergebnisrelevant
          GROUP BY v_buchung.jahr, v_buchung.monat, v_buchung.regionscode, v_buchung.region
        )
 SELECT jahr,
    monat,
    regionscode,
    region,
    leistung,
    variable_kosten,
    fixe_projektkosten,
    verrechnete_gk,
    bereichskosten_ist,
    bereichsentlastung,
    unternehmensgemeinkosten,
    zentralentlastung,
    neutrales_ergebnis,
    saldo_wert,
    belege,
    bereichskosten_ist + bereichsentlastung AS bereichs_deckungsdifferenz,
    unternehmensgemeinkosten + zentralentlastung AS zentral_deckungsdifferenz,
    leistung - variable_kosten AS db1,
    leistung - variable_kosten - fixe_projektkosten AS db2,
    leistung - variable_kosten - fixe_projektkosten - verrechnete_gk AS db3,
    leistung - variable_kosten - fixe_projektkosten - verrechnete_gk
      - (bereichskosten_ist + bereichsentlastung)
      - (unternehmensgemeinkosten + zentralentlastung) AS db4
   FROM basis b;

-- Auftraege nachziehen, die schon bebucht sind. Die Region steckt in der
-- Nummer, genau wie bei den vorhandenen Auftraegen: 410215 West, 410230
-- Sued-West, 410250 Verwaltung, 410260 Ost, 410265 Berlin.
INSERT INTO controlling.projekte
    (projekt_nr, projektname, projektart, status, auftragstyp, regionscode, region)
SELECT q.auftrag,
       COALESCE(NULLIF(btrim(q.name), ''), q.auftrag),
       'SONSTIGES',
       'AKTIV',
       CASE WHEN q.auftrag LIKE 'P%' THEN 'PROJEKT' ELSE 'INNENAUFTRAG' END,
       CASE substring(q.auftrag FROM 2 FOR 6)
         WHEN '410215' THEN '15'
         WHEN '410230' THEN '30'
         WHEN '410250' THEN '50'
         WHEN '410260' THEN '60'
         WHEN '410265' THEN '65'
       END,
       CASE substring(q.auftrag FROM 2 FOR 6)
         WHEN '410215' THEN 'West'
         WHEN '410230' THEN 'Süd-West'
         WHEN '410250' THEN 'Verwaltung'
         WHEN '410260' THEN 'Ost'
         WHEN '410265' THEN 'Berlin'
       END
  FROM (
        SELECT b.auftrag, max(b.objektbezeichnung) AS name
          FROM controlling.buchungen b
         WHERE b.gueltig
           AND b.auftrag IS NOT NULL
           AND btrim(b.auftrag) <> ''
           AND NOT EXISTS (
                 SELECT 1 FROM controlling.projekte p WHERE p.projekt_nr = b.auftrag)
         GROUP BY b.auftrag
       ) q
 WHERE substring(q.auftrag FROM 2 FOR 6) IN
       ('410215', '410230', '410250', '410260', '410265');

UPDATE controlling.buchungen b
   SET projekt_id = p.projekt_id
  FROM controlling.projekte p
 WHERE b.projekt_id IS NULL
   AND b.auftrag = p.projekt_nr;

-- Abgeschlossene Monate im Liquiditaetsmodell folgen den Buchungen.
-- Der August trug noch die runden Werte des Rolling Forecast, obwohl er
-- freigegeben ist.
UPDATE controlling.liq_monat l
   SET umsatz = g.umsatz,
       bestandsaenderung = g.ba
  FROM (
        SELECT jahr,
               monat,
               COALESCE(-sum(wert) FILTER (WHERE kategorie = 'umsatzerloese'), 0) AS umsatz,
               COALESCE(-sum(wert) FILTER (WHERE kategorie = 'leistung_unfertig'), 0) AS ba
          FROM controlling.v_guv_ist
         GROUP BY jahr, monat
       ) g
 WHERE l.jahr = g.jahr
   AND l.monat = g.monat
   AND l.ist
   AND l.monat <= controlling.f_letzter_belastbarer_monat(l.jahr)
   AND (abs(l.umsatz - g.umsatz) > 1 OR abs(l.bestandsaenderung - g.ba) > 1);

REFRESH MATERIALIZED VIEW controlling.mv_ebitda_region_monat;
