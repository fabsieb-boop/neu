/* ---------------------------------------------------------------------------
   Forecast: kaufmaennische Vorzeichen
   ---------------------------------------------------------------------------
   Im SAP-Export stehen Erloese im Haben und damit negativ.  Die
   Forecast-Sichten reichten das unveraendert durch, und die Seite zeigte es
   roh: die Region West stand mit -7.218.283 EUR Umsatz da.  Ein Umsatz ist
   kein negativer Betrag, und wer das liest, rechnet im Kopf falsch.

   Ueberall sonst dreht das Cockpit auf die kaufmaennische Leseart – Ertrag
   positiv, Aufwand negativ, Gewinn positiv.  Hier fehlte das.

   Die Rechnung selbst bleibt unangetastet: der Rumpf beider Sichten steht
   unveraendert als Unterabfrage, gedreht wird nur die aeussere Spaltenliste.
   Die Deckungsbeitraege waren schon vorher kaufmaennisch gerechnet
   (-(Umsatz + Kosten) mit SAP-Vorzeichen) und bleiben deshalb, wie sie sind.
--------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW controlling.v_forecast_monat AS
SELECT q.jahr, q.region, q.monat,
       -q.umsatz_plan       AS umsatz_plan,
       -q.kosten_plan       AS kosten_plan,
       -q.umsatz_gemeldet   AS umsatz_gemeldet,
       -q.kosten_gemeldet   AS kosten_gemeldet,
       -q.umsatz_sap        AS umsatz_sap,
       -q.kosten_sap        AS kosten_sap,
       q.db_plan, q.db_sap,
       -q.umsatz_meldediff  AS umsatz_meldediff,
       -q.kosten_meldediff  AS kosten_meldediff
  FROM (WITH plan AS (
         SELECT forecast_position.jahr,
            forecast_position.region,
            forecast_position.monat,
            sum(forecast_position.wert) FILTER (WHERE forecast_position.groesse::text = 'umsatz'::text AND forecast_position.art::text = 'plan'::text) AS umsatz_plan,
            sum(forecast_position.wert) FILTER (WHERE forecast_position.groesse::text = 'kosten'::text AND forecast_position.art::text = 'plan'::text) AS kosten_plan,
            sum(forecast_position.wert) FILTER (WHERE forecast_position.groesse::text = 'umsatz'::text AND forecast_position.art::text = 'ist'::text) AS umsatz_gemeldet,
            sum(forecast_position.wert) FILTER (WHERE forecast_position.groesse::text = 'kosten'::text AND forecast_position.art::text = 'ist'::text) AS kosten_gemeldet
           FROM controlling.v_forecast_position forecast_position
          GROUP BY forecast_position.jahr, forecast_position.region, forecast_position.monat
        ), sap AS (
         SELECT EXTRACT(year FROM e.buchungsdatum)::integer AS jahr,
            controlling.f_region(substr(e.auftrag::text, 6, 2)) AS region,
            EXTRACT(month FROM e.buchungsdatum)::integer AS monat,
            sum(e.wert_signed) FILTER (WHERE k.kategorie::text = ANY (ARRAY['umsatzerloese'::character varying::text, 'leistung_unfertig'::character varying::text, 'leistung_fertig'::character varying::text, 'sonstige_ertraege'::character varying::text])) AS umsatz_sap,
            sum(e.wert_signed) FILTER (WHERE k.kategorie::text = 'betriebsaufwand'::text) AS kosten_sap
           FROM controlling.sap_einzelposten e
             JOIN controlling.kontenkatalog_tvf k ON controlling.f_konto_norm(k.konto::text) = controlling.f_konto_norm(e.kostenart::text)
          WHERE e.auftrag IS NOT NULL AND e.buchungsdatum IS NOT NULL AND NOT (EXISTS ( SELECT 1
                   FROM controlling.forecast_ausblendung a
                  WHERE a.auftrag::text = e.auftrag::text))
          GROUP BY (EXTRACT(year FROM e.buchungsdatum)::integer), (controlling.f_region(substr(e.auftrag::text, 6, 2))), (EXTRACT(month FROM e.buchungsdatum)::integer)
        )
 SELECT COALESCE(p.jahr::integer, s.jahr) AS jahr,
    COALESCE(p.region, s.region::character varying) AS region,
    COALESCE(p.monat::integer, s.monat) AS monat,
    COALESCE(p.umsatz_plan, 0::numeric) AS umsatz_plan,
    COALESCE(p.kosten_plan, 0::numeric) AS kosten_plan,
    COALESCE(p.umsatz_gemeldet, 0::numeric) AS umsatz_gemeldet,
    COALESCE(p.kosten_gemeldet, 0::numeric) AS kosten_gemeldet,
    COALESCE(s.umsatz_sap, 0::numeric) AS umsatz_sap,
    COALESCE(s.kosten_sap, 0::numeric) AS kosten_sap,
    - (COALESCE(p.umsatz_plan, 0::numeric) + COALESCE(p.kosten_plan, 0::numeric)) AS db_plan,
    - (COALESCE(s.umsatz_sap, 0::numeric) + COALESCE(s.kosten_sap, 0::numeric)) AS db_sap,
    COALESCE(p.umsatz_gemeldet, 0::numeric) - COALESCE(s.umsatz_sap, 0::numeric) AS umsatz_meldediff,
    COALESCE(p.kosten_gemeldet, 0::numeric) - COALESCE(s.kosten_sap, 0::numeric) AS kosten_meldediff
   FROM plan p
     FULL JOIN sap s ON s.jahr = p.jahr AND s.region = p.region::text AND s.monat = p.monat) q;

CREATE OR REPLACE VIEW controlling.v_forecast_auftrag AS
SELECT q.auftrag, q.auftragname, q.region,
       -q.umsatz_plan      AS umsatz_plan,
       -q.kosten_plan      AS kosten_plan,
       -q.umsatz_ist       AS umsatz_ist,
       -q.kosten_ist       AS kosten_ist,
       -q.umsatz_restplan  AS umsatz_restplan,
       -q.kosten_restplan  AS kosten_restplan,
       -q.umsatz_erwartet  AS umsatz_erwartet,
       -q.kosten_erwartet  AS kosten_erwartet
  FROM (WITH letzter_ist AS (
         SELECT max(EXTRACT(month FROM sap_einzelposten.buchungsdatum))::integer AS monat
           FROM controlling.sap_einzelposten
          WHERE EXTRACT(year FROM sap_einzelposten.buchungsdatum) = 2026::numeric
        ), p AS (
         SELECT forecast_position.auftrag,
            max(forecast_position.auftragname::text) AS auftragname,
            max(forecast_position.region::text) AS region,
            forecast_position.jahr,
            sum(forecast_position.wert) FILTER (WHERE forecast_position.groesse::text = 'umsatz'::text AND forecast_position.art::text = 'plan'::text) AS umsatz_plan,
            sum(forecast_position.wert) FILTER (WHERE forecast_position.groesse::text = 'kosten'::text AND forecast_position.art::text = 'plan'::text) AS kosten_plan,
            sum(forecast_position.wert) FILTER (WHERE forecast_position.groesse::text = 'umsatz'::text AND forecast_position.art::text = 'plan'::text AND forecast_position.monat > (( SELECT letzter_ist.monat
                   FROM letzter_ist))) AS umsatz_restplan,
            sum(forecast_position.wert) FILTER (WHERE forecast_position.groesse::text = 'kosten'::text AND forecast_position.art::text = 'plan'::text AND forecast_position.monat > (( SELECT letzter_ist.monat
                   FROM letzter_ist))) AS kosten_restplan
           FROM controlling.v_forecast_position forecast_position
          GROUP BY forecast_position.auftrag, forecast_position.jahr
        ), s AS (
         SELECT e.auftrag,
            sum(e.wert_signed) FILTER (WHERE k.kategorie::text = ANY (ARRAY['umsatzerloese'::character varying::text, 'leistung_unfertig'::character varying::text, 'leistung_fertig'::character varying::text, 'sonstige_ertraege'::character varying::text])) AS umsatz_sap,
            sum(e.wert_signed) FILTER (WHERE k.kategorie::text = 'betriebsaufwand'::text) AS kosten_sap
           FROM controlling.sap_einzelposten e
             JOIN controlling.kontenkatalog_tvf k ON controlling.f_konto_norm(k.konto::text) = controlling.f_konto_norm(e.kostenart::text)
          WHERE EXTRACT(year FROM e.buchungsdatum) = 2026::numeric AND NOT (EXISTS ( SELECT 1
                   FROM controlling.forecast_ausblendung a
                  WHERE a.auftrag::text = e.auftrag::text))
          GROUP BY e.auftrag
        )
 SELECT COALESCE(p.auftrag, s.auftrag) AS auftrag,
    p.auftragname,
    p.region,
    COALESCE(p.umsatz_plan, 0::numeric) AS umsatz_plan,
    COALESCE(p.kosten_plan, 0::numeric) AS kosten_plan,
    COALESCE(s.umsatz_sap, 0::numeric) AS umsatz_ist,
    COALESCE(s.kosten_sap, 0::numeric) AS kosten_ist,
    COALESCE(p.umsatz_restplan, 0::numeric) AS umsatz_restplan,
    COALESCE(p.kosten_restplan, 0::numeric) AS kosten_restplan,
    COALESCE(s.umsatz_sap, 0::numeric) + COALESCE(p.umsatz_restplan, 0::numeric) AS umsatz_erwartet,
    COALESCE(s.kosten_sap, 0::numeric) + COALESCE(p.kosten_restplan, 0::numeric) AS kosten_erwartet
   FROM p
     FULL JOIN s ON s.auftrag::text = p.auftrag::text) q;

GRANT SELECT ON controlling.v_forecast_monat, controlling.v_forecast_auftrag TO PUBLIC;
