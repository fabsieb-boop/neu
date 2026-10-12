-- Forecast-Brücke: Zeitraum aus der Belastbarkeitsgrenze, nicht aus einem festen Monat.
-- Ist läuft bis zum letzten belastbaren Monat. Der Forecast beginnt im Folgemonat.
-- AfA und Finanzergebnis sind die Ist-Monatsrate mal die Anzahl der Forecast-Monate.

CREATE OR REPLACE VIEW controlling.v_forecast_bruecke AS
WITH jahr AS (
  SELECT COALESCE(
           (SELECT max(jahr) FROM controlling.v_kennzahlen_monat),
           (SELECT max(jahr) FROM controlling.v_ebitda_monat)
         ) AS j
),
grenze AS MATERIALIZED (
  SELECT j AS jahr, controlling.f_letzter_belastbarer_monat(j) AS bis
    FROM jahr
   WHERE j IS NOT NULL
),
ist AS MATERIALIZED (
  SELECT sum(g.wert) AS ergebnis,
         sum(g.wert) FILTER (WHERE p.position::text LIKE '00307%') AS afa,
         sum(g.wert) FILTER (WHERE p.position::text LIKE '0040%') AS finanz,
         count(DISTINCT g.monat) AS monate
    FROM controlling.v_guv_ist g
    LEFT JOIN controlling.bilanz_guv_konto p ON p.konto::text = g.konto
    CROSS JOIN grenze
   WHERE g.jahr = grenze.jahr
     AND g.monat <= grenze.bis
),
fc AS MATERIALIZED (
  SELECT sum(e.ebitda) AS ebitda_rest,
         count(*) AS monate,
         min(e.monat) AS von
    FROM controlling.v_ebitda_monat e
    CROSS JOIN grenze
   WHERE e.jahr = grenze.jahr
     AND e.art = 'FC'
)
SELECT 1 AS sort,
       ('Ergebnis Ist Januar bis ' || controlling.monat_name(grenze.bis)) AS position,
       'SAP-Einzelposten, gegen den Abschluss geprüft'::text AS quelle,
       round(ist.ergebnis, 2) AS wert
  FROM ist
  CROSS JOIN grenze
UNION ALL
SELECT 2 AS sort,
       CASE
         WHEN fc.monate > 0 THEN 'EBITDA ' || controlling.monat_name(fc.von) || ' bis Dezember'
         ELSE 'EBITDA Forecast'
       END AS position,
       'Rolling Forecast'::text AS quelle,
       round(-COALESCE(fc.ebitda_rest, 0), 2) AS wert
  FROM fc
UNION ALL
SELECT 3 AS sort,
       CASE
         WHEN fc.monate > 0 THEN 'Abschreibungen ' || controlling.monat_name(fc.von) || ' bis Dezember'
         ELSE 'Abschreibungen Forecast'
       END AS position,
       ('Fortschreibung der Ist-Monatsrate Januar bis ' || controlling.monat_name(grenze.bis)) AS quelle,
       round(ist.afa / NULLIF(ist.monate, 0) * fc.monate, 2) AS wert
  FROM ist
  CROSS JOIN fc
  CROSS JOIN grenze
UNION ALL
SELECT 4 AS sort,
       CASE
         WHEN fc.monate > 0 THEN 'Finanzergebnis ' || controlling.monat_name(fc.von) || ' bis Dezember'
         ELSE 'Finanzergebnis Forecast'
       END AS position,
       ('Fortschreibung der Ist-Monatsrate Januar bis ' || controlling.monat_name(grenze.bis)) AS quelle,
       round(ist.finanz / NULLIF(ist.monate, 0) * fc.monate, 2) AS wert
  FROM ist
  CROSS JOIN fc
  CROSS JOIN grenze
 ORDER BY 1;
