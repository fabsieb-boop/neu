/* ---------------------------------------------------------------------------
   Sonstige Steuern gehoeren nicht ins EBITDA
   ---------------------------------------------------------------------------
   Ich hatte sie hineingerechnet, weil die Monatswerte der Excel (Blatt
   "Zusammenfassung FC + LiqiPlanun", Zeile 51) auf den Cent dazu passten.
   Das war der falsche Schluss: die Zeile traegt die Werte "wie berichtet",
   also mitsamt der Steuern, aber gerechnet wird das EBITDA ohne sie.

   Der Beweis steht im Jahr.  Ohne die sonstigen Steuern:

     IST Januar bis Juli        -120.145,34
     Forecast August bis Dez.   +330.214,00
     ------------------------------------------
     EBITDA 2026                 210.068,66     = die 210 T EUR

   Und es passt zur Referenzstaffel der Karte "Offizielle BCS-GuV": deren
   EBITDA ist -168.316,64, und das ist genau das EBITDA nach neutralen
   Kosten ohne die Steuern.  Mit ihnen waeren es -171.033,59 gewesen, und
   die Karte haette wieder etwas anderes gezeigt als der Rest.

   Betroffen sind beide Sichten, die das EBITDA fuehren - im Ganzen und je
   Region.  Sie muessen dieselbe Regel haben, sonst summieren sich die
   Regionen nicht mehr auf das Unternehmen.

   Was sich dadurch aendert: das EBITDA Januar bis Juli steht ab hier auf
   -120 T EUR statt -123.  Folie 1.1 zeigt beide Zahlen nebeneinander, die
   -123 und die 210, und die beiden vertragen sich nicht - die -123 sind
   die mit den Steuern gerechnete.
--------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW controlling.v_kennzahlen_monat AS
WITH e AS (
  SELECT e.geschaeftsjahr AS jahr, e.monat, k.position AS pos, -e.wert_signed AS w
    FROM controlling.sap_einzelposten e
    JOIN controlling.bilanz_guv_konto k ON k.konto = split_part(e.kostenart, '.', 1)
   WHERE e.monat BETWEEN 1 AND 12
)
SELECT jahr,
       monat,
       coalesce(sum(w) FILTER (WHERE pos LIKE '00301%'), 0)                    AS umsatzerloese,
       coalesce(sum(w) FILTER (WHERE pos LIKE '00302%'), 0)                    AS bestandsveraenderung,
       coalesce(sum(w) FILTER (WHERE pos LIKE '00301%'
                                  OR pos LIKE '00302%'), 0)                    AS gesamtleistung,
       coalesce(sum(w) FILTER (WHERE left(pos, 4) = '0030'
                                 AND pos NOT LIKE '00307%'
                                 AND pos NOT LIKE '003041%'
                                 AND pos NOT LIKE '00308108%'), 0)             AS ebitda,
       coalesce(sum(w) FILTER (WHERE pos LIKE '003041%'
                                  OR pos LIKE '00308108%'), 0)                 AS neutrales_ergebnis,
       coalesce(sum(w) FILTER (WHERE left(pos, 4) = '0030'
                                 AND pos NOT LIKE '00307%'), 0)                AS ebitda_nach_neutral,
       coalesce(sum(w) FILTER (WHERE pos LIKE '00307%'), 0)                    AS abschreibungen,
       coalesce(sum(w) FILTER (WHERE pos LIKE '0040%'), 0)                     AS finanzergebnis
  FROM e GROUP BY jahr, monat;

COMMENT ON VIEW controlling.v_kennzahlen_monat IS
  'Gesamtleistung und EBITDA je Monat. Sonstige Steuern (0060130000) bleiben draussen.';

CREATE OR REPLACE VIEW controlling.v_ebitda_region_monat AS
WITH e AS (
  SELECT controlling.f_region_voll(x.auftrag::text, x.kostenstelle::text) AS region,
         x.geschaeftsjahr AS jahr, x.monat, b.position AS pos, -x.wert_signed AS w
    FROM controlling.sap_einzelposten x
    JOIN controlling.bilanz_guv_konto b
      ON b.konto = controlling.f_konto_norm(x.kostenart::text)
   WHERE x.monat BETWEEN 1 AND 12
)
SELECT jahr::integer AS jahr, monat::integer AS monat, region,
       coalesce(sum(w) FILTER (WHERE pos LIKE '00301%'), 0)                    AS umsatzerloese,
       coalesce(sum(w) FILTER (WHERE pos LIKE '00302%'), 0)                    AS bestandsveraenderung,
       coalesce(sum(w) FILTER (WHERE pos LIKE '00304%'), 0)                    AS sonstige_ertraege,
       coalesce(sum(w) FILTER (WHERE pos LIKE '00305%' OR pos LIKE '00306%'
                                  OR pos LIKE '00308%'), 0)                    AS betriebsaufwand,
       coalesce(sum(w) FILTER (WHERE pos LIKE '00301%'
                                  OR pos LIKE '00302%'), 0)                    AS gesamtleistung,
       coalesce(sum(w) FILTER (WHERE left(pos, 4) = '0030'
                                 AND pos NOT LIKE '00307%'
                                 AND pos NOT LIKE '003041%'
                                 AND pos NOT LIKE '00308108%'), 0)             AS ebitda,
       coalesce(sum(w) FILTER (WHERE pos LIKE '0040%'), 0)                     AS finanzergebnis,
       coalesce(sum(w) FILTER (WHERE pos LIKE '00307%'), 0)                    AS abschreibungen,
       coalesce(sum(w) FILTER (WHERE pos LIKE '003041%'
                                  OR pos LIKE '00308108%'), 0)                 AS neutral_steuern,
       coalesce(sum(w) FILTER (WHERE left(pos, 4) IN ('0030', '0040')), 0)     AS ergebnis,
       count(*)                                                                AS belege
  FROM e GROUP BY 1, 2, 3;

COMMENT ON VIEW controlling.v_ebitda_region_monat IS
  'EBITDA je Region, gleiche Regel wie v_kennzahlen_monat. Summe = EBITDA des Unternehmens.';
