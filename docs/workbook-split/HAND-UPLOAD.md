# Manuell nach SharePoint hochladen (ohne PowerShell)

Site: https://tvfaltwert.sharepoint.com/sites/03-Finance  
Dashboard: https://tvfaltwert.sharepoint.com/sites/03-Finance/SitePages/TVF-ALTWERT-GMBH-Dashboard.aspx

Alles aus dem Ordner `dateien` (48 Excel-Dateien). **Alle Dateien müssen in denselben SharePoint-Ordner.**

---

## 1. ZIP entpacken (Mac)

Im Terminal oder per Doppelklick:

```bash
unzip -o ~/Downloads/TVF_Cockpit_SharePoint_Paket.zip -d ~/TVF-Cockpit
open ~/TVF-Cockpit/dateien
```

Im Finder siehst du dann die 48 `.xlsx`-Dateien.

---

## 2. Ordner in SharePoint anlegen

1. Browser öffnen: https://tvfaltwert.sharepoint.com/sites/03-Finance
2. Links **Dokumente** (oder **Documents**) öffnen
3. **+ Neu** → **Ordner**
4. Name: `TVF-Controlling-Cockpit`
5. Ordner öffnen

Direkter Einstieg oft:
https://tvfaltwert.sharepoint.com/sites/03-Finance/Shared%20Documents/Forms/AllItems.aspx

---

## 3. Alle Excel-Dateien hochladen

1. Im Finder: Ordner `~/TVF-Cockpit/dateien` öffnen
2. **Alles markieren** (`Cmd + A`)
3. Per **Drag & Drop** in den geöffneten SharePoint-Ordner `TVF-Controlling-Cockpit` ziehen  
   **oder** in SharePoint: **Hochladen** → **Dateien** → alle auswählen
4. Warten, bis der Upload fertig ist (Status unten/oben in SharePoint)
5. Prüfen: Es sollten ca. **48** Dateien im Ordner stehen, u. a.:
   - `Cockpit.xlsx`
   - `Steuerung.xlsx`
   - `GuV.xlsx`
   - `Forecast.xlsx`
   - `FC Eingabe.xlsx`
   - `Projekte.xlsx`
   - `Projektakte.xlsx`

**Wichtig:** Keine Unterordner – alle Dateien flach in `TVF-Controlling-Cockpit`.

---

## 3b. Wichtig: neue Cockpit-Hub-Datei

Wegen `#BLOCKIERT!` die Datei **Cockpit.xlsx** aus dem aktuellen Paket verwenden (Hub mit GuV/Forecast/Steuerung in einer Datei).

1. `Cockpit-Hub-SharePoint.xlsx` oder `dateien/Cockpit.xlsx` nehmen
2. Im SharePoint-Ordner die alte `Cockpit.xlsx` **ersetzen**
3. Einmal in Excel für Mac öffnen und speichern

## 4. Dashboard-Seite anpassen

1. Öffnen:  
   https://tvfaltwert.sharepoint.com/sites/03-Finance/SitePages/TVF-ALTWERT-GMBH-Dashboard.aspx
2. Oben **Bearbeiten**
3. Optional alten Inhalt aufräumen / Platz lassen
4. **+** (Webpart hinzufügen) → **Datei und Medien** / **File and Media** (oder **Dokumenteneinbettung** / File Viewer)
5. Datei wählen: Ordner `TVF-Controlling-Cockpit` → **Cockpit.xlsx**
6. Optional darüber einen **Text**-Webpart mit Links, z. B.:

```text
Controlling Cockpit – Direktzugriff

Eingabe:
- Steuerung
- Forecast eingeben (FC Eingabe.xlsx)
- Import Monatsdaten

Auswertung:
- GuV
- Forecast
- Regionen
- Berichte

Projekte:
- Projekte
- Projektakte
- Kostenverfolgung
```

7. Bei jedem Link: Text markieren → Link einfügen → zur jeweiligen `.xlsx` im Ordner `TVF-Controlling-Cockpit` navigieren  
   (oder Datei in SharePoint öffnen → URL kopieren → als Link einfügen)
8. **Erneutes Veröffentlichen** / **Publish**

---

## 5. Wichtige Dateien einmal öffnen (Links aktivieren)

1. Im Ordner zuerst **Steuerung.xlsx** öffnen (Excel für Mac oder Excel im Browser)
2. Dann **Cockpit.xlsx** öffnen
3. Wenn Excel nach Verknüpfungen fragt → **Aktualisieren** / **Update**
4. Speichern
5. Kurz prüfen: **FC Eingabe.xlsx**, **Forecast.xlsx**, **GuV.xlsx**

Ohne diesen Schritt können Kennzahlen leer oder mit Fehlern wirken.

---

## 6. So arbeitest du danach

| Aufgabe | Datei im Ordner |
|---|---|
| Filter / Monat | `Steuerung.xlsx` |
| Forecast eingeben | `FC Eingabe.xlsx` |
| Forecast sehen | `Forecast.xlsx` |
| GuV | `GuV.xlsx` |
| Projekte | `Projekte.xlsx` / `Projektakte.xlsx` |
| Übersicht | `Cockpit.xlsx` (auch auf dem Dashboard) |

Ordner immer:  
`Dokumente` → `TVF-Controlling-Cockpit`

---

## 7. Optional: Eigene Seiten pro Thema

Wenn du willst (nicht Pflicht):

1. SharePoint → **+ Neu** → **Seite**
2. Titel z. B. `Forecast eingeben`
3. File-Viewer-Webpart → `FC Eingabe.xlsx` einbinden
4. Veröffentlichen
5. Link von der Dashboard-Seite auf diese Seite setzen

Dasselbe für GuV, Forecast, Projekte, Projektakte, …

---

## Kurzfassung

1. `dateien` entpacken  
2. In SharePoint Ordner `TVF-Controlling-Cockpit` anlegen  
3. Alle 48 xlsx per Drag & Drop hochladen  
4. Dashboard bearbeiten → `Cockpit.xlsx` einbetten + Links  
5. Veröffentlichen  
6. Steuerung + Cockpit in Excel öffnen → Links aktualisieren  
