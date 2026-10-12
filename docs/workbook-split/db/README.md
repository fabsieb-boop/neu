# Datenbank

Reihenfolge der Skripte:

| Skript | Zweck | Wiederholbar |
|---|---|---|
| `../database.sql` | Schema, Stammdaten und Buchungen aus dem Erstimport | ja |
| `01_modell.sql` | Fremdschlüssel nachziehen, Region und Auftragstyp ableiten, Klassifizierungsregeln anlegen und anwenden | ja |
| `02_views.sql` | Auswertungs-Views: Belegkreise, DB1–DB4, GuV, Kostenartenrechnung, Abstimmung | ja |
| `03_kontenstamm.sql` | GuV-Kontenstamm und Kontenkatalog der TVF ALTWERT GmbH übernehmen | ja |
| `04_referenzen.sql` | BCS-GuV 2026 und SAP-Jahres-GuV 2025 als Referenz | ja |

Alle Skripte sind idempotent und lassen sich nach jedem Import erneut ausführen.

```bash
npm run db:setup
```

## Was `01_modell.sql` repariert

* `buchungen.projekt_id` und `buchungen.kostenart_id` waren im Ausgangsbestand
  durchgängig `NULL`. Ohne sie liefert jede Projekt- und Kostenartenauswertung leere Ergebnisse.
* `projekte.auftragstyp`, `.regionscode` und `.region` werden aus der Auftragsnummer
  abgeleitet (`P4102`**`15`**`7208` → Projekt, Region West).
* Der Kostenartenstamm wird klassifiziert. Der Ausgangsbestand führte alle 108 Konten
  als `AUTO` und wies Erlöskonten als variable Kosten der DB-Stufe 1 aus.

### Klassifizierung als Funktionen

Die Regeln stehen an genau einer Stelle und sind aus SQL heraus aufrufbar:

| Funktion | Ergebnis |
|---|---|
| `controlling.f_region(code)` | Klartextname der Region |
| `controlling.f_db_stufe(konto)` | 0 Leistung · 1 variable Einzelkosten · 2 fixe Kosten · 9 neutral |
| `controlling.f_kontoart(konto)` | ertrag, bestandsveraenderung, aufwand, afa, finanz, steuern, neutral |
| `controlling.f_einzelkosten(konto)` | direkt zurechenbar ja/nein |
| `controlling.f_klr_typ(konto)` | feine KLR-Kategorie |
| `controlling.f_klr_gruppe(konto)` | Kostengruppe für Auswertungen |
| `controlling.f_guv_gruppe(konto)` | GuV-Position mit Sortierpräfix |
| `controlling.f_sortierung(konto)` | Reihenfolge in der GuV-Staffel |

`CALL controlling.kostenarten_klassifizieren();` wendet sie auf den gesamten Stamm an.
Der CSV-Import ruft die Prozedur selbst auf, sobald er ein unbekanntes Konto anlegt –
neue Konten sind damit sofort richtig eingeordnet.

### Regionscodes

Übernommen aus dem TVF-Bestandssystem (`js/db.js`), damit beide Auswertungen
dieselben Regionen ausweisen:

| Code | Region |
|---|---|
| 15 | West |
| 23, 30 | Süd-West |
| 60 | Ost |
| 65, 99 | Berlin |
| 50 | Verwaltung |

## Was `02_views.sql` bereitstellt

| View | Inhalt |
|---|---|
| `v_buchung` | jede Buchungszeile fachlich angereichert, vorzeichenbereinigt, mit Belegkreis und Kostenträger |
| `v_db_monat_region` | Stufenrechnung je Periode und Region |
| `v_db_monat` | Stufenrechnung je Periode, Unternehmen gesamt |
| `v_projekt_db` | Ergebnisrechnung je Projekt und Geschäftsjahr |
| `v_guv` | GuV-Staffel je Periode |
| `v_kostenart_monat` | Kostenartenrechnung je Periode |
| `v_abstimmung` | Belegkreise je Kostenträger – Vollständigkeitsnachweis |
| `v_klr` | Kompatibilitätssicht auf `v_db_monat` |

Die Spalte `buchungen.gueltig` schließt Reportsummenzeilen des Excel-Exports aus
(Zeilen ohne Auftrag und ohne Periode).

## Was `03_kontenstamm.sql` beisteuert

Tabelle `controlling.kontenstamm_tvf` mit den 106 GuV-Konten der TVF ALTWERT GmbH
aus `GuV_FC_Eingabe`, Blatt `Eingabemaske_Beträge` (IST 2025). Sie liefert Angaben,
die sich nicht aus der Kontonummer ableiten lassen:

* **Kontoart** – steuert die Vorzeichennormalisierung
* **Planungsgruppe** – die firmeneigene GuV-Gliederung
* **EBITDA-Kennzeichen** – Grundlage der EBITDA-Überleitung auf der GuV-Seite
* **Kostenblock** – Gliederung der Mehrjahresplanung
* **SAP-GuV-Position**

Außerdem registriert das Skript die 37 noch nicht bebuchten Konten des Stamms vor,
damit künftige Importe sie sofort richtig einordnen.

### Abgleich der beiden Verfahren

69 Konten kommen sowohl im Buchungsbestand als auch im GuV-Kontenstamm vor.
Für **alle 69** stimmen die aus den Nummernkreisen abgeleitete Klassifizierung und
die Vorgabe des Kontenstamms überein. Die Spalte `kostenarten.quelle` weist je Konto
aus, woher die Zuordnung stammt:

| Quelle | Konten | Bedeutung |
|---|---|---|
| `TVF-Kontenstamm` | 106 | Vorgabe aus dem GuV-Kontenstamm |
| `aus Nummernkreis hergeleitet` | 39 | überwiegend CO-interne Konten: Lohn- und Geräteverrechnung, Gemeinkostenzuschlag, kalkulatorische Kosten |

### Kontenkatalog als zweite Gegenprobe

`controlling.kontenkatalog_tvf` enthält den vollständigen Kontenkatalog
(341 Konten, Version 481 vom 18.08.2026) aus dem SAP-Bericht
„Projektergebnisse S_4102 1-8/2026" samt Bilanz/GuV-Bericht. Er ist die einzige
Quelle, aus der sich **Bilanzkonten** erkennen lassen – aus der Kontonummer allein
geht das nicht hervor. Die Spalte `kostenarten.ist_bilanzkonto` übernimmt dieses
Kennzeichen.

Die View `controlling.v_klassifizierung_abgleich` stellt beide Verfahren je Konto
gegenüber. Ergebnis: **138 von 142** Konten deckungsgleich, davon weichen nur
**zwei bebuchte** Konten ab:

| Konto | Eigene Einordnung | Kontenkatalog | Bewertung |
|---|---|---|---|
| 430020 Gewerbeertragsteuer | neutrales Ergebnis | betrieblicher Aufwand | Steuer vom Einkommen und Ertrag nach § 275 HGB; der ältere GuV-Kontenstamm ordnet sie ebenso ein wie hier |
| 401030 Kfz-Steuern | fixe Kosten, Fuhrpark | sonstige Steuern | in beiden Verfahren Betriebsaufwand, nur die Untergliederung unterscheidet sich |

Beide Abweichungen haben keine Wirkung auf DB1 bis DB4.


## Was `04_referenzen.sql` beisteuert

Zwei unabhängige Referenzen aus dem TVF-Bestandssystem, gegen die sich die
gerechneten Zahlen prüfen lassen. Beide werden **nur gelesen** und fließen in
keine Berechnung ein.

| Tabelle | Inhalt |
|---|---|
| `guv_referenz` | BCS-GuV 2026, Kennzahlen je Szenario (Ist bis Periode 6, Forecast, Jahr, Vorjahr) |
| `guv_referenz_segment` | Ergebnis je Niederlassung (NL15 West, NL30 Süd-West, NL50 Verwaltung, NL60 Ost, NL65 Berlin) |
| `guv_konten_referenz` | SAP-Jahres-GuV 2025, 245 Kontensalden zum 31.12.2025 |
| `v_guv_vorjahr` | Vorjahreskonten mit denselben Regeln klassifiziert, Bilanzkonten ausgeschlossen |

### Abgleich Auftragsbericht gegen BCS-GuV, Perioden 1–6

| Position | BCS-GuV | Auftragsbericht | Abdeckung |
|---|---|---|---|
| Umsatzerlöse | 9.126.323 € | 9.141.063 € | 100,2 % |
| Bestandsveränderung | 3.591.603 € | 3.591.603 € | 100,0 % |
| Gesamtleistung | 12.717.926 € | 12.732.666 € | 100,1 % |
| Vorleistungen | 8.745.745 € | 8.720.508 € | 99,7 % |
| Personalaufwand | 2.280.704 € | 1.159.789 € | 50,9 % |
| Abschreibungen | 57.484 € | 17.696 € | 30,8 % |

Leistung und Vorleistungen sind praktisch vollständig auftragsbezogen. Beim
Personalaufwand enthält der Auftragsbericht nur die Lohnverrechnung –
Löhne, Gehälter und Sozialabgaben liegen auf Kostenstellen. Dasselbe gilt für
Abschreibungen. Damit ist die Grenze der Datenbasis nicht nur beschrieben,
sondern beziffert.
