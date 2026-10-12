# Schritt für Schritt: Cockpit nach SharePoint (Mac)

**Eure Site:** https://tvfaltwert.sharepoint.com/sites/03-Finance  
**Startseite (bestehend):** [TVF-ALTWERT-GMBH-Dashboard](https://tvfaltwert.sharepoint.com/sites/03-Finance/SitePages/TVF-ALTWERT-GMBH-Dashboard.aspx)

Das Skript aktualisiert genau diese Dashboard-Seite und legt die übrigen Fachseiten auf derselben Site an.

---

## Schritt 1 – Ordner auf dem Mac anlegen (Terminal)

Terminal öffnen (Programme → Dienstprogramme → Terminal, oder Spotlight: „Terminal“) und ausführen:

```bash
mkdir -p ~/TVF-Cockpit
mkdir -p ~/TVF-Cockpit/dateien
mkdir -p ~/TVF-Cockpit/scripts
open ~/TVF-Cockpit
```

- `mkdir -p` legt den Ordner an (auch wenn er schon existiert, kein Fehler).
- `open` öffnet den Ordner im Finder.

Prüfen:

```bash
ls -la ~/TVF-Cockpit
```

Pfad absolut: `/Users/<dein-kurzname>/TVF-Cockpit`

---

## Schritt 2 – ZIP entpacken in diesen Ordner

ZIP liegt typischerweise in Downloads. Entpacken:

```bash
cd ~/Downloads
unzip -o TVF_Cockpit_SharePoint_Paket.zip -d ~/TVF-Cockpit
ls ~/TVF-Cockpit
ls ~/TVF-Cockpit/dateien | wc -l
```

Erwartet: u. a. `dateien`, `scripts`, `seiten.json`, `SCHRITT-FUER-SCHRITT.md` und ca. **48** Excel-Dateien in `dateien`.

Falls das ZIP anders heißt oder woanders liegt:

```bash
unzip -o ~/Downloads/TVF_Cockpit_SharePoint_Paket.zip -d ~/TVF-Cockpit
```

---

## Schritt 3 – PowerShell auf dem Mac (einmalig)

```bash
brew install --cask powershell
pwsh --version
```

---

## Schritt 4 – PnP.PowerShell (einmalig)

```bash
pwsh
```

```powershell
Install-Module PnP.PowerShell -Scope CurrentUser -Force
```

---

## Schritt 5 – Anmelden (Entra App-ID nötig)

Neuere PnP.PowerShell-Versionen brauchen eine **eigene App-Registrierung** in Microsoft Entra ID. Deshalb kommt die Meldung:

`Please specify a valid client id for an Entra ID App Registration`

### 5a – App einmalig anlegen (Azure-Portal)

1. Im Browser: https://portal.azure.com → **Microsoft Entra ID** → **App-Registrierungen** → **Neue Registrierung**
2. Name z. B. `PnP-TVF-Cockpit`
3. Kontotyp: **Nur dieses Organisationsverzeichnis**
4. Umleitungs-URI:
   - Plattform: **Öffentlicher Client/nativ (mobil & Desktop)**
   - URI: `http://localhost`
5. **Registrieren** → die **Anwendungs-ID (Client)** kopieren (eine GUID)
6. Links **Authentifizierung** → ganz unten **Öffentliche Clientflows zulassen** = **Ja** → Speichern
7. Links **API-Berechtigungen** → **Berechtigung hinzufügen**:
   - **SharePoint** → Delegierte Berechtigungen → `AllSites.FullControl`
   - **Microsoft Graph** → Delegiert → `User.Read` (meist schon da)
8. **Administratoreinwilligung für TVF ALTWERT erteilen** (braucht oft einen Admin)

### 5b – In PowerShell verbinden

Client-ID einsetzen (Platzhalter ersetzen):

```powershell
$clientId = "409b0310-a1b1-4684-9a92-f79ab67b9c05"
Connect-PnPOnline -Url "https://tvfaltwert.sharepoint.com/sites/03-Finance" -Interactive -ClientId $clientId
```

Wenn der Browser auf dem Mac zickt:

```powershell
Connect-PnPOnline -Url "https://tvfaltwert.sharepoint.com/sites/03-Finance" -DeviceLogin -ClientId $clientId
```

Code unter https://microsoft.com/devicelogin eingeben und anmelden.

### 5c – Kein Azure-Admin? Fallback ohne PnP-Login

1. Browser: https://tvfaltwert.sharepoint.com/sites/03-Finance
2. Dokumentenbibliothek **Dokumente** öffnen
3. Ordner `TVF-Controlling-Cockpit` anlegen
4. Alle Dateien aus `~/TVF-Cockpit/dateien` hochladen (Finder → markieren → Drag & Drop)
5. Dashboard manuell öffnen und `Cockpit.xlsx` einbetten/verlinken
6. Fachseiten später mit Client-ID:

```powershell
$clientId = "409b0310-a1b1-4684-9a92-f79ab67b9c05"   # aus Entra App-Registrierung
Connect-PnPOnline -Url "https://tvfaltwert.sharepoint.com/sites/03-Finance" -Interactive -ClientId $clientId
.\New-TVFCockpitStartseite.ps1 -SkipUpload
```

## Schritt 6 – Upload + Seiten anlegen

```powershell
cd ~/TVF-Cockpit/scripts

.\New-TVFCockpitStartseite.ps1
```

Standardwerte im Skript (müssen nicht angegeben werden):

| Parameter | Wert |
|---|---|
| SiteUrl | `https://tvfaltwert.sharepoint.com/sites/03-Finance` |
| StartPageName | `TVF-ALTWERT-GMBH-Dashboard` |
| FolderName | `TVF-Controlling-Cockpit` |
| LibraryName | `Dokumente` |

Das Skript:

1. legt den Ordner `TVF-Controlling-Cockpit` in der Dokumentenbibliothek an,
2. lädt die 48 Excel-Dateien hoch,
3. **aktualisiert eure vorhandene Dashboard-Seite** (Navigation + File Viewer auf `Cockpit.xlsx`),
4. legt die Fachseiten an (Forecast eingeben, GuV, Projekte, …).

Wenn die Bibliothek anders heißt (z. B. „Documents“):

```powershell
.\New-TVFCockpitStartseite.ps1 -LibraryName "Documents"
```

Wenn die Dateien schon hochgeladen sind und nur Seiten fehlen:

```powershell
.\New-TVFCockpitStartseite.ps1 -SkipUpload
```

**Hinweis:** Die Seite vor dem Skript-Lauf im Browser idealerweise **nicht** im Bearbeiten-Modus offen lassen (dein Link mit `?Mode=Edit`). Speichern/Schließen, dann Skript, danach neu öffnen.

---

## Schritt 7 – Dashboard prüfen

Öffnen (ohne Edit-Modus):

https://tvfaltwert.sharepoint.com/sites/03-Finance/SitePages/TVF-ALTWERT-GMBH-Dashboard.aspx

Erwartet:

- Navigation zu Eingabe / Auswertung / Projekte
- eingebettete `Cockpit.xlsx`
- Links z. B. zu Forecast eingeben, GuV, Projekte

---

## Schritt 8 – Excel-Links einmal aktualisieren

1. **Excel für Mac** öffnen.
2. Im Ordner `TVF-Controlling-Cockpit` zuerst `Steuerung.xlsx`, dann `Cockpit.xlsx` öffnen.
3. Links **aktualisieren**, speichern.
4. Kurz FC Eingabe, Forecast, GuV prüfen.

Alle Dateien müssen im **selben** Ordner bleiben.

---

## Schritt 9 – Alltag

| Aufgabe | Seite / Datei |
|---|---|
| Filter setzen | Steuerung |
| Forecast eingeben | **Forecast eingeben** → `FC Eingabe.xlsx` |
| Forecast sehen | Forecast |
| GuV | GuV |
| Projekte | Projekte / Projektakte |
| Übersicht | [Dashboard](https://tvfaltwert.sharepoint.com/sites/03-Finance/SitePages/TVF-ALTWERT-GMBH-Dashboard.aspx) |

---

## Kurzfassung (Mac, eure Site)

Zuerst im normalen Terminal (zsh):

```bash
mkdir -p ~/TVF-Cockpit
unzip -o ~/Downloads/TVF_Cockpit_SharePoint_Paket.zip -d ~/TVF-Cockpit
brew install --cask powershell   # einmalig, falls noch nicht
pwsh
```

**Danach in PowerShell jeden Befehl einzeln** (Prompt `PS …>` abwarten):

```powershell
cd ~/TVF-Cockpit/scripts
.\Install-PnP.ps1
.\Start-TVFDeploy.ps1
```

(`Start-TVFDeploy.ps1` meldet sich mit Client-ID `409b0310-a1b1-4684-9a92-f79ab67b9c05` an und deployed alles.)

Dann Dashboard im Browser öffnen (ohne `?Mode=Edit`) und Excel-Links einmal aktualisieren.
