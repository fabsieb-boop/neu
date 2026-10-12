# Was du jetzt machen musst (Mac)

**Site:** https://tvfaltwert.sharepoint.com/sites/03-Finance  
**Dashboard:** https://tvfaltwert.sharepoint.com/sites/03-Finance/SitePages/TVF-ALTWERT-GMBH-Dashboard.aspx  
**Entra Client-ID:** `409b0310-a1b1-4684-9a92-f79ab67b9c05`

Ziel: Excel + gerettete Zahlen hochladen, Startseite und Unterseiten (Cockpit, GuV, Forecast, Regionen, Projekte, …) anlegen.

---

## Variante A – mit PowerShell (empfohlen, alles automatisch)

### 1. Ordner auf dem Mac

Terminal:

```bash
mkdir -p ~/TVF-Cockpit
open ~/TVF-Cockpit
```

### 2. ZIP entpacken

Paket heißen typischerweise `TVF_Cockpit_SharePoint_Paket.zip` (Downloads oder aus dem Git-Ordner `docs/workbook-split/`).

```bash
unzip -o ~/Downloads/TVF_Cockpit_SharePoint_Paket.zip -d ~/TVF-Cockpit
ls ~/TVF-Cockpit
ls ~/TVF-Cockpit/dateien | wc -l
ls ~/TVF-Cockpit/zahlen
```

Erwartet u. a.:

- `dateien/` (Excel-Dateien)
- `zahlen/` (gerettete Zahlen: `TVF_Zahlen_Export.xlsx`, CSVs)
- `Cockpit-Hub-SharePoint.xlsx`
- `scripts/`
- `design-html/`
- `dashboard-design.json`
- `ANLEITUNG.md`

### 3. PowerShell + PnP (nur einmal)

```bash
brew install --cask powershell
pwsh
```

In PowerShell:

```powershell
Install-Module PnP.PowerShell -Scope CurrentUser -Force
```

### 4. Anmelden

```powershell
cd ~/TVF-Cockpit/scripts
.\Connect-TVF.ps1
```

Browser-Login mit deinem TVF-Konto. Wenn nichts passiert oder Fehler:

```powershell
.\Connect-TVF.ps1 -DeviceLogin
```

Code im Browser eingeben, fertig wenn `Verbunden: …03-Finance` erscheint.

### 5. Alles deployen (Excel + Zahlen + Seiten)

```powershell
.\New-TVFDashboardDesign.ps1
```

Das Skript:

1. legt den Ordner `Dokumente / TVF-Controlling-Cockpit` an  
2. lädt den **Hub** als `Cockpit.xlsx` hoch (ohne `#BLOCKIERT!`)  
3. lädt die Excel-Dateien aus `dateien/`  
4. lädt `zahlen/` (gerettete DB-Zahlen)  
5. aktualisiert die Startseite **TVF-ALTWERT-GMBH-Dashboard**  
6. legt die Unterseiten an (GuV, Forecast, Regionen, Projekte, …)

### 6. Prüfen im Browser

1. Dashboard öffnen (Link oben)  
2. Kacheln testen: Cockpit, GuV, Forecast, Regionen, Projekte  
3. Excel im Viewer: Blatt wechseln (Steuerung / GuV / Forecast)  
4. Seite **TVF-Zahlen** bzw. Ordner `…/TVF-Controlling-Cockpit/zahlen/` – dort muss `TVF_Zahlen_Export.xlsx` liegen  

Fertig.

---

## Variante B – per Hand (ohne PowerShell)

### 1. ZIP entpacken (wie oben)

### 2. SharePoint-Ordner

1. https://tvfaltwert.sharepoint.com/sites/03-Finance → **Dokumente**  
2. **+ Neu** → Ordner `TVF-Controlling-Cockpit`  
3. Darin nochmal Ordner `zahlen` anlegen  

### 3. Dateien hochladen

| Von lokal | Nach SharePoint |
|---|---|
| `Cockpit-Hub-SharePoint.xlsx` **als** `Cockpit.xlsx` | `TVF-Controlling-Cockpit/` |
| alle Dateien aus `dateien/` (ohne alte Cockpit ersetzen, wenn Hub schon da) | `TVF-Controlling-Cockpit/` (flach, keine Unterordner) |
| alles aus `zahlen/` | `TVF-Controlling-Cockpit/zahlen/` |

**Wichtig:** Die Hub-Datei heißt auf SharePoint **`Cockpit.xlsx`** – sonst `#BLOCKIERT!` in eingebetteten Viewern.

### 4. Startseite designen

1. Dashboard im **Bearbeiten**-Modus öffnen  
2. Text-Webpart → Inhalt von `design-html/STARTSEITE.html` einfügen (oder Kacheln manuell nach der HTML-Vorlage)  
3. File-Viewer-Webpart → Datei `Cockpit.xlsx` aus dem Ordner wählen  
4. Veröffentlichen  

### 5. Unterseiten

Für jede Seite unter `design-html/seiten/` (z. B. `TVF-GuV.html`):

1. **+ Neu** → **Seite** → Name wie Dateiname ohne `.html` (z. B. `TVF-GuV`)  
2. HTML aus der Datei in ein Text-Webpart  
3. File-Viewer auf die passende Excel (steht in der HTML / in `app-sharepoint-map.json`)  
4. Veröffentlichen  

Mindestens anlegen: `TVF-Cockpit`, `TVF-Steuerung`, `TVF-GuV`, `TVF-Forecast`, `TVF-FC-Eingabe`, `TVF-Regionen`, `TVF-Projekte`, `TVF-Zahlen`.

---

## Was wo liegt (kurz)

| Bedarf | Datei / Ordner |
|---|---|
| Hub ohne Blockiert | `Cockpit-Hub-SharePoint.xlsx` → SharePoint `Cockpit.xlsx` |
| Einzel-Excels | `dateien/` |
| Gerettete Zahlen (DB) | `zahlen/TVF_Zahlen_Export.xlsx` |
| Auto-Deploy | `scripts/New-TVFDashboardDesign.ps1` |
| HTML von Hand | `design-html/STARTSEITE.html` + `design-html/seiten/` |
| App → Seite → Excel | `app-sharepoint-map.json` |
| Volle DB (optional) | `TVF_DB_Paket.zip` / `db/` |

---

## Wenn etwas schiefgeht

| Problem | Lösung |
|---|---|
| `#BLOCKIERT!` in Excel | Hub `Cockpit.xlsx` aus diesem Paket nutzen (nicht die alte Einzel-Cockpit mit Fremdlinks) |
| PnP: Client-ID fehlt | `Connect-TVF.ps1` nutzen (ID ist schon eingetragen) |
| Login hängt | `.\Connect-TVF.ps1 -DeviceLogin` |
| Zahlen fehlen | Ordner `zahlen/` hochladen bzw. Skript ohne `-SkipExcelUpload` erneut laufen lassen |
| Seite leer | File-Viewer-Pfad prüfen: Datei muss im Ordner `TVF-Controlling-Cockpit` liegen |

---

## Nur Zahlen nachziehen

```powershell
cd ~/TVF-Cockpit/scripts
.\Connect-TVF.ps1
.\New-TVFDashboardDesign.ps1 -SkipExcelUpload   # nur wenn Excels schon da sind – besser einmal komplett ohne Skip
```

Oder per Hand: Inhalt von `zahlen/` nach `…/TVF-Controlling-Cockpit/zahlen/` ziehen.

---

## Reihenfolge zum Abhaken

- [ ] ZIP nach `~/TVF-Cockpit` entpackt  
- [ ] `Connect-TVF.ps1` verbunden  
- [ ] `New-TVFDashboardDesign.ps1` durchgelaufen  
- [ ] Dashboard im Browser öffnet und Kacheln funktionieren  
- [ ] `Cockpit.xlsx` zeigt Werte (kein `#BLOCKIERT!`)  
- [ ] Ordner `zahlen` mit `TVF_Zahlen_Export.xlsx` sichtbar  
