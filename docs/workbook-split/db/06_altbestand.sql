-- ============================================================================
--  Uebernahme des Altbestands aus dem TVF-Bestandssystem
--
--  Quelle: abbruch-risiko.sqlite bzw. die gleichlautende PostgreSQL-Datenbank
--  auf dem Server. Beide Staende sind deckungsgleich (18.773 Buchungen).
--
--  Die Daten werden BEWUSST in eigene Tabellen uebernommen und nicht in
--  controlling.buchungen gemischt:
--
--   - controlling.buchungen ist der Auftragsbericht (nur auftragsbezogene
--     Zeilen, Perioden 1-7). Jede Auswertung stimmt darauf ab.
--   - Der Altbestand ist der SAP-Einzelpostenexport "1 WES" ueber ALLE Konten
--     einschliesslich der Bilanzkonten, Perioden 1-8.
--
--  Ein Zusammenfuehren wuerde doppelt zaehlen. Getrennt gehalten ergaenzen sich
--  beide: der Einzelpostenexport liefert genau die Groessen, die der
--  Liquiditaetsmethodik fehlen - Forderungen, Verbindlichkeiten, erhaltene
--  Anzahlungen, Factoring und das Darlehen.
--
--  Idempotent.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. SAP-Einzelposten (Format "1 WES")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS controlling.sap_einzelposten (
  id                     TEXT PRIMARY KEY,
  auftrag                VARCHAR(80),
  objektbezeichnung      VARCHAR(255),
  belegart               VARCHAR(40),
  periode                VARCHAR(10),          -- Format JJJJ-MM
  geschaeftsjahr         SMALLINT,
  monat                  SMALLINT,
  konto_gegenbuchung     VARCHAR(40),
  bezeichnung_gegenkonto VARCHAR(255),
  wert                   NUMERIC(18,2),        -- Betrag ohne Vorzeichen
  wert_signed            NUMERIC(18,2),        -- Betrag mit SAP-Vorzeichen
  kostenart              VARCHAR(40),
  kostenart_beschreibung VARCHAR(255),
  bezeichnung            VARCHAR(255),
  typ                    VARCHAR(20),          -- kosten | umsatz | bilanz | bestand | sonst_ertrag
  leistung               VARCHAR(80),
  bukrs                  VARCHAR(10),
  belegdatum             VARCHAR(20),
  belegnummer            VARCHAR(40),
  ref_belegnummer        VARCHAR(40),
  debitor                VARCHAR(40),
  profitcenter           VARCHAR(40),
  kostenstelle           VARCHAR(40),
  leistungsart           VARCHAR(40),
  menge                  NUMERIC(18,3),
  mengeneinheit          VARCHAR(20),
  partner_prctr          VARCHAR(40),
  herkunftsobjekt        VARCHAR(80),
  benutzer               VARCHAR(80),
  import_format          VARCHAR(20),
  region                 VARCHAR(40),
  vorgang                VARCHAR(40),
  werttyp                VARCHAR(40)
);

CREATE INDEX IF NOT EXISTS idx_einzelposten_periode ON controlling.sap_einzelposten(geschaeftsjahr, monat);
CREATE INDEX IF NOT EXISTS idx_einzelposten_konto   ON controlling.sap_einzelposten(kostenart);
CREATE INDEX IF NOT EXISTS idx_einzelposten_auftrag ON controlling.sap_einzelposten(auftrag);
CREATE INDEX IF NOT EXISTS idx_einzelposten_typ     ON controlling.sap_einzelposten(typ);

-- ---------------------------------------------------------------------------
-- 2. Quantitatives Projektrisiko (Drei-Punkt-Schaetzung)
--
--  Das Bestandssystem fuehrt Risiken als Monte-Carlo-Modell: je Risiko eine
--  Eintrittswahrscheinlichkeit und je eine Bandbreite fuer Kosten und Dauer.
--  Das ist fachlich reicher als die vorhandene FMEA-Bewertung und bekommt
--  deshalb eine eigene Tabelle statt einer Umdeutung.
--
--  Erwartungswert = Wahrscheinlichkeit x PERT-Mittel
--  PERT-Mittel    = (min + 4 x wahrscheinlich + max) / 6
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS controlling.projekt_risiko (
  id                 TEXT PRIMARY KEY,
  alt_projekt_id     TEXT,
  projekt_id         BIGINT REFERENCES controlling.projekte(projekt_id),
  projekt_nr         VARCHAR(80),
  bezeichnung        VARCHAR(255) NOT NULL,
  kategorie          VARCHAR(80),
  wahrscheinlichkeit NUMERIC(6,4) NOT NULL DEFAULT 0,   -- 0 bis 1
  kosten_min         NUMERIC(18,2) NOT NULL DEFAULT 0,
  kosten_wahrsch     NUMERIC(18,2) NOT NULL DEFAULT 0,
  kosten_max         NUMERIC(18,2) NOT NULL DEFAULT 0,
  dauer_min          NUMERIC(10,2) NOT NULL DEFAULT 0,
  dauer_wahrsch      NUMERIC(10,2) NOT NULL DEFAULT 0,
  dauer_max          NUMERIC(10,2) NOT NULL DEFAULT 0,
  aktiv              BOOLEAN NOT NULL DEFAULT TRUE,
  kosten_erwartet    NUMERIC(18,2) GENERATED ALWAYS AS (
    ROUND(wahrscheinlichkeit * (kosten_min + 4 * kosten_wahrsch + kosten_max) / 6, 2)) STORED,
  dauer_erwartet     NUMERIC(10,2) GENERATED ALWAYS AS (
    ROUND(wahrscheinlichkeit * (dauer_min + 4 * dauer_wahrsch + dauer_max) / 6, 2)) STORED
);

CREATE INDEX IF NOT EXISTS idx_projekt_risiko_projekt ON controlling.projekt_risiko(projekt_id);

-- ---------------------------------------------------------------------------
-- 3. Projektkennzahlen des Bestandssystems (Plan- und Fortschrittsgroessen)
--    Ergaenzen den Projektstamm um Werte, die der Auftragsbericht nicht kennt.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS controlling.projekt_kennzahlen (
  alt_id           TEXT PRIMARY KEY,
  projekt_nr       VARCHAR(80),
  projekt_id       BIGINT REFERENCES controlling.projekte(projekt_id),
  name             VARCHAR(255),
  region           VARCHAR(40),
  plan_umsatz      NUMERIC(18,2),
  plan_kosten      NUMERIC(18,2),
  plan_db_proz     NUMERIC(10,4),
  ist_umsatz       NUMERIC(18,2),
  ist_kosten       NUMERIC(18,2),
  ist_ytd_umsatz   NUMERIC(18,2),
  fc_rest_umsatz   NUMERIC(18,2),
  jahr_umsatz      NUMERIC(18,2),
  tonnage          NUMERIC(18,2),
  stunden          NUMERIC(18,2),
  projektende      VARCHAR(20),
  ba_unfertig      NUMERIC(18,2)
);

-- ---------------------------------------------------------------------------
-- 4. Auftraege ergaenzen, die nur das Bestandssystem kennt
--
--    database.sql enthaelt 153 Auftraege. Im Bestandssystem tauchen zwei
--    Innenauftraege auf, die dort fehlen. Ohne sie laufen deren Risiken und
--    Kennzahlen ohne Projektbezug, und ein Neuaufbau waere nicht deckungsgleich.
-- ---------------------------------------------------------------------------

INSERT INTO controlling.projekte (projekt_nr, projektname, projektart, status) VALUES
  ('W4102304948', 'AFB21202600801-0000000037', 'SONSTIGES', 'AKTIV'),
  ('W4102304949', 'Service CB-AA 552',         'SONSTIGES', 'AKTIV')
ON CONFLICT (projekt_nr) DO NOTHING;

UPDATE controlling.projekte SET
  auftragstyp = CASE left(projekt_nr,1) WHEN 'P' THEN 'PROJEKT'
                                        WHEN 'W' THEN 'INNENAUFTRAG' ELSE 'SONSTIGES' END,
  regionscode = substring(projekt_nr from 6 for 2),
  region      = controlling.f_region(substring(projekt_nr from 6 for 2))
WHERE auftragstyp IS NULL OR region IS NULL;


COMMIT;
