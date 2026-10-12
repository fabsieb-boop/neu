# `#BLOCKIERT!` – Lösung mit Cockpit-Hub

Externe Links zwischen Excel-Dateien funktionieren in SharePoint/Excel Online oft **nicht**. Deshalb gibt es jetzt eine **Hub-Datei**.

## Neue Datei

`Cockpit.xlsx` (auch als `Cockpit-Hub-SharePoint.xlsx`) enthält in **einer** Datei:

- Cockpit, Steuerung, GuV, Forecast, Monatsroll, FC Eingabe, Import Monatsdaten, D Finanzen

Die Kennzahlen rechnen wieder über **Blatt-Formeln in derselben Datei** – kein `[GuV.xlsx]…` mehr für die KPIs.

## Was du tun musst

1. Neue `Cockpit.xlsx` aus dem aktualisierten ZIP / Ordner `dateien` nehmen  
   (oder `Cockpit-Hub-SharePoint.xlsx` nach `Cockpit.xlsx` umbenennen)
2. In SharePoint-Ordner `TVF-Controlling-Cockpit` die **alte** `Cockpit.xlsx` ersetzen (hochladen → ersetzen)
3. Datei einmal in **Excel für Mac** öffnen → speichern (Berechnung anstoßen)
4. Dashboard-Seite neu laden (ohne Bearbeiten-Modus)

Die übrigen Einzeldateien (Projekte, Regionen, …) bleiben daneben; Navigation vom Cockpit zeigt teils dorthin.

## Wenn noch `#BLOCKIERT!` steht

- Eingebetteter Viewer: Seite veröffentlichen, hart neu laden
- Sonst Dashboard-Webpart neu auf `Cockpit.xlsx` setzen
- Zur Not: statt Einbettung Link „In Excel öffnen“
