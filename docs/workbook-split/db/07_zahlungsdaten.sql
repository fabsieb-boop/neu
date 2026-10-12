-- ============================================================================
--  Zahlungsdaten und Jahresabschluss als Referenz
--
--  Schliesst die von der Liquiditaetsmethodik benannten offenen Punkte:
--   - Faelligkeitsstruktur der Forderungen und Verbindlichkeiten
--     (ersetzt die pauschalen Zahlungsziele durch echte Faelligkeiten)
--   - Factoring-Bewegungen (Herkunft des systematischen Zuflusses)
--   - offizieller Abschluss als Abgleichsmassstab
--
--  Quellen: woechentliche Liquiditaetsmappe (4102_KW33.xlsb),
--  Bilanz/GuV-Bericht (bilNZ.XLSX) und GuV-Bericht (guv.XLSX).
--  Alle Tabellen werden nur gelesen und fliessen in keine Auswertung ein,
--  die aus den Buchungen gerechnet wird.
--
--  Idempotent.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Offene Posten mit Faelligkeit
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS controlling.offener_posten (
  posten_id      BIGSERIAL PRIMARY KEY,
  art            VARCHAR(20) NOT NULL,        -- FORDERUNG | VERBINDLICHKEIT
  buchungskreis  VARCHAR(10),
  konto          VARCHAR(40),
  belegart       VARCHAR(10),
  belegnummer    VARCHAR(40),
  belegdatum     DATE,
  nettofaelligkeit DATE,
  betrag         NUMERIC(18,2) NOT NULL,
  waehrung       VARCHAR(3) DEFAULT 'EUR',
  ausgleichsdatum DATE,
  text           VARCHAR(255),
  auftrag        VARCHAR(80),                 -- aus dem Text abgeleitet
  stand          DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_op_faellig ON controlling.offener_posten(nettofaelligkeit);
CREATE INDEX IF NOT EXISTS idx_op_art     ON controlling.offener_posten(art);

-- ---------------------------------------------------------------------------
-- 2. Factoring-Bewegungen
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS controlling.factoring (
  id        BIGSERIAL PRIMARY KEY,
  stichtag  DATE,
  monat_text VARCHAR(20),
  betrag    NUMERIC(18,2) NOT NULL,
  quelle    VARCHAR(60)
);

-- ---------------------------------------------------------------------------
-- 3. Offizieller Abschluss: Bilanz und GuV je Konto
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS controlling.abschluss_konto (
  jahr            SMALLINT NOT NULL,
  periode         SMALLINT NOT NULL,
  quelle          VARCHAR(20) NOT NULL,       -- GUV | BILANZ
  konto           VARCHAR(40) NOT NULL,
  text            VARCHAR(255),
  berichtsperiode NUMERIC(18,2),
  vergleichsperiode NUMERIC(18,2),
  PRIMARY KEY (jahr, periode, quelle, konto)
);

-- ---------------------------------------------------------------------------
-- 4. Gliederung des Abschlusses (Reihenfolge und Hierarchie)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS controlling.abschluss_gliederung (
  zeile           INTEGER PRIMARY KEY,
  bereich         VARCHAR(20),                -- AKTIVA | PASSIVA | GUV | ANHANG
  text            VARCHAR(255),
  konto           VARCHAR(40),
  ist_summe       BOOLEAN NOT NULL DEFAULT FALSE,
  berichtsperiode NUMERIC(18,2),
  vergleichsperiode NUMERIC(18,2)
);

COMMIT;
