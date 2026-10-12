# Gerettete Zahlen (db.zip → SharePoint)

## Was gerettet wurde

Aus `db/database.sql` (PostgreSQL-Dump der Controlling-App):

| Quelle | Anzahl | Ablage |
|---|---|---|
| Buchungen | 10 509 | aggregiert nach Auftrag×Periode, Periode, Projekt, Kostenart |
| Projekte | 153 | `zahlen/projekte.csv` |
| Kostenarten | 108 | `zahlen/kostenarten.csv` |
| Perioden 2026 | 1–7 | Summen in `buchungen_agg_periode.csv` |

Zusätzlich: Excel-Blätter aus `dateien/` (Import Monatsdaten, GuV, Forecast, FC Eingabe, Regionen, …) in `TVF_Zahlen_Export.xlsx`.

## Dateien unter `zahlen/`

- `TVF_Zahlen_Export.xlsx` – Arbeitsmappe für SharePoint (Upload-Ziel)
- `kpi-summary.json` – Zähler für Dashboard-KPIs
- `projekte.csv`, `kostenarten.csv`
- `buchungen_agg_*.csv` – Summen (keine 10k Einzelbelege im Excel; Vollbelege bleiben in `db/database.sql`)

## SharePoint-Ziel

`Dokumente / TVF-Controlling-Cockpit / zahlen /`

Seite: **TVF-Zahlen** (FileViewer auf `TVF_Zahlen_Export.xlsx`)

Deploy: `.\New-TVFDashboardDesign.ps1` lädt den Ordner `zahlen/` automatisch mit hoch.
