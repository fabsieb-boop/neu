# Neustart SharePoint – so geht’s

1. Dieses ZIP entpacken nach `~/TVF-Cockpit`
2. Anleitung: **ANLEITUNG.md**
3. Kurz PowerShell:
   - `pwsh`
   - `cd ~/TVF-Cockpit/scripts`
   - `.\Connect-TVF.ps1`
   - `.\New-TVFStartseite.ps1 -RebuildHtml`
   - `.\New-TVFDashboardDesign.ps1`
4. Hand-Upload: Ordner `dateien/` + `zahlen/` + Hub `Cockpit-Hub-SharePoint.xlsx` als `Cockpit.xlsx` nach
   `Dokumente / TVF-Controlling-Cockpit`
5. Startseite: nur **design-html/STARTSEITE-INLINE.html** (nicht die volle HTML mit style)

Vollständige DB-Dump: separates ZIP **TVF_DB_Paket.zip**


## Projektakten (eine Excel je Projekt)

Separates ZIP: **TVF_Projektakten.zip** – 168 Projektakten mit Forecast, Kosten, Rechnungen, SAP-Buchungen.
Auf SharePoint nach `TVF-Controlling-Cockpit/projektakten/` hochladen.

## Werte eingebacken

Hub + `dateien/*.xlsx` enthalten **feste Zahlen** (kein Excel-Online-Neurechnen). Details: `WERTE-EINGEBACKEN.md`. Bei `#WERT!` Dateien neu hochladen und Hard-Reload.

## Keine Werte / #WERT! ?

Excel Online liest die **D-Tabellen nicht per Verknüpfung**. Nutze **TVF_ALLE_WERTE.zip** (Werte bereits aus D Finanzen/D KLR/D Liquidität übertragen), alles ersetzen, veröffentlichen, Hard-Reload. Siehe `WERTE-EINGEBACKEN.md`.

## Forecast-Tabellen

- `Forecast je Auftrag.xlsx` – Plan/Ist/Restplan je Auftrag
- `Forecast Rechnung Abgleich.xlsx` – Abgleich Forecast ↔ Rechnungstellung

Download: **TVF_Forecast_Tabellen.zip** (Details: `FORECAST-TABELLEN.md`).
