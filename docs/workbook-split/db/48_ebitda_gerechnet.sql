/* ---------------------------------------------------------------------------
   Das EBITDA der Ist-Monate wird gerechnet, nicht eingetragen
   ---------------------------------------------------------------------------
   v_ebitda_monat las bisher die Tabelle ebitda_monat - also Werte, die aus
   der Ergebnispraesentation abgeschrieben waren.  Damit stand in der
   Ergebnisrechnung nicht das Ergebnis, sondern eine Abschrift davon: aendert
   sich eine Buchung, aendert sich die Anzeige nicht.

   Ab hier gilt die Trennung, die auch fachlich richtig ist:

     bis zum letzten belastbaren Monat   gerechnet aus den Einzelposten
     danach                              Forecast, also Eingabe

   Die Aufteilung in operatives Ergebnis, Overhead und Bewertung bleibt
   nachrichtlich aus der Tabelle stehen; das operative Ergebnis traegt die
   Differenz, damit die Zeile weiterhin aufgeht.  Massgeblich ist die Summe,
   und die kommt aus den Buchungen.

   Probe Januar bis Juli 2026: -122.862,29 EUR (Folie 1.1: -123 T EUR),
   Monat fuer Monat 292 / 325 / 23 / -181 / -142 / 57 / -496 T EUR.
--------------------------------------------------------------------------- */

DROP VIEW IF EXISTS controlling.v_ebitda_jahr;
DROP VIEW IF EXISTS controlling.v_ebitda_monat;

CREATE VIEW controlling.v_ebitda_monat AS
WITH grenze AS (
  SELECT DISTINCT jahr, controlling.f_letzter_belastbarer_monat(jahr) AS bis
    FROM controlling.ebitda_monat
),
gerechnet AS (
  SELECT jahr, monat, ebitda FROM controlling.v_kennzahlen_monat
)
SELECT e.jahr,
       e.monat,
       CASE WHEN e.monat <= g.bis THEN 'IST' ELSE 'FC' END                    AS art,
       CASE WHEN e.monat <= g.bis AND k.ebitda IS NOT NULL
            THEN k.ebitda - e.overhead - e.bewertung
            ELSE e.operatives_ergebnis END                                    AS operatives_ergebnis,
       e.overhead,
       e.bewertung,
       CASE WHEN e.monat <= g.bis AND k.ebitda IS NOT NULL
            THEN k.ebitda
            ELSE e.operatives_ergebnis + e.overhead + e.bewertung END         AS ebitda,
       (e.monat <= g.bis AND k.ebitda IS NOT NULL)                            AS gerechnet
  FROM controlling.ebitda_monat e
  JOIN grenze    g ON g.jahr = e.jahr
  LEFT JOIN gerechnet k ON k.jahr = e.jahr AND k.monat = e.monat;

COMMENT ON VIEW controlling.v_ebitda_monat IS
  'EBITDA je Monat: bis zum letzten belastbaren Monat aus den Einzelposten gerechnet, danach Forecast.';

CREATE VIEW controlling.v_ebitda_jahr AS
WITH reihe AS (
  SELECT jahr,
         sum(ebitda)                                AS ebitda_reihe,
         sum(ebitda) FILTER (WHERE art = 'IST')     AS ist,
         sum(ebitda) FILTER (WHERE art = 'FC')      AS fc,
         max(monat)  FILTER (WHERE art = 'IST')     AS ist_bis
    FROM controlling.v_ebitda_monat GROUP BY jahr
), bew AS (
  SELECT jahr,
         sum(betrag) FILTER (WHERE NOT gebucht AND NOT im_forecast AND NOT nachrichtlich) AS offen,
         sum(betrag) FILTER (WHERE nachrichtlich)                                         AS nachrichtlich,
         sum(betrag)                                                                      AS bewertet_gesamt
    FROM controlling.verlustbewertung GROUP BY jahr
)
SELECT r.jahr, r.ist_bis, r.ist, r.fc, r.ebitda_reihe,
       COALESCE(b.offen, 0)          AS bewertung_offen,
       COALESCE(b.nachrichtlich, 0)  AS bewertung_nachrichtlich,
       COALESCE(b.bewertet_gesamt, 0) AS bewertet_gesamt,
       r.ebitda_reihe + COALESCE(b.offen, 0)                             AS ebitda,
       r.ebitda_reihe + COALESCE(b.offen, 0) + COALESCE(b.nachrichtlich, 0) AS ebitda_mit_nachrichtlich
  FROM reihe r LEFT JOIN bew b ON b.jahr = r.jahr;

COMMENT ON VIEW controlling.v_ebitda_jahr IS
  'EBITDA des Jahres aus Ist-Monaten und Forecast, zuzueglich der offenen Verlustbewertung.';

GRANT SELECT ON controlling.v_ebitda_monat, controlling.v_ebitda_jahr TO PUBLIC;
