-- =====================================================================
-- 16 · Mehrjahresplanung je Region und Konto
--
-- Quelle: Jahresplanung_NL-Kostenstellen_<Jahre>_v*.xlsx, Blatt
-- "Plan je Konto". Dort ist jeder MJP-Kostenblock auf einzelne
-- Sachkonten heruntergebrochen – je Niederlassung, Kostenstelle und
-- Planjahr.
--
-- Damit wird der Plan-Ist-Abgleich auf Kontoebene moeglich: dieselbe
-- Kontonummer, die in v_guv_region das Ist traegt, traegt hier den Plan.
-- =====================================================================

SET search_path = controlling, public;

CREATE TABLE IF NOT EXISTS controlling.plan_konto (
  jahr             smallint      NOT NULL,
  region           varchar(30)   NOT NULL,
  kostenstelle     varchar(20),
  nl_code          varchar(4),
  konto            varchar(20)   NOT NULL,
  kontobezeichnung varchar(160),
  kostenblock      varchar(60),
  guv_position     varchar(80),
  planungsgruppe   varchar(80),
  art              varchar(20),          -- Erloese oder Aufwand
  anteil_im_block  numeric(12,8),
  wert             numeric(18,2) NOT NULL DEFAULT 0,
  quelle_datei     varchar(160),
  stand            date,
  PRIMARY KEY (jahr, region, kostenstelle, konto)
);

CREATE INDEX IF NOT EXISTS plan_konto_konto_idx ON controlling.plan_konto (konto);
CREATE INDEX IF NOT EXISTS plan_konto_jahr_idx  ON controlling.plan_konto (jahr);

-- ---------------------------------------------------------------------
-- Plan-Ist-Abgleich je Region und Konto
--
-- Vorzeichen: der Plan fuehrt Erloese positiv, das Ist folgt SAP und
-- fuehrt sie negativ. Damit beide Seiten vergleichbar sind, wird das
-- Ist hier kaufmaennisch gedreht – Ertrag positiv, Aufwand positiv.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_plan_ist_konto AS
WITH plan AS (
  SELECT jahr, region, controlling.f_konto_norm(konto) AS konto,
         max(kontobezeichnung) AS kontobezeichnung,
         max(kostenblock)      AS kostenblock,
         max(planungsgruppe)   AS planungsgruppe,
         max(art)              AS art,
         sum(wert)             AS plan
    FROM controlling.plan_konto GROUP BY jahr, region, 3
), ist AS (
  SELECT jahr, region, konto,
         max(kontobezeichnung) AS kontobezeichnung,
         max(kategorie_text)   AS kategorie_text,
         max(kategorie)        AS kategorie,
         -- Erloese im Ist negativ -> kaufmaennisch drehen, Aufwand bleibt
         sum(CASE WHEN kategorie IN ('umsatzerloese','leistung_unfertig',
                                     'leistung_fertig','sonstige_ertraege')
                  THEN -wert ELSE wert END) AS ist
    FROM controlling.v_guv_region GROUP BY jahr, region, konto
)
SELECT COALESCE(p.jahr, i.jahr)                       AS jahr,
       COALESCE(p.region, i.region)                   AS region,
       COALESCE(p.konto, i.konto)                     AS konto,
       COALESCE(p.kontobezeichnung, i.kontobezeichnung) AS kontobezeichnung,
       COALESCE(p.art, CASE WHEN i.kategorie IN ('umsatzerloese','leistung_unfertig',
                                                 'leistung_fertig','sonstige_ertraege')
                            THEN 'Erlöse' ELSE 'Aufwand' END) AS art,
       p.kostenblock,
       COALESCE(p.planungsgruppe, i.kategorie_text)   AS gruppe,
       round(COALESCE(p.plan, 0), 2)                  AS plan,
       round(COALESCE(i.ist, 0), 2)                   AS ist,
       round(COALESCE(i.ist, 0) - COALESCE(p.plan, 0), 2) AS abweichung,
       CASE WHEN COALESCE(p.plan, 0) <> 0
            THEN round((COALESCE(i.ist, 0) / p.plan - 1) * 100, 1) END AS abweichung_prozent
  FROM plan p FULL JOIN ist i
    ON i.jahr = p.jahr AND i.region = p.region AND i.konto = p.konto;

-- ---------------------------------------------------------------------
-- Verdichtung auf die Planungsgruppen je Region und Jahr
-- ---------------------------------------------------------------------
-- COALESCE ist hier keine Kosmetik: die Verwaltung hat ueberhaupt keine
-- Erloese. Ohne COALESCE wird ihr Ergebnis NULL, faellt aus der Summe und
-- ihre 1,36 Mio. Kosten verschwinden – die Konzernsumme stand dadurch bei
-- 2,35 statt 0,99 Mio.
CREATE OR REPLACE VIEW controlling.v_plan_region AS
SELECT jahr, region,
       COALESCE(sum(wert) FILTER (WHERE art = 'Erlöse'),  0) AS ertrag,
       COALESCE(sum(wert) FILTER (WHERE art = 'Aufwand'), 0) AS aufwand,
       COALESCE(sum(wert) FILTER (WHERE art = 'Erlöse'),  0)
     - COALESCE(sum(wert) FILTER (WHERE art = 'Aufwand'), 0) AS ergebnis,
       count(DISTINCT konto)                                 AS konten
  FROM controlling.plan_konto
 GROUP BY jahr, region;

COMMENT ON TABLE controlling.plan_konto IS
  'Mehrjahresplanung je Region und Sachkonto aus der Jahresplanungsmappe. '
  'Vorzeichen kaufmaennisch: Ertrag und Aufwand beide positiv, unterschieden '
  'ueber die Spalte art.';
