-- August-Ist an den Stellen, die noch nur das Journal lesen.
-- Die Gesellschafts-GuV bleibt bei Quelle FI. Es wird keine Zeile in
-- sap_einzelposten oder buchungen kopiert und kein Forecast überschrieben.
-- Monate mit Quelle CO bleiben das Journal. Die FI-Zeilen kommen nur dazu,
-- wenn derselbe Auftrag und dasselbe Konto im Journal fehlen.

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

-- Kostenverfolgung gegen SAP: derselbe Ist-Bestand wie der Forecast.
CREATE OR REPLACE VIEW controlling.v_kv_sap AS
WITH sap AS (
  SELECT e.auftrag,
         -sum(e.wert_signed) FILTER (
           WHERE k_1.kategorie::text = ANY (ARRAY[
             'umsatzerloese', 'leistung_unfertig', 'leistung_fertig', 'sonstige_ertraege'])) AS umsatz_sap,
         sum(e.wert_signed) FILTER (WHERE k_1.kategorie::text = 'betriebsaufwand') AS kosten_sap,
         count(*) AS belege,
         max(e.buchungsdatum) AS letzte_buchung
    FROM controlling.v_forecast_ist_buchung e
    JOIN controlling.kontenkatalog_tvf k_1
      ON controlling.f_konto_norm(k_1.konto::text) = controlling.f_konto_norm(e.kostenart::text)
   WHERE e.auftrag IS NOT NULL
   GROUP BY e.auftrag
)
SELECT k.psp,
       k.auftrag,
       COALESCE(controlling.f_region_voll(k.auftrag::text, NULL::text), k.region::text) AS region,
       k.projekttitel,
       k.auftraggeber,
       k.phase,
       k.status,
       k.bauleiter,
       k.stand,
       k.erfuellung_prozent,
       COALESCE(k.umsatz_ist, 0::numeric) AS umsatz_kv,
       COALESCE(s.umsatz_sap, 0::numeric) AS umsatz_sap,
       COALESCE(s.umsatz_sap, 0::numeric) - COALESCE(k.umsatz_ist, 0::numeric) AS umsatz_delta,
       COALESCE(k.kosten_ist, 0::numeric) AS kosten_kv,
       COALESCE(s.kosten_sap, 0::numeric) AS kosten_sap,
       COALESCE(s.kosten_sap, 0::numeric) - COALESCE(k.kosten_ist, 0::numeric) AS kosten_delta,
       COALESCE(k.umsatz_ist, 0::numeric) - COALESCE(k.kosten_ist, 0::numeric) AS ergebnis_kv,
       COALESCE(s.umsatz_sap, 0::numeric) - COALESCE(s.kosten_sap, 0::numeric) AS ergebnis_sap,
       COALESCE(s.umsatz_sap, 0::numeric) - COALESCE(s.kosten_sap, 0::numeric)
         - (COALESCE(k.umsatz_ist, 0::numeric) - COALESCE(k.kosten_ist, 0::numeric)) AS ergebnis_delta,
       k.umsatz_vertrag,
       k.kosten_vertrag,
       k.umsatz_projekt,
       k.kosten_projekt,
       COALESCE(s.belege, 0::bigint) AS belege_sap,
       s.letzte_buchung,
       s.auftrag IS NOT NULL AS in_sap,
       k.beginn,
       k.ende,
       k.beginn >= date_trunc('year', CURRENT_DATE::timestamp with time zone)::date AS vergleichbar
  FROM controlling.kv_dashboard k
  LEFT JOIN sap s ON s.auftrag::text = k.auftrag::text;

-- Rechnungsabgleich: Ist-Umsatz aus derselben Sicht, damit der August zählt.
CREATE OR REPLACE VIEW controlling.v_forecast_rechnung_abgleich AS
WITH fc AS (
  SELECT forecast_position.jahr,
         forecast_position.auftrag,
         forecast_position.monat,
         sum(CASE
               WHEN forecast_position.groesse::text = 'umsatz' THEN abs(forecast_position.wert)
               ELSE NULL::numeric
             END) AS umsatz_fc
    FROM controlling.v_fp_gesamt forecast_position
   WHERE forecast_position.art::text = 'plan'
   GROUP BY forecast_position.jahr, forecast_position.auftrag, forecast_position.monat
),
ist AS (
  SELECT e.geschaeftsjahr::integer AS jahr,
         e.auftrag,
         e.monat::integer AS monat,
         sum(-e.wert_signed) AS umsatz_ist
    FROM controlling.v_forecast_ist_buchung e
    JOIN controlling.kontenkatalog_tvf k
      ON controlling.f_konto_norm(k.konto::text) = controlling.f_konto_norm(e.kostenart::text)
   WHERE e.auftrag IS NOT NULL
     AND k.kategorie::text = ANY (ARRAY[
       'umsatzerloese', 'leistung_unfertig', 'leistung_fertig', 'sonstige_ertraege'])
   GROUP BY e.geschaeftsjahr::integer, e.auftrag, e.monat::integer
)
SELECT COALESCE(r.jahr::integer, fc.jahr::integer, ist.jahr) AS jahr,
       COALESCE(r.auftrag, fc.auftrag, ist.auftrag) AS auftrag,
       COALESCE(r.monat::integer, fc.monat::integer, ist.monat) AS monat,
       CASE
         WHEN COALESCE(r.monat::integer, fc.monat::integer, ist.monat)
              <= controlling.f_letzter_belastbarer_monat(COALESCE(r.jahr::integer, fc.jahr::integer, ist.jahr))
           THEN COALESCE(ist.umsatz_ist, 0::numeric)
         ELSE COALESCE(fc.umsatz_fc, 0::numeric)
       END AS umsatz,
       COALESCE(r.betrag, 0::numeric) AS rechnung,
       CASE
         WHEN COALESCE(r.monat::integer, fc.monat::integer, ist.monat)
              <= controlling.f_letzter_belastbarer_monat(COALESCE(r.jahr::integer, fc.jahr::integer, ist.jahr))
           THEN COALESCE(ist.umsatz_ist, 0::numeric)
         ELSE COALESCE(fc.umsatz_fc, 0::numeric)
       END - COALESCE(r.betrag, 0::numeric) AS offen
  FROM controlling.forecast_rechnung r
  FULL JOIN fc ON fc.jahr = r.jahr AND fc.auftrag::text = r.auftrag::text AND fc.monat = r.monat
  FULL JOIN ist ON ist.jahr = COALESCE(r.jahr, fc.jahr)
               AND ist.auftrag::text = COALESCE(r.auftrag, fc.auftrag)::text
               AND ist.monat = COALESCE(r.monat, fc.monat);
