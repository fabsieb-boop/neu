# TVF Altwert Controlling

Das Dashboard zeigt die Arbeitsmappe `data/tvf-dashboard-download.xlsx`. Beträge werden nicht ergänzt. Die Datenbank folgt `sql/schema.sql`, der SQLite-Fassung des Controlling-Modells. SAP-Beträge bleiben im SAP-Vorzeichen. Gedreht wird nur über `konto.kaufm_faktor`. Forecast-Werte stehen kaufmännisch positiv in `forecast_wert`.

## Tabellen

Gefüllt werden nur Tabellen mit Zeilen aus der Mappe: Region, Kostenstelle, Konto, Kontenzuordnung, Projekt, Kostenverfolgung, Buchung, Forecast, Liquiditätsstände, KLR-Sätze und die Kennzahldefinitionen. Leere Bereiche der Vorlage (Partner, Stunden, Risiken, Unteraufträge, Bilanzsalden) werden nicht angelegt. `benutzer` darf leer sein, bis sich jemand anmeldet.

Ist-Monate kommen aus `buchung`. Planmonate kommen aus `forecast_wert`. Der letzte Ist-Monat steht an der aktiven Forecast-Version. Ein erneuter Excel-Import setzt ihn nur zurück, wenn niemand einen anderen Monat freigegeben hat.

Unter System → Import lässt sich neben der Dashboard-Mappe ein Kontoauszug einlesen. Die Zeilen liegen dann in `liq_posten` des Szenarios Kontoauszug. Dieselbe Buchung wird beim erneuten Import übersprungen.

## Start

```sh
python3 scripts/import_excel.py
npm install
npm run verify
python3 server/api.py
npm run dev
```

Die Oberfläche liegt unter http://localhost:5173 und liest die API auf Port 8787.
Beim ersten Aufruf wird ausschließlich der erste Administrator eingerichtet;
Unternehmensdaten liefert die API erst nach der Anmeldung aus. Zugewiesene
Regionen begrenzen Dashboard, Buchungen, Projekte, Kostenverfolgung und
Forecast serverseitig.
