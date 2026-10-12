/* ---------------------------------------------------------------------------
   Die Bestandspruefung addierte Gewinne zu Luecken
   ---------------------------------------------------------------------------
   v_bestand_deckung fuehrt eine Spalte "luecke":

     luecke = Kosten - berechnet - Bestandsveraenderung

   Das ist keine Luecke, sondern eine Identitaet - es ist das Ergebnis des
   Auftrags mit umgekehrtem Vorzeichen.  Positiv heisst: es wurde mehr
   ausgegeben als berechnet und aktiviert, da fehlt wirklich Deckung.
   Negativ heisst das Gegenteil: der Auftrag traegt.

   Die Seite summierte darueber den Betrag ohne Vorzeichen und nannte das
   Ergebnis "ungeprüfte Leistung".  Herausgekommen sind 3.593.331 EUR, von
   denen nur 619.931 EUR ungedeckte Kosten waren; die restlichen 2.973.400
   sind Ueberdeckung, also der umgekehrte Fall.  Zwei entgegengesetzte
   Befunde in einer Summe.

   Diese Migration trennt sie.  "luecke" bleibt als vorzeichenbehaftete
   Groesse erhalten - dort haengt anderes dran -, daneben stehen jetzt:

     ungedeckt   Kosten ohne Deckung, sonst 0
     ueberdeckt  Deckung ueber die Kosten hinaus, sonst 0

   Damit laesst sich jede Zeile in genau einen der beiden Toepfe legen, und
   eine Summe daraus bedeutet wieder etwas.
--------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW controlling.v_bestand_deckung AS
WITH stand AS (
  SELECT max(buchungsdatum) AS bezugstag FROM controlling.v_buchung
), grenze AS (
  SELECT COALESCE((SELECT wert::numeric FROM controlling.app_einstellung
                    WHERE schluessel = 'bestand_tage_ohne_rechnung'), 35)   AS tage,
         COALESCE((SELECT wert::numeric FROM controlling.app_einstellung
                    WHERE schluessel = 'bestand_bagatelle'), 1000)          AS bagatelle,
         COALESCE((SELECT wert::numeric FROM controlling.app_einstellung
                    WHERE schluessel = 'bestand_luecke'), 25000)            AS luecke
), je AS (
  SELECT b.auftrag,
         max(p.projektname::text)  AS projektname,
         max(b.region::text)       AS region,
         max(b.regionscode::text)  AS regionscode,
         sum(b.k_var + b.k_fix)    AS kosten,
         COALESCE(sum(-b.wert) FILTER (WHERE b.klr_gruppe = 'Umsatzerlöse'), 0)        AS erloes,
         COALESCE(sum(-b.wert) FILTER (WHERE b.klr_gruppe = 'Bestandsveränderung'), 0) AS bestandsveraenderung,
         count(*) FILTER (WHERE b.klr_gruppe = 'Umsatzerlöse')                         AS rechnungen,
         count(*) FILTER (WHERE b.klr_gruppe = 'Bestandsveränderung')                  AS bestandsbuchungen,
         max(b.buchungsdatum) FILTER (WHERE b.klr_gruppe = 'Umsatzerlöse')             AS letzte_rechnung,
         min(b.buchungsdatum) FILTER (WHERE (b.k_var + b.k_fix) <> 0)                  AS erste_kosten,
         max(b.buchungsdatum)                                                          AS letzte_buchung
    FROM controlling.v_buchung b
    JOIN controlling.projekte p
      ON p.projekt_nr::text = b.auftrag::text AND p.auftragstyp = 'PROJEKT'
   WHERE b.ergebnisrelevant
   GROUP BY b.auftrag
)
SELECT auftrag, projektname, region, regionscode,
       round(kosten, 2)                                          AS kosten,
       round(erloes, 2)                                          AS erloes,
       round(bestandsveraenderung, 2)                            AS bestandsveraenderung,
       round(kosten - erloes, 2)                                 AS bestand,
       round(kosten - erloes - bestandsveraenderung, 2)          AS luecke,
       CASE WHEN kosten > 0
            THEN round((erloes + bestandsveraenderung) / kosten * 100, 1) END AS deckung,
       rechnungen, bestandsbuchungen, letzte_rechnung, erste_kosten, letzte_buchung,
       (SELECT bezugstag FROM stand)                             AS bezugstag,
       (SELECT bezugstag FROM stand) - COALESCE(letzte_rechnung, erste_kosten)
                                                                 AS tage_ohne_rechnung,
       CASE
         WHEN bestandsbuchungen = 0
              AND (kosten - erloes) > (SELECT luecke FROM grenze) THEN 'OHNE_BESTANDSBUCHUNG'
         WHEN bestandsveraenderung > kosten + (SELECT luecke FROM grenze) THEN 'UEBERAKTIVIERT'
         WHEN (erloes - kosten) > (SELECT luecke FROM grenze)
              AND bestandsveraenderung >= 0 THEN 'VORAUSBERECHNET'
         WHEN (kosten - erloes) > (SELECT bagatelle FROM grenze)
              AND ((SELECT bezugstag FROM stand)
                   - COALESCE(letzte_rechnung, erste_kosten))::numeric
                  > (SELECT tage FROM grenze) THEN 'LANGE_OHNE_RECHNUNG'
         ELSE 'OK'
       END                                                       AS befund,
       /* Neue Spalten gehoeren ans Ende: CREATE OR REPLACE VIEW ordnet nach
          Position, ein Einschub benennt die folgenden Spalten um. */
       round(GREATEST(kosten - erloes - bestandsveraenderung, 0), 2)  AS ungedeckt,
       round(GREATEST(erloes + bestandsveraenderung - kosten, 0), 2)  AS ueberdeckt
  FROM je;

COMMENT ON VIEW controlling.v_bestand_deckung IS
  'Deckung je Auftrag ueber die gesamte Laufzeit. ungedeckt und ueberdeckt sind die beiden Richtungen getrennt; luecke ist die vorzeichenbehaftete Groesse.';
