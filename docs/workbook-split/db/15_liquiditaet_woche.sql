-- =====================================================================
-- 15 · Tagesgenaue Liquiditaet aus der Wochenmappe 4102_KW*.xlsb
--
-- Bisher rechnete das System nur auf Monatsebene. Fuer die Steuerung
-- reicht das nicht: Loehne, Sozialversicherung und Steuern fallen an
-- festen Tagen an, und der Cashpool kann innerhalb eines Monats deutlich
-- tiefer laufen als am Monatsende.
--
-- Das Blatt "Planung" der Wochenmappe fuehrt je Tag eine Spalte und je
-- Zahlungsart eine Zeile. Genau diese Struktur wird hier abgebildet.
-- =====================================================================

SET search_path = controlling, public;

CREATE TABLE IF NOT EXISTS controlling.liq_tag (
  datum       date          NOT NULL,
  kategorie   varchar(60)   NOT NULL,
  richtung    varchar(8)    NOT NULL CHECK (richtung IN ('ein','aus')),
  betrag      numeric(18,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (datum, kategorie)
);

CREATE INDEX IF NOT EXISTS liq_tag_datum_idx ON controlling.liq_tag (datum);

-- Herkunft und Startsaldo der jeweils eingelesenen Mappe
CREATE TABLE IF NOT EXISTS controlling.liq_tag_stand (
  id            smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  quelle_datei  varchar(160),
  konto         varchar(60),
  von           date,
  bis           date,
  startsaldo    numeric(18,2) NOT NULL DEFAULT 0,
  eingelesen_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Tagesreihe mit fortgeschriebenem Saldo
--
-- Der Saldo laeuft kumulativ ueber alle Tage ab dem Startsaldo. Damit
-- ist der Tiefpunkt taggenau ablesbar, nicht nur zum Monatsende.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_liq_tag AS
-- Ein- und Ausgang werden nach dem Vorzeichen getrennt, nicht nach der
-- Blockzugehoerigkeit im Blatt: das Factoring steht dort im Eingangsblock,
-- ist aber ein Abfluss. Nach Bloecken gerechnet stuende in manchen Wochen
-- ein negativer "Eingang" – das liest niemand richtig.
WITH tage AS (
  SELECT datum,
         sum(betrag) FILTER (WHERE betrag > 0) AS eingang,
         sum(betrag) FILTER (WHERE betrag < 0) AS ausgang,
         sum(betrag)                           AS veraenderung
    FROM controlling.liq_tag GROUP BY datum
)
SELECT t.datum,
       EXTRACT(ISOYEAR FROM t.datum)::int             AS iso_jahr,
       EXTRACT(WEEK    FROM t.datum)::int             AS kalenderwoche,
       EXTRACT(MONTH   FROM t.datum)::int             AS monat,
       to_char(t.datum, 'Dy')                         AS wochentag,
       COALESCE(t.eingang, 0)                         AS eingang,
       COALESCE(t.ausgang, 0)                         AS ausgang,
       t.veraenderung,
       COALESCE((SELECT startsaldo FROM controlling.liq_tag_stand), 0)
         + sum(t.veraenderung) OVER (ORDER BY t.datum) AS saldo
  FROM tage t;

-- ---------------------------------------------------------------------
-- Verdichtung auf Kalenderwochen – die Sicht fuer die Wochenrunde
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_liq_woche AS
SELECT iso_jahr, kalenderwoche,
       min(datum)          AS von,
       max(datum)          AS bis,
       sum(eingang)        AS eingang,
       sum(ausgang)        AS ausgang,
       sum(veraenderung)   AS veraenderung,
       min(saldo)          AS saldo_tiefpunkt,
       (array_agg(saldo ORDER BY datum DESC))[1] AS saldo_ende,
       (array_agg(datum ORDER BY saldo ASC))[1]  AS tiefpunkt_am
  FROM controlling.v_liq_tag
 GROUP BY iso_jahr, kalenderwoche;

-- ---------------------------------------------------------------------
-- Dieselbe Reihe auf Monate verdichtet
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_liq_tag_monat AS
SELECT EXTRACT(YEAR FROM datum)::int AS jahr, monat,
       min(datum)        AS von,
       max(datum)        AS bis,
       count(*)          AS tage,
       sum(eingang)      AS eingang,
       sum(ausgang)      AS ausgang,
       sum(veraenderung) AS veraenderung,
       min(saldo)        AS saldo_tiefpunkt,
       (array_agg(saldo ORDER BY datum DESC))[1] AS saldo_ende,
       (array_agg(datum ORDER BY saldo ASC))[1]  AS tiefpunkt_am
  FROM controlling.v_liq_tag
 GROUP BY 1, monat;

-- ---------------------------------------------------------------------
-- Je Kategorie und Woche – zeigt, woher der Ausschlag kommt
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_liq_kategorie_woche AS
SELECT EXTRACT(ISOYEAR FROM datum)::int AS iso_jahr,
       EXTRACT(WEEK    FROM datum)::int AS kalenderwoche,
       kategorie, richtung,
       sum(betrag) AS betrag
  FROM controlling.liq_tag
 GROUP BY 1, 2, kategorie, richtung
HAVING sum(betrag) <> 0;

COMMENT ON VIEW controlling.v_liq_woche IS
  'Wochensicht der Liquiditaet. saldo_tiefpunkt ist der tiefste Tagesstand '
  'innerhalb der Woche – die eigentliche Steuerungsgroesse.';
