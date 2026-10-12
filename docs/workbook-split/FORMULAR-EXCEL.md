# Formular, das direkt in Excel schreibt (SharePoint Online)

Für euer TVF-Cockpit: Eingaben sollen in Excel landen, ohne die Datei von Hand zu tippen.

**Wichtige Regel:** Power Automate / Power Apps schreiben nur in eine **Excel-Tabelle** (ListObject), nicht in beliebige Einzelzellen.  
Bei euch ist das schon vorbereitet:

| Datei | Tabellenname | Zweck |
|-------|----------------|--------|
| `FC Eingabe.xlsx` | `TVF_80` | Forecast-Deltas (Jahr, Monat, Region, Auftrag, Δ Umsatz/Bestand/Kosten, Kommentar, Status) |
| `Import Monatsdaten.xlsx` | `TVFImportMonate` | Monats-GuV |
| `Import Stunden.xlsx` | `TVFImportStunden` | Stunden |

Empfohlen für den Start: **Microsoft Forms + Power Automate → Zeile in `TVF_80`**.

---

## Variante 1 – Forms + Power Automate (schnell, passt zu Forecast-Eingabe)

### 1. Excel auf SharePoint

Datei liegt z. B. hier:

`Dokumente / TVF-Controlling-Cockpit / FC Eingabe.xlsx`

Tabelle `TVF_80` muss existieren (Kopfzeile in Zeile 6: Jahr, Monat, Region, …).  
In Excel Online prüfen: Zelle in der Tabelle → Register **Tabellentools** → Name `TVF_80`.

### 2. Microsoft Form anlegen

1. [https://forms.office.com](https://forms.office.com) → **Neues Formular**  
   Titel z. B. `TVF Forecast-Eingabe`
2. Felder anlegen (Reihenfolge egal, Namen klar halten):

| Formularfeld | Typ | Excel-Spalte |
|--------------|-----|----------------|
| Jahr | Zahl | Jahr |
| Monat | Zahl (1–12) | Monat |
| Region | Auswahl (West, Ost, Süd-West, Berlin, Verwaltung) | Region |
| Auftrag / Projekt | Text | Auftrag / Projekt |
| Δ Umsatz EUR | Zahl | Δ Umsatz EUR |
| Δ Bestand EUR | Zahl | Δ Bestand EUR |
| Δ Kosten EUR | Zahl | Δ Kosten EUR |
| Kommentar | Text (lang) | Kommentar |
| Status | Auswahl: `Entwurf` / `Wirksam` | Status |

3. Formular **teilen** → Link kopieren (später auf die SharePoint-Seite).

### 3. Power Automate Flow

1. [https://make.powerautomate.com](https://make.powerautomate.com)  
2. **Erstellen** → **Automatisierter Cloud-Flow**  
3. Trigger: **Beim Senden einer neuen Antwort** (Microsoft Forms) → euer Formular wählen  
4. Aktion: **Antwortdetails abrufen** (Forms) → dieselbe Formular-ID  
5. Aktion: **Excel Online (Business)** → **Zeile zu einer Tabelle hinzufügen**

Einstellungen der Excel-Aktion:

- **Standort:** OneDrive/SharePoint-Site `03-Finance` (bzw. eure Dokumentbibliothek)
- **Dokumentbibliothek:** `Dokumente` (Shared Documents)
- **Datei:** `/TVF-Controlling-Cockpit/FC Eingabe.xlsx`  
  (Pfad ggf. über Dateiauswahl)
- **Tabelle:** `TVF_80`
- Spalten mappen:

```
Jahr              ← Jahr (aus Antwortdetails)
Monat             ← Monat
Region            ← Region
Auftrag / Projekt ← Auftrag / Projekt
Δ Umsatz EUR      ← Δ Umsatz EUR
Δ Bestand EUR     ← Δ Bestand EUR
Δ Kosten EUR      ← Δ Kosten EUR
Kommentar         ← Kommentar
Status            ← Status
Δ EBITDA EUR      ← leer lassen oder Formel: Umsatz + Bestand − Kosten
```

Für Δ EBITDA könnt ihr im Flow einen Ausdruck setzen, z. B.:

```
add(add(float(coalesce(outputs('Antwortdetails_abrufen')?['body/rXXXX'],'0')),
        float(coalesce(outputs('Antwortdetails_abrufen')?['body/rYYYY'],'0'))),
    mul(float(coalesce(outputs('Antwortdetails_abrufen')?['body/rZZZZ'],'0')),-1))
```

Einfacher: Feld Δ EBITDA weglassen und in Excel als Tabellenspalte mit Formel führen (nach dem Einfügen ggf. einmal in Excel öffnen).

6. Flow **Speichern** → mit einer Testantwort prüfen → in `FC Eingabe.xlsx` erscheint eine neue Zeile.

### 4. Formular auf die SharePoint-Seite

1. Site Page bearbeiten (z. B. `TVF-FC-Eingabe` oder Dashboard)
2. Webpart **Microsoft Forms** (oder **Embed**/iframe mit Forms-Link)
3. Formular auswählen → **Veröffentlichen**

Fertig: Ausfüllen → Absenden → Zeile steht in Excel.

---

## Variante 2 – Power Apps (schöner, mehr Kontrolle)

1. [https://make.powerapps.com](https://make.powerapps.com) → **App** → **leer** (Tablet/Phone)
2. Daten → **Excel Online** → `FC Eingabe.xlsx` → Tabelle `TVF_80` verbinden  
   (Datei muss in SharePoint/OneDrive liegen, Tabelle zwingend)
3. Bildschirm mit Formular (**EditForm** / **Form** neu) auf `TVF_80`
4. Speichern-Button: `SubmitForm(Form1)`
5. App auf SharePoint-Seite als Webpart **Power Apps** einbetten

Vorteil: Dropdowns aus eurer Projektliste, Pflichtfelder, Mobile.  
Nachteil: etwas mehr Aufbauarbeit; Excel als Datenquelle ist langsamer als SharePoint-Liste.

---

## Variante 3 – SharePoint-Liste als Formular (robuster, empfohlen mittelfristig)

Excel eignet sich schlecht als Mehrbenutzer-Datenbank (Sperren, gleichzeitige Schreibzugriffe).

Besser:

1. SharePoint-Liste `TVF-FC-Eingabe` mit denselben Spalten anlegen  
2. Formular = Listenformular oder Power Apps auf der Liste  
3. Optionaler Flow: bei neuem Listeneintrag → Zeile nach `FC Eingabe.xlsx` spiegeln  
   **oder** Reporting weiter aus der Liste / periodischem Export

So bleibt die Bedienung stabil, Excel bleibt Auswertungs-/Cockpit-Datei.

---

## Was nicht funktioniert / Fallstricke

| Problem | Lösung |
|--------|--------|
| Flow findet keine Tabelle | In Excel als **Tabelle** formatieren (Strg+T), Name vergeben |
| Datei „gesperrt“ | Niemand darf die Datei exklusiv in Desktop-Excel offen haben |
| Gebackene Hub-Zahlen ändern sich nicht | `FC Eingabe` ist Rohinput; Cockpit-KPIs sind fest geschrieben – nach Eingaben ggf. Desktop-Excel rechnen oder Transfer-Skript neu laufen lassen |
| Sonderzeichen in Spaltennamen | Genau wie in der Tabelle schreiben (`Δ Umsatz EUR`) |
| Moderne Site ohne Forms-Webpart | Forms-Link als Button/Embed nutzen |

---

## Kurzrezept für euch

1. Formular in **Microsoft Forms** mit den FC-Eingabe-Feldern  
2. Flow: Forms → **Zeile hinzufügen** in `FC Eingabe.xlsx` / Tabelle `TVF_80`  
3. Forms-Webpart auf der Seite `TVF-FC-Eingabe`  
4. Testen mit Status `Wirksam`

Optional später: dasselbe Muster für `TVFImportMonate` / `TVFImportStunden`.
