# Startseite einfügen (sichtbares Layout, kein Quellcode)

Die Datei **STARTSEITE-INLINE.html** enthält nur Inline-Styles.
SharePoint zeigt sie im **Text-Webpart** als Layout – nicht als Code.

## Variante PowerShell (empfohlen)

```
cd ~/TVF-Cockpit/scripts
.\Connect-TVF.ps1
.\New-TVFStartseite.ps1
```

## Variante Hand

1. Dashboard öffnen: https://tvfaltwert.sharepoint.com/sites/03-Finance/SitePages/TVF-ALTWERT-GMBH-Dashboard.aspx
2. **Bearbeiten**
3. Alten Code-/HTML-Block mit Quelltext **löschen**
4. **+** → Webpart **Text** (nicht „Code“, nicht Datei-Viewer auf die .html)
5. Im Text-Webpart oben auf **…** oder **</>** (HTML bearbeiten / Quellcode) – falls vorhanden
6. Inhalt von STARTSEITE-INLINE.html **komplett** einfügen (beginnt mit `<div style=…`)
7. Speichern / Vorschau: du musst **Kacheln und blauen Kopf** sehen, keinen CSS-Text
8. Darunter **Datei-Viewer** → `Cockpit.xlsx` aus TVF-Controlling-Cockpit
9. **Seite veröffentlichen**

Wenn du wieder nur Quellcode siehst: du bist im falschen Webpart (Code) oder hast die volle STARTSEITE.html mit `<style>` eingefügt. Nur **STARTSEITE-INLINE.html** verwenden.
