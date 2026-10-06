# Due-Diligence-Arbeitsmappe

`Due_Diligence_Arbeitsmappe.xlsx` ist eine branchenneutrale Excel-Vorlage für
Unternehmenskäufe, Beteiligungen, Carve-outs und vergleichbare Transaktionen.
`Due_Diligence_Portal.html` bildet denselben Projektablauf zusätzlich als
modernes, responsives Offline-Portal ab.

Enthalten sind unter anderem:

- 18 sichtbare Arbeitsblätter einschließlich zentraler Ausfüllhilfe
- 63 verbundene Projektstart-Aufgaben in sechs Teilchecklisten mit Direktlinks
- 156 Prüfpunkte aus 17 Due-Diligence-Bereichen
- automatisches Risiko-Scoring und Management-Dashboard
- 156 Dokumentenanforderungen sowie Q&A- und Vertrags-Tracker
- 60 vorformulierte Prüfhypothesen und Maßnahmenvorschläge
- Finanzanalyse, Quality-of-Earnings-, NWC- und Net-Debt-Vorlagen
- Vertiefungen für IT/Cyber, HR/Pensions und Steuern
- Deal-Mechanismen und Quellenverzeichnis
- 325 dokumentierte Felder mit Beispielen, Pflichtgrad und Qualitätsregeln
- 177 Excel-Eingabemeldungs- und Validierungsregeln

Gelbe Zellen sind zur Eingabe vorgesehen, blaue Zellen enthalten Formeln. Die
vorformulierten Risiken sind Hypothesen und keine Feststellungen. Die
Arbeitsmappe öffnet auf `00_Projektstart`; zusätzliche Hinweise erscheinen als
Kommentare an Spaltenköpfen und beim Auswählen relevanter Eingabezellen.

## HTML-Portal

Das Portal bietet lokale Browser-Speicherung, verbundene Fachansichten,
automatische Risiko- und Fortschrittsberechnungen, JSON-/CSV-Export,
JSON-Import, Druckansicht und einen direkten Download der Excel-Arbeitsmappe.
HTML- und Excel-Eingaben sind getrennte Arbeitsstände.

## Dateien neu erzeugen

```bash
python3 -m pip install -r requirements.txt
python3 generate_due_diligence_workbook.py
python3 generate_due_diligence_html.py
```

Die Vorlage ersetzt keine Rechts-, Steuer-, Wirtschaftsprüfungs- oder sonstige
Fachberatung.