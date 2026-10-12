-- Pflege des Jahresabschlusses: Status, Datum und hochgeladene Datei
-- je Unterlage und je Aufgabe. Die Datei selbst liegt unter uploads/ja.

CREATE TABLE IF NOT EXISTS controlling.ja_stand (
  schluessel varchar(80) PRIMARY KEY,
  art varchar(20) NOT NULL,
  titel text,
  status varchar(20) NOT NULL DEFAULT 'offen',
  datum date,
  quelle text,
  dateiname text,
  datei text,
  geaendert_am timestamptz NOT NULL DEFAULT now(),
  geaendert_von integer
);
