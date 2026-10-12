-- =====================================================================
-- 23 · Berichtsbaukasten
--
-- Berichte sollen sich ohne Programmierung zusammenstellen lassen:
-- Datenquelle waehlen, Spalten ein- und ausblenden, filtern, gruppieren
-- und eigene Rechenspalten anlegen.
--
-- Sicherheitsgrundsatz: aus der Oberflaeche kommt nie SQL. Erlaubt sind
-- ausschliesslich die hier eingetragenen Quellen und deren tatsaechlich
-- vorhandene Spalten; alles andere wird verworfen. Die Rechenspalten
-- sind auf die vier Grundrechenarten ueber bekannte Spaltennamen und
-- Zahlen beschraenkt.
-- =====================================================================

SET search_path = controlling, public;

CREATE TABLE IF NOT EXISTS controlling.bericht_quelle (
  name          varchar(60)  PRIMARY KEY,   -- Sichtname in controlling
  bezeichnung   varchar(120) NOT NULL,
  beschreibung  varchar(300),
  regionsspalte varchar(40),                -- fuer die Regionsfreigabe
  sortierung    smallint NOT NULL DEFAULT 100
);

INSERT INTO controlling.bericht_quelle (name, bezeichnung, beschreibung, regionsspalte, sortierung) VALUES
 ('v_guv_ist','GuV je Konto und Monat',
  'Ist-Ergebnis aus den SAP-Einzelposten, gegen den Abschluss geprüft. Vorzeichen: Aufwand positiv.', NULL, 10),
 ('v_guv_region','GuV je Region, Konto und Monat',
  'Dasselbe, zusätzlich nach Region aufgeschlüsselt – auch die Kostenstellen.', 'region', 20),
 ('v_guv_region_staffel','GuV-Staffel je Region',
  'Verdichtet: Gesamtleistung, Aufwand und Ergebnis je Region.', 'region', 30),
 ('v_abstimmung_guv','Abstimmung gegen den Abschluss',
  'Je Konto der Abschlusswert, der eigene Wert und die Differenz.', NULL, 40),
 ('v_bilanz','Bilanz',
  'Bestand laut Abschluss, Bewegung des Jahres und Eröffnungswert je Konto.', NULL, 50),
 ('v_plan_ist_konto','Plan gegen Ist je Konto',
  'Mehrjahresplanung gegen das Ist, je Region und Sachkonto.', 'region', 60),
 ('v_plan_region','Mehrjahresplan je Region',
  'Ertrag, Aufwand und Ergebnis je Region und Planjahr.', 'region', 70),
 ('v_forecast_monat','Forecast je Region und Monat',
  'Plan der Regionalleiter gegen das SAP-Ist.', 'region', 80),
 ('v_forecast_auftrag','Forecast je Auftrag',
  'Plan, Ist und Restplan je Auftrag mit der Jahreserwartung.', 'region', 90),
 ('v_kv_sap','Kostenverfolgung gegen SAP',
  'Was die Regionen führen, was gebucht ist, und die Differenz.', 'region', 100),
 ('v_liq_woche','Liquidität je Kalenderwoche',
  'Ein- und Ausgang, Tiefpunkt und Endstand je Woche.', NULL, 110),
 ('v_liq_tag','Liquidität je Tag',
  'Tagesgenauer Zahlungsplan mit fortgeschriebenem Saldo.', NULL, 120),
 ('v_risiko_netto','Projektrisiken',
  'Brutto, geplante Minderung und Netto je Risiko.', NULL, 130),
 ('v_innenauftrag','Innenaufträge',
  'Primärkosten, Umlage und Saldo je Innenauftrag.', 'region', 140),
 ('v_gemeinkosten_region','Gemeinkosten je Region',
  'Primärkosten, Umlage und Deckungsdifferenz je Region und Funktion.', 'region', 150),
 ('v_projekt_db','Deckungsbeitrag je Projekt',
  'Die Stufenrechnung DB I bis DB IV je Projekt.', 'region', 160),
 ('v_buchung','Einzelbuchungen',
  'Die Buchungszeilen der Auftragsrechnung mit allen Merkmalen.', 'region', 170)
ON CONFLICT (name) DO UPDATE
  SET bezeichnung = EXCLUDED.bezeichnung, beschreibung = EXCLUDED.beschreibung,
      regionsspalte = EXCLUDED.regionsspalte, sortierung = EXCLUDED.sortierung;

-- ---------------------------------------------------------------------
-- Gespeicherte Berichtsvorlagen
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS controlling.bericht_vorlage (
  id            bigserial PRIMARY KEY,
  name          varchar(120) NOT NULL,
  beschreibung  varchar(300),
  quelle        varchar(60)  NOT NULL REFERENCES controlling.bericht_quelle(name),
  -- Aufbau als JSON: spalten, filter, gruppierung, rechenspalten, sortierung
  aufbau        jsonb        NOT NULL DEFAULT '{}'::jsonb,
  oeffentlich   boolean      NOT NULL DEFAULT true,
  erstellt_von  bigint REFERENCES controlling.benutzer(benutzer_id),
  erstellt_at   timestamptz  NOT NULL DEFAULT now(),
  geaendert_at  timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (name)
);

-- ---------------------------------------------------------------------
-- Welche Spalten hat eine Quelle? Die Oberflaeche fragt das ab, statt
-- eine gepflegte Liste zu fuehren, die veraltet.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_bericht_spalte AS
SELECT q.name AS quelle, c.column_name AS spalte, c.ordinal_position AS position,
       c.data_type AS typ,
       (c.data_type IN ('numeric','integer','bigint','smallint','double precision','real')) AS zahl
  FROM controlling.bericht_quelle q
  JOIN information_schema.columns c
    ON c.table_schema = 'controlling' AND c.table_name = q.name;

COMMENT ON TABLE controlling.bericht_quelle IS
  'Weisse Liste der Datenquellen fuer den Berichtsbaukasten. Nur was hier steht, '
  'ist abfragbar – aus der Oberflaeche kommt nie SQL.';
