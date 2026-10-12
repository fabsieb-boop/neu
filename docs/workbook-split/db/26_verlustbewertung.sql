/* ---------------------------------------------------------------------------
   Verlustfreie Bewertung (Verlustbewertungen)
   ---------------------------------------------------------------------------
   Drohende Verluste aus Projekten werden bewertet, lange bevor sie im SAP
   gebucht sind.  Genau dieser Unterschied entscheidet ueber das EBITDA:

     gebucht        -> steckt bereits in den Buchungszeilen und im SAP-Ergebnis
     noch offen     -> muss zusaetzlich abgezogen werden

   Wird das nicht getrennt gefuehrt, passiert eines von beiden: die Bewertung
   fehlt ganz, oder sie wird doppelt abgezogen.  Deshalb traegt jede Zeile den
   Schalter `gebucht`.

   Die Betraege sind negativ zu erfassen (eine Abwertung mindert das Ergebnis).
--------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS controlling.verlustbewertung (
  bewertung_id  bigserial PRIMARY KEY,
  jahr          smallint    NOT NULL,
  monat         smallint    NOT NULL CHECK (monat BETWEEN 1 AND 12),
  regionscode   text,                                  -- NULL = gesellschaftsweit
  projekt_nr    text,                                  -- NULL = nicht einzeln zugeordnet
  betrag        numeric(18,2) NOT NULL,                -- negativ = Abwertung
  gebucht       boolean     NOT NULL DEFAULT false,
  notiz         text,
  quelle        text,                                  -- z. B. 'Rolling Forecast'
  erfasst_von   bigint,
  erfasst_at    timestamptz NOT NULL DEFAULT now(),
  geaendert_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_verlustbewertung_zeit
  ON controlling.verlustbewertung (jahr, monat);

COMMENT ON TABLE controlling.verlustbewertung IS
  'Verlustfreie Bewertung je Monat. gebucht=true steckt bereits im SAP-Ergebnis.';
COMMENT ON COLUMN controlling.verlustbewertung.gebucht IS
  'true = im SAP gebucht, darf NICHT noch einmal abgezogen werden.';

/* ---------------------------------------------------------------------------
   Stand je Jahr: was ist bewertet, was davon gebucht, was steht noch aus.
--------------------------------------------------------------------------- */
CREATE OR REPLACE VIEW controlling.v_verlustbewertung AS
SELECT jahr,
       monat,
       sum(betrag)                                    AS bewertet,
       sum(betrag) FILTER (WHERE gebucht)             AS gebucht,
       sum(betrag) FILTER (WHERE NOT gebucht)         AS offen,
       count(*)                                       AS zeilen
  FROM controlling.verlustbewertung
 GROUP BY jahr, monat;

/* ---------------------------------------------------------------------------
   EBITDA auf belastbarer Grundlage.
   ---------------------------------------------------------------------------
   Ausgangspunkt ist NICHT die Buchungszeile: der Einzelposten-Auszug enthaelt
   die primaeren Personalkosten nicht, ein daraus gerechnetes EBITDA faellt
   deshalb um Millionen zu gut aus.  Grundlage ist die SAP-Auswertung
   Bilanz/GuV:

     Ergebnis der gewoehnlichen Geschaeftstaetigkeit
     - Finanzergebnis          (gehoert nicht ins EBITDA)
     + Abschreibungen          (das D und A in EBITDA)
     - noch nicht gebuchte Verlustbewertungen
     = EBITDA

   Vorzeichen der SAP-Auswertung: Aufwand positiv, Ertrag negativ.  Die Sicht
   dreht auf die kaufmaennische Leseart, in der ein Gewinn positiv ist.
--------------------------------------------------------------------------- */
CREATE OR REPLACE VIEW controlling.v_ebitda AS
WITH sap AS (
  SELECT jahr, periode,
         -max(berichtsperiode) FILTER (WHERE position = '0040180000'
              AND zeilentyp <> 'KONTO' AND berichtsperiode <> 0) AS egt,
         -max(berichtsperiode) FILTER (WHERE position = '0040100000'
              AND zeilentyp <> 'KONTO' AND berichtsperiode <> 0) AS finanzergebnis,
         -max(berichtsperiode) FILTER (WHERE position = '0030700000'
              AND zeilentyp <> 'KONTO' AND berichtsperiode <> 0) AS abschreibungen
    FROM controlling.sap_struktur
   WHERE art = 'GUV'
   GROUP BY jahr, periode
), offen AS (
  SELECT jahr, sum(betrag) AS offen
    FROM controlling.verlustbewertung
   WHERE NOT gebucht
   GROUP BY jahr
)
SELECT s.jahr,
       s.periode                                   AS bis_periode,
       s.egt,
       s.finanzergebnis,
       s.abschreibungen,
       s.egt - s.finanzergebnis                    AS ebit,
       s.egt - s.finanzergebnis - s.abschreibungen AS ebitda_vor_bewertung,
       COALESCE(o.offen, 0)                        AS verlustbewertung_offen,
       s.egt - s.finanzergebnis - s.abschreibungen
         + COALESCE(o.offen, 0)                    AS ebitda
  FROM sap s
  LEFT JOIN offen o ON o.jahr = s.jahr
 WHERE s.egt IS NOT NULL;

GRANT SELECT ON controlling.verlustbewertung, controlling.v_verlustbewertung,
                controlling.v_ebitda TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON controlling.verlustbewertung TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE controlling.verlustbewertung_bewertung_id_seq TO PUBLIC;

/* ---------------------------------------------------------------------------
   Monatliche EBITDA-Reihe aus dem Rolling Forecast
   ---------------------------------------------------------------------------
   Das EBITDA der Gesellschaft laesst sich aus unseren Buchungszeilen nicht
   rechnen: dort fehlen die primaeren Personalkosten.  Grundlage ist deshalb
   die Rechnung, die das Controlling ohnehin fuehrt:

     Operatives Ergebnis  -  Overhead  -  Verlustfreie Bewertung  =  EBITDA

   Gespeichert werden die drei Bestandteile, nicht nur die Summe – sonst
   laesst sich spaeter nicht mehr erklaeren, woher eine Zahl kommt.
--------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS controlling.ebitda_monat (
  jahr                smallint    NOT NULL,
  monat               smallint    NOT NULL CHECK (monat BETWEEN 1 AND 12),
  art                 text        NOT NULL CHECK (art IN ('IST','FC')),
  operatives_ergebnis numeric(18,2) NOT NULL DEFAULT 0,
  overhead            numeric(18,2) NOT NULL DEFAULT 0,   -- negativ
  bewertung           numeric(18,2) NOT NULL DEFAULT 0,   -- negativ, bereits beruecksichtigt
  quelle              text,
  stand               date,
  PRIMARY KEY (jahr, monat)
);

COMMENT ON TABLE controlling.ebitda_monat IS
  'EBITDA je Monat aus dem Rolling Forecast. art=IST bereits abgerechnet, FC Prognose.';

/* Erst loeschen, dann anlegen.  Spaetere Migrationen erweitern diese Sicht -
   49 stellt die Ist-Monate auf die Rechnung um und haengt die Spalte
   "gerechnet" an.  CREATE OR REPLACE kann keine Spalte wegnehmen, und weil
   setup.sh alle Dateien in einem psql-Lauf mit ON_ERROR_STOP ausfuehrt,
   brach hier der gesamte Lauf ab: die Migrationen 27 bis 56 kamen nie dran.
   v_ebitda_jahr haengt an dieser Sicht und muss deshalb zuerst weichen.

   CASCADE, weil spaetere Migrationen weitere Sichten daran haengen:
   v_ebitda_jahr (48/49) und v_forecast_bruecke (56).  Im vollen Lauf faellt
   das nicht auf - dort legt eine fruehere Datei v_forecast_bruecke ohne
   diese Abhaengigkeit neu an.  Wer aber nur die geaenderten Migrationen
   nachzieht, wie auf dem Server, laeuft ohne CASCADE genau hier auf.
   Beide Sichten werden von 49 und 56 wieder angelegt. */
DROP VIEW IF EXISTS controlling.v_ebitda_jahr CASCADE;
DROP VIEW IF EXISTS controlling.v_ebitda_monat CASCADE;

CREATE VIEW controlling.v_ebitda_monat AS
SELECT jahr, monat, art, operatives_ergebnis, overhead, bewertung,
       operatives_ergebnis + overhead + bewertung AS ebitda
  FROM controlling.ebitda_monat;

/* ---------------------------------------------------------------------------
   Jahres-EBITDA.
   ---------------------------------------------------------------------------
   Die Monatsreihe enthaelt bereits, was zum Stand des Forecasts beruecksichtigt
   war.  Verlustbewertungen, die weder gebucht noch im Forecast enthalten sind,
   kommen zusaetzlich in Abzug – genau einmal, dafuer sorgen die beiden
   Schalter `gebucht` und `im_forecast`.
--------------------------------------------------------------------------- */
ALTER TABLE controlling.verlustbewertung
  ADD COLUMN IF NOT EXISTS im_forecast boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN controlling.verlustbewertung.im_forecast IS
  'true = steckt bereits in der EBITDA-Monatsreihe und darf nicht erneut abgezogen werden.';

/* Weiter unten in dieser Datei bekommt die Sicht drei Spalten mehr.  Beim
   Neuaufbau ist die Reihenfolge egal, auf einer bestehenden Datenbank nicht:
   dort steht die breitere Fassung schon, und CREATE OR REPLACE darf einer
   Sicht keine Spalten wegnehmen ("cannot drop columns from view").  Das
   Skript brach an dieser Stelle ab, sobald es ein zweites Mal lief – deshalb
   erst wegnehmen, dann neu anlegen. */
DROP VIEW IF EXISTS controlling.v_ebitda_jahr;
CREATE VIEW controlling.v_ebitda_jahr AS
WITH reihe AS (
  SELECT jahr,
         sum(operatives_ergebnis + overhead + bewertung)                          AS ebitda_reihe,
         sum(operatives_ergebnis + overhead + bewertung) FILTER (WHERE art='IST')  AS ist,
         sum(operatives_ergebnis + overhead + bewertung) FILTER (WHERE art='FC')   AS fc,
         max(monat) FILTER (WHERE art='IST')                                       AS ist_bis
    FROM controlling.ebitda_monat
   GROUP BY jahr
), offen AS (
  SELECT jahr, sum(betrag) AS offen
    FROM controlling.verlustbewertung
   WHERE NOT gebucht AND NOT im_forecast
   GROUP BY jahr
)
SELECT r.jahr, r.ist_bis, r.ist, r.fc, r.ebitda_reihe,
       COALESCE(o.offen, 0)                  AS bewertung_offen,
       r.ebitda_reihe + COALESCE(o.offen, 0) AS ebitda
  FROM reihe r LEFT JOIN offen o ON o.jahr = r.jahr;

GRANT SELECT ON controlling.ebitda_monat, controlling.v_ebitda_monat,
                controlling.v_ebitda_jahr TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON controlling.ebitda_monat TO PUBLIC;

/* ---------------------------------------------------------------------------
   Nachrichtliche Bewertungen
   ---------------------------------------------------------------------------
   Nicht jede erkannte Abwertung ist schon entschieden.  Solche Posten werden
   ausgewiesen, aber nicht in die Kennzahl gerechnet – sonst wandert eine Zahl
   ins Berichtswesen, die noch zur Diskussion steht.  Sichtbar bleiben sie
   trotzdem: als eigene Zeile unter dem Ergebnis.
--------------------------------------------------------------------------- */
ALTER TABLE controlling.verlustbewertung
  ADD COLUMN IF NOT EXISTS nachrichtlich boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN controlling.verlustbewertung.nachrichtlich IS
  'true = wird ausgewiesen, aber nicht vom EBITDA abgezogen (noch nicht entschieden).';

DROP VIEW IF EXISTS controlling.v_ebitda_jahr;
CREATE VIEW controlling.v_ebitda_jahr AS
WITH reihe AS (
  SELECT jahr,
         sum(operatives_ergebnis + overhead + bewertung)                         AS ebitda_reihe,
         sum(operatives_ergebnis + overhead + bewertung) FILTER (WHERE art='IST') AS ist,
         sum(operatives_ergebnis + overhead + bewertung) FILTER (WHERE art='FC')  AS fc,
         max(monat) FILTER (WHERE art='IST')                                      AS ist_bis
    FROM controlling.ebitda_monat
   GROUP BY jahr
), bew AS (
  SELECT jahr,
         sum(betrag) FILTER (WHERE NOT gebucht AND NOT im_forecast
                               AND NOT nachrichtlich)  AS offen,
         sum(betrag) FILTER (WHERE nachrichtlich)      AS nachrichtlich,
         sum(betrag)                                   AS bewertet_gesamt
    FROM controlling.verlustbewertung
   GROUP BY jahr
)
SELECT r.jahr, r.ist_bis, r.ist, r.fc, r.ebitda_reihe,
       COALESCE(b.offen, 0)                  AS bewertung_offen,
       COALESCE(b.nachrichtlich, 0)          AS bewertung_nachrichtlich,
       COALESCE(b.bewertet_gesamt, 0)        AS bewertet_gesamt,
       r.ebitda_reihe + COALESCE(b.offen, 0) AS ebitda,
       r.ebitda_reihe + COALESCE(b.offen, 0)
         + COALESCE(b.nachrichtlich, 0)      AS ebitda_mit_nachrichtlich
  FROM reihe r LEFT JOIN bew b ON b.jahr = r.jahr;

GRANT SELECT ON controlling.v_ebitda_jahr TO PUBLIC;
