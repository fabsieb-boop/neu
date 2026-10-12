/* ---------------------------------------------------------------------------
   Die GuV-Staffel aus den Einzelposten
   ---------------------------------------------------------------------------
   Die Seite "Gewinn- und Verlustrechnung" zeigte bisher v_guv, und v_guv
   rechnet aus v_buchung – den Auftragsbuchungen.  Damit stand auf einer
   Seite, die GuV heisst, die Auftragsrechnung:

                              Seite        richtig
     Umsatzerloese        10.465.313    10.450.251
     Personalaufwand      -1.345.907    -2.489.312
     Abschreibungen          -20.278       -66.567
     Summe                +1.215.026      -305.063

   Keine einzige Zeile stimmte, weil den Auftragsbuchungen die primaeren
   Personalkosten und alles fehlen, was auf Kostenstellen liegt.

   Diese Sicht rechnet dieselbe Gliederung aus v_guv_ist, also aus den
   SAP-Einzelposten.  Die Gruppen kommen aus dem Kostenartenstamm; sein
   Schluessel traegt eine Dezimalstelle ("390000.0"), deshalb der Vergleich
   ueber split_part.

   Neun Konten fuehrt der Stamm nicht, darunter sechs Personalkonten mit
   411021 Arbeitgeberanteil Rentenversicherung als groesstem.  Sie liefen
   vorher stillschweigend in "Sonstige betriebliche Aufwendungen".  Die
   Auffanglogik ordnet sie nach Nummernkreis ein, damit kein Betrag in der
   falschen Zeile landet.

   Probe: die Summe der Staffel ist das Ergebnis der gewoehnlichen
   Geschaeftstaetigkeit, Januar bis Juli 2026 also -305.063 EUR.
--------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW controlling.v_guv_staffel AS
SELECT g.jahr,
       g.monat,
       COALESCE(k.sortierung,
                CASE
                  WHEN g.konto LIKE '41%' THEN 60
                  WHEN g.kategorie = 'umsatzerloese'     THEN 10
                  WHEN g.kategorie = 'leistung_unfertig' THEN 20
                  WHEN g.kategorie = 'leistung_fertig'   THEN 20
                  WHEN g.kategorie = 'sonstige_ertraege' THEN 30
                  WHEN g.kategorie = 'finanzergebnis'    THEN 100
                  WHEN g.kategorie = 'steuern_sonstige'  THEN 110
                  WHEN g.kategorie = 'neutral'           THEN 120
                  ELSE 80
                END)                                          AS guv_sort,
       COALESCE(k.guv_gruppe,
                CASE
                  WHEN g.konto LIKE '41%' THEN '6 Personalaufwand'
                  WHEN g.kategorie = 'umsatzerloese'     THEN '1 Umsatzerlöse'
                  WHEN g.kategorie IN ('leistung_unfertig',
                                       'leistung_fertig') THEN '2 Bestandsveränderungen'
                  WHEN g.kategorie = 'sonstige_ertraege' THEN '3 Sonstige betriebliche Erträge'
                  WHEN g.kategorie = 'finanzergebnis'    THEN '10 Zinsergebnis'
                  WHEN g.kategorie = 'steuern_sonstige'  THEN '11 Steuern vom Einkommen und Ertrag'
                  WHEN g.kategorie = 'neutral'           THEN '12 Periodenfremdes Ergebnis'
                  ELSE '8 Sonstige betriebliche Aufwendungen'
                END)::varchar                                 AS guv_gruppe,
       sum(-g.wert)                                           AS betrag,
       sum(g.belege)                                          AS belege
  FROM controlling.v_guv_ist g
  LEFT JOIN controlling.kostenarten k
    ON split_part(k.kostenart_nr, '.', 1) = g.konto
 GROUP BY g.jahr, g.monat, 3, 4;

COMMENT ON VIEW controlling.v_guv_staffel IS
  'GuV-Staffel der Gesellschaft aus den SAP-Einzelposten. Summe = Ergebnis der gewoehnlichen Geschaeftstaetigkeit.';

GRANT SELECT ON controlling.v_guv_staffel TO PUBLIC;
