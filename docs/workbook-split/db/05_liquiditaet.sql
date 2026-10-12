-- ============================================================================
--  Liquiditaetsplanung: Datenmodell, Parameter und Ausgangsdaten
--
--  Setzt die dokumentierte Methode der TVF ALTWERT GmbH um
--  ("Liquiditaetsplanung 2026 - Methode, Rechenweg und Herleitung jeder Groesse",
--  Version 1.0, Stand August 2026) samt der Arbeitsmappe "Rechenweg".
--
--  Kern der Methode: der Zahlungsstrom wird direkt modelliert statt aus dem
--  Ergebnis abgeleitet. Die beiden Zahlungsziele sind nicht angenommen, sondern
--  aus den tatsaechlichen Bestandsbewegungen zurueckgerechnet. Das kalibrierte
--  Modell erklaert 96,8 Prozent der beobachteten Monatsveraenderungen.
--
--  Idempotent, beliebig oft ausfuehrbar.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Steuerparameter
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS controlling.liq_parameter (
  jahr        SMALLINT NOT NULL,
  schluessel  VARCHAR(40) NOT NULL,
  wert        NUMERIC(18,4) NOT NULL,
  einheit     VARCHAR(20),
  beschreibung TEXT,
  PRIMARY KEY (jahr, schluessel)
);

-- ---------------------------------------------------------------------------
-- 2. Monatliche Ausgangsgroessen aus der Ergebnisrechnung
--    ist = TRUE fuer abgeschlossene Monate, FALSE fuer Forecast
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS controlling.liq_monat (
  jahr                     SMALLINT NOT NULL,
  monat                    SMALLINT NOT NULL CHECK (monat BETWEEN 1 AND 12),
  umsatz                   NUMERIC(18,2) NOT NULL DEFAULT 0,
  bestandsaenderung        NUMERIC(18,2) NOT NULL DEFAULT 0,
  ebitda                   NUMERIC(18,2) NOT NULL DEFAULT 0,
  netto_vorraete           NUMERIC(18,2),
  bestand_erhaltene_az     NUMERIC(18,2),
  bestand_angeforderte_az  NUMERIC(18,2),
  ist                      BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (jahr, monat)
);

-- ---------------------------------------------------------------------------
-- 3. Tatsaechliche Bestaende je Monatsende (Cash Pool bzw. Bank)
--    Grundlage der Kalibrierung. Jeder zusaetzliche Ist-Stand verbessert sie.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS controlling.liq_bestand (
  jahr   SMALLINT NOT NULL,
  monat  SMALLINT NOT NULL CHECK (monat BETWEEN 1 AND 12),
  saldo  NUMERIC(18,2) NOT NULL,
  quelle VARCHAR(60),
  PRIMARY KEY (jahr, monat)
);

-- ---------------------------------------------------------------------------
-- 4. Finanzierungsvorgaenge (einmalige Zu- und Abfluesse)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS controlling.liq_finanzierung (
  jahr        SMALLINT NOT NULL,
  monat       SMALLINT NOT NULL CHECK (monat BETWEEN 1 AND 12),
  schluessel  VARCHAR(40) NOT NULL,
  betrag      NUMERIC(18,2) NOT NULL,
  beschreibung TEXT,
  PRIMARY KEY (jahr, monat, schluessel)
);

-- ---------------------------------------------------------------------------
-- 5. Bankkonten und Kontoauszuege
--    Vorbereitet fuer den Import. Mit echten Bewegungen laesst sich die
--    Kalibrierung auf Ist-Staende stuetzen und der systematische Zufluss
--    sachlich zuordnen - beides nennt die Methodik als offene Punkte.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS controlling.bankkonto (
  konto_id    BIGSERIAL PRIMARY KEY,
  bezeichnung VARCHAR(120) NOT NULL,
  iban        VARCHAR(40) UNIQUE,
  bank        VARCHAR(120),
  waehrung    VARCHAR(3) NOT NULL DEFAULT 'EUR',
  art         VARCHAR(30) NOT NULL DEFAULT 'BANK',  -- BANK | CASH_POOL | DARLEHEN | KASSE
  aktiv       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS controlling.bankbewegung (
  bewegung_id     BIGSERIAL PRIMARY KEY,
  konto_id        BIGINT REFERENCES controlling.bankkonto(konto_id),
  buchungsdatum   DATE NOT NULL,
  valutadatum     DATE,
  betrag          NUMERIC(18,2) NOT NULL,
  waehrung        VARCHAR(3) NOT NULL DEFAULT 'EUR',
  saldo_nachher   NUMERIC(18,2),
  buchungstext    VARCHAR(255),
  verwendungszweck TEXT,
  gegenpartei     VARCHAR(255),
  gegen_iban      VARCHAR(40),
  kategorie       VARCHAR(40),   -- KUNDENZAHLUNG | LIEFERANT | PERSONAL | STEUERN | FACTORING | DARLEHEN | SONSTIGES
  auftrag         VARCHAR(80),
  import_id       BIGINT,
  quelle          JSONB,
  erfasst_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (konto_id, buchungsdatum, betrag, verwendungszweck)
);

CREATE INDEX IF NOT EXISTS idx_bankbewegung_datum ON controlling.bankbewegung(buchungsdatum);
CREATE INDEX IF NOT EXISTS idx_bankbewegung_kat   ON controlling.bankbewegung(kategorie);

-- ---------------------------------------------------------------------------
-- 6. Ausgangsdaten 2026
--
--    Der Seed fuellt nur auf, was noch fehlt. Werte, die inzwischen aus dem
--    Rolling Forecast oder von Hand aktualisiert wurden, bleiben stehen -
--    sonst wuerde ein erneuter Lauf der Migration sie zurueckdrehen.
-- ---------------------------------------------------------------------------

INSERT INTO controlling.liq_parameter (jahr, schluessel, wert, einheit, beschreibung) VALUES
  (2026, 'dso_tage', 119, 'Tage', 'Debitorenlaufzeit: von der Umsatzbuchung bis zum Zahlungseingang. Kalibriert an den Ist-Bewegungen.'),
  (2026, 'dpo_tage', 45, 'Tage', 'Kreditorenlaufzeit: von der Kostenentstehung bis zur Auszahlung der Sachkosten. Kalibriert.'),
  (2026, 'systematischer_zufluss', 209759.08, 'EUR/Monat', 'Regelmaessiger Zufluss, den das Modell weder Umsatz noch Anzahlung zuordnen kann. Vermutlich Factoring.'),
  (2026, 'realisierungsquote_az', 1, 'Anteil', 'Anteil der geplanten Anzahlungseingaenge, der tatsaechlich zufliesst.'),
  (2026, 'tage_je_monat', 30.4375, 'Tage', '365,25 / 12. Umrechnung der Zahlungsziele in Monatsversaetze.'),
  (2026, 'personal_monat', 333887.39, 'EUR/Monat', 'Personalaufwand Jahresforecast / 12. Wird im Entstehungsmonat gezahlt, daher ohne Zahlungsziel.'),
  (2026, 'abschreibung_monat', 9455.99, 'EUR/Monat', 'Nicht zahlungswirksam, wird aus den Sachkosten herausgerechnet.'),
  (2026, 'zins_steuer_monat', 4058.81, 'EUR/Monat', 'Zinsaufwand abzueglich Zinsertrag zuzueglich sonstige Steuern.'),
  (2026, 'startbestand', -919229.04, 'EUR', 'Cash-Pool-Saldo zum 31.07.2026. Negativ = Verbindlichkeit gegenueber dem Mutterkonzern.'),
  (2026, 'bestand_angeforderte_az_start', 1476386.65, 'EUR', 'Bestand zum 31.07.2026. Laeuft im Modell bis Dezember gleichmaessig aus.'),
  (2026, 'tilgung_monat', 0, 'EUR/Monat', 'Tilgungsplan des Konzerndarlehens liegt noch nicht vor.'),
  (2026, 'investition_monat', 0, 'EUR/Monat', 'Annahme: kein signifikantes Investment.'),
  (2026, 'startmonat_plan', 8, 'Monat', 'Erster Planmonat. Davor gelten Ist-Werte.'),
  (2026, 'umsatzsteuer_aktiv', 0, 'Schalter', 'Zahlungsstroeme brutto rechnen und die Zahllast separat abfuehren. 0 = aus, 1 = an. Geprueft und bewusst aus: die Bruttorechnung senkt den Erklaerungsgrad von 96,8 auf 92,5 Prozent, weil die Steuerzahlungen nicht ueber den Cash Pool laufen, gegen den kalibriert wird.'),
  (2026, 'ust_satz', 0.19, 'Anteil', 'Regelsteuersatz.'),
  (2026, 'ust_verzug_monate', 2, 'Monate', 'Voranmeldung zuzueglich Dauerfristverlaengerung.')
ON CONFLICT DO NOTHING;
INSERT INTO controlling.liq_finanzierung (jahr, monat, schluessel, betrag, beschreibung) VALUES
  (2026, 8, 'wandlung_cash_pool', 800000.00, 'Wandlung Cash Pool in Darlehen'),
  (2026, 8, 'darlehen', 1500000.00, 'Auszahlung Liquiditaetsdarlehen'),
  (2026, 8, 'sonstige_zahlungen', -100000.00, 'Sonstige Zahlungen, Verwendungszweck im Ursprungsmodell nicht dokumentiert')
ON CONFLICT DO NOTHING;

INSERT INTO controlling.liq_monat
  (jahr, monat, umsatz, bestandsaenderung, ebitda, netto_vorraete,
   bestand_erhaltene_az, bestand_angeforderte_az, ist) VALUES
  (2026, 1, 640000.00, 1281000.00, 292000.00, -958894.15, 6526193.63, 3106123.50, true),
  (2026, 2, 2777000.00, -200000.00, 325000.00, -922181.59, 5926998.66, 3468428.99, true),
  (2026, 3, 1214000.00, 1199000.00, 23000.00, -931915.22, 6136257.91, 4467574.86, true),
  (2026, 4, 678000.00, 1261000.00, -181000.00, -645799.88, 7457313.36, 4121623.96, true),
  (2026, 5, 1348000.00, -264000.00, -142000.00, -1430447.99, 8107758.48, 3992222.86, true),
  (2026, 6, 2470000.00, 315000.00, 57000.00, 1246468.86, 7521893.97, 2215815.75, true),
  (2026, 7, 1006000.00, 466000.00, -135000.00, 807059.51, 8995448.88, 1476386.65, true),
  (2026, 8, 1095000.00, 1130000.00, -81000.00, -1165963.51, NULL, NULL, false),
  (2026, 9, 2003000.00, 954000.00, 189000.00, -1361187.97, NULL, NULL, false),
  (2026, 10, 5118000.00, -3166000.00, 124000.00, -2098534.84, NULL, NULL, false),
  (2026, 11, 3414000.00, -1561000.00, 66000.00, -2148507.05, NULL, NULL, false),
  (2026, 12, 6230000.00, -3704000.00, 241000.00, -1771238.45, NULL, NULL, false)
ON CONFLICT DO NOTHING;

INSERT INTO controlling.liq_bestand (jahr, monat, saldo, quelle) VALUES
  (2026, 1, -967394.51, 'Rolling Forecast, Zeile Cash Pool'),
  (2026, 2, -1687613.22, 'Rolling Forecast, Zeile Cash Pool'),
  (2026, 3, -1081708.41, 'Rolling Forecast, Zeile Cash Pool'),
  (2026, 4, -1858253.62, 'Rolling Forecast, Zeile Cash Pool'),
  (2026, 5, -2445311.20, 'Rolling Forecast, Zeile Cash Pool'),
  (2026, 6, -1778289.46, 'Rolling Forecast, Zeile Cash Pool'),
  (2026, 7, -919229.04, 'Rolling Forecast, Zeile Cash Pool')
ON CONFLICT DO NOTHING;

COMMIT;
