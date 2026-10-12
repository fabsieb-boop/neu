/* ---------------------------------------------------------------------------
   Die Bruecke zum Jahresergebnis liest dasselbe EBITDA wie alle anderen
   ---------------------------------------------------------------------------
   v_forecast_bruecke holte den Forecast aus liq_monat.ebitda - einem
   dritten Ort, an dem dieselbe Reihe stand.  Sie zeigte deshalb 331.000,
   waehrend v_ebitda_monat nach der Uebernahme aus dem Rolling Forecast auf
   330.214 kommt.  Es gibt nur ein EBITDA; ab hier auch hier.

   Die Abschreibungen kamen ueber den Nummernkreis '48%'.  Auch das
   entscheidet jetzt die SAP-Position (00307), damit die Bruecke dieselbe
   Grenze zieht wie die Ergebnisstaffel daneben.
--------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW controlling.v_forecast_bruecke AS
/* MATERIALIZED, sonst zieht der Planer den Funktionsaufruf in jede Zeile
   von v_guv_ist - aus 22 Millisekunden werden so ueber zwanzig Sekunden. */
WITH grenze AS MATERIALIZED (
  SELECT controlling.f_letzter_belastbarer_monat(2026::smallint) AS bis
), ist AS MATERIALIZED (
  SELECT sum(g.wert)                                            AS ergebnis,
         sum(g.wert) FILTER (WHERE p.position LIKE '00307%')    AS afa,
         sum(g.wert) FILTER (WHERE p.position LIKE '0040%')     AS finanz,
         count(DISTINCT g.monat)                                AS monate
    FROM controlling.v_guv_ist g
    LEFT JOIN controlling.bilanz_guv_konto p ON p.konto = g.konto
   CROSS JOIN grenze
   WHERE g.jahr = 2026 AND g.monat <= grenze.bis
), fc AS MATERIALIZED (
  SELECT sum(ebitda) AS ebitda_rest, count(*) AS monate
    FROM controlling.v_ebitda_monat
   WHERE jahr = 2026 AND art = 'FC'
)
SELECT 1 AS sort,
       'Ergebnis Ist Januar bis Juli'::text                       AS position,
       'SAP-Einzelposten, gegen den Abschluss geprüft'::text      AS quelle,
       round(ist.ergebnis, 2)                                     AS wert
  FROM ist
UNION ALL
SELECT 2, 'EBITDA August bis Dezember',
       'Rolling Forecast'::text,
       round(-fc.ebitda_rest, 2) FROM fc
UNION ALL
SELECT 3, 'Abschreibungen August bis Dezember',
       'Fortschreibung der Ist-Monatsrate Januar bis Juli'::text,
       round(ist.afa / ist.monate * (SELECT monate FROM fc), 2) FROM ist
UNION ALL
SELECT 4, 'Finanzergebnis August bis Dezember',
       'Fortschreibung der Ist-Monatsrate Januar bis Juli'::text,
       round(ist.finanz / ist.monate * (SELECT monate FROM fc), 2) FROM ist
ORDER BY 1;
