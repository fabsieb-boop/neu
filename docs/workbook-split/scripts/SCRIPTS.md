# Skripte (aktualisiert für TVF Mac)

| Datei | Zweck |
|---|---|
| `mac-ordner-anlegen.sh` | Ordner `~/TVF-Cockpit` anlegen, ZIP entpacken |
| `Install-PnP.ps1` | PnP.PowerShell installieren |
| `Connect-TVF.ps1` | Anmelden mit Client-ID |
| `New-TVFCockpitStartseite.ps1` | Upload + 38 Seiten |
| `Start-TVFDeploy.ps1` | Connect + Deploy in einem Rutsch |
| `New-TVFDashboardDesign.ps1` | Komplettes Dashboard-Design (Start + Unterseiten Regionen/Projekte) |
| `TVF_Cockpit_Startseite.office.ts` | Office Script für Excel-Hub |
| `split_workbook.py` | Excel erneut in Einzeldateien trennen |

## Defaults

- Site: `https://tvfaltwert.sharepoint.com/sites/03-Finance`
- ClientId: `409b0310-a1b1-4684-9a92-f79ab67b9c05`
- Startseite: `TVF-ALTWERT-GMBH-Dashboard`
- Ordner: `Dokumente/TVF-Controlling-Cockpit`

## Empfohlene Reihenfolge (Mac)

Im normalen Terminal:

```bash
bash ~/TVF-Cockpit/scripts/mac-ordner-anlegen.sh
# oder ZIP manuell entpacken nach ~/TVF-Cockpit
pwsh
```

In PowerShell **einzeln**:

```powershell
cd ~/TVF-Cockpit/scripts
.\Install-PnP.ps1
.\Start-TVFDeploy.ps1
```

Oder Schritt für Schritt:

```powershell
.\Connect-TVF.ps1
.\New-TVFCockpitStartseite.ps1
```

Device-Login:

```powershell
.\Start-TVFDeploy.ps1 -DeviceLogin
```

Nur Seiten, Dateien schon oben:

```powershell
.\Start-TVFDeploy.ps1 -SkipUpload
```


## Dashboard-Design

Siehe `../DESIGN.md` und `../dashboard-design.json`.

```powershell
.\Connect-TVF.ps1
.\New-TVFDashboardDesign.ps1
```
