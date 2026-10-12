-- =====================================================================
-- 13 · Einstellungen: Firma und Regionen
--
-- Zweck: Berichte tragen je nach gewaehlter Region deren Logo und
-- Anschrift. Ohne Regionsauswahl gilt der Firmeneintrag.
--
-- Das Logo liegt als bytea in der Datenbank, nicht als Datei im
-- Dateisystem: so wandert es mit jeder Sicherung mit und ein
-- Neuaufbau auf einem anderen Rechner ist vollstaendig.
-- =====================================================================

SET search_path = controlling, public;

-- ---------------------------------------------------------------------
-- Globale Einstellungen als Schluessel-Wert-Paare
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS controlling.app_einstellung (
  schluessel      varchar(60) PRIMARY KEY,
  wert            text,
  beschreibung    varchar(255),
  aktualisiert_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO controlling.app_einstellung (schluessel, wert, beschreibung) VALUES
  ('firma_name',      'TVF ALTWERT GmbH',                        'Firmierung im Berichtskopf'),
  ('firma_zusatz',    'Controlling',                             'Zeile unter der Firmierung'),
  ('bericht_untertitel', 'Controlling & Risikomanagement',       'Untertitel auf Berichten'),
  ('bericht_fusszeile',  'Vertraulich – nur für internen Gebrauch', 'Fusszeile beim Drucken'),
  ('bericht_datum_zeigen', 'ja',                                 'Erstellungsdatum drucken'),
  ('bericht_rand_cm',  '2',                                      'Seitenrand beim Drucken in cm')
ON CONFLICT (schluessel) DO NOTHING;

-- ---------------------------------------------------------------------
-- Regionen: Stammsatz je Region, mit Logo
--
-- Der Regionscode ist derselbe wie in f_region (Stellen 6-7 der
-- Auftragsnummer). Mehrere Codes koennen auf dieselbe Region zeigen
-- (23 und 30 sind beide Sued-West), deshalb ist der Regionsname der
-- Schluessel und die Codes stehen als Liste daneben.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS controlling.region_einstellung (
  region          varchar(30) PRIMARY KEY,
  codes           text[]      NOT NULL DEFAULT '{}',
  langname        varchar(160),
  logo            bytea,
  logo_typ        varchar(40),
  logo_name       varchar(160),
  anschrift       text,
  leitung         varchar(120),
  telefon         varchar(60),
  email           varchar(160),
  farbe           varchar(9),
  sharepoint_url  text,
  sortierung      smallint    NOT NULL DEFAULT 100,
  aktiv           boolean     NOT NULL DEFAULT true,
  aktualisiert_at timestamptz NOT NULL DEFAULT now()
);

-- Die SharePoint-Adressen stammen aus dem Altsystem (settings.sharepoint_regionen).
INSERT INTO controlling.region_einstellung (region, codes, langname, farbe, sortierung, sharepoint_url) VALUES
  ('West',       ARRAY['15'],       'Region West',            '#2563eb', 10,
   'https://tvfaltwert.sharepoint.com/:u:/s/10-RegionW/IQCtOM5i2MMkQqlT_pVM8geQAUMRaexzHUYIaiMevT4CJiY?e=5f89Uq'),
  ('Ost',        ARRAY['60'],       'Region Ost',             '#0d9488', 20,
   'https://tvfaltwert.sharepoint.com/:u:/r/sites/60-RegionO/SitePages/CollabHome.aspx?csf=1&web=2&share=IQCXQxJHJ9PVT4sU_dzIpvoIAT5E4W8ImfK6SbEL00BIEUE&e=YVanbE'),
  ('Berlin',     ARRAY['65','99'],  'Region Berlin',          '#7c3aed', 30,
   'https://tvfaltwert.sharepoint.com/:u:/s/30-RegionSW/IQBvbXB6hNcISqGp_BQsMRcyAQVLzETmb6lFk6uG3yF_x5c?e=HPnmIx'),
  ('Süd-West',   ARRAY['23','30'],  'Region Süd-West',        '#d97706', 40,
   'https://tvfaltwert.sharepoint.com/:u:/s/30-RegionSW/IQBvbXB6hNcISqGp_BQsMRcyAQVLzETmb6lFk6uG3yF_x5c?e=HPnmIx'),
  ('Verwaltung', ARRAY['50'],       'Verwaltung und Zentrale','#64748b', 50,
   'https://tvfaltwert-my.sharepoint.com/:f:/g/personal/fsiebert_tvf-altwert_de/IgDUQ-P4qTGQR4uUetzhi5ZnAVhzMq8_Cp8liSlQgEza9Yo?e=sAFQ5Y')
ON CONFLICT (region) DO NOTHING;

-- ---------------------------------------------------------------------
-- Welches Logo gilt fuer einen Berichtskopf?
--
-- Ist fuer die Region eines hinterlegt, gilt dieses. Sonst faellt der
-- Bericht auf das Firmenlogo zurueck – das steht unter der Region '*'.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_berichtskopf AS
SELECT r.region,
       r.codes,
       COALESCE(r.langname, r.region)                             AS langname,
       (r.logo IS NOT NULL)                                       AS eigenes_logo,
       COALESCE(NULLIF(r.logo_typ, ''), f.logo_typ)               AS logo_typ,
       r.anschrift, r.leitung, r.telefon, r.email,
       COALESCE(r.farbe, '#334155')                               AS farbe,
       r.sharepoint_url, r.sortierung, r.aktiv,
       octet_length(COALESCE(r.logo, f.logo))                     AS logo_bytes
  FROM controlling.region_einstellung r
  LEFT JOIN controlling.region_einstellung f ON f.region = '*'
 WHERE r.region <> '*';

-- Das Firmenlogo liegt als Datei bei und wird beim Aufbau eingespielt:
--   npm run db:logo -- db/dateien/firmenlogo.png
-- Regionslogos setzt man in der Oberflaeche unter /einstellungen oder
--   npm run db:logo -- pfad/zum/bild.png West
