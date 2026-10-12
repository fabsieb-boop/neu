-- =====================================================================
-- 11 · 12-Monats-Forecast der Regionalleiter
--
-- Quelle: 12-Monats-Forecast_Import_<Region>_<Datum>.xlsx
-- Aufbau je Auftrag zwei Zeilen (PLAN / IST) mal zwoelf Monate,
-- getrennt nach Umsatz und Kosten. Vorzeichen wie in SAP:
-- Umsatz negativ (Haben), Kosten positiv (Soll).
-- =====================================================================

SET search_path = controlling, public;

CREATE TABLE IF NOT EXISTS controlling.forecast_position (
  jahr          smallint       NOT NULL,
  region        varchar(30)    NOT NULL,
  auftrag       varchar(40)    NOT NULL,
  auftragname   varchar(255),
  groesse       varchar(10)    NOT NULL CHECK (groesse IN ('umsatz','kosten')),
  art           varchar(10)    NOT NULL CHECK (art IN ('plan','ist')),
  monat         smallint       NOT NULL CHECK (monat BETWEEN 1 AND 12),
  wert          numeric(18,2)  NOT NULL DEFAULT 0,
  quelle_datei  varchar(160),
  stand         date,
  PRIMARY KEY (jahr, region, auftrag, groesse, art, monat)
);

CREATE INDEX IF NOT EXISTS forecast_position_auftrag_idx
  ON controlling.forecast_position (auftrag);

-- ---------------------------------------------------------------------
-- Der Forecast je Monat und Region: Plan der Regionalleiter, deren
-- gemeldetes Ist, und daneben das Ist aus SAP. Die dritte Spalte ist
-- die eigentliche Kontrolle – meldet die Region dasselbe wie das System?
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_forecast_monat AS
WITH plan AS (
  SELECT jahr, region, monat,
         sum(wert) FILTER (WHERE groesse='umsatz' AND art='plan') AS umsatz_plan,
         sum(wert) FILTER (WHERE groesse='kosten' AND art='plan') AS kosten_plan,
         sum(wert) FILTER (WHERE groesse='umsatz' AND art='ist')  AS umsatz_gemeldet,
         sum(wert) FILTER (WHERE groesse='kosten' AND art='ist')  AS kosten_gemeldet
    FROM controlling.forecast_position GROUP BY 1,2,3
), sap AS (
  SELECT EXTRACT(YEAR  FROM e.buchungsdatum)::int AS jahr,
         controlling.f_region(substr(e.auftrag, 6, 2)) AS region,
         EXTRACT(MONTH FROM e.buchungsdatum)::int AS monat,
         sum(e.wert_signed) FILTER (WHERE k.kategorie IN ('umsatzerloese','leistung_unfertig',
                                                          'leistung_fertig','sonstige_ertraege')) AS umsatz_sap,
         sum(e.wert_signed) FILTER (WHERE k.kategorie = 'betriebsaufwand') AS kosten_sap
    FROM controlling.sap_einzelposten e
    JOIN controlling.kontenkatalog_tvf k
      ON controlling.f_konto_norm(k.konto) = controlling.f_konto_norm(e.kostenart)
   WHERE e.auftrag IS NOT NULL AND e.buchungsdatum IS NOT NULL
   GROUP BY 1,2,3
)
SELECT COALESCE(p.jahr, s.jahr)     AS jahr,
       COALESCE(p.region, s.region) AS region,
       COALESCE(p.monat, s.monat)   AS monat,
       COALESCE(p.umsatz_plan, 0)      AS umsatz_plan,
       COALESCE(p.kosten_plan, 0)      AS kosten_plan,
       COALESCE(p.umsatz_gemeldet, 0)  AS umsatz_gemeldet,
       COALESCE(p.kosten_gemeldet, 0)  AS kosten_gemeldet,
       COALESCE(s.umsatz_sap, 0)       AS umsatz_sap,
       COALESCE(s.kosten_sap, 0)       AS kosten_sap,
       -- Deckungsbeitrag: Umsatz ist negativ, deshalb Kosten addieren
       -(COALESCE(p.umsatz_plan,0) + COALESCE(p.kosten_plan,0))       AS db_plan,
       -(COALESCE(s.umsatz_sap,0)  + COALESCE(s.kosten_sap,0))        AS db_sap,
       COALESCE(p.umsatz_gemeldet,0) - COALESCE(s.umsatz_sap,0)       AS umsatz_meldediff,
       COALESCE(p.kosten_gemeldet,0) - COALESCE(s.kosten_sap,0)       AS kosten_meldediff
  FROM plan p FULL JOIN sap s
    ON s.jahr = p.jahr AND s.region = p.region AND s.monat = p.monat;

-- ---------------------------------------------------------------------
-- Jahressicht je Auftrag: Plan gegen SAP-Ist, mit Restplan
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_forecast_auftrag AS
WITH letzter_ist AS (
  SELECT max(EXTRACT(MONTH FROM buchungsdatum))::int AS monat
    FROM controlling.sap_einzelposten
   WHERE EXTRACT(YEAR FROM buchungsdatum) = 2026
), p AS (
  SELECT auftrag, max(auftragname) AS auftragname, max(region) AS region, jahr,
         sum(wert) FILTER (WHERE groesse='umsatz' AND art='plan') AS umsatz_plan,
         sum(wert) FILTER (WHERE groesse='kosten' AND art='plan') AS kosten_plan,
         sum(wert) FILTER (WHERE groesse='umsatz' AND art='plan'
                             AND monat > (SELECT monat FROM letzter_ist)) AS umsatz_restplan,
         sum(wert) FILTER (WHERE groesse='kosten' AND art='plan'
                             AND monat > (SELECT monat FROM letzter_ist)) AS kosten_restplan
    FROM controlling.forecast_position GROUP BY auftrag, jahr
), s AS (
  SELECT e.auftrag,
         sum(e.wert_signed) FILTER (WHERE k.kategorie IN ('umsatzerloese','leistung_unfertig',
                                    'leistung_fertig','sonstige_ertraege')) AS umsatz_sap,
         sum(e.wert_signed) FILTER (WHERE k.kategorie='betriebsaufwand')     AS kosten_sap
    FROM controlling.sap_einzelposten e
    JOIN controlling.kontenkatalog_tvf k
      ON controlling.f_konto_norm(k.konto) = controlling.f_konto_norm(e.kostenart)
   WHERE EXTRACT(YEAR FROM e.buchungsdatum) = 2026
   GROUP BY 1
)
SELECT COALESCE(p.auftrag, s.auftrag) AS auftrag,
       p.auftragname, p.region,
       COALESCE(p.umsatz_plan,0)    AS umsatz_plan,
       COALESCE(p.kosten_plan,0)    AS kosten_plan,
       COALESCE(s.umsatz_sap,0)     AS umsatz_ist,
       COALESCE(s.kosten_sap,0)     AS kosten_ist,
       COALESCE(p.umsatz_restplan,0) AS umsatz_restplan,
       COALESCE(p.kosten_restplan,0) AS kosten_restplan,
       -- Erwartung Jahresende: Ist bis heute plus Restplan
       COALESCE(s.umsatz_sap,0) + COALESCE(p.umsatz_restplan,0) AS umsatz_erwartet,
       COALESCE(s.kosten_sap,0) + COALESCE(p.kosten_restplan,0) AS kosten_erwartet
  FROM p FULL JOIN s ON s.auftrag = p.auftrag;

-- ---------------------------------------------------------------------
-- Jahresforecast 2026 – die Bruecke vom Ist zum Jahresergebnis
--
-- Grundsatz: fuer jeden Monat die belastbarste Quelle.
--
--   Jan–Jul  SAP-Einzelposten. Gegen guv.XLSX/bilNZ.XLSX auf den Cent
--            abgestimmt (v_abstimmung_guv, Differenz 0).
--   Aug–Dez  Rolling Forecast. Der SAP-August ist nur zu 39 % gefuellt
--            (986 statt rund 2.542 Zeilen) und daher unbrauchbar; der
--            12-Monats-Forecast der Regionen wiederum kennt nur
--            Auftraege und laesst die Kostenstellen aus. Der Rolling
--            Forecast ist die einzige Quelle, die beides abdeckt.
--
-- Der Rolling Forecast fuehrt EBITDA. Abschreibungen und Finanz-
-- ergebnis fehlen darin und werden mit der Ist-Monatsrate Jan–Jul
-- fortgeschrieben.
--
-- Vorzeichen durchgehend wie in SAP: Aufwand positiv, Ertrag negativ.
-- Eine positive Summe ist ein Verlust.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_forecast_bruecke AS
WITH ist AS (
  SELECT sum(wert)                                                     AS ergebnis,
         sum(wert) FILTER (WHERE konto LIKE '48%')                     AS afa,
         sum(wert) FILTER (WHERE kategorie = 'finanzergebnis')         AS finanz,
         count(DISTINCT monat)                                         AS monate
    FROM controlling.v_guv_ist WHERE jahr = 2026 AND monat <= 7
), rf AS (
  SELECT sum(ebitda) AS ebitda_rest, count(*) AS monate
    FROM controlling.liq_monat WHERE jahr = 2026 AND monat >= 8
)
SELECT 1 AS sort, 'Ergebnis Ist Januar bis Juli'                AS position,
       'SAP-Einzelposten, gegen den Abschluss geprüft'          AS quelle,
       round(ist.ergebnis, 2)                                   AS wert FROM ist
UNION ALL
SELECT 2, 'EBITDA August bis Dezember', 'Rolling Forecast',
       round(-rf.ebitda_rest, 2) FROM rf
UNION ALL
SELECT 3, 'Abschreibungen August bis Dezember',
       'Fortschreibung der Ist-Monatsrate Januar bis Juli',
       round(ist.afa / ist.monate * (SELECT monate FROM rf), 2) FROM ist
UNION ALL
SELECT 4, 'Finanzergebnis August bis Dezember',
       'Fortschreibung der Ist-Monatsrate Januar bis Juli',
       round(ist.finanz / ist.monate * (SELECT monate FROM rf), 2) FROM ist
ORDER BY 1;

COMMENT ON VIEW controlling.v_forecast_bruecke IS
  'Jahresforecast 2026. Ist bis Juli aus SAP, ab August aus dem Rolling '
  'Forecast. Vorzeichen wie in SAP: positive Summe = Verlust.';

-- ---------------------------------------------------------------------
-- Monatsreihe: je Monat die verwendete Quelle und der Wert
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_forecast_reihe AS
WITH rate AS (
  SELECT (sum(wert) FILTER (WHERE konto LIKE '48%')
        + sum(wert) FILTER (WHERE kategorie = 'finanzergebnis'))
        / NULLIF(count(DISTINCT monat), 0) AS je_monat
    FROM controlling.v_guv_ist WHERE jahr = 2026 AND monat <= 7
), ist AS (
  SELECT monat, sum(wert) AS ergebnis
    FROM controlling.v_guv_ist WHERE jahr = 2026 AND monat <= 7 GROUP BY monat
)
SELECT m.monat,
       CASE WHEN m.monat <= 7 THEN 'SAP-Ist' ELSE 'Rolling Forecast' END AS quelle,
       (m.monat <= 7)                                                    AS ist,
       CASE WHEN m.monat <= 7 THEN round(i.ergebnis, 2)
            ELSE round(-m.ebitda + (SELECT je_monat FROM rate), 2) END   AS ergebnis,
       round(m.umsatz, 2)                                                AS umsatz,
       round(m.bestandsaenderung, 2)                                     AS bestandsaenderung,
       round(m.ebitda, 2)                                                AS ebitda
  FROM controlling.liq_monat m
  LEFT JOIN ist i ON i.monat = m.monat
 WHERE m.jahr = 2026 ORDER BY m.monat;
