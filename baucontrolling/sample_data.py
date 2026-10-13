"""Konsistente Beispieldaten für ein mittelständisches Bauunternehmen 2026."""

from datetime import date

FIRMA = {
    "name": "Bergmann Hoch- und Tiefbau GmbH",
    "strasse": "Industriestraße 18",
    "plz": "85356",
    "ort": "Freising",
    "land": "Deutschland",
    "tel": "+49 8161 4900-0",
    "mail": "buchhaltung@bergmann-bau.de",
    "web": "www.bergmann-bau.de",
    "ustid": "DE129847331",
    "steuernr": "115/215/30817",
    "hrb": "HRB 18442 Amtsgericht München",
    "iban": "DE89 7005 0000 0000 1844 21",
    "bic": "BYLADEM1FSI",
    "bank": "Sparkasse Freising",
    "gf": "Andreas Bergmann",
    "buchhaltung": "Claudia Meier",
    "gj": 2026,
    "ust": 0.19,
    "skonto_pct": 0.02,
    "skonto_tage": 10,
    "zahlungsziel": 30,
    "einbehalt": 0.05,
    "gewaehr_jahre": 5,
    "mindestliquiditaet": 180000,
    "anfangskasse": 285400,
    "kreditlinie": 250000,
    "sollstunden_monat": 160,
    "verrechnungssatz": 68.5,
    "agk_pct": 0.12,
    "wagnis_pct": 0.05,
}

KUNDEN = [
    ["K-1001", "Wohnbau Alpenland AG", "Firma", "Lisa Hartmann", "Prinzregentenstr. 22", "80538", "München", "089 1200 440", "l.hartmann@wohnbau-alpenland.de", 30, 0.02, "A", "Aktiv", "Großkunde Wohnungsbau"],
    ["K-1002", "Stadt Freising", "Kommune", "Amt Hochbau", "Obere Hauptstr. 2", "85354", "Freising", "08161 17-0", "hochbau@freising.de", 45, 0.0, "A", "Aktiv", "Öffentlicher Auftraggeber VOB/A"],
    ["K-1003", "Kita Träger Freising e.V.", "Verein", "Sabine Kohl", "Sonnenweg 4", "85354", "Freising", "08161 88910", "verwaltung@kita-freising.de", 21, 0.02, "B", "Aktiv", "Sozialer Träger"],
    ["K-1004", "Nordpark Gewerbe GmbH", "Firma", "Thomas Reiter", "Am Nordpark 9", "85221", "Dachau", "08131 55620", "t.reiter@nordpark-gewerbe.de", 30, 0.02, "A", "Aktiv", "Industrie / Halle"],
    ["K-1005", "Familie Huber", "Privat", "Martin Huber", "Lindenweg 7", "85435", "Erding", "08122 9912", "martin.huber@web.de", 14, 0.0, "C", "Aktiv", "EFH Privatkunde"],
    ["K-1006", "Staatliches Bauamt Freising", "Behörde", "Vergabestelle", "Landshuter Str. 31", "85356", "Freising", "08161 403-0", "vergabe@stba-fs.bayern.de", 60, 0.0, "A", "Aktiv", "Straßen- und Tiefbau"],
]

LIEFERANTEN = [
    ["L-2001", "BayernZement GmbH", "Material", "Einkauf", "DE14 7015 0000 0000 3321 09", "14", 0.02, 30, "zement@bayernzement.de", "Aktiv", "Beton / Zement"],
    ["L-2002", "Holz & Stahl Süd AG", "Material", "Vertrieb Süd", "DE22 7605 0101 0000 8841 33", "10", 0.03, 30, "auftrag@holzstahl-sued.de", "Aktiv", "Bewehrung / Stahl"],
    ["L-2003", "Elektro Fuchs GmbH", "Nachunternehmer", "Werner Fuchs", "DE77 7001 0080 0012 4455 01", "10", 0.02, 21, "office@elektro-fuchs.de", "Aktiv", "Elektroinstallation"],
    ["L-2004", "Haustechnik Lang KG", "Nachunternehmer", "Petra Lang", "DE55 7602 0070 0019 3300 18", "14", 0.02, 21, "info@ht-lang.de", "Aktiv", "HLS / Sanitär"],
    ["L-2005", "Mietpark Geräte GmbH", "Gerät", "Disposition", "DE33 7015 0000 0099 1200 44", "7", 0.0, 14, "dispo@mietpark-geraete.de", "Aktiv", "Bagger / Kran / Gerüst"],
    ["L-2006", "Spedition Huber", "Dienstleistung", "Fuhrpark", "DE10 7005 0000 0044 2210 87", "7", 0.0, 14, "disposition@spedition-huber.de", "Aktiv", "Aushub / Entsorgung"],
    ["L-2007", "Gerüstbau Huber", "Nachunternehmer", "Josef Huber", "DE41 7016 0000 0008 7712 55", "10", 0.02, 21, "buero@geruestbau-huber.de", "Aktiv", "Fassade / Gerüst"],
]

PERSONAL = [
    ["MA-01", "Andreas Bergmann", "Geschäftsführung", "GF", 0, 85.00, 42.00, date(2012, 3, 1), "Aktiv", "Geschäftsführer"],
    ["MA-02", "Claudia Meier", "Kaufmännisch", "BuHa", 0, 62.00, 34.00, date(2018, 6, 1), "Aktiv", "Buchhaltung / Controlling"],
    ["MA-03", "Markus Wolf", "Polier", "Bauleitung", 160, 58.00, 41.50, date(2015, 4, 1), "Aktiv", "Polier Hochbau"],
    ["MA-04", "Jonas Keller", "Vorarbeiter", "Rohbau", 168, 48.00, 36.20, date(2019, 8, 15), "Aktiv", "Rohbau"],
    ["MA-05", "Emre Yildiz", "Facharbeiter", "Rohbau", 168, 42.00, 32.40, date(2021, 2, 1), "Aktiv", "Maurer"],
    ["MA-06", "Stefan Vogel", "Facharbeiter", "Tiefbau", 168, 44.00, 33.10, date(2017, 9, 1), "Aktiv", "Tiefbauer"],
    ["MA-07", "Anna Schuster", "Bauleitung", "BL", 160, 64.00, 45.00, date(2020, 1, 7), "Aktiv", "Bauleiterin"],
    ["MA-08", "Lukas Berger", "Azubi", "Rohbau", 140, 18.00, 14.50, date(2024, 9, 1), "Aktiv", "Auszubildender 2. LJ"],
]

PROJEKTE = [
    # nr, name, kunde, art, vertrag, status, start, ende_plan, ende_ist, auftrag_netto, budget_mat, budget_nu, budget_lohn, budget_geraet, budget_gk, gewaehr, bl, polier, ort, bemerkung
    ["P-2026-001", "Wohnquartier Am Park", "K-1001", "Hochbau", "VOB/B", "in Bau", date(2026, 1, 13), date(2026, 11, 30), None, 2400000, 720000, 380000, 510000, 95000, 145000, 0.05, "MA-07", "MA-03", "München", "6 Mehrfamilienhäuser, 48 WE"],
    ["P-2026-002", "Kita Sonnenweg", "K-1003", "Hochbau", "VOB/B", "in Bau", date(2026, 3, 2), date(2026, 10, 15), None, 890000, 250000, 145000, 210000, 38000, 52000, 0.05, "MA-07", "MA-03", "Freising", "Neubau 4-gruppige Kita"],
    ["P-2026-003", "Sanierung Rathaus", "K-1002", "Sanierung", "VOB/B", "in Bau", date(2026, 2, 16), date(2026, 12, 18), None, 1100000, 210000, 320000, 245000, 42000, 68000, 0.05, "MA-07", "MA-04", "Freising", "Denkmalschutz, Nachträge wahrscheinlich"],
    ["P-2026-004", "Gewerbehalle Nord", "K-1004", "Industrie", "BGB", "in Bau", date(2026, 4, 6), date(2027, 2, 26), None, 3200000, 980000, 540000, 610000, 145000, 190000, 0.05, "MA-07", "MA-03", "Dachau", "Stahlhalle 4.200 m² + Büro"],
    ["P-2026-005", "EFH Familie Huber", "K-1005", "Wohnungsbau", "BGB", "abgeschlossen", date(2025, 9, 8), date(2026, 4, 30), date(2026, 4, 22), 420000, 145000, 38000, 98000, 18000, 24000, 0.05, "MA-07", "MA-04", "Erding", "Schlussrechnung gestellt"],
    ["P-2026-006", "Straßenbau B13 Abschnitt", "K-1006", "Tiefbau", "VOB/B", "geplant", date(2026, 9, 1), date(2027, 6, 30), None, 1800000, 620000, 210000, 430000, 165000, 98000, 0.05, "MA-07", "MA-06", "Freising Land", "Zuschlag 12.08.2026, Baubeginn Sept."],
]

LV = [
    ["LV-001", "P-2026-001", "01.01", "Baugrube / Aushub", "m³", 1850, 28.50, 1.00, "Rohbau", "erledigt"],
    ["LV-002", "P-2026-001", "02.10", "Ortbeton Fundamente", "m³", 420, 285.00, 1.00, "Rohbau", "erledigt"],
    ["LV-003", "P-2026-001", "03.20", "Mauerwerk KG/EG", "m²", 2100, 92.00, 1.00, "Rohbau", "in Arbeit"],
    ["LV-004", "P-2026-001", "04.10", "Stahlbeton Decken", "m²", 1680, 145.00, 1.00, "Rohbau", "in Arbeit"],
    ["LV-005", "P-2026-001", "07.00", "Dachkonstruktion", "m²", 980, 168.00, 1.00, "Ausbau", "offen"],
    ["LV-006", "P-2026-002", "01.00", "Erdbau / Fundament", "pauschal", 1, 78000, 1.00, "Rohbau", "erledigt"],
    ["LV-007", "P-2026-002", "02.00", "Rohbau Kita", "m²", 640, 620.00, 1.00, "Rohbau", "in Arbeit"],
    ["LV-008", "P-2026-002", "05.00", "Fassade WDVS", "m²", 780, 118.00, 1.00, "Ausbau", "offen"],
    ["LV-009", "P-2026-003", "10.00", "Fassadensanierung", "m²", 920, 245.00, 1.00, "Sanierung", "in Arbeit"],
    ["LV-010", "P-2026-003", "12.00", "Fenster Denkmalschutz", "Stk", 64, 1850.00, 1.00, "Ausbau", "offen"],
    ["LV-011", "P-2026-004", "01.00", "Bodenplatte Halle", "m²", 4200, 95.00, 1.00, "Rohbau", "in Arbeit"],
    ["LV-012", "P-2026-004", "03.00", "Stahltragwerk", "t", 186, 2850.00, 1.00, "Rohbau", "offen"],
    ["LV-013", "P-2026-005", "99.00", "Schlüsselfertig EFH", "pauschal", 1, 420000, 1.00, "Komplett", "erledigt"],
    ["LV-014", "P-2026-006", "20.00", "Fahrbahndecke Asphalt", "m²", 12400, 42.00, 1.00, "Tiefbau", "offen"],
    ["LV-015", "P-2026-006", "21.00", "Entwässerung", "m", 1860, 185.00, 1.00, "Tiefbau", "offen"],
]

NACHTRAEGE = [
    ["N-001", "P-2026-001", date(2026, 5, 12), "Zusätzliche Drainage Ost", 28500, "angeboten", "K-1001", "Baugrund weicher als Gutachten"],
    ["N-002", "P-2026-001", date(2026, 7, 3), "Aufzugsturm extra Schacht", 64000, "beauftragt", "K-1001", "Planungsänderung Architekt"],
    ["N-003", "P-2026-003", date(2026, 6, 18), "Zusätzlicher Holzschutz Dachstuhl", 19200, "beauftragt", "K-1002", "Befall nach Öffnung"],
    ["N-004", "P-2026-003", date(2026, 8, 22), "Statische Ertüchtigung Decke EG", 47800, "in Prüfung", "K-1002", "Auflage Statiker"],
    ["N-005", "P-2026-004", date(2026, 8, 4), "Zusätzliche Toranlage Süd", 33600, "angeboten", "K-1004", "Nutzerwunsch"],
]

ANGEBOTE = [
    ["AN-26001", date(2025, 11, 18), "K-1001", "P-2026-001", "Wohnquartier Am Park", 2400000, 0.12, 0.05, "angenommen", date(2025, 12, 9), 90],
    ["AN-26002", date(2026, 1, 14), "K-1003", "P-2026-002", "Kita Sonnenweg", 890000, 0.12, 0.05, "angenommen", date(2026, 2, 10), 60],
    ["AN-26003", date(2026, 1, 8), "K-1002", "P-2026-003", "Sanierung Rathaus", 1100000, 0.14, 0.06, "angenommen", date(2026, 2, 2), 90],
    ["AN-26004", date(2026, 2, 20), "K-1004", "P-2026-004", "Gewerbehalle Nord", 3200000, 0.11, 0.05, "angenommen", date(2026, 3, 18), 90],
    ["AN-26005", date(2025, 7, 2), "K-1005", "P-2026-005", "EFH Familie Huber", 420000, 0.13, 0.05, "angenommen", date(2025, 7, 22), 30],
    ["AN-26006", date(2026, 6, 11), "K-1006", "P-2026-006", "Straßenbau B13", 1800000, 0.10, 0.05, "angenommen", date(2026, 8, 12), 120],
    ["AN-26007", date(2026, 9, 8), "K-1001", "", "Wohnquartier Phase 2", 1650000, 0.12, 0.05, "offen", None, 60],
    ["AN-26008", date(2026, 9, 22), "K-1004", "", "Büroanbau Halle Nord", 480000, 0.12, 0.05, "offen", None, 45],
]

AUFTRAEGE = [
    ["AU-26001", "AN-26001", "P-2026-001", "K-1001", date(2025, 12, 9), 2400000, "VOB/B", 0.05, "laufend", "Einbehalt 5 % bis Abnahme"],
    ["AU-26002", "AN-26002", "P-2026-002", "K-1003", date(2026, 2, 10), 890000, "VOB/B", 0.05, "laufend", ""],
    ["AU-26003", "AN-26003", "P-2026-003", "K-1002", date(2026, 2, 2), 1100000, "VOB/B", 0.05, "laufend", "Sicherheit durch Bürgschaft möglich"],
    ["AU-26004", "AN-26004", "P-2026-004", "K-1004", date(2026, 3, 18), 3200000, "BGB", 0.05, "laufend", ""],
    ["AU-26005", "AN-26005", "P-2026-005", "K-1005", date(2025, 7, 22), 420000, "BGB", 0.05, "abgenommen", "Abnahme 22.04.2026"],
    ["AU-26006", "AN-26006", "P-2026-006", "K-1006", date(2026, 8, 12), 1800000, "VOB/B", 0.05, "beauftragt", "Baubeginn 01.09.2026"],
]

STUNDEN = [
    ["ST-1001", date(2026, 9, 1), "P-2026-001", "MA-03", 10.0, "Rohbau", "Polier Wohnquartier", True],
    ["ST-1002", date(2026, 9, 1), "P-2026-001", "MA-04", 9.5, "Rohbau", "Mauerwerk Block C", True],
    ["ST-1003", date(2026, 9, 1), "P-2026-001", "MA-05", 9.5, "Rohbau", "Mauerwerk Block C", True],
    ["ST-1004", date(2026, 9, 1), "P-2026-002", "MA-07", 8.0, "Bauleitung", "Terminplan Kita", True],
    ["ST-1005", date(2026, 9, 2), "P-2026-003", "MA-04", 9.0, "Sanierung", "Fassade Süd", True],
    ["ST-1006", date(2026, 9, 2), "P-2026-004", "MA-03", 6.0, "Rohbau", "Bodenplatte Abschnitt 2", True],
    ["ST-1007", date(2026, 9, 2), "P-2026-004", "MA-06", 9.5, "Tiefbau", "Kanalanschluss", True],
    ["ST-1008", date(2026, 9, 3), "P-2026-001", "MA-05", 10.0, "Rohbau", "Decke OG1", True],
    ["ST-1009", date(2026, 9, 3), "P-2026-002", "MA-05", 8.5, "Rohbau", "Innenwände", True],
    ["ST-1010", date(2026, 9, 4), "P-2026-006", "MA-06", 4.0, "Vorbereitung", "Einmessen Achse", True],
    ["ST-1011", date(2026, 9, 4), "", "MA-02", 8.0, "Verwaltung", "OPOS / Mahnwesen", False],
    ["ST-1012", date(2026, 9, 5), "P-2026-001", "MA-08", 8.0, "Rohbau", "Mörtel / Hilfsarbeiten", True],
    ["ST-1013", date(2026, 8, 28), "P-2026-003", "MA-03", 9.0, "Sanierung", "Gerüstabnahme", True],
    ["ST-1014", date(2026, 8, 28), "P-2026-004", "MA-04", 10.0, "Rohbau", "Bewehrung Bodenplatte", True],
    ["ST-1015", date(2026, 8, 29), "P-2026-002", "MA-07", 9.0, "Bauleitung", "SIGeKO Begehung", True],
]

MATERIAL = [
    ["MAT-01", date(2026, 8, 12), "P-2026-001", "L-2001", "ER-5512", "Transportbeton C25/30", "m³", 86, 142.00, "Beton", "verbucht"],
    ["MAT-02", date(2026, 8, 14), "P-2026-001", "L-2002", "ER-5518", "Betonstahl B500B", "t", 12.4, 980.00, "Stahl", "verbucht"],
    ["MAT-03", date(2026, 8, 20), "P-2026-002", "L-2001", "ER-5531", "Transportbeton C20/25", "m³", 34, 138.00, "Beton", "verbucht"],
    ["MAT-04", date(2026, 9, 2), "P-2026-004", "L-2002", "ER-5602", "Stahlträger HEB 300", "t", 18.6, 1420.00, "Stahl", "offen"],
    ["MAT-05", date(2026, 9, 4), "P-2026-003", "L-2007", "", "Gerüstmiete September", "Monat", 1, 4800.00, "Gerüst", "offen"],
    ["MAT-06", date(2026, 7, 22), "P-2026-005", "L-2001", "ER-5401", "Estrichmaterial", "m²", 186, 18.50, "Ausbau", "verbucht"],
    ["MAT-07", date(2026, 9, 8), "P-2026-001", "L-2006", "", "Aushubabfuhr", "t", 42, 28.00, "Entsorgung", "offen"],
]

GERAETE = [
    ["GE-01", "Raupenbagger CAT 320", "Bagger", "eigen", 185000, date(2021, 4, 1), 8, 95.00, "P-2026-004", "Einsatzfähig"],
    ["GE-02", "Turmdrehkran Liebherr 81 K", "Kran", "Miete", 0, date(2026, 1, 10), 5, 210.00, "P-2026-001", "Einsatzfähig"],
    ["GE-03", "LKW MAN TGS 26.480", "LKW", "eigen", 98000, date(2019, 6, 1), 8, 62.00, "Pool", "Einsatzfähig"],
    ["GE-04", "Minibagger Kubota U27", "Bagger", "eigen", 42000, date(2023, 3, 15), 6, 48.00, "P-2026-002", "Werkstatt"],
    ["GE-05", "Gerüstsatz 800 m²", "Gerüst", "Miete", 0, date(2026, 2, 1), 4, 18.00, "P-2026-003", "Einsatzfähig"],
]

# typ: Abschlag | Anzahlung | Schluss | Gutschrift
AR = [
    ["AR-26001", date(2026, 2, 28), "P-2026-001", "K-1001", "Abschlag", 1, 360000, 0.05, 0.19, date(2026, 3, 30), date(2026, 3, 24), "bezahlt", "1. Abschlag Rohbau"],
    ["AR-26002", date(2026, 4, 30), "P-2026-001", "K-1001", "Abschlag", 2, 420000, 0.05, 0.19, date(2026, 5, 30), date(2026, 5, 22), "bezahlt", "2. Abschlag Geschosse"],
    ["AR-26003", date(2026, 7, 31), "P-2026-001", "K-1001", "Abschlag", 3, 380000, 0.05, 0.19, date(2026, 8, 30), date(2026, 9, 4), "bezahlt", "3. Abschlag inkl. Nachtrag N-002"],
    ["AR-26004", date(2026, 9, 30), "P-2026-001", "K-1001", "Abschlag", 4, 310000, 0.05, 0.19, date(2026, 10, 30), None, "offen", "4. Abschlag Dachbeginn"],
    ["AR-26005", date(2026, 4, 15), "P-2026-002", "K-1003", "Abschlag", 1, 178000, 0.05, 0.19, date(2026, 5, 6), date(2026, 5, 2), "bezahlt", "1. Abschlag Kita"],
    ["AR-26006", date(2026, 7, 20), "P-2026-002", "K-1003", "Abschlag", 2, 210000, 0.05, 0.19, date(2026, 8, 10), None, "gemahnt", "2. Abschlag Rohbau"],
    ["AR-26007", date(2026, 5, 31), "P-2026-003", "K-1002", "Abschlag", 1, 220000, 0.05, 0.19, date(2026, 7, 15), date(2026, 7, 11), "bezahlt", "1. Abschlag Rathaus"],
    ["AR-26008", date(2026, 8, 31), "P-2026-003", "K-1002", "Abschlag", 2, 185000, 0.05, 0.19, date(2026, 10, 15), None, "offen", "2. Abschlag Fassade"],
    ["AR-26009", date(2026, 6, 30), "P-2026-004", "K-1004", "Abschlag", 1, 480000, 0.05, 0.19, date(2026, 7, 30), date(2026, 7, 21), "bezahlt", "1. Abschlag Erdbau/Bodenplatte"],
    ["AR-26010", date(2026, 9, 15), "P-2026-004", "K-1004", "Abschlag", 2, 520000, 0.05, 0.19, date(2026, 10, 15), None, "offen", "2. Abschlag Stahl"],
    ["AR-26011", date(2026, 1, 31), "P-2026-005", "K-1005", "Abschlag", 3, 84000, 0.05, 0.19, date(2026, 2, 14), date(2026, 2, 10), "bezahlt", "3. Abschlag EFH"],
    ["AR-26012", date(2026, 4, 24), "P-2026-005", "K-1005", "Schluss", 4, 126000, 0.05, 0.19, date(2026, 5, 8), date(2026, 5, 6), "bezahlt", "Schlussrechnung EFH, Einbehalt 5 %"],
    ["AR-26013", date(2026, 10, 5), "P-2026-006", "K-1006", "Anzahlung", 1, 180000, 0.00, 0.19, date(2026, 12, 4), None, "offen", "1. Abschlag nach Baubeginn"],
]

ER = [
    ["ER-5401", date(2026, 7, 22), "P-2026-005", "L-2001", "Material", 3441.00, 0.19, date(2026, 8, 21), date(2026, 8, 12), "bezahlt", "Estrich"],
    ["ER-5512", date(2026, 8, 12), "P-2026-001", "L-2001", "Material", 12212.00, 0.19, date(2026, 9, 11), date(2026, 9, 4), "bezahlt", "Transportbeton"],
    ["ER-5518", date(2026, 8, 14), "P-2026-001", "L-2002", "Material", 12152.00, 0.19, date(2026, 9, 13), date(2026, 8, 28), "bezahlt", "Betonstahl Skonto"],
    ["ER-5531", date(2026, 8, 20), "P-2026-002", "L-2001", "Material", 4692.00, 0.19, date(2026, 9, 19), None, "offen", "Beton Kita"],
    ["ER-5540", date(2026, 8, 25), "P-2026-001", "L-2003", "Nachunternehmer", 28600.00, 0.19, date(2026, 9, 15), None, "offen", "Elektro Steigstränge"],
    ["ER-5555", date(2026, 8, 28), "P-2026-003", "L-2004", "Nachunternehmer", 19400.00, 0.19, date(2026, 9, 18), date(2026, 9, 10), "bezahlt", "HLS 1. Rate"],
    ["ER-5602", date(2026, 9, 2), "P-2026-004", "L-2002", "Material", 26412.00, 0.19, date(2026, 10, 2), None, "offen", "Stahlträger"],
    ["ER-5610", date(2026, 9, 5), "P-2026-003", "L-2007", "Nachunternehmer", 4800.00, 0.19, date(2026, 9, 19), None, "offen", "Gerüstmiete"],
    ["ER-5622", date(2026, 9, 8), "Allgemein", "L-2005", "Gerät", 6200.00, 0.19, date(2026, 9, 22), None, "offen", "Kranmiete September"],
    ["ER-5630", date(2026, 9, 10), "P-2026-002", "L-2004", "Nachunternehmer", 15800.00, 0.19, date(2026, 10, 1), None, "offen", "HLS Kita"],
]

ZAHLUNGEN = [
    ["Z-001", date(2026, 3, 24), "Eingang", "AR-26001", "K-1001", 406980.00, "Bank", "Wohnquartier Abschlag 1"],
    ["Z-002", date(2026, 5, 22), "Eingang", "AR-26002", "K-1001", 474810.00, "Bank", "Wohnquartier Abschlag 2"],
    ["Z-003", date(2026, 5, 2), "Eingang", "AR-26005", "K-1003", 201249.00, "Bank", "Kita Abschlag 1"],
    ["Z-004", date(2026, 7, 11), "Eingang", "AR-26007", "K-1002", 248710.00, "Bank", "Rathaus Abschlag 1"],
    ["Z-005", date(2026, 7, 21), "Eingang", "AR-26009", "K-1004", 542640.00, "Bank", "Halle Abschlag 1"],
    ["Z-006", date(2026, 2, 10), "Eingang", "AR-26011", "K-1005", 94962.00, "Bank", "EFH Abschlag 3"],
    ["Z-007", date(2026, 5, 6), "Eingang", "AR-26012", "K-1005", 142443.00, "Bank", "EFH Schluss"],
    ["Z-008", date(2026, 9, 4), "Eingang", "AR-26003", "K-1001", 429570.00, "Bank", "Wohnquartier Abschlag 3"],
    ["Z-009", date(2026, 8, 12), "Ausgang", "ER-5401", "L-2001", 4094.79, "Bank", "Estrich"],
    ["Z-010", date(2026, 9, 4), "Ausgang", "ER-5512", "L-2001", 14532.28, "Bank", "Transportbeton"],
    ["Z-011", date(2026, 8, 28), "Ausgang", "ER-5518", "L-2002", 14043.56, "Bank", "Stahl inkl. Skonto"],
    ["Z-012", date(2026, 9, 10), "Ausgang", "ER-5555", "L-2004", 23086.00, "Bank", "HLS Rathaus"],
    ["Z-013", date(2026, 8, 31), "Ausgang", "", "Personal", 68420.00, "Bank", "Löhne August"],
    ["Z-014", date(2026, 8, 15), "Ausgang", "", "Finanzamt", 18640.00, "Bank", "USt-Vorauszahlung Juli"],
    ["Z-015", date(2026, 9, 30), "Ausgang", "", "Personal", 69110.00, "Bank", "Löhne September"],
    ["Z-016", date(2026, 9, 12), "Ausgang", "", "Sozialkasse", 12480.00, "Bank", "Soka-Bau / BG Bau"],
]

MAHNUNGEN = [
    ["MAH-01", "AR-26006", "K-1003", date(2026, 8, 25), 1, 21, "1. Mahnung", "offen", "Zahlungserinnerung Kita"],
    ["MAH-02", "AR-26006", "K-1003", date(2026, 9, 20), 2, 14, "2. Mahnung + Verzug", "offen", "Frist 04.10.2026"],
]

GEWAEHR = [
    ["GW-01", "P-2026-005", "AR-26012", date(2026, 4, 22), date(2031, 4, 21), 21000.00, "Einbehalt", "laufend", "5 % Schlussrechnung EFH"],
    ["GW-02", "P-2026-001", "AR-26001", date(2026, 3, 24), date(2031, 11, 30), 18000.00, "Einbehalt", "laufend", "kumuliert Abschläge Wohnquartier"],
    ["GW-03", "P-2026-001", "AR-26002", date(2026, 5, 22), date(2031, 11, 30), 21000.00, "Einbehalt", "laufend", ""],
    ["GW-04", "P-2026-001", "AR-26003", date(2026, 9, 4), date(2031, 11, 30), 19000.00, "Einbehalt", "laufend", ""],
]

# Monatsbudget / Forecast 2026 (netto Umsatz, Kosten)
MONATE = ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]
FORECAST_UMSATZ = [210000, 280000, 340000, 410000, 455000, 490000, 520000, 505000, 560000, 610000, 580000, 420000]
FORECAST_MATERIAL = [72000, 95000, 118000, 145000, 152000, 168000, 175000, 162000, 188000, 205000, 190000, 130000]
FORECAST_NU = [28000, 42000, 55000, 68000, 74000, 82000, 90000, 88000, 96000, 110000, 98000, 62000]
FORECAST_LOHN = [72000, 72000, 74000, 76000, 78000, 78000, 80000, 80000, 82000, 84000, 82000, 78000]
FORECAST_GERAET = [12000, 14000, 16000, 18000, 19000, 21000, 22000, 21000, 24000, 26000, 23000, 18000]
FORECAST_GK = [28000, 28000, 29000, 30000, 30000, 31000, 31000, 31000, 32000, 32000, 32000, 32000]

# Ist bis September grob passend zu AR (netto vor Einbehalt, vereinfacht)
IST_UMSATZ = [84000, 360000, 0, 598000, 0, 480000, 590000, 185000, 830000, 0, 0, 0]
# The IST should be more realistic monthly recognized revenue - I'll use planned recognition
IST_UMSATZ = [126000, 360000, 180000, 418000, 220000, 480000, 590000, 395000, 830000, None, None, None]

LIQ_WOCHEN_IN = [142000, 185000, 0, 420000, 62000, 0, 248000, 0, 310000, 95000, 0, 180000, 220000]
LIQ_WOCHEN_OUT_LOHN = [0, 0, 0, 69110, 0, 0, 0, 69800, 0, 0, 0, 70500, 0]
LIQ_WOCHEN_OUT_NU = [23000, 18000, 45000, 28600, 15800, 12000, 34000, 22000, 41000, 19000, 15000, 28000, 21000]
LIQ_WOCHEN_OUT_MAT = [14500, 26400, 8000, 6200, 18000, 22000, 31000, 16000, 27000, 14000, 9000, 24000, 17000]
LIQ_WOCHEN_OUT_STEUER = [0, 18640, 0, 0, 0, 21400, 0, 0, 0, 19800, 0, 0, 24000]
LIQ_WOCHEN_OUT_SONST = [8200, 4500, 6200, 4800, 5100, 4300, 8900, 4700, 5200, 6100, 4400, 7800, 5000]

KOSTENARTEN = [
    ["KA-10", "Fertigungslöhne", "Personal", 4100],
    ["KA-11", "Gehältersatz", "Personal", 4120],
    ["KA-20", "Baustoffe", "Material", 5000],
    ["KA-21", "Hilfsstoffe", "Material", 5010],
    ["KA-30", "Nachunternehmer", "Fremdleistung", 5900],
    ["KA-40", "Gerätemiete", "Gerät", 5700],
    ["KA-41", "Abschreibung Geräte", "Gerät", 4830],
    ["KA-50", "Baustellengemeinkosten", "Gemeinkosten", 4760],
    ["KA-60", "Verwaltungsgemeinkosten", "Gemeinkosten", 4900],
    ["KA-70", "Zinsen / Aval", "Finanz", 7300],
]

LISTEN = {
    "status_projekt": ["geplant", "beauftragt", "in Bau", "abgenommen", "abgeschlossen", "stopp", "Gewährleistung"],
    "status_beleg": ["offen", "teilbezahlt", "bezahlt", "gemahnt", "überfällig", "storniert"],
    "status_angebot": ["offen", "verhandelt", "angenommen", "abgelehnt", "zurückgezogen"],
    "art_projekt": ["Hochbau", "Tiefbau", "Sanierung", "Industrie", "Wohnungsbau", "Schlüsselfertig"],
    "vertrag": ["VOB/B", "BGB", "Einheitspreis", "Pauschal", "GMP"],
    "ar_typ": ["Abschlag", "Anzahlung", "Schluss", "Gutschrift", "Nachtrag"],
    "er_typ": ["Material", "Nachunternehmer", "Gerät", "Dienstleistung", "Allgemein"],
    "zahlung_art": ["Eingang", "Ausgang"],
    "mahnstufe": ["Zahlungserinnerung", "1. Mahnung", "2. Mahnung + Verzug", "3. Mahnung / RA"],
    "lv_status": ["offen", "in Arbeit", "erledigt", "gestrichen"],
    "abc": ["A", "B", "C"],
}
