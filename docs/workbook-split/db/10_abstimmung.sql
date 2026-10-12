-- =====================================================================
-- 10 · Abstimmung GuV / Bilanz gegen den SAP-Abschluss
--
-- Anlass: Der Abgleich mit guv.XLSX und bilNZ.XLSX (Periode 8/2026) hat
-- drei Fehler in der bisherigen Ergebnisabgrenzung aufgedeckt:
--
--   1. Sekundäre Kostenarten (7xxxxx: Lohn-, Geräte-, Gemeinkosten-
--      verrechnung) wurden als ergebnisrelevant gezählt. Sie existieren
--      nur im CO, nicht in der Finanzbuchhaltung, und heben sich über
--      Soll und Haben auf. Der Belegkreisfilter nahm nur die Sollseite
--      mit -> 1.583.586 EUR zu viel im Ergebnis.
--   2. Bilanzkonten wurden mitgezählt -> 62.407 EUR zu viel.
--   3. Die Tabelle buchungen endet am 31.07.; verglichen wurde aber
--      gegen einen Abschluss per 31.08.
--
-- Verbindliche Ergebnisquelle ist ab hier sap_einzelposten. Diese
-- Tabelle stimmt auf allen 119 GuV-Konten auf den Cent mit dem
-- offiziellen Abschluss ueberein (nachgewiesen ueber v_abstimmung_guv).
-- =====================================================================

SET search_path = controlling, public;

-- ---------------------------------------------------------------------
-- Welche Kategorien des Kontenkatalogs bilden die GuV?
-- 'neutral' gehoert dazu: periodenfremde Aufwendungen und Ertraege,
-- Anlagenabgaenge und Rueckstellungsaufloesungen fuehrt auch der
-- offizielle Abschluss in der GuV.
-- ---------------------------------------------------------------------
-- Kontonummern normieren: rein numerische Konten auf sechs Stellen
-- auffuellen, F-Konten (IFRS) unveraendert lassen. lpad() allein wuerde
-- 'F049951' auf 'F04995' abschneiden.
CREATE OR REPLACE FUNCTION controlling.f_konto_norm(konto text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN konto ~ '^[0-9]+$' THEN lpad(konto, 6, '0') ELSE upper(trim(konto)) END
$$;

CREATE OR REPLACE FUNCTION controlling.f_ist_guv_konto(kategorie text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT kategorie IN ('umsatzerloese','leistung_unfertig','leistung_fertig',
                       'sonstige_ertraege','betriebsaufwand','finanzergebnis',
                       'steuern_sonstige','neutral')
$$;

-- ---------------------------------------------------------------------
-- Sekundaere Kostenarten erkennen: im SAP-Kontenplan der TVF beginnen
-- sie mit 7 und sind sechs- bis siebenstellig. Sie tauchen im
-- Kontenkatalog gar nicht auf, weil es sie in FI nicht gibt.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION controlling.f_ist_sekundaer(konto text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT konto ~ '^7[0-9]{5,6}'
$$;

-- ---------------------------------------------------------------------
-- GuV aus den Einzelposten – die belastbare Fassung
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_guv_ist AS
SELECT controlling.f_konto_norm(e.kostenart)     AS konto,
       k.name                                   AS kontobezeichnung,
       k.kategorie,
       k.kategorie_text,
       EXTRACT(YEAR  FROM e.buchungsdatum)::int AS jahr,
       EXTRACT(MONTH FROM e.buchungsdatum)::int AS monat,
       sum(e.wert_signed)                       AS wert,
       count(*)                                 AS belege
  FROM controlling.sap_einzelposten e
  JOIN controlling.kontenkatalog_tvf k
    ON controlling.f_konto_norm(k.konto) = controlling.f_konto_norm(e.kostenart)
 WHERE controlling.f_ist_guv_konto(k.kategorie)
   AND e.buchungsdatum IS NOT NULL
 GROUP BY 1,2,3,4,5,6;

COMMENT ON VIEW controlling.v_guv_ist IS
  'Ist-GuV aus den SAP-Einzelposten. Vorzeichen: Aufwand positiv, Ertrag negativ. '
  'Summe positiv = Verlust.';

-- ---------------------------------------------------------------------
-- Abstimmung Konto fuer Konto gegen den geladenen Abschluss
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_abstimmung_guv AS
WITH abschluss AS (
  -- nur die Konten, die auch zur GuV gehoeren; Bilanzkonten stehen in v_bilanz
  -- Immer der juengste eingelesene Abschluss, nicht eine feste Periode:
  -- sonst vergleicht das System nach dem naechsten Auszug gegen einen
  -- veralteten Stand.
  SELECT controlling.f_konto_norm(a.konto) AS konto, a.text, a.berichtsperiode AS wert
    FROM controlling.abschluss_konto a
    JOIN controlling.kontenkatalog_tvf k
      ON controlling.f_konto_norm(k.konto) = controlling.f_konto_norm(a.konto)
   WHERE a.quelle = 'BILANZ' AND a.jahr = 2026
     AND a.periode = (SELECT max(periode) FROM controlling.abschluss_konto
                       WHERE quelle = 'BILANZ' AND jahr = 2026)
     AND controlling.f_ist_guv_konto(k.kategorie)
), ist AS (
  SELECT konto, max(kontobezeichnung) AS name, max(kategorie) AS kategorie,
         sum(wert) AS wert
    FROM controlling.v_guv_ist WHERE jahr = 2026 GROUP BY 1
)
SELECT COALESCE(i.konto, a.konto)                       AS konto,
       COALESCE(i.name, a.text)                         AS bezeichnung,
       i.kategorie,
       round(COALESCE(a.wert, 0), 2)                    AS abschluss,
       round(COALESCE(i.wert, 0), 2)                    AS einzelposten,
       round(COALESCE(i.wert,0) - COALESCE(a.wert,0),2) AS differenz
  FROM ist i FULL JOIN abschluss a ON a.konto = i.konto
 WHERE i.konto IS NOT NULL OR a.konto IS NOT NULL;

-- ---------------------------------------------------------------------
-- Bilanz aus dem Abschluss, mit der 2026er Bewegung daneben
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_bilanz AS
WITH bewegung AS (
  SELECT controlling.f_konto_norm(kostenart) AS konto, sum(wert_signed) AS bewegung
    FROM controlling.sap_einzelposten
   WHERE EXTRACT(YEAR FROM buchungsdatum) = 2026 GROUP BY 1
)
SELECT controlling.f_konto_norm(a.konto)         AS konto,
       a.text                                    AS bezeichnung,
       k.kategorie,
       k.bilanz_seite,
       round(a.berichtsperiode, 2)               AS bestand,
       round(COALESCE(b.bewegung, 0), 2)         AS bewegung_2026,
       round(a.berichtsperiode - COALESCE(b.bewegung, 0), 2) AS eroeffnungsbilanz
  FROM controlling.abschluss_konto a
  LEFT JOIN controlling.kontenkatalog_tvf k
         ON controlling.f_konto_norm(k.konto) = controlling.f_konto_norm(a.konto)
  LEFT JOIN bewegung b ON b.konto = controlling.f_konto_norm(a.konto)
 WHERE a.quelle = 'BILANZ' AND a.jahr = 2026
   AND a.periode = (SELECT max(periode) FROM controlling.abschluss_konto
                     WHERE quelle = 'BILANZ' AND jahr = 2026)
   AND NOT controlling.f_ist_guv_konto(COALESCE(k.kategorie, ''));

COMMENT ON VIEW controlling.v_bilanz IS
  'Bestand laut Abschluss, daneben die Bewegung des laufenden Jahres. '
  'Die Differenz ist der Eroeffnungsbilanzwert – die Einzelposten beginnen am 01.01.';
