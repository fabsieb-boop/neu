/* ---------------------------------------------------------------------------
   Die Referenzstaffel "Offizielle BCS-GuV" auf den Abschluss stellen
   ---------------------------------------------------------------------------
   Die Karte auf der GuV-Seite zeigt eine eigene Staffel aus guv_referenz.
   Vier ihrer Werte waren stehengeblieben, darunter das EBITDA mit +43.370 -
   waehrend jede andere Stelle im Cockpit -123 T EUR zeigt.  Zwei Zahlen fuer
   dasselbe auf derselben Seite.

   Die Staffel der Karte lautet:

     Gesamtleistung + sonstige Ertraege - Vorleistungen - Personal
       - Sachkosten + neutrales Ergebnis            = EBITDA
       - Abschreibungen                             = EBIT
       - Finanzergebnis                             = Ergebnis vor Steuern
       - Steuern                                    = Jahresueberschuss

   Mit den Werten des Berichts, Januar bis Juli 2026:

     14.336.570,17 + 162.767,35 - 10.258.197,78 - 2.671.099,13
        - 1.709.016,95 - 29.340,30                 =  -168.316,64  EBITDA
        - 66.566,92                                =  -234.883,56  EBIT
        - 67.462,28                                =  -302.345,84  vor Steuern
        - 2.716,95                                 =  -305.062,79  Jahresueberschuss

   Alle vier Zwischensummen treffen den SAP-Bericht: -234.883,56 ist dessen
   Position 0030000000, -302.345,84 das Ergebnis der gewoehnlichen
   Geschaeftstaetigkeit, -305.062,79 die Summe aller GuV-Konten einschliesslich
   der sonstigen Steuern.

   Die Sachkosten waren um 558,85 zu niedrig: Sachkosten und neutrales
   Ergebnis zusammen muessen die sonstigen betrieblichen Aufwendungen des
   Berichts ergeben, -1.738.357,25.

   Nicht angefasst werden die Spalten Forecast, Jahr und Vorjahr - fuer die
   gibt es hier keine Probe.
--------------------------------------------------------------------------- */

UPDATE controlling.guv_referenz AS r SET betrag = v.betrag
  FROM (VALUES ('sachkosten',            -1709016.95),
               ('ebitda',                 -168316.64),
               ('ebit',                   -234883.56),
               ('ergebnisVorSteuern',     -302345.84),
               ('jahresueberschussVor',   -302345.84),
               ('jahresueberschussNach',  -305062.79))
       AS v(position, betrag)
 WHERE r.jahr = 2026 AND r.szenario = 'ist'
   AND r.position = v.position AND r.betrag <> v.betrag;
