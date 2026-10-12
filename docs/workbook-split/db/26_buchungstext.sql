-- Buchungstext an der Belegzeile, damit eine Korrektur aus der Admin-Liste
-- an der Buchung stehen bleibt. Betrag und Auftrag bleiben die bisherigen Spalten.

ALTER TABLE controlling.buchungen
  ADD COLUMN IF NOT EXISTS buchungstext character varying(255);
