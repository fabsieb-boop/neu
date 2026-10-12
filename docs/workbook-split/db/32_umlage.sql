/* ---------------------------------------------------------------------------
   Gemeinkostenumlage in der Buchungsmaske
   ---------------------------------------------------------------------------
   Wird ein Projekt bebucht, traegt es einen Gemeinkostenzuschlag der Region.
   Gebucht wird er als geschlossener Kreis auf einem Konto:

     Soll   7801020  auf dem Auftrag              (Belastung des Projekts)
     Haben  7801020  auf der Umlagekostenstelle   (Entlastung der Region)

   Beide Seiten heben sich auf – der Belegkreis UMLAGE summiert sich im
   Bestand auf genau null.  Das Ergebnis der Gesellschaft aendert sich
   dadurch nicht; verschoben wird nur zwischen Region und Projekt, und
   genau das ist der Zweck.

   Der Satz steht in den Einstellungen und nicht im Programmtext.  Die
   Vorgabe 12 % stammt aus der Bezeichnung des Kontos
   ("Gemeinkostenzuschlaege 12 % TVF Altwerk").  Im Bestand kommen daneben
   Monate mit 5 % vor, und zwar bei denselben Projekten – der Satz ist also
   eine Entscheidung je Lauf und keine Eigenschaft des Projekts.  Deshalb
   laesst die Maske ihn aendern, statt ihn zu erraten.
--------------------------------------------------------------------------- */

INSERT INTO controlling.app_einstellung (schluessel, wert) VALUES
  ('umlage_konto',        '7801020'),
  ('umlage_satz',         '12'),
  ('umlage_automatik',    'ja'),
  ('umlage_kostenstelle', '4102{nl}9401'),
  ('umlage_belegkreis',   'UMLAGE')
ON CONFLICT (schluessel) DO NOTHING;

/* ---------------------------------------------------------------------------
   Welche Saetze wurden tatsaechlich gebucht?
   ---------------------------------------------------------------------------
   Damit niemand den Vorschlag der Maske fuer gesetzt haelt: diese Sicht
   zeigt je Auftrag und Monat, welcher Satz im Bestand steht.  Sie rechnet
   nichts vor, sie berichtet.
--------------------------------------------------------------------------- */
CREATE OR REPLACE VIEW controlling.v_umlage_satz AS
WITH umlage AS (
  SELECT auftrag, jahr, monat, sum(wert) AS umlage
    FROM controlling.v_buchung
   WHERE kostenart_nr LIKE '7801020%' AND wert > 0 AND auftrag IS NOT NULL
   GROUP BY 1, 2, 3
), basis AS (
  SELECT auftrag, jahr, monat,
         sum(k_var + k_fix) AS kosten,
         max(region)        AS region
    FROM controlling.v_buchung
   WHERE ergebnisrelevant
     AND klr_typ IS DISTINCT FROM 'GEMEINKOSTENUMLAGE'
     AND auftrag IS NOT NULL
   GROUP BY 1, 2, 3
)
SELECT u.auftrag, u.jahr, u.monat, b.region,
       round(b.kosten, 2)  AS basis,
       round(u.umlage, 2)  AS umlage,
       CASE WHEN b.kosten > 0 THEN round(u.umlage / b.kosten * 100, 1) END AS satz
  FROM umlage u
  JOIN basis  b ON b.auftrag = u.auftrag AND b.jahr = u.jahr AND b.monat = u.monat;

COMMENT ON VIEW controlling.v_umlage_satz IS
  'Tatsaechlich gebuchter Gemeinkostenzuschlag je Auftrag und Monat, gemessen an der Kostenbasis.';

GRANT SELECT ON controlling.v_umlage_satz TO PUBLIC;
