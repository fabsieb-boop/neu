# Werte eingebacken (SharePoint)

Excel Online zeigt bei Querverweisen oft `#WERT!` und rechnet Formeln nicht wie Desktop-Excel.

**Lösung:** `scripts/bake_all_sharepoint.py` schreibt die zuletzt berechneten Werte aus
`TVF_Controlling_Cockpit_Import.xlsx` als feste Zahlen in Hub + `dateien/*.xlsx`.

## Neu hochladen

1. `Cockpit-Hub-SharePoint.xlsx` → als `Cockpit.xlsx` ersetzen
2. Alle Dateien aus `dateien/` (oder `TVF_Cockpit_Dateien.zip`) ersetzen – besonders `Stunden.xlsx`, `KLR.xlsx`, `Steuerung.xlsx`, `GuV.xlsx`, …
3. SharePoint-Seite **veröffentlichen**
4. Hard-Reload: `Cmd + Shift + R`

## Erneut backen

```bash
python3 scripts/bake_all_sharepoint.py
```
