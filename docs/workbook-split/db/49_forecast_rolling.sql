/* ---------------------------------------------------------------------------
   Forecast und Overhead aus dem Rolling Forecast
   ---------------------------------------------------------------------------
   Quelle: "Rolling Forecast-6.xlsx", Blatt "Zusammenfassung FC + LiqiPlanun",
   Zeile 48 (Operatives Ergebnis) und Zeile 49 (Overhead).  Der Overhead
   kommt dort selbst aus einer eigenen Datei; aus unseren Buchungen ist er
   nicht ableitbar, deshalb ist er Eingabe wie der Forecast.

   Damit steht der Overhead Januar bis Juli auf -956.961 EUR - die -957, nach
   denen gefragt war, nicht die -909.

   Die Ist-Monate bleiben gerechnet: v_ebitda_monat nimmt von hier nur die
   Aufteilung, die Summe kommt aus den Einzelposten.  Zur Kontrolle, die
   Excel-Reihe 51 und unsere Rechnung nebeneinander:

     Jan 292.453  Feb 324.629  Mrz 22.834  Apr -181.398
     Mai -142.497 Jun  56.976  Jul -495.860

   Fuer die Forecast-Monate gilt die Reihe der Excel, mit einer Ausnahme: die
   verlustfreie Bewertung steht dort mit -261.000 im Oktober.  Sie wurde
   inzwischen auf -669.000 insgesamt berichtigt, davon -376.000 im Juli
   gebucht und -293.000 im Oktober angesetzt.  Massgeblich ist die
   Tabelle verlustbewertung; die Spalte bewertung in ebitda_monat wird
   deshalb nicht mehr gelesen.
--------------------------------------------------------------------------- */

UPDATE controlling.ebitda_monat SET overhead = v.overhead
  FROM (VALUES (1, -89049.00), (2, -104263.00), (3, -151248.00), (4, -152056.00),
               (5, -163062.00), (6, -148642.00), (7, -148641.00))
       AS v(monat, overhead)
 WHERE ebitda_monat.jahr = 2026 AND ebitda_monat.monat = v.monat;

UPDATE controlling.ebitda_monat
   SET operatives_ergebnis = v.operativ, overhead = v.overhead, bewertung = 0
  FROM (VALUES (8,    767.00, -152558.00), (9,  401088.00, -158558.00),
               (10, 253955.00, -142558.00), (11, 205874.00, -136558.00),
               (12, 488320.00, -136558.00))
       AS v(monat, operativ, overhead)
 WHERE ebitda_monat.jahr = 2026 AND ebitda_monat.monat = v.monat;

/* ---------------------------------------------------------------------------
   Die Bewertung hat jetzt nur noch einen Ort.  Vorher stand sie zweimal da -
   in ebitda_monat und in verlustbewertung - und die beiden konnten
   auseinanderlaufen, ohne dass es jemand merkt.
--------------------------------------------------------------------------- */
DROP VIEW IF EXISTS controlling.v_ebitda_jahr;
DROP VIEW IF EXISTS controlling.v_ebitda_monat;

CREATE VIEW controlling.v_ebitda_monat AS
WITH grenze AS (
  SELECT DISTINCT jahr, controlling.f_letzter_belastbarer_monat(jahr) AS bis
    FROM controlling.ebitda_monat
),
bew AS (   -- angesetzt, noch nicht gebucht: gehoert in den Forecast-Monat
  SELECT jahr, monat, sum(betrag) AS betrag
    FROM controlling.verlustbewertung
   WHERE im_forecast AND NOT gebucht AND NOT nachrichtlich
   GROUP BY jahr, monat
)
SELECT e.jahr,
       e.monat,
       CASE WHEN e.monat <= g.bis THEN 'IST' ELSE 'FC' END                    AS art,
       CASE WHEN e.monat <= g.bis AND k.ebitda IS NOT NULL
            THEN k.ebitda - e.overhead
            ELSE e.operatives_ergebnis END::numeric(18,2)                     AS operatives_ergebnis,
       e.overhead,
       CASE WHEN e.monat <= g.bis THEN 0
            ELSE COALESCE(b.betrag, 0) END::numeric(18,2)                     AS bewertung,
       CASE WHEN e.monat <= g.bis AND k.ebitda IS NOT NULL
            THEN k.ebitda
            ELSE e.operatives_ergebnis + e.overhead
                 + COALESCE(b.betrag, 0) END::numeric(18,2)                   AS ebitda,
       (e.monat <= g.bis AND k.ebitda IS NOT NULL)                            AS gerechnet
  FROM controlling.ebitda_monat e
  JOIN grenze g ON g.jahr = e.jahr
  LEFT JOIN controlling.v_kennzahlen_monat k ON k.jahr = e.jahr AND k.monat = e.monat
  LEFT JOIN bew b ON b.jahr = e.jahr AND b.monat = e.monat;

COMMENT ON VIEW controlling.v_ebitda_monat IS
  'EBITDA je Monat: bis zum letzten belastbaren Monat gerechnet, danach Forecast; Bewertung aus verlustbewertung.';

GRANT SELECT ON controlling.v_ebitda_monat TO PUBLIC;

CREATE VIEW controlling.v_ebitda_jahr AS
WITH reihe AS (
  SELECT jahr,
         sum(ebitda)                            AS ebitda_reihe,
         sum(ebitda) FILTER (WHERE art = 'IST') AS ist,
         sum(ebitda) FILTER (WHERE art = 'FC')  AS fc,
         max(monat)  FILTER (WHERE art = 'IST') AS ist_bis
    FROM controlling.v_ebitda_monat GROUP BY jahr
), bew AS (
  SELECT jahr,
         sum(betrag) FILTER (WHERE NOT gebucht AND NOT im_forecast AND NOT nachrichtlich) AS offen,
         sum(betrag) FILTER (WHERE nachrichtlich)                                         AS nachrichtlich,
         sum(betrag)                                                                      AS bewertet_gesamt
    FROM controlling.verlustbewertung GROUP BY jahr
)
SELECT r.jahr, r.ist_bis, r.ist, r.fc, r.ebitda_reihe,
       COALESCE(b.offen, 0)           AS bewertung_offen,
       COALESCE(b.nachrichtlich, 0)   AS bewertung_nachrichtlich,
       COALESCE(b.bewertet_gesamt, 0) AS bewertet_gesamt,
       r.ebitda_reihe + COALESCE(b.offen, 0)                                AS ebitda,
       r.ebitda_reihe + COALESCE(b.offen, 0) + COALESCE(b.nachrichtlich, 0) AS ebitda_mit_nachrichtlich
  FROM reihe r LEFT JOIN bew b ON b.jahr = r.jahr;

COMMENT ON VIEW controlling.v_ebitda_jahr IS
  'EBITDA des Jahres aus gerechneten Ist-Monaten und Forecast, zuzueglich noch nicht angesetzter Bewertung.';

GRANT SELECT ON controlling.v_ebitda_jahr TO PUBLIC;
