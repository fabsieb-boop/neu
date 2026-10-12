/* ---------------------------------------------------------------------------
   Bestand ohne Rechnung
   ---------------------------------------------------------------------------
   Die stille Art, ein Ergebnis zu schoenen: Kosten laufen auf ein Projekt,
   abgerechnet wird nicht, und die Differenz steht als unfertige Leistung im
   Bestand.  Solange sie dort steht, sieht das Projekt aus, als sei es
   ausgeglichen.  Ob die Leistung je bezahlt wird, entscheidet sich erst bei
   der Schlussrechnung – und dann auf einen Schlag.

   Diese Sicht macht daraus eine Beobachtungsliste: welches Projekt traegt
   Bestand, und wie lange ist die letzte Rechnung her.

   Zwei Festlegungen, beide als Einstellung und nicht im Programmtext:

     bestand_tage_ohne_rechnung  ab wann eine Zeile auffaellt (35 Tage)
     bestand_bagatelle           unterhalb welchen Betrags nicht (1.000 €)

   Gemessen wird gegen den **Stand der Daten** und nicht gegen das heutige
   Datum.  Sonst waere jedes Projekt auffaellig, sobald der Import ein paar
   Wochen alt ist – die Liste wuerde nicht das Projekt beschreiben, sondern
   den Importrhythmus.
--------------------------------------------------------------------------- */

INSERT INTO controlling.app_einstellung (schluessel, wert) VALUES
  ('bestand_tage_ohne_rechnung', '35'),
  ('bestand_bagatelle',          '1000')
ON CONFLICT (schluessel) DO NOTHING;

CREATE OR REPLACE VIEW controlling.v_bestand_ohne_rechnung AS
WITH stand AS (
  SELECT max(buchungsdatum) AS bezugstag FROM controlling.v_buchung
), grenze AS (
  SELECT
    COALESCE((SELECT wert::numeric FROM controlling.app_einstellung
               WHERE schluessel = 'bestand_tage_ohne_rechnung'), 35) AS tage,
    COALESCE((SELECT wert::numeric FROM controlling.app_einstellung
               WHERE schluessel = 'bestand_bagatelle'), 1000)        AS bagatelle
), je AS (
  SELECT b.auftrag,
         max(p.projektname)                                          AS projektname,
         max(b.region)                                               AS region,
         max(b.regionscode)                                          AS regionscode,
         sum(b.k_var + b.k_fix)                                      AS kosten,
         COALESCE(sum(-b.wert) FILTER (WHERE b.klr_gruppe = 'Umsatzerlöse'), 0) AS erloes,
         max(b.buchungsdatum) FILTER (WHERE b.klr_gruppe = 'Umsatzerlöse')      AS letzte_rechnung,
         min(b.buchungsdatum) FILTER (WHERE b.k_var + b.k_fix <> 0)             AS erste_kosten,
         max(b.buchungsdatum)                                        AS letzte_buchung,
         count(*) FILTER (WHERE b.klr_gruppe = 'Umsatzerlöse')       AS rechnungen
    FROM controlling.v_buchung b
    JOIN controlling.projekte p
      ON p.projekt_nr = b.auftrag AND p.auftragstyp = 'PROJEKT'
   WHERE b.ergebnisrelevant
   GROUP BY b.auftrag
)
SELECT je.auftrag, je.projektname, je.region, je.regionscode,
       round(je.kosten, 2)                     AS kosten,
       round(je.erloes, 2)                     AS erloes,
       round(je.kosten - je.erloes, 2)         AS bestand,
       je.rechnungen,
       je.letzte_rechnung,
       je.erste_kosten,
       je.letzte_buchung,
       (SELECT bezugstag FROM stand)           AS bezugstag,
       /* Ohne Rechnung zaehlt das Alter der aeltesten unbezahlten Kosten –
          ein Projekt, das noch nie abgerechnet wurde, ist nicht deshalb
          unauffaellig, weil es keine Rechnung gibt. */
       ((SELECT bezugstag FROM stand)
         - COALESCE(je.letzte_rechnung, je.erste_kosten))::int AS tage_ohne_rechnung,
       ((SELECT bezugstag FROM stand)
         - COALESCE(je.letzte_rechnung, je.erste_kosten))
         > (SELECT tage FROM grenze)                           AS auffaellig
  FROM je
 WHERE je.kosten - je.erloes > (SELECT bagatelle FROM grenze);

COMMENT ON VIEW controlling.v_bestand_ohne_rechnung IS
  'Projekte mit nicht abgerechneter Leistung und dem Alter der letzten Rechnung.';

GRANT SELECT ON controlling.v_bestand_ohne_rechnung TO PUBLIC;
