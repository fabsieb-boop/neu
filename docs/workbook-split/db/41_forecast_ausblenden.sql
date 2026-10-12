/* ---------------------------------------------------------------------------
   Projekte aus dem Forecast ausblenden
   ---------------------------------------------------------------------------
   Im Rolling Forecast stehen Auftraege, die dort nicht hingehoeren – alte
   Nummern, Sammelauftraege, Innenauftraege, die versehentlich mitgeliefert
   wurden.  Sie verzerren jede Summe und jede Rangfolge.

   Ausgeblendet wird an genau einer Stelle: die Sicht v_forecast_position
   liefert die Forecast-Zeilen ohne die ausgeblendeten Auftraege, und beide
   auswertenden Sichten lesen kuenftig von dort.  Damit wirkt eine Ausblendung
   ueberall im Forecast auf einmal, auch in Auswertungen, die es noch nicht
   gibt.

   Was NICHT ausgeblendet wird: die GuV, die Abstimmung gegen den Abschluss
   und die Bruecke zum Jahresergebnis.  Die stuetzen sich auf die SAP-
   Einzelposten und muessen gegen den Abschluss aufgehen – dort etwas
   wegzulassen hiesse, die geprueften Zahlen zu veraendern.  Der Forecast ist
   eine Planungsrechnung, da ist Weglassen eine fachliche Entscheidung; im
   Abschluss waere es ein Fehler.

   Wer darf das: nur wer die Berechtigung `forecast.ausblenden` hat.  Sie
   haengt an der eigenen Rolle FORECAST-PFLEGE und ist zunaechst nur einem
   Benutzer zugeteilt.  Weitergeben laesst sie sich unter Benutzer & Rechte,
   ohne dass jemand ins Skript muss.
--------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS controlling.forecast_ausblendung (
  auftrag     varchar(40) PRIMARY KEY,
  grund       text,
  erfasst_von bigint,
  erfasst_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE controlling.forecast_ausblendung IS
  'Auftraege, die im Rolling Forecast nicht mitgerechnet werden. Wirkt nur im Forecast, nie in der GuV oder der Abstimmung.';

/* Die eine Stelle, an der gefiltert wird. */
CREATE OR REPLACE VIEW controlling.v_forecast_position AS
SELECT p.*
  FROM controlling.forecast_position p
 WHERE NOT EXISTS (SELECT 1 FROM controlling.forecast_ausblendung a
                    WHERE a.auftrag = p.auftrag);

COMMENT ON VIEW controlling.v_forecast_position IS
  'Forecast-Zeilen ohne die ausgeblendeten Auftraege. Grundlage aller Forecast-Auswertungen.';

/* Beide Sichten unveraendert bis auf zwei Stellen.  Erstens lesen sie die
   gefilterte Sicht statt der Tabelle; der Alias bleibt `forecast_position`,
   damit die Spaltenverweise im Rumpf gueltig bleiben.  Zweitens faellt der
   ausgeblendete Auftrag auch auf der SAP-Seite weg – beide Sichten verbinden
   Plan und SAP mit FULL JOIN, ein nur im Plan ausgeblendeter Auftrag kaeme
   sonst ueber die Buchungen wieder herein. */

CREATE OR REPLACE VIEW controlling.v_forecast_auftrag AS
WITH letzter_ist AS (
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
            sum(e.wert_signed) FILTER (WHERE k.kategorie::text = ANY (ARRAY['umsatzerloese'::character varying, 'leistung_unfertig'::character varying, 'leistung_fertig'::character varying, 'sonstige_ertraege'::character varying]::text[])) AS umsatz_sap,
            sum(e.wert_signed) FILTER (WHERE k.kategorie::text = 'betriebsaufwand'::text) AS kosten_sap
           FROM controlling.sap_einzelposten e
             JOIN controlling.kontenkatalog_tvf k ON controlling.f_konto_norm(k.konto::text) = controlling.f_konto_norm(e.kostenart::text)
          WHERE EXTRACT(year FROM e.buchungsdatum) = 2026::numeric
            AND NOT EXISTS (SELECT 1 FROM controlling.forecast_ausblendung a
                            WHERE a.auftrag::text = e.auftrag::text)
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
     FULL JOIN s ON s.auftrag::text = p.auftrag::text;

CREATE OR REPLACE VIEW controlling.v_forecast_monat AS
WITH plan AS (
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
            sum(e.wert_signed) FILTER (WHERE k.kategorie::text = ANY (ARRAY['umsatzerloese'::character varying, 'leistung_unfertig'::character varying, 'leistung_fertig'::character varying, 'sonstige_ertraege'::character varying]::text[])) AS umsatz_sap,
            sum(e.wert_signed) FILTER (WHERE k.kategorie::text = 'betriebsaufwand'::text) AS kosten_sap
           FROM controlling.sap_einzelposten e
             JOIN controlling.kontenkatalog_tvf k ON controlling.f_konto_norm(k.konto::text) = controlling.f_konto_norm(e.kostenart::text)
          WHERE e.auftrag IS NOT NULL AND e.buchungsdatum IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM controlling.forecast_ausblendung a
                            WHERE a.auftrag::text = e.auftrag::text)
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
     FULL JOIN sap s ON s.jahr = p.jahr AND s.region = p.region::text AND s.monat = p.monat;

/* ---------------------------------------------------------------------------
   Recht, Rolle, Zuteilung
--------------------------------------------------------------------------- */

INSERT INTO controlling.berechtigungen (code, beschreibung)
VALUES ('forecast.ausblenden', 'Auftraege im Rolling Forecast ausblenden')
ON CONFLICT (code) DO NOTHING;

INSERT INTO controlling.rollen (rollenname, beschreibung)
VALUES ('FORECAST-PFLEGE', 'Darf Auftraege aus dem Rolling Forecast nehmen')
ON CONFLICT (rollenname) DO NOTHING;

INSERT INTO controlling.rollen_berechtigungen (rollen_id, berechtigung_id)
SELECT r.rollen_id, b.berechtigung_id
  FROM controlling.rollen r, controlling.berechtigungen b
 WHERE r.rollenname = 'FORECAST-PFLEGE' AND b.code = 'forecast.ausblenden'
ON CONFLICT DO NOTHING;

/* Zunaechst nur ein Benutzer.  Weitere Zuteilungen gehoeren in die Oberflaeche,
   nicht in dieses Skript. */
INSERT INTO controlling.benutzer_rollen (benutzer_id, rollen_id)
SELECT u.benutzer_id, r.rollen_id
  FROM controlling.benutzer u, controlling.rollen r
 WHERE u.email = 'fabian.siebert@alba.info' AND r.rollenname = 'FORECAST-PFLEGE'
ON CONFLICT DO NOTHING;

GRANT SELECT ON controlling.v_forecast_position, controlling.forecast_ausblendung TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON controlling.forecast_ausblendung TO PUBLIC;
