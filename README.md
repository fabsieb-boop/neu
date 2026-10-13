# Kaufmännisches Baucontrolling (Excel)

Steuerungsmappe für ein Bauunternehmen: **KPI-Dashboard, Forecast, Projekte, Liquidität, Cashflow, BWA, Soll-Ist, VOB-Formulare** und **automatische CSV-/DATEV-/Bank-Importe**.

Die Datei `Baucontrolling_Kaufmann.xlsx` ist sofort mit Beispieldaten der fiktiven **Bergmann Hoch- und Tiefbau GmbH** (GJ 2026) befüllt. Weiße Zellen sind Eingaben, blaue Zellen sind Formeln.

## Mappe neu erzeugen

```bash
python3 -m pip install -r requirements.txt
python3 -m baucontrolling.generate
```

## Automatischer Import

```bash
python3 scripts/import_csv.py --workbook Baucontrolling_Kaufmann.xlsx --typ bank --datei templates/bankumsatz.csv
```

Weitere Typen: `kunden`, `lieferanten`, `personal`, `projekte`, `stunden`, `material`, `ar`, `er`, `zahlungen`, `datev`.

Spalten und Power-Query-Hinweise stehen im Blatt `30_Import`. CSV-Vorlagen liegen unter `templates/` (Semikolon, UTF-8).

## Was die Mappe abdeckt

| Bereich | Blätter |
| --- | --- |
| Cockpit | `24_Dashboard`, `00_Navi` |
| Stamm | Firma, Kunden, Lieferanten, Personal, Kostenarten, Dropdown-Listen |
| Projekte | Stamm + DB, LV, Nachträge, Angebote, Aufträge |
| Betrieb | Stunden, Material, Geräte/AfA |
| Finanzen | Abschläge/Schluss, Kreditoren, Zahlungen, OPOS, Mahnwesen, Einbehalte |
| Steuerung | Cashflow, 13-Wochen- + 12-Monats-Liquidität, Forecast, BWA, Soll-Ist |
| Formulare | Angebot, Rechnung, Abnahme, Bautagesbericht, Mahnung (Belegnummer wählen, dann drucken) |
| Import | CSV, Bank, DATEV-Buchungsstapel, Python-Skript |

Alle Verdichtungen (Offenbeträge, Marge, Fertigstellung, Hit-Rate, Liquiditätsampel) rechnen aus den Bewegungsdaten. Formulare ziehen per `SVERWEIS` den gewählten Beleg.

## Typischer Ablauf

1. Kunde und Angebot anlegen.
2. Bei Zuschlag Auftrag und Projekt mit Kostenbudgets anlegen.
3. Stunden, Material, Nachträge laufend buchen.
4. Abschlagsrechnung in `13_Ausgangsrechnungen` → Formular `26_Form_Rechnung` drucken.
5. Bank-CSV importieren → OPOS, Cashflow und Dashboard aktualisieren sich.
6. Wöchentlich gelbe Zellen in `20_Liquiditaet` disponieren.
7. Monatlich Forecast und BWA mit der Geschäftsleitung lesen.

## Grenzen

Kein Ersatz für DATEV-Rechnungswesen, Lohnabrechnung oder GoBD-Archiv. Die Mappe ist das kaufmännische Cockpit, nicht die Finanzbuchhaltung.
