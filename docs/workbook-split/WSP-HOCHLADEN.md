# SharePoint Project Management Template (.wsp) auf SharePoint

Die Datei `SharePoint_Project_Management_Template.wsp` ist ein **klassisches Site-Template** (SharePoint 2013 / Produktversion 15, BrightWork Free Template).  
Sie enthält u. a. Listen *Project Tasks*, *Project Issues*, *Status Reports*, Wiki, Masterpage und alte Workflows.

Euer Controlling läuft auf **SharePoint Online** (`tvfaltwert.sharepoint.com`). Dort funktionieren solche `.wsp`-Pakete nur eingeschränkt.

---

## Variante A – SharePoint Online (Versuch über Lösungskatalog)

Nur sinnvoll, wenn die Site **klassische** Features noch zulässt und du **Websiteauflistungs-Administrator** bist.

1. Datei bereithalten: `SharePoint_Project_Management_Template.wsp`
2. Im Browser die **Stammwebsite der Websiteauflistung** öffnen  
   (z. B. `https://tvfaltwert.sharepoint.com/sites/03-Finance` – oft die Site Collection Root).
3. URL manuell öffnen (Lösungskatalog):  
   `https://tvfaltwert.sharepoint.com/sites/03-Finance/_catalogs/solutions/Forms/AllItems.aspx`  
   Falls 404: unter Websiteeinstellungen nach **Lösungen** / **Solutions** suchen.
4. **Hochladen** → `.wsp` wählen → speichern.
5. Die Lösung in der Liste markieren → **Aktivieren**.
6. Danach: **Websiteeinstellungen** → **Websitesammlungen** / **New site** bzw.  
   `https://tvfaltwert.sharepoint.com/sites/03-Finance/_layouts/15/newsbweb.aspx`  
   (oder „Website hinzufügen“) → unter Vorlagen sollte  
   **SharePoint Project Management Template** erscheinen → neue Unterwebsite damit anlegen.

### Typische Stolpersteine Online

| Problem | Bedeutung |
|--------|-----------|
| Lösungskatalog fehlt / 404 | Moderne Sites haben oft keinen Sandbox-Lösungskatalog mehr |
| Aktivieren schlägt fehl | Sandbox-Lösungen in SPO stark eingeschränkt / abgeschaltet |
| Vorlage erscheint nicht | WebTemplate wurde nicht registriert |
| Seite sieht kaputt aus | Klassische Masterpage + Workflows 2010 passen nicht zu modernen Sites |
| Workflows laufen nicht | SharePoint-2010-Workflows in SPO sind abgeschaltet |

Wenn einer dieser Punkte zutrifft: Variante A ist für eure Tenant-Konfiguration **nicht geeignet**.

---

## Variante B – SharePoint Server vor Ort (2013/2016/2019)

Nur wenn ihr wirklich einen klassischen Server habt (nicht Microsoft 365):

1. Als Farm-Administrator: Central Administration → **System Settings** → **Manage farm solutions**  
   bzw. PowerShell:
   ```powershell
   Add-SPSolution -LiteralPath "C:\Temp\SharePoint_Project_Management_Template.wsp"
   Install-SPSolution -Identity SharePoint_Project_Management_Template.wsp -GACDeployment
   ```
2. Site Collection Features aktivieren, dann neue Website mit dem WebTemplate anlegen.

Das gilt **nicht** für `*.sharepoint.com`.

---

## Variante C – Empfohlen für eure TVF-Online-Site

Statt der alten `.wsp` die Projektstruktur **modern** nachbauen bzw. eure bestehenden Controlling-Dateien nutzen:

- Projektlisten / Suche: bereits `Projektakte.xlsx` / `Projektakten_Suche.xlsx` im Ordner `TVF-Controlling-Cockpit`
- Forecast je Auftrag + Abgleich Rechnung: `TVF_Forecast_Tabellen.zip`
- Für echtes Projektmanagement in M365 eher: **Planner**, **Project for the web**, oder eine **moderne Teamwebsite** mit Listen (Aufgaben, Probleme, Dokumente) manuell anlegen – ohne `.wsp`

Die BrightWork-`.wsp` ist ein Export von ca. 2018 und zielt auf klassisches SharePoint 15, nicht auf das moderne 03-Finance-Dashboard.

---

## Kurzantwort

| Ziel | Vorgehen |
|------|----------|
| Datei nur ablegen | In `Dokumente` / einen Ordner hochladen – das **installiert** das Template aber nicht |
| Template als neue Projekt-Website | Lösungskatalog → hochladen → aktivieren → neue Website aus Vorlage (Variante A) |
| Microsoft 365 / moderne Site | Meist **nicht zuverlässig** → Variante C |

**Datei im Paket:** `SharePoint_Project_Management_Template.wsp`
