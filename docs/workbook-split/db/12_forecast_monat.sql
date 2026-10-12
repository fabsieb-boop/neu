-- Forecast und Bestandsänderung, Monat für Monat aus den Daten.
-- Ist-Monate: Kennzahlen aus den Buchungen.
-- Folgemonate: forecast_position (Umsatz und Kosten als Betrag, Bestandsänderung mit Vorzeichen).
-- Operatives Ergebnis = Umsatz − Kosten + Bestandsänderung.
-- Gesamtleistung = Umsatz + Bestandsänderung.

CREATE OR REPLACE VIEW controlling.v_forecast_reihe AS
WITH jahre AS (
  SELECT DISTINCT jahr FROM controlling.liq_monat
  UNION
  SELECT DISTINCT jahr FROM controlling.forecast_position
),
monate AS (
  SELECT j.jahr, gs.monat
    FROM jahre j
    CROSS JOIN generate_series(1, 12) AS gs(monat)
),
grenze AS (
  SELECT jahr, controlling.f_letzter_belastbarer_monat(jahr) AS bis
    FROM jahre
),
rate AS (
  SELECT g.jahr,
         (COALESCE(sum(v.wert) FILTER (WHERE v.konto LIKE '48%'), 0)
          + COALESCE(sum(v.wert) FILTER (WHERE v.kategorie::text = 'finanzergebnis'), 0))
         / NULLIF(count(DISTINCT v.monat), 0) AS je_monat
    FROM grenze g
    JOIN controlling.v_guv_ist v ON v.jahr = g.jahr AND v.monat <= g.bis
   GROUP BY g.jahr
),
ist_erg AS (
  SELECT jahr, monat, sum(wert) AS ergebnis
    FROM controlling.v_guv_ist
   GROUP BY jahr, monat
),
fc AS (
  SELECT jahr,
         monat::integer AS monat,
         COALESCE(sum(abs(wert)) FILTER (WHERE groesse = 'umsatz'), 0) AS umsatz,
         COALESCE(sum(abs(wert)) FILTER (WHERE groesse = 'kosten'), 0) AS kosten,
         COALESCE(sum(wert) FILTER (WHERE groesse = 'ba'), 0) AS ba
    FROM controlling.forecast_position
   WHERE art = 'plan'
   GROUP BY jahr, monat
)
SELECT m.monat::smallint AS monat,
       CASE
         WHEN m.monat <= g.bis AND k.monat IS NOT NULL THEN 'SAP-Ist'
         WHEN f.monat IS NOT NULL THEN 'Rolling Forecast'
         ELSE 'Plan'
       END AS quelle,
       (m.monat <= g.bis AND k.monat IS NOT NULL) AS ist,
       CASE
         WHEN m.monat <= g.bis AND k.monat IS NOT NULL THEN round(ie.ergebnis, 2)
         WHEN f.monat IS NOT NULL THEN round(-(f.umsatz - f.kosten + f.ba) + COALESCE(rt.je_monat, 0), 2)
         ELSE round(-COALESCE(l.ebitda, 0) + COALESCE(rt.je_monat, 0), 2)
       END AS ergebnis,
       round(CASE
         WHEN m.monat <= g.bis AND k.monat IS NOT NULL THEN k.umsatzerloese
         WHEN f.monat IS NOT NULL THEN f.umsatz
         ELSE COALESCE(l.umsatz, 0)
       END, 2) AS umsatz,
       round(CASE
         WHEN m.monat <= g.bis AND k.monat IS NOT NULL THEN k.bestandsveraenderung
         WHEN f.monat IS NOT NULL THEN f.ba
         ELSE COALESCE(l.bestandsaenderung, 0)
       END, 2) AS bestandsaenderung,
       round(CASE
         WHEN m.monat <= g.bis AND k.monat IS NOT NULL THEN k.ebitda
         WHEN f.monat IS NOT NULL THEN f.umsatz - f.kosten + f.ba
         ELSE COALESCE(l.ebitda, 0)
       END, 2) AS ebitda,
       m.jahr
  FROM monate m
  JOIN grenze g ON g.jahr = m.jahr
  LEFT JOIN controlling.v_kennzahlen_monat k ON k.jahr = m.jahr AND k.monat = m.monat
  LEFT JOIN ist_erg ie ON ie.jahr = m.jahr AND ie.monat = m.monat
  LEFT JOIN fc f ON f.jahr = m.jahr AND f.monat = m.monat AND m.monat > g.bis
  LEFT JOIN rate rt ON rt.jahr = m.jahr
  LEFT JOIN controlling.liq_monat l ON l.jahr = m.jahr AND l.monat = m.monat
 WHERE (m.monat <= g.bis AND k.monat IS NOT NULL)
    OR f.monat IS NOT NULL
    OR l.monat IS NOT NULL;

CREATE OR REPLACE VIEW controlling.v_ebitda_monat AS
WITH grenze AS (
  SELECT DISTINCT ebitda_monat.jahr,
         controlling.f_letzter_belastbarer_monat(ebitda_monat.jahr::integer) AS bis
    FROM controlling.ebitda_monat
),
fc AS (
  SELECT f.jahr,
         f.monat::integer AS monat,
         COALESCE(sum(abs(f.wert)) FILTER (WHERE f.groesse = 'umsatz'), 0)
       - COALESCE(sum(abs(f.wert)) FILTER (WHERE f.groesse = 'kosten'), 0)
       + COALESCE(sum(f.wert) FILTER (WHERE f.groesse = 'ba'), 0) AS operativ
    FROM controlling.forecast_position f
    JOIN grenze g ON g.jahr = f.jahr
   WHERE f.art = 'plan' AND f.monat > g.bis
   GROUP BY f.jahr, f.monat
),
bew AS (
  SELECT verlustbewertung.jahr,
         verlustbewertung.monat,
         sum(verlustbewertung.betrag) AS betrag
    FROM controlling.verlustbewertung
   WHERE verlustbewertung.im_forecast
     AND NOT verlustbewertung.gebucht
     AND NOT verlustbewertung.nachrichtlich
   GROUP BY verlustbewertung.jahr, verlustbewertung.monat
)
SELECT e.jahr,
       e.monat,
       CASE WHEN e.monat <= g.bis THEN 'IST'::text ELSE 'FC'::text END AS art,
       CASE
         WHEN e.monat <= g.bis AND k.ebitda IS NOT NULL THEN k.ebitda - e.overhead
         ELSE COALESCE(fc.operativ, e.operatives_ergebnis)
       END::numeric(18,2) AS operatives_ergebnis,
       e.overhead,
       CASE
         WHEN e.monat <= g.bis THEN 0::numeric
         ELSE COALESCE(b.betrag, 0::numeric)
       END::numeric(18,2) AS bewertung,
       CASE
         WHEN e.monat <= g.bis AND k.ebitda IS NOT NULL THEN k.ebitda
         ELSE COALESCE(fc.operativ, e.operatives_ergebnis) + e.overhead + COALESCE(b.betrag, 0::numeric)
       END::numeric(18,2) AS ebitda,
       (e.monat <= g.bis AND k.ebitda IS NOT NULL) AS gerechnet
  FROM controlling.ebitda_monat e
  JOIN grenze g ON g.jahr = e.jahr
  LEFT JOIN controlling.v_kennzahlen_monat k ON k.jahr = e.jahr AND k.monat = e.monat
  LEFT JOIN fc ON fc.jahr = e.jahr AND fc.monat = e.monat
  LEFT JOIN bew b ON b.jahr = e.jahr AND b.monat = e.monat;

CREATE OR REPLACE VIEW controlling.v_plan_ist_monat AS
SELECT p.jahr,
       p.monat,
       CASE
         WHEN p.monat <= controlling.f_letzter_belastbarer_monat(p.jahr) THEN 'IST'::text
         ELSE 'FC'::text
       END AS art,
       p.gesamtleistung AS gl_plan,
       COALESCE(r.umsatz, 0) + COALESCE(r.bestandsaenderung, 0) AS gl_ist,
       COALESCE(r.umsatz, 0) + COALESCE(r.bestandsaenderung, 0) - p.gesamtleistung AS gl_delta,
       p.ebitda AS ebitda_plan,
       COALESCE(e.ebitda, 0) AS ebitda_ist,
       COALESCE(e.ebitda, 0) - p.ebitda AS ebitda_delta
  FROM controlling.plan_monat p
  LEFT JOIN controlling.v_forecast_reihe r ON r.jahr = p.jahr AND r.monat = p.monat
  LEFT JOIN controlling.v_ebitda_monat e ON e.jahr = p.jahr AND e.monat = p.monat;

-- Regionsvergleich: Bestandsänderung bleibt eine eigene Größe und geht in den DB.
CREATE OR REPLACE VIEW controlling.v_forecast_monat AS
WITH plan AS (
  SELECT forecast_position.jahr,
         forecast_position.region,
         forecast_position.monat,
         sum(forecast_position.wert) FILTER (WHERE forecast_position.groesse = 'umsatz' AND forecast_position.art = 'plan') AS umsatz_plan,
         sum(forecast_position.wert) FILTER (WHERE forecast_position.groesse = 'kosten' AND forecast_position.art = 'plan') AS kosten_plan,
         sum(forecast_position.wert) FILTER (WHERE forecast_position.groesse = 'ba' AND forecast_position.art = 'plan') AS ba_plan,
         sum(forecast_position.wert) FILTER (WHERE forecast_position.groesse = 'umsatz' AND forecast_position.art = 'ist') AS umsatz_gemeldet,
         sum(forecast_position.wert) FILTER (WHERE forecast_position.groesse = 'kosten' AND forecast_position.art = 'ist') AS kosten_gemeldet
    FROM controlling.v_forecast_position_gesamt forecast_position
   GROUP BY forecast_position.jahr, forecast_position.region, forecast_position.monat
),
sap AS (
  SELECT EXTRACT(year FROM e.buchungsdatum)::integer AS jahr,
         controlling.f_region(substr(e.auftrag::text, 6, 2)) AS region,
         EXTRACT(month FROM e.buchungsdatum)::integer AS monat,
         sum(e.wert_signed) FILTER (WHERE k.kategorie::text = 'umsatzerloese') AS umsatz_sap,
         sum(e.wert_signed) FILTER (WHERE k.kategorie::text IN ('leistung_unfertig', 'leistung_fertig')) AS ba_sap,
         sum(e.wert_signed) FILTER (WHERE k.kategorie::text = 'betriebsaufwand') AS kosten_sap
    FROM controlling.sap_einzelposten e
    JOIN controlling.kontenkatalog_tvf k
      ON controlling.f_konto_norm(k.konto::text) = controlling.f_konto_norm(e.kostenart::text)
   WHERE e.auftrag IS NOT NULL
     AND e.buchungsdatum IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM controlling.forecast_ausblendung a WHERE a.auftrag = e.auftrag)
   GROUP BY 1, 2, 3
)
SELECT COALESCE(p.jahr::integer, s.jahr) AS jahr,
       COALESCE(p.region, s.region::character varying) AS region,
       COALESCE(p.monat::integer, s.monat) AS monat,
       - COALESCE(p.umsatz_plan, 0) AS umsatz_plan,
       - COALESCE(p.kosten_plan, 0) AS kosten_plan,
       - COALESCE(p.umsatz_gemeldet, 0) AS umsatz_gemeldet,
       - COALESCE(p.kosten_gemeldet, 0) AS kosten_gemeldet,
       - COALESCE(s.umsatz_sap, 0) AS umsatz_sap,
       - COALESCE(s.kosten_sap, 0) AS kosten_sap,
       (- (COALESCE(p.umsatz_plan, 0) + COALESCE(p.kosten_plan, 0)) + COALESCE(p.ba_plan, 0)) AS db_plan,
       (- (COALESCE(s.umsatz_sap, 0) + COALESCE(s.ba_sap, 0) + COALESCE(s.kosten_sap, 0))) AS db_sap,
       - (COALESCE(p.umsatz_gemeldet, 0) - COALESCE(s.umsatz_sap, 0)) AS umsatz_meldediff,
       - (COALESCE(p.kosten_gemeldet, 0) - COALESCE(s.kosten_sap, 0)) AS kosten_meldediff,
       COALESCE(p.ba_plan, 0) AS ba_plan,
       - COALESCE(s.ba_sap, 0) AS ba_sap
  FROM plan p
  FULL JOIN sap s ON s.jahr = p.jahr AND s.region = p.region::text AND s.monat = p.monat;

CREATE OR REPLACE VIEW controlling.v_forecast_auftrag AS
WITH p AS (
  SELECT forecast_position.auftrag,
         max(forecast_position.auftragname::text) AS auftragname,
         max(forecast_position.region::text) AS region,
         forecast_position.jahr,
         sum(forecast_position.wert) FILTER (WHERE forecast_position.groesse = 'umsatz' AND forecast_position.art = 'plan') AS umsatz_plan,
         sum(forecast_position.wert) FILTER (WHERE forecast_position.groesse = 'kosten' AND forecast_position.art = 'plan') AS kosten_plan,
         sum(forecast_position.wert) FILTER (WHERE forecast_position.groesse = 'ba' AND forecast_position.art = 'plan') AS ba_plan,
         sum(forecast_position.wert) FILTER (
           WHERE forecast_position.groesse = 'umsatz' AND forecast_position.art = 'plan'
             AND forecast_position.monat > controlling.f_letzter_belastbarer_monat(forecast_position.jahr)) AS umsatz_restplan,
         sum(forecast_position.wert) FILTER (
           WHERE forecast_position.groesse = 'kosten' AND forecast_position.art = 'plan'
             AND forecast_position.monat > controlling.f_letzter_belastbarer_monat(forecast_position.jahr)) AS kosten_restplan,
         sum(forecast_position.wert) FILTER (
           WHERE forecast_position.groesse = 'ba' AND forecast_position.art = 'plan'
             AND forecast_position.monat > controlling.f_letzter_belastbarer_monat(forecast_position.jahr)) AS ba_restplan
    FROM controlling.v_forecast_position_gesamt forecast_position
   GROUP BY forecast_position.auftrag, forecast_position.jahr
),
s AS (
  SELECT e.auftrag,
         EXTRACT(year FROM e.buchungsdatum)::integer AS jahr,
         sum(e.wert_signed) FILTER (WHERE k.kategorie::text = 'umsatzerloese') AS umsatz_sap,
         sum(e.wert_signed) FILTER (WHERE k.kategorie::text IN ('leistung_unfertig', 'leistung_fertig')) AS ba_sap,
         sum(e.wert_signed) FILTER (WHERE k.kategorie::text = 'betriebsaufwand') AS kosten_sap
    FROM controlling.sap_einzelposten e
    JOIN controlling.kontenkatalog_tvf k
      ON controlling.f_konto_norm(k.konto::text) = controlling.f_konto_norm(e.kostenart::text)
   WHERE e.buchungsdatum IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM controlling.forecast_ausblendung a WHERE a.auftrag = e.auftrag)
   GROUP BY e.auftrag, 2
)
SELECT COALESCE(p.auftrag, s.auftrag) AS auftrag,
       p.auftragname,
       p.region,
       - COALESCE(p.umsatz_plan, 0) AS umsatz_plan,
       - COALESCE(p.kosten_plan, 0) AS kosten_plan,
       - COALESCE(s.umsatz_sap, 0) AS umsatz_ist,
       - COALESCE(s.kosten_sap, 0) AS kosten_ist,
       - COALESCE(p.umsatz_restplan, 0) AS umsatz_restplan,
       - COALESCE(p.kosten_restplan, 0) AS kosten_restplan,
       - (COALESCE(s.umsatz_sap, 0) + COALESCE(p.umsatz_restplan, 0)) AS umsatz_erwartet,
       - (COALESCE(s.kosten_sap, 0) + COALESCE(p.kosten_restplan, 0)) AS kosten_erwartet,
       COALESCE(p.ba_plan, 0) AS ba_plan,
       COALESCE(p.ba_restplan, 0) AS ba_restplan,
       - COALESCE(s.ba_sap, 0) AS ba_ist,
       (- COALESCE(s.ba_sap, 0) + COALESCE(p.ba_restplan, 0)) AS ba_erwartet,
       COALESCE(p.jahr, s.jahr) AS jahr
  FROM p
  FULL JOIN s ON s.auftrag = p.auftrag AND s.jahr = p.jahr;

CREATE OR REPLACE FUNCTION controlling.fc_fortschreiben(p_jahr integer)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'controlling', 'public'
AS $function$
DECLARE g integer := controlling.f_letzter_belastbarer_monat(p_jahr);
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _fc (monat integer, um numeric, ko numeric, ba numeric) ON COMMIT DROP;
  DELETE FROM _fc;
  INSERT INTO _fc
  SELECT monat::int,
         COALESCE(sum(abs(wert)) FILTER (WHERE groesse = 'umsatz'), 0),
         COALESCE(sum(abs(wert)) FILTER (WHERE groesse = 'kosten'), 0),
         COALESCE(sum(wert) FILTER (WHERE groesse = 'ba'), 0)
    FROM controlling.forecast_position
   WHERE jahr = p_jahr AND art = 'plan' AND monat > g
   GROUP BY 1;
  UPDATE controlling.ebitda_monat e
     SET operatives_ergebnis = f.um - f.ko + f.ba,
         art = 'FC'
    FROM _fc f
   WHERE e.jahr = p_jahr AND e.monat = f.monat;
  UPDATE controlling.liq_monat l
     SET umsatz = f.um,
         bestandsaenderung = f.ba,
         ebitda = f.um - f.ko + f.ba,
         ist = false
    FROM _fc f
   WHERE l.jahr = p_jahr AND l.monat = f.monat;
END
$function$;

-- Abgeschlossene Monate: die gespeicherte Liquiditätszeile folgt den Buchungen,
-- auch beim EBITDA. Vorher standen dort gerundete Planwerte.
UPDATE controlling.liq_monat l
   SET umsatz = k.umsatzerloese,
       bestandsaenderung = k.bestandsveraenderung,
       ebitda = k.ebitda,
       ist = true
  FROM controlling.v_kennzahlen_monat k
 WHERE l.jahr = k.jahr
   AND l.monat = k.monat
   AND l.monat <= controlling.f_letzter_belastbarer_monat(l.jahr)
   AND (abs(l.umsatz - k.umsatzerloese) > 0.01
     OR abs(l.bestandsaenderung - k.bestandsveraenderung) > 0.01
     OR abs(l.ebitda - k.ebitda) > 0.01
     OR l.ist IS DISTINCT FROM true);

UPDATE controlling.ebitda_monat e
   SET art = CASE
         WHEN e.monat <= controlling.f_letzter_belastbarer_monat(e.jahr) THEN 'IST'
         ELSE 'FC'
       END
 WHERE e.art IS DISTINCT FROM CASE
         WHEN e.monat <= controlling.f_letzter_belastbarer_monat(e.jahr) THEN 'IST'
         ELSE 'FC'
       END;

SELECT controlling.fc_fortschreiben(j)
  FROM (SELECT DISTINCT jahr AS j FROM controlling.forecast_position) s;
