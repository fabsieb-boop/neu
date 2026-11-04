-- SQLite-Übertragung des Controlling-Modells (PostgreSQL-Vorlage).
-- Spaltennamen und Constraints entsprechen der Vorlage.
-- IDENTITY wird INTEGER PRIMARY KEY, boolean INTEGER 0/1, numeric REAL,
-- Datum und Uhrzeit ISO-Text. EXTRACT(day) ist substr(..., 9, 2) = '01'.
--
-- Nicht angelegt, weil die Mappe dafür keine Zeilen hat:
--   partner, mitarbeiter, anmelde_protokoll, benutzer_zugriff,
--   nachtrag, projekt_dokument, unterauftrag, unterauftrag_kv_position,
--   stunden, stunden_kontrolle, konto_saldo, risiko_katalog, projekt_risiko,
--   liq_finanzierung, liq_posten, bericht_vorlage, bericht_abschnitt, bericht_lauf
-- liq_posten, bericht_vorlage, bericht_abschnitt und benutzer_zugriff
-- legt die Anwendung erst an, wenn ein Kontoauszug, eine Vorlage
-- oder eine Regionseinschränkung gespeichert wird.
-- Die plpgsql-Funktionen und die Sichten, die nur auf leere Tabellen
-- zeigen, fehlen. Enthalten sind v_guv_monat, v_ebitda_monat
-- und v_projektakte_forecast.

PRAGMA foreign_keys = ON;

CREATE TABLE region (
    region_id    INTEGER PRIMARY KEY,
    code         TEXT NOT NULL UNIQUE,
    bezeichnung  TEXT NOT NULL,
    aktiv        INTEGER NOT NULL DEFAULT 1 CHECK (aktiv IN (0, 1))
);

CREATE TABLE kostenstelle (
    kostenstelle_id INTEGER PRIMARY KEY,
    nummer          TEXT NOT NULL UNIQUE,
    bezeichnung     TEXT NOT NULL,
    region_id       INTEGER REFERENCES region (region_id),
    typ             TEXT NOT NULL DEFAULT 'PROJEKT'
                    CHECK (typ IN ('PROJEKT', 'NIEDERLASSUNG', 'OVERHEAD')),
    aktiv           INTEGER NOT NULL DEFAULT 1 CHECK (aktiv IN (0, 1))
);

CREATE TABLE benutzer (
    benutzer_id      INTEGER PRIMARY KEY,
    login            TEXT NOT NULL UNIQUE,
    anzeigename      TEXT NOT NULL,
    email            TEXT,
    passwort_hash    TEXT NOT NULL,
    aktiv            INTEGER NOT NULL DEFAULT 1 CHECK (aktiv IN (0, 1)),
    muss_pw_aendern  INTEGER NOT NULL DEFAULT 1 CHECK (muss_pw_aendern IN (0, 1)),
    angelegt_am      TEXT NOT NULL DEFAULT (datetime('now')),
    letzte_anmeldung TEXT
);

CREATE TABLE rolle (
    rolle_id     INTEGER PRIMARY KEY,
    code         TEXT NOT NULL UNIQUE,
    bezeichnung  TEXT NOT NULL
);

CREATE TABLE benutzer_rolle (
    benutzer_id  INTEGER NOT NULL REFERENCES benutzer (benutzer_id) ON DELETE CASCADE,
    rolle_id     INTEGER NOT NULL REFERENCES rolle (rolle_id),
    PRIMARY KEY (benutzer_id, rolle_id)
);

CREATE TABLE kostenart (
    kostenart_id INTEGER PRIMARY KEY,
    code         TEXT NOT NULL UNIQUE,
    bezeichnung  TEXT NOT NULL,
    gruppe       TEXT NOT NULL
                 CHECK (gruppe IN ('PERSONAL', 'GERAET', 'FREMDLEISTUNG', 'MATERIAL', 'ENTSORGUNG', 'SONSTIGE')),
    sortierung   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE berichtsposition (
    position_id        INTEGER PRIMARY KEY,
    bericht            TEXT NOT NULL CHECK (bericht IN ('BILANZ', 'GUV')),
    code               TEXT NOT NULL UNIQUE,
    bezeichnung        TEXT NOT NULL,
    eltern_position_id INTEGER REFERENCES berichtsposition (position_id),
    ebene              INTEGER NOT NULL DEFAULT 1,
    sortierung         INTEGER NOT NULL,
    ist_summenzeile    INTEGER NOT NULL DEFAULT 0 CHECK (ist_summenzeile IN (0, 1)),
    ebitda_zuordnung   TEXT
                       CHECK (ebitda_zuordnung IN ('EBITDA', 'NEUTRAL', 'ABSCHREIBUNG', 'FINANZ_STEUER')),
    CHECK (bericht = 'GUV' OR ebitda_zuordnung IS NULL)
);
CREATE INDEX ix_berichtsposition_bericht ON berichtsposition (bericht, sortierung);

CREATE TABLE konto (
    konto_nr     TEXT PRIMARY KEY,
    bezeichnung  TEXT NOT NULL,
    kontoart     TEXT NOT NULL
                 CHECK (kontoart IN ('BILANZ_AKTIV', 'BILANZ_PASSIV', 'ERTRAG', 'AUFWAND')),
    kaufm_faktor INTEGER NOT NULL CHECK (kaufm_faktor IN (-1, 1)),
    kostenart_id INTEGER REFERENCES kostenart (kostenart_id),
    ifrs         INTEGER NOT NULL DEFAULT 0 CHECK (ifrs IN (0, 1)),
    aktiv        INTEGER NOT NULL DEFAULT 1 CHECK (aktiv IN (0, 1)),
    bemerkung    TEXT
);
CREATE INDEX ix_konto_kostenart ON konto (kostenart_id);

CREATE TABLE konto_mapping (
    mapping_id   INTEGER PRIMARY KEY,
    konto_nr     TEXT NOT NULL REFERENCES konto (konto_nr),
    position_id  INTEGER NOT NULL REFERENCES berichtsposition (position_id),
    gueltig_ab   TEXT NOT NULL DEFAULT '2000-01-01',
    gueltig_bis  TEXT,
    bemerkung    TEXT,
    UNIQUE (konto_nr, gueltig_ab),
    CHECK (gueltig_bis IS NULL OR gueltig_bis >= gueltig_ab)
);
CREATE INDEX ix_konto_mapping_position ON konto_mapping (position_id);

CREATE TABLE projekt (
    projekt_id          INTEGER PRIMARY KEY,
    auftragsnr          TEXT NOT NULL UNIQUE,
    psp                 TEXT,
    bezeichnung         TEXT NOT NULL,
    region_id           INTEGER NOT NULL REFERENCES region (region_id),
    kostenstelle_id     INTEGER REFERENCES kostenstelle (kostenstelle_id),
    auftraggeber_id     INTEGER,
    vertragsart         TEXT NOT NULL DEFAULT 'VOB_B'
                        CHECK (vertragsart IN ('VOB_B', 'BGB', 'SONSTIGE')),
    phase               TEXT NOT NULL DEFAULT 'LAUFEND'
                        CHECK (phase IN ('AKQUISE', 'LAUFEND', 'ABGESCHLOSSEN', 'STORNIERT')),
    projektleiter_id    INTEGER,
    startdatum          TEXT,
    enddatum_plan       TEXT,
    enddatum_ist        TEXT,
    vertragsumsatz      REAL,
    kv_vorlage          TEXT CHECK (kv_vorlage IN ('ALT', 'NEU')),
    bemerkung           TEXT,
    angelegt_am         TEXT NOT NULL DEFAULT (datetime('now')),
    geaendert_am        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ix_projekt_region_phase ON projekt (region_id, phase);

CREATE TABLE kv_stand (
    kv_stand_id                  INTEGER PRIMARY KEY,
    projekt_id                   INTEGER NOT NULL REFERENCES projekt (projekt_id) ON DELETE CASCADE,
    stand_datum                  TEXT NOT NULL,
    umsatz_vertrag               REAL,
    umsatz_aktuell               REAL,
    umsatz_prognose              REAL,
    gesamtumsatz                 REAL NOT NULL,
    projektkosten                REAL NOT NULL,
    fremdleistungen_hauptgewerke REAL NOT NULL DEFAULT 0,
    quelle_datei                 TEXT,
    eingelesen_am                TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (projekt_id, stand_datum)
);

CREATE TABLE import_lauf (
    import_id     INTEGER PRIMARY KEY,
    quelle        TEXT NOT NULL
                  CHECK (quelle IN ('FI_EINZELPOSTEN', 'CO_OBJEKTPOSTEN', 'BILANZ_GUV_BERICHT', 'FORECAST_IMPORT', 'KOSTENVERFOLGUNG', 'MANUELL')),
    dateiname     TEXT,
    importiert_am TEXT NOT NULL DEFAULT (datetime('now')),
    benutzer_id   INTEGER REFERENCES benutzer (benutzer_id),
    zeilen        INTEGER,
    bemerkung     TEXT
);

CREATE TABLE buchung (
    buchung_id      INTEGER PRIMARY KEY,
    import_id       INTEGER REFERENCES import_lauf (import_id),
    quelle          TEXT NOT NULL DEFAULT 'FI_EINZELPOSTEN'
                    CHECK (quelle IN ('FI_EINZELPOSTEN', 'CO_OBJEKTPOSTEN', 'MANUELL')),
    buchungskreis   TEXT NOT NULL DEFAULT '4102',
    geschaeftsjahr  INTEGER NOT NULL,
    periode         INTEGER NOT NULL CHECK (periode BETWEEN 1 AND 16),
    belegnr         TEXT NOT NULL,
    zeile           INTEGER NOT NULL DEFAULT 1,
    buchungsdatum   TEXT NOT NULL,
    konto_nr        TEXT NOT NULL REFERENCES konto (konto_nr),
    kostenstelle_id INTEGER REFERENCES kostenstelle (kostenstelle_id),
    projekt_id      INTEGER REFERENCES projekt (projekt_id),
    partner_id      INTEGER,
    betrag_sap      REAL NOT NULL,
    buchungstext    TEXT,
    UNIQUE (quelle, buchungskreis, geschaeftsjahr, belegnr, zeile)
);
CREATE INDEX ix_buchung_periode_konto ON buchung (geschaeftsjahr, periode, konto_nr);
CREATE INDEX ix_buchung_projekt ON buchung (projekt_id, geschaeftsjahr, periode);

CREATE TABLE forecast_version (
    version_id      INTEGER PRIMARY KEY,
    bezeichnung     TEXT NOT NULL,
    geschaeftsjahr  INTEGER NOT NULL,
    typ             TEXT NOT NULL DEFAULT 'ROLLING_FORECAST'
                    CHECK (typ IN ('PLAN', 'ROLLING_FORECAST', 'TARGET')),
    ist_bis_periode INTEGER CHECK (ist_bis_periode BETWEEN 0 AND 12),
    status          TEXT NOT NULL DEFAULT 'ENTWURF'
                    CHECK (status IN ('ENTWURF', 'FREIGEGEBEN', 'ARCHIVIERT')),
    ist_aktiv       INTEGER NOT NULL DEFAULT 0 CHECK (ist_aktiv IN (0, 1)),
    erstellt_am     TEXT NOT NULL DEFAULT (datetime('now')),
    erstellt_von    INTEGER REFERENCES benutzer (benutzer_id)
);
CREATE UNIQUE INDEX uq_forecast_version_aktiv
    ON forecast_version (geschaeftsjahr, typ) WHERE ist_aktiv;

CREATE TABLE forecast_projekt (
    version_id           INTEGER NOT NULL REFERENCES forecast_version (version_id) ON DELETE CASCADE,
    projekt_id           INTEGER NOT NULL REFERENCES projekt (projekt_id) ON DELETE CASCADE,
    endergebnis_prognose REAL,
    bemerkung            TEXT,
    gepflegt_von         INTEGER REFERENCES benutzer (benutzer_id),
    gepflegt_am          TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (version_id, projekt_id)
);
CREATE INDEX ix_forecast_projekt_projekt ON forecast_projekt (projekt_id);

CREATE TABLE forecast_wert (
    forecast_wert_id INTEGER PRIMARY KEY,
    version_id       INTEGER NOT NULL,
    projekt_id       INTEGER NOT NULL,
    monat            TEXT NOT NULL CHECK (substr(monat, 9, 2) = '01'),
    wertart          TEXT NOT NULL
                     CHECK (wertart IN ('UMSATZ', 'BESTANDSVERAENDERUNG', 'KOSTEN')),
    kostenart_id     INTEGER REFERENCES kostenart (kostenart_id),
    betrag_plan      REAL,
    betrag_ist       REAL,
    betrag_forecast  REAL,
    FOREIGN KEY (version_id, projekt_id) REFERENCES forecast_projekt (version_id, projekt_id) ON DELETE CASCADE,
    CHECK (wertart = 'KOSTEN' OR kostenart_id IS NULL)
);
CREATE UNIQUE INDEX uq_forecast_wert
    ON forecast_wert (version_id, projekt_id, monat, wertart, COALESCE(kostenart_id, 0));
CREATE INDEX ix_forecast_wert_projekt ON forecast_wert (projekt_id, monat);

CREATE TABLE liq_szenario (
    szenario_id         INTEGER PRIMARY KEY,
    bezeichnung         TEXT NOT NULL,
    forecast_version_id INTEGER REFERENCES forecast_version (version_id),
    startdatum          TEXT NOT NULL,
    enddatum            TEXT NOT NULL,
    startsaldo          REAL NOT NULL DEFAULT 0,
    dso_tage            INTEGER NOT NULL DEFAULT 60,
    dpo_tage            INTEGER NOT NULL DEFAULT 30,
    nur_sichere_posten  INTEGER NOT NULL DEFAULT 0 CHECK (nur_sichere_posten IN (0, 1)),
    erstellt_am         TEXT NOT NULL DEFAULT (datetime('now')),
    erstellt_von        INTEGER REFERENCES benutzer (benutzer_id),
    CHECK (enddatum > startdatum)
);

CREATE TABLE liq_bankstand (
    bankstand_id INTEGER PRIMARY KEY,
    datum        TEXT NOT NULL,
    bankkonto    TEXT NOT NULL,
    saldo        REAL NOT NULL,
    UNIQUE (datum, bankkonto)
);

CREATE TABLE klr_zuschlagssatz (
    satz_id     INTEGER PRIMARY KEY,
    code        TEXT NOT NULL CHECK (code IN ('VVK_REGION', 'VVK_OVERHEAD')),
    satz        REAL NOT NULL,
    basis       TEXT NOT NULL DEFAULT 'PROJEKTKOSTEN'
                CHECK (basis IN ('PROJEKTKOSTEN', 'UMSATZ')),
    region_id   INTEGER REFERENCES region (region_id),
    gueltig_ab  TEXT NOT NULL DEFAULT '2000-01-01',
    gueltig_bis TEXT,
    UNIQUE (code, region_id, gueltig_ab)
);

CREATE TABLE klr_ampel_schwelle (
    kennzahl     TEXT PRIMARY KEY,
    richtung     TEXT NOT NULL CHECK (richtung IN ('HOEHER_BESSER', 'NIEDRIGER_BESSER')),
    gruen_grenze REAL NOT NULL,
    rot_grenze   REAL NOT NULL,
    bemerkung    TEXT
);

CREATE TABLE kennzahl_definition (
    kennzahl_id   INTEGER PRIMARY KEY,
    code          TEXT NOT NULL UNIQUE,
    bezeichnung   TEXT NOT NULL,
    einheit       TEXT NOT NULL DEFAULT 'EUR',
    quelle_view   TEXT NOT NULL CHECK (quelle_view GLOB 'v_[a-z0-9_]*'),
    quelle_spalte TEXT NOT NULL CHECK (quelle_spalte GLOB '[a-z0-9_]*'),
    beschreibung  TEXT
);

-- GuV je Periode, kaufmännisch. Gewinn ist positiv, gedreht wird nur hier.
CREATE VIEW v_guv_monat AS
SELECT b.buchungskreis,
       b.geschaeftsjahr,
       b.periode,
       bp.position_id,
       bp.code            AS position_code,
       bp.bezeichnung     AS position_text,
       bp.sortierung,
       bp.ebitda_zuordnung,
       SUM(b.betrag_sap)                  AS betrag_sap,
       SUM(b.betrag_sap * k.kaufm_faktor) AS betrag_kaufm
FROM buchung b
JOIN konto k ON k.konto_nr = b.konto_nr AND NOT k.ifrs
JOIN konto_mapping km ON km.konto_nr = k.konto_nr
                     AND b.buchungsdatum >= km.gueltig_ab
                     AND (km.gueltig_bis IS NULL OR b.buchungsdatum <= km.gueltig_bis)
JOIN berichtsposition bp ON bp.position_id = km.position_id AND bp.bericht = 'GUV'
GROUP BY b.buchungskreis, b.geschaeftsjahr, b.periode,
         bp.position_id, bp.code, bp.bezeichnung, bp.sortierung, bp.ebitda_zuordnung;

CREATE VIEW v_ebitda_monat AS
SELECT buchungskreis,
       geschaeftsjahr,
       periode,
       COALESCE(SUM(betrag_kaufm) FILTER (WHERE ebitda_zuordnung = 'EBITDA'), 0)        AS ebitda,
       COALESCE(SUM(betrag_kaufm) FILTER (WHERE ebitda_zuordnung = 'NEUTRAL'), 0)       AS neutrales_ergebnis,
       COALESCE(SUM(betrag_kaufm) FILTER (WHERE ebitda_zuordnung = 'ABSCHREIBUNG'), 0)  AS abschreibungen,
       COALESCE(SUM(betrag_kaufm) FILTER (WHERE ebitda_zuordnung = 'FINANZ_STEUER'), 0) AS finanz_und_steuern,
       SUM(betrag_kaufm)                                                                AS ergebnis
FROM v_guv_monat
GROUP BY buchungskreis, geschaeftsjahr, periode;

CREATE VIEW v_projektakte_forecast AS
SELECT fp.version_id,
       fv.geschaeftsjahr,
       fv.typ,
       fv.ist_aktiv,
       fp.projekt_id,
       COALESCE(SUM(COALESCE(fw.betrag_ist, fw.betrag_forecast, fw.betrag_plan)) FILTER (WHERE fw.wertart = 'UMSATZ'), 0) AS umsatz_aktuell,
       COALESCE(SUM(fw.betrag_plan) FILTER (WHERE fw.wertart = 'UMSATZ'), 0) AS umsatz_plan,
       COALESCE(SUM(COALESCE(fw.betrag_ist, fw.betrag_forecast, fw.betrag_plan)) FILTER (WHERE fw.wertart = 'BESTANDSVERAENDERUNG'), 0) AS bestandsveraenderung,
       COALESCE(SUM(COALESCE(fw.betrag_ist, fw.betrag_forecast, fw.betrag_plan)) FILTER (WHERE fw.wertart = 'KOSTEN'), 0) AS kosten_aktuell,
       COALESCE(SUM(fw.betrag_plan) FILTER (WHERE fw.wertart = 'KOSTEN'), 0) AS kosten_plan,
       COALESCE(SUM(COALESCE(fw.betrag_ist, fw.betrag_forecast, fw.betrag_plan)) FILTER (WHERE fw.wertart = 'UMSATZ'), 0)
         + COALESCE(SUM(COALESCE(fw.betrag_ist, fw.betrag_forecast, fw.betrag_plan)) FILTER (WHERE fw.wertart = 'BESTANDSVERAENDERUNG'), 0)
         - COALESCE(SUM(COALESCE(fw.betrag_ist, fw.betrag_forecast, fw.betrag_plan)) FILTER (WHERE fw.wertart = 'KOSTEN'), 0) AS ergebnis_aktuell,
       fp.endergebnis_prognose
FROM forecast_projekt fp
JOIN forecast_version fv ON fv.version_id = fp.version_id
LEFT JOIN forecast_wert fw ON fw.version_id = fp.version_id AND fw.projekt_id = fp.projekt_id
GROUP BY fp.version_id, fv.geschaeftsjahr, fv.typ, fv.ist_aktiv, fp.projekt_id, fp.endergebnis_prognose;

INSERT INTO rolle (code, bezeichnung) VALUES
    ('ADMIN',        'Administrator'),
    ('CONTROLLING',  'Controlling'),
    ('GF',           'Geschaeftsfuehrung'),
    ('PROJEKTLEITER','Projektleiter'),
    ('LESEN',        'Nur lesen');

INSERT INTO region (code, bezeichnung) VALUES
    ('OST',   'Ost'),
    ('WEST',  'West'),
    ('BER',   'Berlin'),
    ('SW',    'Sued-West'),
    ('VERW',  'Verwaltung');

INSERT INTO kostenart (code, bezeichnung, gruppe, sortierung) VALUES
    ('PERSONAL',      'Personal',                     'PERSONAL',      10),
    ('GERAET',        'Geraete',                      'GERAET',        20),
    ('FREMDLEISTUNG', 'Fremdleistungen Hauptgewerke', 'FREMDLEISTUNG', 30),
    ('MATERIAL',      'Material',                     'MATERIAL',      40),
    ('ENTSORGUNG',    'Entsorgung',                   'ENTSORGUNG',    50),
    ('SONSTIGE',      'Sonstige Kosten',              'SONSTIGE',      60);

INSERT INTO berichtsposition (bericht, code, bezeichnung, sortierung, ist_summenzeile, ebitda_zuordnung) VALUES
    ('GUV', 'UMSATZ',              'Umsatzerloese',                     10, 0, 'EBITDA'),
    ('GUV', 'BESTANDSVERAENDERUNG','Bestandsveraenderung',              20, 0, 'EBITDA'),
    ('GUV', 'SONST_ERTRAEGE',      'Sonstige betriebliche Ertraege',    30, 0, 'EBITDA'),
    ('GUV', 'MATERIAL_FREMD',      'Material und Fremdleistungen',      40, 0, 'EBITDA'),
    ('GUV', 'PERSONAL',            'Personalaufwand',                   50, 0, 'EBITDA'),
    ('GUV', 'SONST_AUFWAND',       'Sonstige betriebliche Aufwendungen',60, 0, 'EBITDA'),
    ('GUV', 'SONST_STEUERN',       'Sonstige Steuern',                  70, 0, 'EBITDA'),
    ('GUV', 'NEUTRAL_ERGEBNIS',    'Neutrales Ergebnis',                80, 0, 'NEUTRAL'),
    ('GUV', 'ABSCHREIBUNGEN',      'Abschreibungen',                    90, 0, 'ABSCHREIBUNG'),
    ('GUV', 'ZINSEN_STEUERN',      'Zinsen und Steuern',               100, 0, 'FINANZ_STEUER');

INSERT INTO berichtsposition (bericht, code, bezeichnung, sortierung, ist_summenzeile) VALUES
    ('BILANZ', 'VORRAETE_NETTO',   'Vorraete netto (Bestaende abzgl. erhaltene Anzahlungen)', 10, 0),
    ('BILANZ', 'LIQUIDE_MITTEL',   'Liquide Mittel',                                          20, 0),
    ('BILANZ', 'FORDERUNGEN',      'Forderungen aus Lieferungen und Leistungen',              30, 0),
    ('BILANZ', 'VERB_KURZFRISTIG', 'Kurzfristige Verbindlichkeiten',                          40, 0);

-- Bilanzkonten aus der Vorlage. Sie stehen nicht in der Mappe.
INSERT INTO konto (konto_nr, bezeichnung, kontoart, kaufm_faktor, kostenart_id, bemerkung) VALUES
    ('49951', 'Bestaende unfertige Erzeugnisse',    'BILANZ_AKTIV', 1, NULL, NULL),
    ('49972', 'Erhaltene Anzahlungen auf Vorraete', 'BILANZ_AKTIV', 1, NULL, 'SAP-Saldo negativ, deshalb Faktor +1 und Summe mit 49951 ergibt Vorraete netto');

INSERT INTO konto_mapping (konto_nr, position_id)
SELECT m.konto_nr, bp.position_id
FROM (
    SELECT '49951' AS konto_nr, 'VORRAETE_NETTO' AS position_code
    UNION ALL SELECT '49972', 'VORRAETE_NETTO'
) AS m
JOIN berichtsposition bp ON bp.code = m.position_code;

INSERT INTO klr_zuschlagssatz (code, satz, basis) VALUES
    ('VVK_REGION',   0.1200, 'PROJEKTKOSTEN'),
    ('VVK_OVERHEAD', 0.0500, 'PROJEKTKOSTEN');

INSERT INTO klr_ampel_schwelle (kennzahl, richtung, gruen_grenze, rot_grenze, bemerkung) VALUES
    ('ERGEBNIS_VOLLKOSTEN', 'HOEHER_BESSER',   5.00,  0.00, 'in Prozent vom Gesamtumsatz'),
    ('SUB_QUOTE',           'NIEDRIGER_BESSER', 60.00, 65.00, 'Fremdleistungen Hauptgewerke durch Gesamtumsatz');

INSERT INTO kennzahl_definition (code, bezeichnung, einheit, quelle_view, quelle_spalte) VALUES
    ('EBITDA',               'EBITDA',                      'EUR', 'v_ebitda_monat',     'ebitda'),
    ('ERGEBNIS_VOLLKOSTEN',  'Ergebnis Vollkosten',         'EUR', 'v_projekt_klr',      'ergebnis_vollkosten'),
    ('SUB_QUOTE',            'Sub-Quote',                   '%',   'v_projekt_klr',      'sub_quote_pct'),
    ('RISIKO_ERWARTUNGSWERT','Risiko Erwartungswert',       'EUR', 'v_projekt_klr',      'risiko_erwartungswert'),
    ('LIQ_TIEFPUNKT',        'Liquiditaet Tiefpunkt',       'EUR', 'v_liq_kennzahlen',   'tiefpunkt'),
    ('LIQ_ENDSALDO',         'Liquiditaet Endsaldo',        'EUR', 'v_liq_kennzahlen',   'endsaldo');
