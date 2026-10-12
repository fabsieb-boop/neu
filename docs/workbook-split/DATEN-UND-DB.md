# Daten & Datenbank im Paket

## Excel / SharePoint
- `dateien/` – Einzeldateien (gesplittet, verknüpft)
- `Cockpit-Hub-SharePoint.xlsx` – Hub ohne `#BLOCKIERT!` (als `Cockpit.xlsx` hochladen)
- `zahlen/` – **gerettete Zahlen** aus `db.zip` (siehe [ZAHLEN.md](ZAHLEN.md))
- `design-html/` – Startseite + 37 Unterseiten-HTML aus App-Navigation
- `dashboard-design.json` – Schema `tvf-dashboard-design-v2-app`
- `app-sharepoint-map.json` – App-Route → SharePoint-Seite → Excel

## App (`app-quelle/` + Mapping)
Navigation aus `Shell.tsx.bak-ersetzt` (volle App-Leiste):

- **Ergebnisrechnung:** DB1–DB4, GuV, GuV-SAP, KLR, Projekte, Auftragsauswertung, KV, Bestand, Belegjournal, Mitarbeiter
- **Planung:** Angebote, Forecast, FC-Eingabe, Mehrjahresplan, Liquidität, Risiken, Nachträge
- **Berichte:** Berichtsgenerator, Vorstand, Folienwerte, Baukasten
- **Regionen:** West, Süd-West, Ost, Berlin, Verwaltung
- **Grundlagen / System:** Abstimmung, Handbuch, Import, Einstellungen, Zahlen-Export

Deploy: `scripts/New-TVFDashboardDesign.ps1`

## Datenbank (`db/`) – vollständiges `db.zip`

| Bereich | Inhalt |
|---|---|
| Shell | `umgebung.sh`, `sichern.sh`, `setup.sh`, `pruefen.sh` |
| Doku | `README.md` |
| Modell | `01_modell.sql` … Migrationen inkl. `62`–`66` |
| Dump | `database.sql` (~25 MB, 10 509 Buchungen, 153 Projekte) |

Details: [`db/README.md`](db/README.md) · Zahlenexport: [`ZAHLEN.md`](ZAHLEN.md)
