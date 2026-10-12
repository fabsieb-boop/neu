/* ---------------------------------------------------------------------------
   Fehlende Kalkulationswerte aus der Differenz ableiten
   ---------------------------------------------------------------------------
   Viele Uebersichtsblaetter lassen die Spalte "kalkuliert" leer und fuellen
   nur "aktuell" und "Differenz".  Der Vergleich stand dann auf einer Seite
   leer, und die Differenzspalte zeigte den vollen Ist-Wert - was so aussieht,
   als sei alles neu hinzugekommen.

   Das Blatt rechnet die Differenz durchgehend als kalkuliert minus aktuell.
   Also gilt: kalkuliert = aktuell + Differenz.

   Probe an 608263, wo die Kalkulationsspalte leer ist:

     Gesamtumsatz   3.654.639,77 + (-2.826.421,91) =   828.217,86
     Gesamtkosten   3.028.385,53 + (-2.217.505,53) =   810.880,00
     Ergebnis         626.254,24 + (  -608.916,38) =    17.337,86

   Die 828.217,86 stehen im selben Blatt noch einmal als Vertragssumme, und
   828.217,86 - 810.880,00 sind genau die 17.337,86.  Die Ableitung ist damit
   nicht geraten, sondern nachgerechnet.

   Abgeleitet wird nur, was fehlt; ein vorhandener Wert bleibt unangetastet.
--------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW controlling.v_kv_deckblatt AS
WITH w AS (
  SELECT psp, block,
         max(betrag) FILTER (WHERE rolle = 'kalkuliert') AS kalkuliert,
         max(betrag) FILTER (WHERE rolle = 'aktuell')    AS aktuell,
         max(betrag) FILTER (WHERE rolle = 'differenz')  AS differenz,
         max(betrag) FILTER (WHERE rolle = 'vertrag')    AS vertrag,
         max(betrag) FILTER (WHERE rolle = 'nachtraege') AS nachtraege
    FROM controlling.kv_deckblatt_wert
   GROUP BY psp, block
), v AS (
  SELECT psp, block, aktuell, vertrag, nachtraege,
         /* Der eigentliche Punkt: fehlt "kalkuliert", steht es in der
            Differenz. */
         COALESCE(kalkuliert, aktuell + differenz) AS kalkuliert
    FROM w
)
SELECT d.psp,
       d.projekttitel,
       d.auftraggeber,
       d.region,
       d.beginn,
       d.erfuellung,
       d.stand,
       d.quelle_datei,
       max(v.vertrag)    FILTER (WHERE v.block = 'umsatz')          AS umsatz_vertrag,
       max(v.nachtraege) FILTER (WHERE v.block = 'umsatz')          AS umsatz_nachtraege,
       max(v.aktuell)    FILTER (WHERE v.block = 'umsatz')          AS umsatz_aktuell,
       max(v.kalkuliert) FILTER (WHERE v.block = 'gesamtumsatz')    AS gesamtumsatz_kalk,
       max(v.aktuell)    FILTER (WHERE v.block = 'gesamtumsatz')    AS gesamtumsatz_ist,
       max(v.kalkuliert) FILTER (WHERE v.block = 'personalkosten')  AS personal_kalk,
       max(v.aktuell)    FILTER (WHERE v.block = 'personalkosten')  AS personal_ist,
       max(v.kalkuliert) FILTER (WHERE v.block = 'geraetekosten')   AS geraete_kalk,
       max(v.aktuell)    FILTER (WHERE v.block = 'geraetekosten')   AS geraete_ist,
       max(v.kalkuliert) FILTER (WHERE v.block = 'fremdleistungen') AS fremd_kalk,
       max(v.aktuell)    FILTER (WHERE v.block = 'fremdleistungen') AS fremd_ist,
       max(v.kalkuliert) FILTER (WHERE v.block = 'sonstige_kosten') AS sonstige_kalk,
       max(v.aktuell)    FILTER (WHERE v.block = 'sonstige_kosten') AS sonstige_ist,
       max(v.kalkuliert) FILTER (WHERE v.block = 'schrott')         AS schrott_kalk,
       max(v.aktuell)    FILTER (WHERE v.block = 'schrott')         AS schrott_ist,
       max(v.aktuell)    FILTER (WHERE v.block = 'vvk')             AS vvk_ist,
       max(v.aktuell)    FILTER (WHERE v.block = 'bestellungen')    AS bestellungen_offen,
       max(v.kalkuliert) FILTER (WHERE v.block = 'gesamtkosten')    AS gesamtkosten_kalk,
       max(v.aktuell)    FILTER (WHERE v.block = 'gesamtkosten')    AS gesamtkosten_ist,
       max(v.kalkuliert) FILTER (WHERE v.block = 'ergebnis')        AS ergebnis_kalk,
       max(v.aktuell)    FILTER (WHERE v.block = 'ergebnis')        AS ergebnis_ist
  FROM controlling.kv_deckblatt d
  LEFT JOIN v ON v.psp = d.psp
 GROUP BY d.psp, d.projekttitel, d.auftraggeber, d.region, d.beginn,
          d.erfuellung, d.stand, d.quelle_datei;

COMMENT ON VIEW controlling.v_kv_deckblatt IS
  'Uebersichtsblatt je Projekt, eine Zeile. Fehlt "kalkuliert", wird es aus aktuell + Differenz abgeleitet.';
