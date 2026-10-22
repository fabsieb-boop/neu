-- Quelltabellen aus tvf-dashboard-download.xlsx.
-- Nur Blätter mit eingegebenen Werten. Summen, Kennzahlen, Forecast-Anzeige,
-- Regionen, Auftragsauswertung und die 26-Wochen-Liquidität bleiben Abfragen.

CREATE TABLE parameter (
  jahr INTEGER NOT NULL,
  letzter_ist_monat INTEGER NOT NULL,
  stichtag TEXT NOT NULL,
  auftragsnummer TEXT NOT NULL
);

-- Projektstamm
CREATE TABLE projekt (
  projekt_id INTEGER PRIMARY KEY,
  projekt_nr TEXT NOT NULL,
  name TEXT NOT NULL,
  typ TEXT NOT NULL,
  regionscode TEXT NOT NULL,
  region TEXT NOT NULL,
  status TEXT NOT NULL,
  budget_umsatz REAL NOT NULL,
  budget_kosten REAL NOT NULL
);

-- Kostenarten
CREATE TABLE kostenart (
  kostenart_id INTEGER PRIMARY KEY,
  konto TEXT NOT NULL,
  bezeichnung TEXT NOT NULL,
  db_stufe INTEGER NOT NULL,
  guv_gruppe TEXT NOT NULL,
  sortierung INTEGER NOT NULL,
  klr_gruppe TEXT NOT NULL
);

-- Auftrag_Journal, Spalten A–L. M–AC sind Formeln und stehen in v_journal.
CREATE TABLE buchung (
  id INTEGER PRIMARY KEY,
  datum TEXT NOT NULL,
  jahr INTEGER NOT NULL,
  monat INTEGER NOT NULL,
  belegart TEXT NOT NULL,
  belegnummer TEXT NOT NULL,
  auftrag TEXT NOT NULL,
  projekt_id INTEGER,
  kostenart_id INTEGER,
  konto TEXT NOT NULL,
  wert REAL NOT NULL,
  text TEXT NOT NULL
);

CREATE INDEX buchung_jahr_monat ON buchung (jahr, monat);
CREATE INDEX buchung_projekt ON buchung (projekt_id);
CREATE INDEX buchung_kostenart ON buchung (kostenart_id);

-- Forecast_Plan
CREATE TABLE forecast_plan (
  jahr INTEGER NOT NULL,
  region TEXT NOT NULL,
  auftrag TEXT NOT NULL,
  auftragname TEXT NOT NULL,
  groesse TEXT NOT NULL,
  art TEXT NOT NULL,
  monat INTEGER NOT NULL,
  wert REAL NOT NULL
);

CREATE INDEX forecast_plan_key ON forecast_plan (jahr, groesse, art, monat, region, auftrag);

-- EBITDA_Plan
CREATE TABLE ebitda_plan (
  jahr INTEGER NOT NULL,
  monat INTEGER NOT NULL,
  operativ REAL NOT NULL,
  overhead REAL NOT NULL,
  bewertung REAL NOT NULL,
  PRIMARY KEY (jahr, monat)
);

-- Verlust. Gebucht, ImForecast und Nachrichtlich sind Excel-Wahrheitswerte.
CREATE TABLE verlust (
  jahr INTEGER NOT NULL,
  monat INTEGER NOT NULL,
  region TEXT NOT NULL,
  projekt TEXT NOT NULL,
  betrag REAL NOT NULL,
  gebucht INTEGER NOT NULL,
  im_forecast INTEGER NOT NULL,
  nachrichtlich INTEGER NOT NULL,
  notiz TEXT NOT NULL
);

-- Liq_Parameter
CREATE TABLE liq_parameter (
  jahr INTEGER NOT NULL,
  schluessel TEXT NOT NULL,
  wert REAL NOT NULL,
  einheit TEXT NOT NULL,
  beschreibung TEXT NOT NULL,
  PRIMARY KEY (jahr, schluessel)
);

-- Liq_Monat, nur die eingegebenen Spalten. Kosten und Zahlungsziel sind Formeln.
CREATE TABLE liq_monat (
  jahr INTEGER NOT NULL,
  monat INTEGER NOT NULL,
  umsatz REAL NOT NULL,
  bestandsaenderung REAL NOT NULL,
  ebitda REAL NOT NULL,
  ist INTEGER NOT NULL,
  PRIMARY KEY (jahr, monat)
);

-- Liq_Bestand
CREATE TABLE liq_bestand (
  jahr INTEGER NOT NULL,
  monat INTEGER NOT NULL,
  saldo REAL NOT NULL,
  quelle TEXT NOT NULL,
  PRIMARY KEY (jahr, monat)
);

-- Kontostand
CREATE TABLE kontostand (
  stichtag TEXT NOT NULL,
  konto TEXT NOT NULL,
  saldo REAL NOT NULL
);

-- GuV_Positionen. formel leer = SAP-Blattwert, sonst die Summenformel als Zeilenliste.
CREATE TABLE guv_position (
  zeile INTEGER PRIMARY KEY,
  nr INTEGER NOT NULL,
  position TEXT NOT NULL,
  formel TEXT NOT NULL
);

CREATE TABLE guv_wert (
  zeile INTEGER NOT NULL,
  monat INTEGER NOT NULL,
  wert REAL NOT NULL,
  PRIMARY KEY (zeile, monat)
);

-- Kostenverfolgung, eingegebene Meldung. SAP-Spalten sind Formeln.
CREATE TABLE kosten_meldung (
  zeile INTEGER PRIMARY KEY,
  psp TEXT NOT NULL,
  auftrag TEXT NOT NULL,
  titel TEXT NOT NULL,
  region TEXT NOT NULL,
  umsatz_meldung REAL NOT NULL,
  kosten_meldung REAL NOT NULL,
  ergebnis_meldung REAL NOT NULL,
  vertrag_umsatz REAL NOT NULL
);

-- Auftraege, Spalte A: die dort aufgeführten Projektnummern.
CREATE TABLE auftrag_liste (
  zeile INTEGER PRIMARY KEY,
  projekt_nr TEXT NOT NULL
);

-- Regionen, Spalte A in der Reihenfolge des Blatts.
CREATE TABLE region_liste (
  zeile INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

-- Legende
CREATE TABLE legende (
  zeile INTEGER PRIMARY KEY,
  punkt TEXT NOT NULL,
  formel TEXT NOT NULL
);

-- Dieselbe Zuordnung wie die Formeln in Auftrag_Journal, Spalten M–AC.
CREATE VIEW v_journal AS
SELECT
  b.id,
  b.datum,
  b.jahr,
  b.monat,
  b.belegart,
  b.belegnummer,
  b.auftrag,
  b.projekt_id,
  b.kostenart_id,
  b.konto,
  b.wert,
  b.text,
  CASE WHEN p.projekt_id IS NULL THEN b.auftrag ELSE p.projekt_nr END AS projekt_nr,
  CASE WHEN p.projekt_id IS NULL THEN '' ELSE p.name END AS projektname,
  CASE WHEN p.projekt_id IS NULL THEN 'SONSTIGES' ELSE p.typ END AS typ,
  CASE WHEN p.projekt_id IS NULL THEN '--' ELSE p.regionscode END AS regionscode,
  CASE WHEN p.projekt_id IS NULL THEN 'Ohne Zuordnung' ELSE p.region END AS region,
  CASE WHEN k.kostenart_id IS NULL THEN 2 ELSE k.db_stufe END AS db_stufe,
  CASE WHEN k.kostenart_id IS NULL THEN '8 Sonstige betriebliche Aufwendungen' ELSE k.guv_gruppe END AS guv_gruppe,
  CASE
    WHEN substr(b.belegnummer, 1, 4) = '9900' THEN 'Umlage'
    WHEN substr(b.belegnummer, 1, 2) = '80' THEN 'Abrechnung'
    WHEN substr(b.belegnummer, 1, 1) = '9' THEN 'Verrechnung'
    ELSE 'Primaer'
  END AS belegkreis,
  CASE
    WHEN b.belegnummer <> '' AND substr(b.belegnummer, 1, 2) <> '80' THEN 1
    ELSE 0
  END AS ergebnisrelevant,
  CASE
    WHEN b.belegnummer <> '' AND substr(b.belegnummer, 1, 2) <> '80' AND COALESCE(k.db_stufe, 2) = 0 THEN -b.wert
    ELSE 0
  END AS leistung,
  CASE
    WHEN b.belegnummer <> '' AND substr(b.belegnummer, 1, 2) <> '80' AND COALESCE(k.db_stufe, 2) = 1 THEN b.wert
    ELSE 0
  END AS kvar,
  CASE
    WHEN b.belegnummer <> '' AND substr(b.belegnummer, 1, 2) <> '80' AND COALESCE(k.db_stufe, 2) = 2
      AND NOT (substr(b.belegnummer, 1, 4) = '9900') THEN b.wert
    ELSE 0
  END AS kfix,
  CASE
    WHEN b.belegnummer <> '' AND substr(b.belegnummer, 1, 2) <> '80' AND substr(b.belegnummer, 1, 4) = '9900' THEN b.wert
    ELSE 0
  END AS umlage,
  CASE
    WHEN p.typ = 'PROJEKT' THEN 'Projekt'
    WHEN p.regionscode = '50' THEN 'Zentrale'
    WHEN p.typ = 'INNENAUFTRAG' THEN 'Bereich'
    ELSE 'Offen'
  END AS kostentraeger
FROM buchung b
LEFT JOIN projekt p ON p.projekt_id = b.projekt_id
LEFT JOIN kostenart k ON k.kostenart_id = b.kostenart_id;

-- Ergebnis DB, Ergebnis Akte und Beitrag aus der Legende.
CREATE VIEW v_zeile AS
SELECT
  j.*,
  CASE
    WHEN j.ergebnisrelevant = 1 AND j.kostentraeger = 'Projekt'
      THEN j.leistung - (j.kvar + j.kfix + j.umlage)
    ELSE 0
  END AS ergebnis_db,
  CASE
    WHEN j.ergebnisrelevant = 1 AND j.kostentraeger = 'Projekt' AND j.belegart <> 'CA'
      THEN j.leistung - (j.kvar + j.kfix + j.umlage)
    ELSE 0
  END AS ergebnis_akte,
  CASE
    WHEN j.ergebnisrelevant = 1 THEN j.leistung - (j.kvar + j.kfix + j.umlage)
    ELSE 0
  END AS beitrag
FROM v_journal j;
