-- Eine Quelle für das Jahres-EBITDA.
-- Die Firmenzahl steht in v_ebitda_monat und v_ebitda_jahr (Reihe plus offene
-- Bewertung, die weder gebucht noch im Forecast steckt). Diese Sicht verteilt
-- dieselbe Zahl auf die Regionen. Sie rechnet das EBITDA nicht ein zweites Mal.
-- Im Forecast fehlt den Regionen der Overhead und die Bewertung. Die Differenz
-- zur Firmenzahl liegt bei der Verwaltung, ohne Umsatz und ohne Gesamtleistung.

CREATE OR REPLACE VIEW controlling.v_region_jahr AS
WITH basis AS (
  SELECT r.jahr,
         r.region,
         r.monat,
         CASE
           WHEN r.monat <= controlling.f_letzter_belastbarer_monat(r.jahr) THEN 'IST'::text
           ELSE 'FC'::text
         END AS art,
         r.umsatzerloese AS umsatz,
         r.gesamtleistung,
         r.ebitda
    FROM controlling.v_ebitda_region_monat r
   WHERE r.monat <= controlling.f_letzter_belastbarer_monat(r.jahr)
  UNION ALL
  SELECT f.jahr,
         f.region::text AS region,
         f.monat,
         'FC'::text AS art,
         abs(COALESCE(f.umsatz_plan, 0::numeric)) AS umsatz,
         abs(COALESCE(f.umsatz_plan, 0::numeric)) + COALESCE(f.ba_plan, 0::numeric) AS gesamtleistung,
         abs(COALESCE(f.umsatz_plan, 0::numeric))
           - abs(COALESCE(f.kosten_plan, 0::numeric))
           + COALESCE(f.ba_plan, 0::numeric) AS ebitda
    FROM controlling.v_forecast_monat f
   WHERE f.monat > controlling.f_letzter_belastbarer_monat(f.jahr)
),
monate AS (
  SELECT jahr, monat FROM basis
  UNION
  SELECT jahr::integer, monat::integer FROM controlling.v_ebitda_monat
),
summe AS (
  SELECT jahr, monat, sum(ebitda) AS ebitda
    FROM basis
   GROUP BY jahr, monat
),
ausgleich AS (
  SELECT m.jahr,
         m.monat,
         COALESCE(e.art, CASE
           WHEN m.monat <= controlling.f_letzter_belastbarer_monat(m.jahr) THEN 'IST'::text
           ELSE 'FC'::text
         END) AS art,
         COALESCE(e.ebitda, 0) - COALESCE(s.ebitda, 0) AS ebitda
    FROM monate m
    LEFT JOIN controlling.v_ebitda_monat e
      ON e.jahr = m.jahr AND e.monat = m.monat
    LEFT JOIN summe s
      ON s.jahr = m.jahr AND s.monat = m.monat
)
SELECT jahr, region, monat, art, umsatz, gesamtleistung, ebitda
  FROM basis
UNION ALL
SELECT a.jahr,
       'Verwaltung'::text,
       a.monat,
       a.art,
       0::numeric,
       0::numeric,
       a.ebitda
  FROM ausgleich a
 WHERE a.ebitda <> 0
UNION ALL
SELECT j.jahr::integer,
       'Verwaltung'::text,
       12,
       'FC'::text,
       0::numeric,
       0::numeric,
       j.bewertung_offen
  FROM controlling.v_ebitda_jahr j
 WHERE j.bewertung_offen <> 0;
