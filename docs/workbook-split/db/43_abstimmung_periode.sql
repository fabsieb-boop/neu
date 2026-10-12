/* ---------------------------------------------------------------------------
   Abstimmung: Abschluss und Buchungen auf denselben Stichtag
   ---------------------------------------------------------------------------
   Die Sicht v_abstimmung_guv stellt den SAP-Abschluss den eigenen
   Einzelposten gegenueber.  Sie nahm dafuer den Abschluss mit der hoechsten
   Periodennummer – und das ist die falsche Wahl:

     Periode  8 = Stand nach dem August, 235 Konten
     Periode 16 = Sonderperiode fuer Abschlussbuchungen, 272 Konten

   Verglichen wurde also der Sonderperiodenstand gegen die Buchungen bis
   August.  Ergebnis: 23 Konten mit zusammen 613.365 EUR Abweichung, die das
   Cockpit als "Abweichung gegen den Abschluss" meldete.

   Richtig gepaart – Abschluss der letzten regulaeren Periode gegen die
   Buchungen bis genau dieser Periode – geht die Abstimmung auf **0,00 EUR**
   und **0 Konten** auf.  Die Abweichung war nie eine.

   Zwei Regeln folgen daraus, und beide stehen jetzt in der Sicht:

   * Nur regulaere Perioden (1 bis 12) sind ein Monatsstand.  Periode 13 bis
     16 tragen Abschlussbuchungen und lassen sich mit laufenden Monaten nicht
     vergleichen.
   * Der Buchungszeitraum endet mit derselben Periode.  Ein Abschluss per
     August gegen Buchungen bis Juli ergibt 59 offene Konten – nicht weil
     etwas fehlt, sondern weil ein Monat fehlt.

   Das ist etwas anderes als die Frage, bis wann gerechnet wird: die
   Ergebnisrechnung endet beim letzten abgeschlossenen Monat, hier zaehlt der
   Stichtag des Abschlusses, gegen den geprueft wird.
--------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW controlling.v_abstimmung_guv AS
WITH stand AS (
  /* Die letzte regulaere Periode, zu der ein Abschluss vorliegt. */
  SELECT max(periode) AS periode
    FROM controlling.abschluss_konto
   WHERE quelle = 'BILANZ' AND jahr = 2026 AND periode BETWEEN 1 AND 12
), abschluss AS (
  SELECT controlling.f_konto_norm(a.konto::text) AS konto,
         a.text,
         a.berichtsperiode AS wert
    FROM controlling.abschluss_konto a
    JOIN controlling.kontenkatalog_tvf k
      ON controlling.f_konto_norm(k.konto::text) = controlling.f_konto_norm(a.konto::text)
   WHERE a.quelle::text = 'BILANZ'
     AND a.jahr = 2026
     AND a.periode = (SELECT periode FROM stand)
     AND controlling.f_ist_guv_konto(k.kategorie::text)
), ist AS (
  SELECT v_guv_ist.konto,
         max(v_guv_ist.kontobezeichnung::text) AS name,
         max(v_guv_ist.kategorie::text)        AS kategorie,
         sum(v_guv_ist.wert)                   AS wert
    FROM controlling.v_guv_ist
   WHERE v_guv_ist.jahr = 2026
     AND v_guv_ist.monat <= (SELECT periode FROM stand)
   GROUP BY v_guv_ist.konto
)
SELECT COALESCE(i.konto, a.konto) AS konto,
       COALESCE(i.name, a.text::text) AS bezeichnung,
       i.kategorie,
       round(COALESCE(a.wert, 0::numeric), 2) AS abschluss,
       round(COALESCE(i.wert, 0::numeric), 2) AS einzelposten,
       round(COALESCE(i.wert, 0::numeric) - COALESCE(a.wert, 0::numeric), 2) AS differenz
  FROM ist i
  FULL JOIN abschluss a ON a.konto = i.konto
 WHERE i.konto IS NOT NULL OR a.konto IS NOT NULL;

COMMENT ON VIEW controlling.v_abstimmung_guv IS
  'Eigene Einzelposten gegen den SAP-Abschluss, beide zum Stichtag der letzten regulaeren Periode. Sonderperioden 13-16 bleiben aussen vor.';

GRANT SELECT ON controlling.v_abstimmung_guv TO PUBLIC;
