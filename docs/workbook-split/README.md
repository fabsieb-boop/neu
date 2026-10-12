# TVF Controlling Cockpit – Einzeldateien für SharePoint

Die Mappe `TVF_Controlling_Cockpit_Import1.xlsx` ist in **48 Einzeldateien** zerlegt. Blattübergreifende Formeln wurden in **externe Arbeitsmappen-Verknüpfungen** umgeschrieben, damit die Verbindungen im selben SharePoint-Ordner erhalten bleiben.

## Inhalt

**Neu aus app.zip / db.zip:** gerettete Zahlen (`zahlen/`, siehe `ZAHLEN.md`), App→SharePoint-Mapping (`app-sharepoint-map.json`), Design v2 (`dashboard-design.json`), 37 HTML-Unterseiten, vollständige `db/`.


| Pfad | Zweck |
|---|---|
| `dateien/` | 48 × `.xlsx` (ein Blatt pro Datei) |
| `seiten.json` | Katalog aller SharePoint-Seiten (38) inkl. Startseite |
| `auswertungs-und-eingabeseiten.md` | Übersicht Auswertung / Forecast-Eingabe / Projekte |
| `SCHRITT-FUER-SCHRITT.md` | Anleitung: was du nacheinander machst |
| `HAND-UPLOAD.md` | Manuell hochladen ohne PowerShell |
| `manifest.json` | Dateiliste, Tabellen, Abhängigkeitsgraph |
| `scripts/split_workbook.py` | Trennung erneut erzeugen |
| `scripts/New-TVFCockpitStartseite.ps1` | PnP: Upload + Startseite + alle Fachseiten |
| `scripts/TVF_Cockpit_Startseite.office.ts` | Office Script für die Hub-Datei `Cockpit.xlsx` |
| `TVF_Cockpit_Dateien.zip` | nur die 48 Excel-Dateien |
| `TVF_Cockpit_SharePoint_Paket.zip` | ZIP inkl. Skripte und Seitenkatalog |

## Hub / Startseite und Fachseiten

- **Excel-Hub:** `dateien/Cockpit.xlsx` – Kennzahlen und Hyperlinks auf alle Fachdateien
- **SharePoint-Startseite:** `TVF-Controlling-Cockpit` mit Navigation + File Viewer auf `Cockpit.xlsx`
- **38 Seiten (Auswertung, Eingabe, Projekte, …)** laut Anleitung-Mapping (GuV, Forecast, Projekte, KLR, …) – je eine moderne Seite mit File Viewer auf die passende `.xlsx`
- Katalog: `seiten.json`

## Verknüpfungslogik

Beispiel in `Cockpit.xlsx`:

```text
='[GuV.xlsx]GuV'!D9
='[Forecast.xlsx]Forecast'!L23
=IFERROR(HYPERLINK("[Steuerung.xlsx]Steuerung!C2","Steuerung"),"Steuerung")
```

Strukturierte Tabellenbezüge (z. B. `TVFImportMonate[Jahr]`) auf **anderen** Blättern wurden in Zellbereiche der Zieldatei umgeschrieben, z. B.:

```text
'[Import Monatsdaten.xlsx]Import Monatsdaten'!$C$7:$C$8
```

## SharePoint laden

**Mac / Site:** https://tvfaltwert.sharepoint.com/sites/03-Finance – Startseite `TVF-ALTWERT-GMBH-Dashboard`. Details: `SCHRITT-FUER-SCHRITT.md`.


1. Modul: `Install-Module PnP.PowerShell -Scope CurrentUser`
2. Anmelden: `Connect-PnPOnline -Url https://TENANT.sharepoint.com/sites/SITE -Interactive`
3. Skript ausführen:

```powershell
cd ...\docs\workbook-split\scripts
.\New-TVFCockpitStartseite.ps1
```

Default-Site ist `03-Finance`, Startseite `TVF-ALTWERT-GMBH-Dashboard`. Upload überspringen: `-SkipUpload`.

4. https://tvfaltwert.sharepoint.com/sites/03-Finance/SitePages/TVF-ALTWERT-GMBH-Dashboard.aspx öffnen. Excel-Links einmal aktualisieren.

## Office Script Startseite

In Excel für das Web unter Automatisieren das Script `TVF_Cockpit_Startseite.office.ts` anlegen und in `Cockpit.xlsx` ausführen, falls die Hub-Formeln neu gesetzt werden sollen.

## Wichtige Dateien

| Datei | Rolle |
|---|---|
| `Cockpit.xlsx` | Start / Kennzahlen |
| `Steuerung.xlsx` | Berichtsjahr, Monat, Region, Projekt |
| `GuV.xlsx` | GuV und EBITDA |
| `Forecast.xlsx` / `FC Eingabe.xlsx` | Forecast und Deltas |
| `Import Monatsdaten.xlsx` | Tabelle `TVFImportMonate` |
| `Import Stunden.xlsx` | Tabelle `TVFImportStunden` |
| `D Finanzen.xlsx`, `D Projekte.xlsx`, `D KLR.xlsx`, … | Quelldaten |

## Hinweise

- Diagramme aus der Originalmappe wurden beim Split nicht vollständig übernommen (openpyxl). Fachformeln und Tabellen sind enthalten.
- Excel Online löst externe Links oft erst nach Bestätigung bzw. besser in Excel Desktop.
- Dateinamen entsprechen den Blattnamen (SharePoint-sichere Zeichen). Umlaute bleiben erhalten (`Bestände.xlsx`, `Maßnahmen.xlsx`, …).
- Quelldaten-Excel ohne eigene Seite (D Finanzen, Buchungen, …) werden mit hochgeladen und bleiben über Formeln erreichbar.
