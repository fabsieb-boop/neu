-- Manuelle Korrektur der Monatssicht. Sie liegt auf dem Gebuchten oder dem
-- Forecast und schreibt weder SAP noch den FI-EBITDA fort.

CREATE TABLE IF NOT EXISTS controlling.monat_korrektur (
  jahr integer NOT NULL,
  monat integer NOT NULL CHECK (monat BETWEEN 1 AND 12),
  umsatz numeric(18,2),
  kosten numeric(18,2),
  bestandsveraenderung numeric(18,2),
  abgrenzung numeric(18,2),
  geaendert_am timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (jahr, monat)
);
