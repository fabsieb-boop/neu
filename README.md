# TVF Altwert Controlling

Das Dashboard zeigt die Arbeitsmappe `data/tvf-dashboard-download.xlsx`. Beträge werden nicht ergänzt. Die Darstellung übernimmt Farben, Schriften und den Seitenaufbau des Entwurfs. Neue Projektplanwerte werden ohne Freigabe direkt in die vorhandene Tabelle `forecast_plan` geschrieben.

## Tabellen

In `data/tvf.sqlite` liegen nur die Blätter mit eingegebenen Werten:

- `parameter`, `projekt`, `kostenart`, `buchung`
- `forecast_plan`, `ebitda_plan`, `verlust`
- `liq_parameter`, `liq_monat`, `liq_bestand`, `kontostand`
- `guv_position`, `guv_wert`, `kosten_meldung`
- `auftrag_liste`, `region_liste`, `legende`

GuV-Summen, Kennzahlen, EBITDA-Anzeige, Forecast, Regionen, Auftragsauswertung und der 26-Wochen-Plan sind Abfragen. Die Zuordnung jeder Buchung steht in der Sicht `v_zeile` und folgt den Formeln des Auftragsjournals.

Unter `Forecast-Eingabe` lassen sich Werte je aktivem Auftrag und Monat erfassen. Die Eingabe nutzt ausschließlich die Spalten des Excel-Blatts `Forecast_Plan`: Jahr, Region, Auftrag, Auftragsname, Größe, Art, Monat und Wert. Umsatz wird wie in der Mappe intern mit umgekehrtem Vorzeichen gespeichert. Es gibt keinen Freigabeschritt.

## Start

```sh
python3 scripts/import_excel.py
npm install
npm run verify
python3 server/api.py
npm run dev
```

Die Oberfläche liegt unter http://localhost:5173 und liest die API auf Port 8787.
