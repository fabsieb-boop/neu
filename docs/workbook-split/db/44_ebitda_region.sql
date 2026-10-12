/* ---------------------------------------------------------------------------
   EBITDA je Region
   ---------------------------------------------------------------------------
   Die GuV je Region endete bisher beim Ergebnis nach Zinsen, Abschreibungen
   und neutralem Ergebnis – Januar bis Juli -305.063 EUR.  Das ist eine
   richtige Zahl, aber nicht die, um die es geht: das EBITDA derselben
   Periode sind -123 T EUR.  Zwei Zahlen fuer dasselbe, ohne Weg dazwischen.

   Diese Sicht rechnet das EBITDA je Region, und zwar mit derselben
   Kontenzuordnung wie die Ergebnispraesentation (kontenmapping_guv).  Das ist
   nicht dasselbe wie der GuV-Kontenstamm der TVF: zwei Konten ordnen die
   beiden verschieden ein –

     430040 Sonstige Steuern
     430010 Vermoegensteuer, Grundsteuer u.a.

   Der Kontenstamm haelt sie fuer Steuern und laesst sie draussen, die
   Praesentation zaehlt sie als Betriebsaufwand und nimmt sie mit ("sonstige
   Steuern im EBITDA", Blatt FI-Monatswerte).  Im Februar 2026 sind das
   8.101 EUR – genau der Rest, der zwischen beiden Rechnungen stand.

   Massgeblich ist die Praesentation.  Deshalb rechnet diese Sicht nach ihr,
   und die Summe ueber alle Regionen trifft das EBITDA der Folie:

     Januar bis Juli  -122.538 EUR   (Folie 12: -123 T EUR)
--------------------------------------------------------------------------- */

/* Erst loeschen: 55 baut diese Sicht auf der SAP-Kontenzuordnung neu auf und
   zaehlt die Belege mit count(*) statt sum(). CREATE OR REPLACE kann den
   Spaltentyp nicht aendern, und der Lauf braeche hier ab. */
DROP VIEW IF EXISTS controlling.v_ebitda_region_monat;

CREATE VIEW controlling.v_ebitda_region_monat AS
SELECT g.jahr,
       g.monat,
       g.region,
       COALESCE(sum(-g.wert) FILTER (WHERE m.kategorie = 'Umsatzerlöse'), 0)                     AS umsatzerloese,
       COALESCE(sum(-g.wert) FILTER (WHERE m.kategorie = 'Bestandsveränderung'), 0)              AS bestandsveraenderung,
       COALESCE(sum(-g.wert) FILTER (WHERE m.kategorie = 'Sonstige betriebliche Erträge'), 0)    AS sonstige_ertraege,
       COALESCE(sum(-g.wert) FILTER (WHERE m.kategorie = 'Betriebsaufwand (EBITDA-wirksam)'), 0) AS betriebsaufwand,
       COALESCE(sum(-g.wert) FILTER (WHERE m.kategorie IN ('Umsatzerlöse',
                 'Bestandsveränderung')), 0)                                                     AS gesamtleistung,
       COALESCE(sum(-g.wert) FILTER (WHERE m.kategorie IN ('Umsatzerlöse',
                 'Sonstige betriebliche Erträge', 'Bestandsveränderung',
                 'Betriebsaufwand (EBITDA-wirksam)')), 0)                                        AS ebitda,
       /* Nachrichtlich: was zwischen EBITDA und dem Ergebnis der Region liegt. */
       COALESCE(sum(-g.wert) FILTER (WHERE m.kategorie = 'Zinsen und Finanzergebnis'), 0)        AS finanzergebnis,
       COALESCE(sum(-g.wert) FILTER (WHERE m.kategorie = 'Abschreibungen'), 0)                   AS abschreibungen,
       COALESCE(sum(-g.wert) FILTER (WHERE m.kategorie IN ('Steuern',
                 'Neutrales Ergebnis (nicht EBITDA)')), 0)                                       AS neutral_steuern,
       COALESCE(sum(-g.wert), 0)                                                                 AS ergebnis,
       COALESCE(sum(g.belege), 0)                                                                AS belege
  FROM controlling.v_guv_region g
  JOIN controlling.kontenmapping_guv m ON m.konto = g.konto
 GROUP BY g.jahr, g.monat, g.region;

COMMENT ON VIEW controlling.v_ebitda_region_monat IS
  'EBITDA je Region und Monat nach der Kontenzuordnung der Ergebnispraesentation. Summe ueber alle Regionen = EBITDA der Folie.';

GRANT SELECT ON controlling.v_ebitda_region_monat TO PUBLIC;
