-- Forecast-Ist folgt der GuV-Quelle.
-- Monate mit Quelle CO bleiben das Journal. Ist die Quelle FI, hat das Journal
-- die Innenaufträge der Verwaltung nicht. Diese FI-Zeilen kommen dazu, wenn
-- derselbe Auftrag und dasselbe Konto im Journal fehlen. Es wird nichts
-- geschätzt und keine Forecast-Zeile überschrieben.

CREATE OR REPLACE VIEW controlling.v_forecast_ist_buchung AS
SELECT e.geschaeftsjahr,
       e.monat,
       e.auftrag::character varying AS auftrag,
       e.kostenart::character varying AS kostenart,
       e.kostenstelle::character varying AS kostenstelle,
       e.wert_signed,
       e.buchungsdatum,
       e.belegnummer,
       e.belegart,
       e.bezeichnung::text AS bezeichnung,
       e.id,
       'journal'::text AS herkunft
  FROM controlling.sap_einzelposten e
 WHERE e.buchungsdatum IS NOT NULL
UNION ALL
SELECT f.geschaeftsjahr,
       f.periode AS monat,
       btrim(f.auftrag::text)::character varying AS auftrag,
       f.konto::character varying AS kostenart,
       left(f.kostenstelle, 40)::character varying AS kostenstelle,
       f.betrag::numeric AS wert_signed,
       f.buchungsdatum,
       NULL::character varying(40) AS belegnummer,
       NULLIF(btrim(f.belegart), '')::character varying(40) AS belegart,
       left(btrim(coalesce(f.text, f.bezeichnung, '')), 255) AS bezeichnung,
       ('fi-' || f.fi_id::text) AS id,
       'fi'::text AS herkunft
  FROM controlling.sap_fi_konten f
  JOIN controlling.v_guv_quelle q
    ON q.jahr = f.geschaeftsjahr::integer
   AND q.monat = f.periode::integer
   AND q.quelle = 'FI'
 WHERE f.auftrag IS NOT NULL
   AND btrim(f.auftrag::text) <> ''
   AND NOT EXISTS (
         SELECT 1
           FROM controlling.sap_einzelposten e
          WHERE e.geschaeftsjahr = f.geschaeftsjahr
            AND e.monat = f.periode
            AND e.auftrag = btrim(f.auftrag::text)
            AND controlling.f_konto_norm(e.kostenart::text) = controlling.f_konto_norm(f.konto::text)
       );

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
    FROM controlling.v_forecast_ist_buchung e
    JOIN controlling.kontenkatalog_tvf k
      ON controlling.f_konto_norm(k.konto::text) = controlling.f_konto_norm(e.kostenart::text)
   WHERE e.auftrag IS NOT NULL
     AND btrim(e.auftrag) <> ''
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
    FROM controlling.v_forecast_ist_buchung e
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
