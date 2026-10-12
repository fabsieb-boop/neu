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
