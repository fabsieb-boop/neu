# TVF Dashboard Design – Startseite & Unterseiten

Struktur aus **app.zip** (Shell-Navigation) und **db.zip** (Zahlen): **Cockpit → Steuerung → GuV → Forecast**, dazu **Regionen**, **Projekte** und alle App-Gruppen (Ergebnisrechnung, Planung, Berichte, Grundlagen, System).

## Dateien

| Datei | Zweck |
|---|---|
| `dashboard-design.json` | Schema `v2-app`: Seitenbaum, App-Nav, KPI aus DB |
| `app-sharepoint-map.json` | App-Route → SharePoint-Seite → Excel |
| `scripts/New-TVFDashboardDesign.ps1` | PnP: alle Seiten + Excel + Zahlen-Upload |
| `design-html/STARTSEITE.html` | HTML zum Einfügen per Hand |
| `design-html/seiten/*.html` | 37 Unterseiten-HTML |
| `zahlen/` | Gerettete Zahlen ([ZAHLEN.md](ZAHLEN.md)) |
| `Cockpit-Hub-SharePoint.xlsx` | Excel-Hub (Cockpit+Steuerung+GuV+Forecast+…) |

## Seitenbaum

### Start
- `TVF-ALTWERT-GMBH-Dashboard` (Startseite)
- `TVF-Cockpit`

### Auswertung
- `TVF-Steuerung`
- `TVF-GuV`
- `TVF-Forecast`
- `TVF-FC-Eingabe`
- `TVF-Monatsanalyse`
- `TVF-Berichte`

### Regionen
- `TVF-Regionen` (Übersicht)
- `TVF-Region-West`
- `TVF-Region-Sued-West`
- `TVF-Region-Ost`
- `TVF-Region-Berlin`
- `TVF-Region-Verwaltung`

### Projekte
- `TVF-Projekte`
- `TVF-Projektakte`
- `TVF-Kostenverfolgung`
- `TVF-Bestaende`
- `TVF-Risiken`
- `TVF-Massnahmen`

---

## Variante A – per Skript (wenn PnP-Login geht)

```powershell
cd ~/TVF-Cockpit/scripts
.\Connect-TVF.ps1
.\New-TVFDashboardDesign.ps1
```

Oder:

```powershell
.\New-TVFDashboardDesign.ps1 -Connect
```

Nur Design, Excel schon oben:

```powershell
.\New-TVFDashboardDesign.ps1 -SkipExcelUpload
```

---

## Variante B – per Hand (empfohlen bei dir)

### 1. Excel-Hub ersetzen
1. `Cockpit-Hub-SharePoint.xlsx` als **`Cockpit.xlsx`** in  
   `Dokumente / TVF-Controlling-Cockpit` hochladen (ersetzen).
2. Einmal in Excel für Mac öffnen → speichern.

### 2. Startseite designen
1. https://tvfaltwert.sharepoint.com/sites/03-Finance/SitePages/TVF-ALTWERT-GMBH-Dashboard.aspx → **Bearbeiten**
2. Text-Webpart → HTML aus `design-html/STARTSEITE.html` einfügen
3. Darunter **Datei-Viewer** → `Cockpit.xlsx`
4. **Veröffentlichen**

### 3. Unterseiten anlegen
Für jede Seite aus dem Seitenbaum:

1. SharePoint → **+ Neu** → **Seite**
2. Name genau wie in der Tabelle (`TVF-GuV`, `TVF-Forecast`, …)
3. HTML aus `UNTERSEITE-VORLAGE.html` einfügen (Titel/Beschreibung/Excel anpassen)
4. File-Viewer:
   - Steuerung / GuV / Forecast / FC Eingabe → **`Cockpit.xlsx`** (Blatt im Excel wählen)
   - Regionen → `Regionen.xlsx`
   - Projekte → `Projekte.xlsx` usw.
5. Veröffentlichen
6. Von der Startseite verlinken (Links in STARTSEITE.html zeigen schon auf diese Namen)

### 4. Reihenfolge der wichtigsten Seiten
1. TVF-Cockpit  
2. TVF-Steuerung  
3. TVF-GuV  
4. TVF-Forecast  
5. TVF-FC-Eingabe  
6. TVF-Regionen (+ 5 Region-Seiten)  
7. TVF-Projekte + TVF-Projektakte  

---

## Design-Sprache

- Primär: `#1F4E79` (Blau wie Cockpit)
- Akzent: `#5B2C6F` (Violett wie Original-Dashboard)
- Kacheln: hellgrau `#F3F6F9`, linke Kante in Primärfarbe
- Hero: Verlauf Blau → Violett
- Schrift: Segoe UI (SharePoint-Standard)

Entspricht der Excel-/Original-Dashboard-Optik (Blau/Violett), nicht einem neuen Fremddesign.
