-- Eingabe je Region für Monate, die noch nicht belastbar sind.
-- SAP-Monate bleiben in v_ebitda_region_monat. Diese Tabelle ersetzt sie nicht
-- und schreibt weder forecast_position noch das Unternehmens-EBITDA fort.

CREATE TABLE IF NOT EXISTS controlling.region_monat_eingabe (
  jahr integer NOT NULL,
  region text NOT NULL,
  monat integer NOT NULL CHECK (monat BETWEEN 1 AND 12),
  umsatz numeric(18,2),
  kosten numeric(18,2),
  bestandsveraenderung numeric(18,2),
  abgrenzung numeric(18,2),
  geaendert_am timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (jahr, region, monat)
);
