/* ---------------------------------------------------------------------------
   Die Ergebnisstaffel auf die SAP-Gliederung stellen
   ---------------------------------------------------------------------------
   v_guv_staffel gruppierte ueber kostenarten.guv_gruppe, mit einer
   Auffanglogik nach Nummernkreis fuer alles, was der Stamm nicht fuehrt.
   Das ist dieselbe Zuordnung, die den Arbeitgeberanteil zur
   Rentenversicherung verlegt hat - die Staffel zeigte deshalb einen
   Personalaufwand, den es so nicht gibt.

   Ab hier kommt die Gliederung aus dem SAP-Bericht selbst.  Die Zeilen sind
   die Positionen erster Ordnung, ihre Summe ist das Ergebnis der
   gewoehnlichen Geschaeftstaetigkeit.

   Probe Januar bis Juli 2026, kaufmaennisch:

     Umsatzerloese                       10.450.251
     Bestandsveraenderung                 3.886.319
     Sonstige betriebliche Ertraege         162.767
     Materialaufwand                    -10.258.198
     Personalaufwand                     -2.671.099
     Abschreibungen                         -66.567
     Sonstige betriebliche Aufwendungen  -1.738.357
     Finanzergebnis                         -67.462
     ------------------------------------------------
     Ergebnis                              -302.346
--------------------------------------------------------------------------- */

DROP VIEW IF EXISTS controlling.v_guv_staffel;

CREATE VIEW controlling.v_guv_staffel AS
SELECT g.jahr::integer  AS jahr,
       g.monat::integer AS monat,
       s.sortierung                       AS guv_sort,
       s.bezeichnung::varchar             AS guv_gruppe,
       sum(g.betrag)                      AS betrag,
       sum(g.belege)                      AS belege
  FROM controlling.v_guv_position_monat g
  JOIN LATERAL (VALUES
         ('00301',  10, '1 Umsatzerlöse'),
         ('00302',  20, '2 Bestandsveränderungen'),
         ('00304',  30, '3 Sonstige betriebliche Erträge'),
         ('00305',  40, '4 Materialaufwand'),
         ('00306',  50, '5 Personalaufwand'),
         ('00307',  60, '6 Abschreibungen'),
         ('00308',  70, '7 Sonstige betriebliche Aufwendungen'),
         ('0040',   80, '8 Finanzergebnis')
       ) AS s(praefix, sortierung, bezeichnung)
    ON g.position LIKE s.praefix || '%'
 GROUP BY g.jahr, g.monat, s.sortierung, s.bezeichnung;

COMMENT ON VIEW controlling.v_guv_staffel IS
  'Ergebnisstaffel nach der SAP-Gliederung. Summe = Ergebnis der gewoehnlichen Geschaeftstaetigkeit.';

GRANT SELECT ON controlling.v_guv_staffel TO PUBLIC;
