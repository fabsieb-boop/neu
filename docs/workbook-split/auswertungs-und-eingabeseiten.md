# Auswertungs-, Projekt- und Eingabeseiten

Site: https://tvfaltwert.sharepoint.com/sites/03-Finance  
Start: https://tvfaltwert.sharepoint.com/sites/03-Finance/SitePages/TVF-ALTWERT-GMBH-Dashboard.aspx

SharePoint legt diese Seiten mit dem PnP-Skript an. Jede Seite bettet die genannte Excel-Datei ein. Katalog: `seiten.json`.

## Eingabe (Forecast & Import)

| SharePoint-Seite | Excel | Zweck |
|---|---|---|
| TVF-Steuerung | Steuerung.xlsx | Berichtsjahr, Monat, Region, Projekt |
| **TVF-FC-Eingabe** | **FC Eingabe.xlsx** | Forecast-Deltas (Umsatz / Bestand / Kosten) |
| TVF-Import | Import.xlsx | Import-Anleitung |
| TVF-Import-Monatsdaten | Import Monatsdaten.xlsx | Monats-GuV (TVFImportMonate) |
| TVF-Import-Stunden | Import Stunden.xlsx | Stundenimport |

## Auswertung

| SharePoint-Seite | Excel |
|---|---|
| TVF-GuV | GuV.xlsx |
| TVF-Monatsanalyse | Monatsanalyse.xlsx |
| **TVF-Forecast** | **Forecast.xlsx** |
| TVF-Regionen | Regionen.xlsx |
| TVF-Berichte | Berichte.xlsx |
| TVF-Bilanz | Bilanz.xlsx |
| TVF-Liquiditaet | Liquidität.xlsx |
| TVF-Monatsroll | Monatsroll.xlsx |
| TVF-Mehrjahresplan | Mehrjahresplan.xlsx |
| TVF-KLR | KLR.xlsx |
| TVF-Stunden | Stunden.xlsx |
| TVF-Stundensaetze | Stundensätze.xlsx |
| TVF-Kalkulation | Kalkulation.xlsx |
| TVF-Vertrieb | Vertrieb.xlsx |
| TVF-Bereinigungen | Bereinigungen.xlsx |
| TVF-Pruefungen | Prüfungen.xlsx |

## Projekte

| SharePoint-Seite | Excel |
|---|---|
| **TVF-Projekte** | **Projekte.xlsx** |
| **TVF-Projektakte** | **Projektakte.xlsx** |
| TVF-Kostenverfolgung | Kostenverfolgung.xlsx |
| TVF-Bestaende | Bestände.xlsx |
| TVF-Risiken | Risiken.xlsx |
| TVF-Massnahmen | Maßnahmen.xlsx |
| TVF-Fremdleistungen | Fremdleistungen.xlsx |

## Startseite

`TVF-ALTWERT-GMBH-Dashboard` verlinkt alle Gruppen und zeigt `Cockpit.xlsx`.

## Anlegen

```powershell
.\New-TVFCockpitStartseite.ps1 -SiteUrl "https://TENANT.sharepoint.com/sites/SITE" -SetAsHomePage
```

Damit entstehen **38 Seiten** (Start + Eingabe + Auswertung + Projekte + Abschluss + System).
