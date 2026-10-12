# Werte aus den D-Tabellen

Excel Online überträgt **keine** Formeln zwischen Dateien (`Stunden.xlsx` → `D KLR.xlsx` usw.) → `#WERT!` / leere Zellen.

## Was wir tun

`scripts/transfer_d_to_sheets.py` liest:

- `D Finanzen.xlsx` → GuV, Forecast, Cockpit, Regionen
- `D KLR.xlsx` → Stunden, KLR
- `D Liquidität.xlsx` → Cash-Pool / Monatsroll

und schreibt **feste Zahlen** in Hub + `dateien/`. Zusätzlich liegen die D-Blätter in denselben Dateien (eingebettet).

## Download

- **Alles ersetzen:** `TVF_ALLE_WERTE.zip`
- **Nur Cockpit:** `TVF_Cockpit_Download.zip`

## Upload

1. ZIP entpacken  
2. `Cockpit.xlsx` + gesamten Ordner `dateien/` nach `TVF-Controlling-Cockpit` **ersetzen**  
3. Seite **veröffentlichen**  
4. Hard-Reload: `Cmd + Shift + R`
