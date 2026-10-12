-- ============================================================================
--  Planungsmodule: Nachtraege, Kassenbuch, Vertraege, Vertriebspipeline
--
--  Uebernommen aus dem TVF-Bestandssystem. Alle vier Module erfassen Daten,
--  die es sonst nirgends gibt - sie ergaenzen die aus SAP gerechneten Zahlen,
--  ohne sie zu veraendern.
--
--  Kassenbuch und Vertragsraten fliessen als zusaetzliche Ein- und
--  Auszahlungen in die Liquiditaetsplanung ein. Nachtraege gehen mit ihrem
--  Erwartungswert in Gesamtleistung und EBITDA.
--
--  Idempotent.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Nachtraege
--    Erwartungswert = Betrag x Eintrittswahrscheinlichkeit. Nur angenommene
--    Nachtraege zaehlen voll, offene gehen gewichtet ein.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS controlling.nachtrag (
  nachtrag_id        BIGSERIAL PRIMARY KEY,
  projekt_id         BIGINT REFERENCES controlling.projekte(projekt_id),
  projekt_nr         VARCHAR(80),
  jahr               SMALLINT NOT NULL,
  monat              SMALLINT CHECK (monat BETWEEN 1 AND 12),
  bezeichnung        VARCHAR(255) NOT NULL,
  art                VARCHAR(40),        -- MEHRMENGE | BAUZEIT | STOERUNG | ZUSATZLEISTUNG | SONSTIGES
  rechtsgrundlage    VARCHAR(40),        -- VOB/B | BGB | SONSTIGE
  betrag             NUMERIC(18,2) NOT NULL DEFAULT 0,
  kosten             NUMERIC(18,2) NOT NULL DEFAULT 0,
  wahrscheinlichkeit NUMERIC(5,4) NOT NULL DEFAULT 0.5 CHECK (wahrscheinlichkeit BETWEEN 0 AND 1),
  status             VARCHAR(30) NOT NULL DEFAULT 'ANGEMELDET',
  begruendung        TEXT,
  gemeldet_am        DATE,
  erfasst_von        BIGINT REFERENCES controlling.benutzer(benutzer_id),
  erfasst_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  erwartungswert     NUMERIC(18,2) GENERATED ALWAYS AS (ROUND(betrag * wahrscheinlichkeit, 2)) STORED,
  erwartetes_ergebnis NUMERIC(18,2) GENERATED ALWAYS AS (ROUND((betrag - kosten) * wahrscheinlichkeit, 2)) STORED
);

CREATE INDEX IF NOT EXISTS idx_nachtrag_projekt ON controlling.nachtrag(projekt_id);
CREATE INDEX IF NOT EXISTS idx_nachtrag_jahr    ON controlling.nachtrag(jahr, monat);

-- ---------------------------------------------------------------------------
-- 2. Kassenbuch je Region
--    Die Regionen planen selbst, wann welches Geld fliesst. Jede Zeile ist
--    eine geplante Zahlung mit Partner, Zweck und Termin.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS controlling.kassenbuch (
  eintrag_id    BIGSERIAL PRIMARY KEY,
  jahr          SMALLINT NOT NULL,
  monat         SMALLINT NOT NULL CHECK (monat BETWEEN 1 AND 12),
  regionscode   VARCHAR(4),
  richtung      VARCHAR(3) NOT NULL CHECK (richtung IN ('EIN','AUS')),
  partner       VARCHAR(255),
  projekt_nr    VARCHAR(80),
  zweck         VARCHAR(255) NOT NULL,
  betrag        NUMERIC(18,2) NOT NULL CHECK (betrag >= 0),
  faellig_am    DATE,
  status        VARCHAR(20) NOT NULL DEFAULT 'GEPLANT',  -- GEPLANT | BESTAETIGT | GEFLOSSEN
  quelle        VARCHAR(20) NOT NULL DEFAULT 'KASSENBUCH',
  bemerkung     TEXT,
  erfasst_von   BIGINT REFERENCES controlling.benutzer(benutzer_id),
  erfasst_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kassenbuch_periode ON controlling.kassenbuch(jahr, monat);
CREATE INDEX IF NOT EXISTS idx_kassenbuch_region  ON controlling.kassenbuch(regionscode);

-- ---------------------------------------------------------------------------
-- 3. Dienstleistungsvertraege mit Zahlungsplan
--    Jede Rate ist eine geplante Einzahlung und wirkt wie ein Kassenbucheintrag.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS controlling.vertrag (
  vertrag_id    BIGSERIAL PRIMARY KEY,
  vertragsnummer VARCHAR(40) UNIQUE,
  auftraggeber  VARCHAR(255) NOT NULL,
  projekt_id    BIGINT REFERENCES controlling.projekte(projekt_id),
  projekt_nr    VARCHAR(80),
  regionscode   VARCHAR(4),
  leistung      TEXT,
  beginn        DATE,
  ende          DATE,
  verguetung    NUMERIC(18,2) NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'ENTWURF',  -- ENTWURF | AKTIV | BEENDET
  erfasst_von   BIGINT REFERENCES controlling.benutzer(benutzer_id),
  erfasst_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS controlling.vertrag_rate (
  rate_id     BIGSERIAL PRIMARY KEY,
  vertrag_id  BIGINT NOT NULL REFERENCES controlling.vertrag(vertrag_id) ON DELETE CASCADE,
  nummer      INTEGER NOT NULL,
  faellig_am  DATE NOT NULL,
  betrag      NUMERIC(18,2) NOT NULL,
  bezeichnung VARCHAR(255),
  status      VARCHAR(20) NOT NULL DEFAULT 'OFFEN',      -- OFFEN | GESTELLT | BEZAHLT
  UNIQUE (vertrag_id, nummer)
);

CREATE INDEX IF NOT EXISTS idx_vertrag_rate_faellig ON controlling.vertrag_rate(faellig_am);

-- ---------------------------------------------------------------------------
-- 4. Vertriebspipeline
--    Gewichteter Auftragseingang als Vorlauf zum Forecast.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS controlling.chance (
  chance_id     BIGSERIAL PRIMARY KEY,
  kunde         VARCHAR(255) NOT NULL,
  bezeichnung   VARCHAR(255) NOT NULL,
  regionscode   VARCHAR(4),
  umsatz        NUMERIC(18,2) NOT NULL DEFAULT 0,
  wahrscheinlichkeit NUMERIC(5,4) NOT NULL DEFAULT 0.5 CHECK (wahrscheinlichkeit BETWEEN 0 AND 1),
  stufe         VARCHAR(20) NOT NULL DEFAULT 'LEAD',
                -- LEAD | QUALIFIZIERT | ANGEBOT | VERHANDLUNG | GEWONNEN | VERLOREN
  erwarteter_start DATE,
  projekt_nr    VARCHAR(80),
  notiz         TEXT,
  erfasst_von   BIGINT REFERENCES controlling.benutzer(benutzer_id),
  erfasst_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  gewichtet     NUMERIC(18,2) GENERATED ALWAYS AS (ROUND(umsatz * wahrscheinlichkeit, 2)) STORED
);

CREATE INDEX IF NOT EXISTS idx_chance_stufe ON controlling.chance(stufe);

-- ---------------------------------------------------------------------------
-- 5. Geplante Zahlungen aus Kassenbuch und Vertragsraten in einer Sicht
--    Diese View liefert dem Liquiditaetsmodell die zusaetzlichen Zahlungen.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW controlling.v_geplante_zahlung AS
SELECT k.jahr, k.monat, k.regionscode,
       CASE WHEN k.richtung = 'EIN' THEN k.betrag ELSE -k.betrag END AS betrag,
       k.richtung, k.partner, k.zweck, k.status, 'KASSENBUCH'::text AS herkunft
  FROM controlling.kassenbuch k
UNION ALL
SELECT EXTRACT(YEAR FROM r.faellig_am)::smallint, EXTRACT(MONTH FROM r.faellig_am)::smallint,
       v.regionscode, r.betrag, 'EIN', v.auftraggeber,
       COALESCE(r.bezeichnung, 'Rate ' || r.nummer || ' zu ' || COALESCE(v.vertragsnummer, v.auftraggeber)),
       r.status, 'VERTRAG'
  FROM controlling.vertrag_rate r
  JOIN controlling.vertrag v ON v.vertrag_id = r.vertrag_id
 WHERE v.status <> 'ENTWURF';

COMMIT;
