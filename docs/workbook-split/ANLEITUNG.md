# Anleitung: Controlling Cockpit nach SharePoint (Mac)

Punkt für Punkt. **Jeden Befehl einzeln** ausführen und Enter drücken – nie mehrere Zeilen auf einmal kopieren.

| | |
|---|---|
| **Site** | https://tvfaltwert.sharepoint.com/sites/03-Finance |
| **Startseite** | TVF-ALTWERT-GMBH-Dashboard |
| **Dashboard-URL** | https://tvfaltwert.sharepoint.com/sites/03-Finance/SitePages/TVF-ALTWERT-GMBH-Dashboard.aspx |
| **Entra Client-ID** | `409b0310-a1b1-4684-9a92-f79ab67b9c05` |
| **SharePoint-Ordner** | Dokumente → `TVF-Controlling-Cockpit` |
| **ZIP** | `TVF_Cockpit_SharePoint_Paket.zip` |

**Ziel:** Excel-Dateien und gerettete Zahlen hochladen, Startseite und Unterseiten (Cockpit, Steuerung, GuV, Forecast, Regionen, Projekte, …) nutzbar machen.

Wähle **eine** Variante:

- **Variante A** – PowerShell erledigt Upload + Seiten (empfohlen)
- **Variante B** – alles per Hand im Browser

---

## Variante A – PowerShell (automatisch)

### A1. Ordner und ZIP

1. **Terminal öffnen**  
   Spotlight (`Cmd + Leertaste`) → `Terminal` tippen → Enter.  
   **Sollst du sehen:** ein Fenster mit Prompt wie `fabian@MacBook-Air ~ %`.  
   **Schiefgehen kann:** falsche App (z. B. nur TextEdit) – dann nochmal Spotlight, genau „Terminal“.

2. **Arbeitsordner anlegen** – genau diesen einen Befehl, dann Enter:

   `mkdir -p ~/TVF-Cockpit`

   **Sollst du sehen:** keine Fehlermeldung, Prompt kommt sofort wieder.  
   **Schiefgehen kann:** nichts Typisches; wenn „Permission denied“, bist du nicht unter deinem Benutzerkonto.

3. **Ordner im Finder öffnen:**

   `open ~/TVF-Cockpit`

   **Sollst du sehen:** Finder-Fenster „TVF-Cockpit“ (kann noch leer sein).  
   **Schiefgehen kann:** Ordner existiert nicht – Schritt 2 wiederholen.

4. **Prüfen, ob das ZIP in Downloads liegt** (Name kann leicht abweichen):

   `ls ~/Downloads/TVF_Cockpit_SharePoint_Paket.zip`

   **Sollst du sehen:** eine Zeile mit dem Dateipfad.  
   **Schiefgehen kann:** `No such file` – ZIP aus dem Chat/Paket nochmal speichern oder richtigen Namen mit `ls ~/Downloads/*Paket*.zip` suchen.

5. **ZIP entpacken** (ein Befehl):

   `unzip -o ~/Downloads/TVF_Cockpit_SharePoint_Paket.zip -d ~/TVF-Cockpit`

   **Sollst du sehen:** viele Zeilen `inflating: …`, am Ende wieder der Prompt.  
   **Schiefgehen kann:** falscher ZIP-Pfad (Schritt 4); oder ZIP kaputt → neu herunterladen.

6. **Inhalt prüfen:**

   `ls ~/TVF-Cockpit`

   **Sollst du sehen:** u. a. `dateien`, `zahlen`, `scripts`, `design-html`, `Cockpit-Hub-SharePoint.xlsx`, `ANLEITUNG.md`, `dashboard-design.json`.  
   **Schiefgehen kann:** alles in einem Unterordner (z. B. `~/TVF-Cockpit/workbook-split/`) – dann Inhalte eine Ebene hochziehen oder Pfade unten anpassen.

7. **Excel-Anzahl prüfen:**

   `ls ~/TVF-Cockpit/dateien | wc -l`

   **Sollst du sehen:** eine Zahl um **48** (plus ggf. unsichtbare Dateien etwas mehr/weniger).  
   **Schiefgehen kann:** `0` oder `No such file` – Entpacken fehlgeschlagen (Schritt 5).

8. **Zahlen-Ordner prüfen:**

   `ls ~/TVF-Cockpit/zahlen`

   **Sollst du sehen:** mindestens `TVF_Zahlen_Export.xlsx` und einige `.csv`.  
   **Schiefgehen kann:** Ordner fehlt → falsches/altes ZIP ohne Zahlen-Paket.

### A2. PowerShell und PnP (nur beim ersten Mal nötig)

9. **Prüfen, ob PowerShell schon da ist:**

   `pwsh --version`

   **Sollst du sehen:** z. B. `PowerShell 7.x.x`.  
   **Schiefgehen kann:** `command not found` → weiter mit Schritt 10. Wenn Version da ist → Schritt 12.

10. **Homebrew prüfen** (nur wenn `pwsh` fehlt):

    `brew --version`

    **Sollst du sehen:** `Homebrew …`.  
    **Schiefgehen kann:** `command not found` → Homebrew von https://brew.sh installieren, Terminal neu öffnen, dann weiter.

11. **PowerShell installieren** (ein Befehl, dauert):

    `brew install --cask powershell`

    **Sollst du sehen:** Download/Install, am Ende Erfolg ohne roten Fehler.  
    **Schiefgehen kann:** Passwort-Abfrage für Admin – eingeben; Netzwerkfehler → später wiederholen.

12. **PowerShell starten:**

    `pwsh`

    **Sollst du sehen:** Prompt wechselt zu etwas wie `PS /Users/fabian>`.  
    **Schiefgehen kann:** startet nicht → Schritt 9–11 prüfen; altes Terminal neu öffnen.

13. **PnP-Modul installieren** (nur einmal; in der **pwsh**-Sitzung):

    `Install-Module PnP.PowerShell -Scope CurrentUser -Force`

    **Sollst du sehen:** ggf. Frage zu NuGet/Untrusted Repository → mit `Y` bestätigen; danach fertig ohne Abbruch.  
    **Schiefgehen kann:** Ausführungsrichtlinie – dann in derselben Session: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (ein Befehl), Enter, bestätigen, Schritt 13 wiederholen.

14. **Installation prüfen:**

    `Get-Module -ListAvailable PnP.PowerShell`

    **Sollst du sehen:** mindestens eine Zeile mit Name `PnP.PowerShell` und einer Versionsnummer.  
    **Schiefgehen kann:** leer → Schritt 13 erneut; Internet/Proxy prüfen.

### A3. Anmelden an SharePoint

15. **In den scripts-Ordner wechseln** (noch in `pwsh`):

    `cd ~/TVF-Cockpit/scripts`

    **Sollst du sehen:** Prompt endet mit `…/scripts>`.  
    **Schiefgehen kann:** Ordner nicht gefunden – Schritt 6 prüfen, ob `scripts` unter `~/TVF-Cockpit` liegt.

16. **Dateien im scripts-Ordner listen:**

    `ls`

    **Sollst du sehen:** u. a. `Connect-TVF.ps1`, `New-TVFDashboardDesign.ps1`.  
    **Schiefgehen kann:** fehlen → ZIP unvollständig.

17. **Anmelden starten:**

    `.\Connect-TVF.ps1`

    **Sollst du sehen:** Ausgabe mit Site-URL und Client-ID; danach Browser-Fenster oder Login-Hinweis.  
    **Schiefgehen kann:** siehe Schritte 18–20.

18. **Wenn die Warnung zur Entra Client-ID kommt**  
    Text wie: `Please specify a valid client id for an Entra ID App Registration` oder `Specified method is not supported`.  
    **Bedeutung:** alte/manuelle Connect-Befehle ohne Client-ID.  
    **Tun:** nichts selbst basteln – nur `Connect-TVF.ps1` nutzen (Client-ID `409b0310-a1b1-4684-9a92-f79ab67b9c05` ist schon drin). Schritt 17 erneut.  
    **Schiefgehen kann:** du hast `Connect-PnPOnline` ohne `-ClientId` getippt – immer das Skript verwenden.

19. **Im Browser anmelden**  
    Microsoft-Login mit deinem TVF-Konto (tvfaltwert).  
    **Sollst du sehen:** Erlaubnis für die App ggf. bestätigen, danach zurück zu PowerShell.  
    **Schiefgehen kann:** falscher Account; Popup blockiert → Popup erlauben oder Schritt 20.

20. **Wenn nichts passiert oder Login hängt – Device-Login:**

    `.\Connect-TVF.ps1 -DeviceLogin`

    **Sollst du sehen:** einen Code und den Hinweis, https://microsoft.com/devicelogin zu öffnen.  
    **Schiefgehen kann:** Code abgelaufen → Befehl erneut.

21. **Device-Code im Browser eingeben**  
    Seite öffnen, Code eintippen, mit TVF-Konto bestätigen.  
    **Sollst du sehen:** „Sie haben sich angemeldet“ (o. ä.) im Browser.  
    **Schiefgehen kann:** Tippfehler im Code; falsches Konto ohne Site-Rechte.

22. **Erfolg in PowerShell prüfen**  
    **Sollst du sehen:** eine Zeile ähnlich `Verbunden: https://tvfaltwert.sharepoint.com/sites/03-Finance` und Hinweis auf `New-TVFDashboardDesign.ps1`.  
    **Schiefgehen kann:** Fehler 403 – keine Berechtigung auf der Site; IT/Site-Admin fragen.

### A4. Deploy ausführen

23. **Noch im Ordner `scripts`?** Prüfen:

    `pwd`

    **Sollst du sehen:** Pfad endet mit `/TVF-Cockpit/scripts`.  
    **Schiefgehen kann:** woanders → Schritt 15 wiederholen.

24. **Dashboard-Design und Upload starten:**

    `.\New-TVFDashboardDesign.ps1`

    **Sollst du sehen:** Meldungen zu Ordner, Upload von Hub/`Cockpit.xlsx`, Excel-Dateien, `zahlen/`, dann „Startseite“, „Unterseiten“, am Ende „Fertig.“ mit Dashboard-URL. Das kann mehrere Minuten dauern.  
    **Schiefgehen kann:** Session abgelaufen → Schritt 17/20, dann 24 erneut; einzelne FileViewer-Warnungen sind oft ok, Seiten trotzdem angelegt.

25. **Skript nicht mit `-SkipExcelUpload` starten**, solange Dateien/Zahlen noch fehlen.  
    **Sollst du sehen:** beim normalen Lauf Upload-Zeilen für Dateien und `zahlen/…`.  
    **Schiefgehen kann:** du hast Skip gesetzt → Zahlen/Excel fehlen auf SharePoint; ohne Skip wiederholen.

### A5. Im Browser prüfen

26. **Dashboard öffnen**  
    https://tvfaltwert.sharepoint.com/sites/03-Finance/SitePages/TVF-ALTWERT-GMBH-Dashboard.aspx  
    **Sollst du sehen:** TVF-ALTWERT-Kopf, Kacheln, eingebettetes Excel.  
    **Schiefgehen kann:** alte leere Seite – Hard-Reload (`Cmd + Shift + R`); ggf. noch im Bearbeiten-Modus → **Veröffentlichen** / Bearbeiten beenden.

27. **Kacheln testen:** Cockpit, Steuerung, GuV, Forecast, Regionen, Projekte anklicken.  
    **Sollst du sehen:** jeweilige Unterseite mit Navigation und Excel-Viewer.  
    **Schiefgehen kann:** 404 – Skript nicht durchgelaufen (Schritt 24); Link-Name prüfen.

28. **Im Excel-Viewer Blatt wechseln** (unten oder über Blattregister): GuV / Forecast / Steuerung.  
    **Sollst du sehen:** Zahlen/Struktur, **kein** `#BLOCKIERT!` / `#WERT!` in den Kernzellen.  
    **Schiefgehen kann:** `#BLOCKIERT!` → falsche alte `Cockpit.xlsx`; Hub aus dem Paket muss als `Cockpit.xlsx` liegen (Skript lädt `Cockpit-Hub-SharePoint.xlsx` als `Cockpit.xlsx`).  
    **`#WERT!` überall** → alte Dateien mit Excel-Online-Verknüpfungen; gebackene Dateien aus `dateien/` bzw. `TVF_Cockpit_Dateien.zip` **ersetzen**, Seite veröffentlichen, Hard-Reload (`Cmd+Shift+R`). Siehe `WERTE-EINGEBACKEN.md`.

29. **Ordner `zahlen` in Dokumenten öffnen**  
    Site → Dokumente → `TVF-Controlling-Cockpit` → `zahlen`.  
    **Sollst du sehen:** `TVF_Zahlen_Export.xlsx` (und CSVs).  
    **Schiefgehen kann:** Ordner leer → Schritt 24 ohne Skip.

Damit ist Variante A fertig. Weiter zur **Checkliste** am Ende.

---

## Variante B – per Hand (ohne PowerShell)

Nutze diese Variante, wenn PowerShell nicht geht. Zuerst Dashboard **nicht** im Bearbeiten-Modus lassen, wenn du nur schaust – für HTML brauchst du Bearbeiten gezielt.

### B1. ZIP und lokale Dateien

1. **Terminal öffnen** (wie A1 Schritt 1).  
   **Sollst du sehen:** Terminal-Prompt.  
   **Schiefgehen kann:** falsche App.

2. **Ordner anlegen:**

   `mkdir -p ~/TVF-Cockpit`

   **Sollst du sehen:** kein Fehler.  
   **Schiefgehen kann:** Permission denied.

3. **Finder öffnen:**

   `open ~/TVF-Cockpit`

   **Sollst du sehen:** Finder-Fenster.  
   **Schiefgehen kann:** Ordner fehlt → Schritt 2.

4. **ZIP entpacken:**

   `unzip -o ~/Downloads/TVF_Cockpit_SharePoint_Paket.zip -d ~/TVF-Cockpit`

   **Sollst du sehen:** `inflating:`-Zeilen.  
   **Schiefgehen kann:** ZIP nicht in Downloads – Pfad anpassen.

5. **`dateien` im Finder öffnen:**

   `open ~/TVF-Cockpit/dateien`

   **Sollst du sehen:** viele `.xlsx`-Dateien.  
   **Schiefgehen kann:** Ordner leer → Entpacken prüfen.

6. **Anzahl grob prüfen** – im Finder unten oder:

   `ls ~/TVF-Cockpit/dateien | wc -l`

   **Sollst du sehen:** ca. **48**.  
   **Schiefgehen kann:** deutlich weniger → falsches ZIP.

7. **`zahlen` öffnen:**

   `open ~/TVF-Cockpit/zahlen`

   **Sollst du sehen:** `TVF_Zahlen_Export.xlsx`.  
   **Schiefgehen kann:** fehlt → Paket unvollständig.

8. **Hub-Datei finden:**

   `ls ~/TVF-Cockpit/Cockpit-Hub-SharePoint.xlsx`

   **Sollst du sehen:** eine Zeile mit dem Dateipfad.  
   **Schiefgehen kann:** Datei fehlt – ohne Hub bleibt `#BLOCKIERT!` Risiko hoch.

### B2. SharePoint-Ordner

9. **Site im Browser öffnen:** https://tvfaltwert.sharepoint.com/sites/03-Finance  
   **Sollst du sehen:** Finance-Site, Navigation links.  
   **Schiefgehen kann:** kein Zugriff – anderes Konto / VPN / Admin.

10. **Bibliothek Dokumente öffnen** (manchmal „Documents“).  
    Direkter Einstieg oft: https://tvfaltwert.sharepoint.com/sites/03-Finance/Shared%20Documents/Forms/AllItems.aspx  
    **Sollst du sehen:** Datei-/Ordnerliste.  
    **Schiefgehen kann:** andere Bibliothek – „Dokumente“ der Site wählen.

11. **Ordner anlegen:** **+ Neu** → **Ordner** → Name genau `TVF-Controlling-Cockpit` → Erstellen.  
    **Sollst du sehen:** neuer Ordner in der Liste.  
    **Schiefgehen kann:** Ordner heißt anders → umbenennen; Tippfehler bei Bindestrichen.

12. **Ordner `TVF-Controlling-Cockpit` öffnen.**  
    **Sollst du sehen:** leerer oder schon teilweise gefüllter Ordner.  
    **Schiefgehen kann:** du bist noch eine Ebene zu hoch.

13. **Unterordner `zahlen` anlegen** (**+ Neu** → **Ordner** → `zahlen`).  
    **Sollst du sehen:** Ordner `zahlen` innerhalb von `TVF-Controlling-Cockpit`.  
    **Schiefgehen kann:** `zahlen` versehentlich neben statt in `TVF-Controlling-Cockpit` – verschieben.

### B3. Excel und Zahlen hochladen

14. **Alle Dateien aus `~/TVF-Cockpit/dateien` markieren** (`Cmd + A` im Finder).  
    **Sollst du sehen:** alle `.xlsx` markiert.  
    **Schiefgehen kann:** Unterordner mit markiert – nur die Excel-Dateien.

15. **Per Drag & Drop in den geöffneten SharePoint-Ordner `TVF-Controlling-Cockpit` ziehen** (oder **Hochladen** → **Dateien**).  
    **Sollst du sehen:** Upload-Fortschritt; danach ca. 48 Dateien **flach** im Ordner (keine Unterordner für die Excels).  
    **Schiefgehen kann:** Upload abbricht → in Batches hochladen; Dateien landeten in `zahlen` → zurück verschieben.

16. **Hub hochladen:** Datei `Cockpit-Hub-SharePoint.xlsx` aus `~/TVF-Cockpit` nach `TVF-Controlling-Cockpit` hochladen.  
    **Sollst du sehen:** Datei erscheint (zuerst noch mit Langnamen).  
    **Schiefgehen kann:** falsche Datei aus `dateien/Cockpit.xlsx` ohne Hub-Inhalt.

17. **Hub als `Cockpit.xlsx` bereitstellen**  
    - Wenn schon eine `Cockpit.xlsx` existiert: diese **ersetzen** bzw. löschen und die Hub-Datei umbenennen zu `Cockpit.xlsx`, **oder** beim Hochladen „ersetzen“ wählen und Zielname `Cockpit.xlsx` setzen.  
    - Ziel: Im Ordner liegt **eine** Datei namens **`Cockpit.xlsx`**, die dem Hub entspricht (enthält Blätter Cockpit, Steuerung, GuV, Forecast, …).  
    **Sollst du sehen:** Dateiname genau `Cockpit.xlsx`.  
    **Schiefgehen kann:** beide Dateien parallel (`Cockpit-Hub-…` und alte `Cockpit.xlsx`) – Viewer zeigt die alte → `#BLOCKIERT!`.

18. **Inhalt von `~/TVF-Cockpit/zahlen` in den SharePoint-Ordner `…/TVF-Controlling-Cockpit/zahlen` hochladen.**  
    **Sollst du sehen:** `TVF_Zahlen_Export.xlsx` dort.  
    **Schiefgehen kann:** Dateien flach neben den Excels statt in `zahlen` – verschieben.

19. **Stichprobe:** Im Ordner `TVF-Controlling-Cockpit` u. a. `Cockpit.xlsx`, `GuV.xlsx`, `Forecast.xlsx`, `Regionen.xlsx`, `Projekte.xlsx` sichtbar.  
    **Sollst du sehen:** diese Namen.  
    **Schiefgehen kann:** Umlaute/Namen abgeschnitten – erneut hochladen.

### B4. Dashboard vorbereiten (Edit-Modus)

20. **Dashboard öffnen:** https://tvfaltwert.sharepoint.com/sites/03-Finance/SitePages/TVF-ALTWERT-GMBH-Dashboard.aspx  
    **Sollst du sehen:** die bestehende Dashboard-Seite.  
    **Schiefgehen kann:** 404 – Seitenname prüfen.

21. **Wenn die Seite im Bearbeiten-Modus ist:** zuerst **Verwerfen** oder **Veröffentlichen**/Bearbeiten beenden, Seite neu laden – damit du von einem klaren Stand startest.  
    **Sollst du sehen:** normale Ansicht ohne gelbe Bearbeiten-Leiste (je nach UI).  
    **Schiefgehen kann:** hängender Edit-Lock – Seite schließen, neu öffnen, ggf. „Bearbeitung übernehmen“.

22. **Erneut Bearbeiten** starten (Stift / **Bearbeiten**).  
    **Sollst du sehen:** Webparts sind editierbar.  
    **Schiefgehen kann:** keine Rechte → Site-Mitgliedschaft prüfen.

### B5. Startseite (HTML + Excel)

23. **Lokal die Startseiten-HTML öffnen:**

    `open ~/TVF-Cockpit/design-html/STARTSEITE.html`

    **Sollst du sehen:** Browser/Editor mit dem HTML (TVF ALTWERT, Kacheln).  
    **Schiefgehen kann:** Datei fehlt → ZIP prüfen.

24. **HTML-Inhalt kopieren** (im Editor: alles markieren, `Cmd + C` – oder Quelltext aus dem Editor).  
    **Sollst du sehen:** großer Textblock in der Zwischenablage.  
    **Schiefgehen kann:** nur sichtbare Seite ohne Tags kopiert – besser Datei in TextEdit öffnen und alles kopieren.

25. **Auf dem Dashboard:** Text-Webpart hinzufügen oder vorhandenes leeren → HTML einfügen (Einbetten/HTML je nach SharePoint-Option; ggf. „Markdown“/„Embed“/HTML-Webpart).  
    **Sollst du sehen:** Kacheln/Navigation im Vorschaubereich.  
    **Schiefgehen kann:** SharePoint strippt Skripte – Layout trotzdem nutzbar; Links zu Unterseiten funktionieren erst, wenn Seiten existieren (B6).

26. **File-Viewer-Webpart** hinzufügen (oder vorhandenes) → Datei **`Cockpit.xlsx`** aus `TVF-Controlling-Cockpit` wählen.  
    **Sollst du sehen:** Excel-Vorschau auf der Seite.  
    **Schiefgehen kann:** falsche Datei / Pfad → `#BLOCKIERT!` oder leerer Viewer.

27. **Dashboard veröffentlichen** (Nicht nur Speichern).  
    **Sollst du sehen:** Seite live, Bearbeiten-Modus zu.  
    **Schiefgehen kann:** Entwurf bleibt unsichtbar für andere – explizit Veröffentlichen.

### B6. Unterseiten

28. **Mapping öffnen** (optional, zeigt App → Seite → Excel):

    `open ~/TVF-Cockpit/app-sharepoint-map.json`

    **Sollst du sehen:** JSON mit Gruppen und `seite` / `excel`.  
    **Schiefgehen kann:** Datei fehlt – dann die Liste in Schritt 29 nutzen.

29. **Mindestens diese Seiten anlegen** (Site → **+ Neu** → **Seite**, Name = Seitenname ohne `.html`):  
    - `TVF-Cockpit`  
    - `TVF-Steuerung`  
    - `TVF-GuV`  
    - `TVF-Forecast`  
    - `TVF-Regionen`  
    - `TVF-Projekte`  
    - `TVF-Zahlen`  
    **Sollst du sehen:** neue Seiten unter SitePages.  
    **Schiefgehen kann:** Leerzeichen im Namen – genau so schreiben.

30. **Für jede Seite:** passende HTML aus `~/TVF-Cockpit/design-html/seiten/` öffnen (z. B. `TVF-GuV.html`), Inhalt in Text-Webpart; File-Viewer auf die in der HTML genannte Excel (GuV oft über Hub-`Cockpit.xlsx` Blatt GuV, Regionen → `Regionen.xlsx`, Zahlen → `zahlen/TVF_Zahlen_Export.xlsx`).  
    **Sollst du sehen:** Hero + Nav + Excel.  
    **Schiefgehen kann:** Viewer zeigt 404 – Dateiname/Leerzeichen im Pfad prüfen.

31. **Jede Unterseite veröffentlichen.**  
    **Sollst du sehen:** Seite ohne Entwurfshinweis erreichbar.  
    **Schiefgehen kann:** vergessen zu veröffentlichen → nur du siehst den Entwurf.

32. **Von der Startseite die Kacheln/Links testen.**  
    **Sollst du sehen:** Sprung zu Steuerung, GuV, Forecast, Regionen, Projekte.  
    **Schiefgehen kann:** Link zeigt auf alten Seitennamen – HTML-Links oder Seitennamen angleichen.

Damit ist Variante B fertig.

---

## Wo die restlichen Seiten hin (wichtig)

**Ort:** immer auf derselben Site  
https://tvfaltwert.sharepoint.com/sites/03-Finance  

**Ablage der Seiten:** links **Seiten** (Site Pages) – **nicht** in Dokumente und nicht als Datei in den Excel-Ordner.

Die Excels liegen weiter in:  
`Dokumente` → `TVF-Controlling-Cockpit` (flach) und `…/zahlen/`.

### So legst du eine Unterseite an (für jede Seite wiederholen)

1. Links auf **Seiten** klicken.  
   **Sollst du sehen:** Liste der vorhandenen Site-Seiten.  
   **Schiefgehen kann:** du bist in „Dokumente“ – dort gehören nur Excel/ZIP hin.

2. Oben **+ Neu** → **Seite** (oder „Website-Seite“).  
   **Sollst du sehen:** Seitenvorlage / leere Seite.  
   **Schiefgehen kann:** „Neuer Ordner“ gewählt – das ist falsch.

3. **Seitenname genau** so setzen wie die HTML-Datei **ohne** `.html` (Beispiel: Datei `TVF-GuV.html` → Seitenname `TVF-GuV`).  
   Keine Leerzeichen, Bindestriche wie in der Liste.  
   **Sollst du sehen:** URL später `…/SitePages/TVF-GuV.aspx`.  
   **Schiefgehen kann:** anderer Name → Kacheln auf der Startseite landen auf 404.

4. HTML aus lokal öffnen (ein Befehl, dann Enter):

   `open ~/TVF-Cockpit/design-html/seiten/TVF-GuV.html`

   (Dateiname jeweils anpassen.)  
   **Sollst du sehen:** HTML im Browser/Editor.  
   **Schiefgehen kann:** Ordner fehlt → ZIP prüfen.

5. Inhalt kopieren → auf der neuen Seite in Webpart **Einbetten** / HTML einfügen (besser `STARTSEITE-SHAREPOINT`-Logik: bei Bedarf nur Body; Voll-HTML oft problematisch).  
   **Sollst du sehen:** Kopfzeile + Text der Unterseite.  
   **Schiefgehen kann:** Text-Webpart strippt Layout → Einbetten nutzen.

6. Webpart **Datei-Viewer** hinzufügen → passende Excel aus `TVF-Controlling-Cockpit` wählen (siehe Tabelle unten). Bei Hub-Blatt (GuV, Forecast, Steuerung, FC Eingabe): Datei **`Cockpit.xlsx`**, Blatt im Excel wechseln.  
   **Sollst du sehen:** Excel auf der Seite.  
   **Schiefgehen kann:** falsche Datei / Datei noch nicht hochgeladen.

7. **Seite veröffentlichen.**  
   **Sollst du sehen:** kein „Entwurf“ mehr.  
   **Schiefgehen kann:** nur gespeichert → für andere unsichtbar.

### Zuerst diese 8 (Minimum)

| Seitenname (Site Pages) | HTML lokal | Excel im Ordner |
|---|---|---|
| `TVF-Cockpit` | `seiten/TVF-Cockpit.html` | `Cockpit.xlsx` |
| `TVF-Steuerung` | `seiten/TVF-Steuerung.html` | `Cockpit.xlsx` (Blatt Steuerung) |
| `TVF-GuV` | `seiten/TVF-GuV.html` | `Cockpit.xlsx` (Blatt GuV) |
| `TVF-Forecast` | `seiten/TVF-Forecast.html` | `Cockpit.xlsx` (Blatt Forecast) |
| `TVF-FC-Eingabe` | `seiten/TVF-FC-Eingabe.html` | `Cockpit.xlsx` (Blatt FC Eingabe) |
| `TVF-Regionen` | (Kacheln/Regionen) bzw. Region-West zuerst | `Regionen.xlsx` |
| `TVF-Projekte` | `seiten/TVF-Projekte.html` | `Projekte.xlsx` |
| `TVF-Zahlen` | `seiten/TVF-Zahlen.html` | `zahlen/TVF_Zahlen_Export.xlsx` |

Danach nach Bedarf die übrigen aus `design-html/seiten/` (gleiche Regel: Seitenname = Dateiname ohne `.html`). Volle Zuordnung: `app-sharepoint-map.json`.

**Automatisch alle Seiten:** Variante A → `.\New-TVFDashboardDesign.ps1` legt sie unter Site Pages an.

---

## Startseite zeigt nur Quellcode – so wird sie sichtbar

Ursache: Volle HTML-Datei mit `<style>` / DOCTYPE landet als Text und wird nicht gerendert.

**Lösung:** Datei **`design-html/STARTSEITE-INLINE.html`** (nur Inline-Styles) + Skript **`scripts/New-TVFStartseite.ps1`**.

### PowerShell (empfohlen)

1. PowerShell starten:

   `pwsh`

   **Sollst du sehen:** Prompt `PS …>`  
   **Schiefgehen kann:** nicht installiert → zuerst Variante A Schritt PowerShell.

2. In den scripts-Ordner:

   `cd ~/TVF-Cockpit/scripts`

   **Sollst du sehen:** Pfad endet auf `scripts`.  
   **Schiefgehen kann:** Ordner fehlt → aktuelles ZIP entpacken.

3. Anmelden:

   `.\Connect-TVF.ps1`

   **Sollst du sehen:** `Verbunden: …03-Finance`  
   **Schiefgehen kann:** Entra → `.\Connect-TVF.ps1 -DeviceLogin`

4. Startseite setzen:

   `.\New-TVFStartseite.ps1 -RebuildHtml`

   **Sollst du sehen:** „Fertig – Startseite veroeffentlicht“ und die Dashboard-URL.  
   **Schiefgehen kann:** Session weg → Schritt 3, dann 4.

5. Browser: Dashboard öffnen, hart neu laden (`Cmd + Shift + R`).  
   **Sollst du sehen:** blauer Kopf „TVF ALTWERT“, KPI-Kacheln, Links – **keinen** CSS-Quelltext.  
   **Schiefgehen kann:** alter Code-Webpart noch da → Bearbeiten, Webpart mit Quellcode **löschen**, veröffentlichen, Schritt 4 erneut.

### Hand (ohne PowerShell)

1. Lokal:

   `open -a TextEdit ~/TVF-Cockpit/design-html/STARTSEITE-INLINE.html`

   Inhalt beginnt mit `<div style=…`, **nicht** mit `<!DOCTYPE`.

2. Dashboard → **Bearbeiten** → Webpart mit Quellcode **löschen**.

3. **+** → Webpart **Text** (nicht „Code“, nicht Datei-Viewer auf die .html).

4. Alles aus `STARTSEITE-INLINE.html` einfügen → Speichern.

5. **+** → **Datei-Viewer** → `Cockpit.xlsx` → **Seite veröffentlichen**.

6. Neu laden – Layout muss sichtbar sein.

Details: `design-html/STARTSEITE-SO-EINFUEGEN.md`

---

## Checkliste (A und B)

Am Ende muss gelten:

- [ ] Dashboard öffnet ohne ständigen Bearbeiten-Modus  
- [ ] `Cockpit.xlsx` im Ordner `TVF-Controlling-Cockpit` ist der **Hub** (aus `Cockpit-Hub-SharePoint.xlsx`)  
- [ ] Im eingebetteten Cockpit **kein** `#BLOCKIERT!` in den Kernzahlen  
- [ ] Ordner `TVF-Controlling-Cockpit/zahlen` existiert und enthält `TVF_Zahlen_Export.xlsx`  
- [ ] Seite **Steuerung** erreichbar (`TVF-Steuerung`)  
- [ ] Seite **GuV** erreichbar (`TVF-GuV`)  
- [ ] Seite **Forecast** erreichbar (`TVF-Forecast`)  
- [ ] Seite **Regionen** erreichbar (`TVF-Regionen`)  
- [ ] Seite **Projekte** erreichbar (`TVF-Projekte`)  

---

## Kurz: Was wo liegt

| Bedarf | Lokal im Paket |
|---|---|
| Diese Anleitung | `ANLEITUNG.md` |
| Hub gegen `#BLOCKIERT!` | `Cockpit-Hub-SharePoint.xlsx` → SharePoint `Cockpit.xlsx` |
| 48 Excels | `dateien/` |
| Gerettete DB-Zahlen | `zahlen/` |
| PowerShell-Deploy | `scripts/Connect-TVF.ps1`, `scripts/New-TVFDashboardDesign.ps1` |
| HTML von Hand | `design-html/STARTSEITE.html`, `STARTSEITE-SHAREPOINT.html` (für Embed), `design-html/seiten/` |
| App → Seite → Excel | `app-sharepoint-map.json` |

---

## Typische Fehler (Schnellhilfe)

| Symptom | Was tun |
|---|---|
| Mehrere Befehle auf einmal kopiert, nur erste Zeile läuft | Pro Schritt **einen** Befehl, Enter, Ergebnis abwarten |
| Entra / Client-ID-Warnung | Nur `.\Connect-TVF.ps1` (ggf. `-DeviceLogin`) |
| `#BLOCKIERT!` | Hub als `Cockpit.xlsx` ersetzen |
| Zahlen fehlen | Ordner `zahlen/` hochladen bzw. Deploy ohne `-SkipExcelUpload` |
| Seite 404 | Seitennamen exakt wie oben; Skript/Hand-Anlage prüfen |
