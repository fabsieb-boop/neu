/* ---------------------------------------------------------------------------
   Ein EBITDA, auch je Region
   ---------------------------------------------------------------------------
   v_ebitda_region_monat rechnete ueber kontenmapping_guv auf v_guv_region.
   Solange v_guv_region die sonstigen Steuern mitfuehrte, kam dasselbe
   heraus wie im Ganzen.  Seit 54 fuehrt sie sie nicht mehr - und das
   Cockpit zeigte -120 T EUR statt -123.

   Zwei Wege zum EBITDA sind einer zu viel.  Diese Sicht rechnet ab hier
   nach derselben Regel wie v_kennzahlen_monat, nur zusaetzlich je Region:
   alle GuV-Positionen ohne Abschreibungen und Finanzergebnis, ohne die
   neutralen Posten, zuzueglich der sonstigen Steuern.

   Probe: die Summe ueber alle Regionen ist das EBITDA des Unternehmens,
   Januar bis Juli 2026 also -122.862,29 EUR.
--------------------------------------------------------------------------- */

DROP VIEW IF EXISTS controlling.v_ebitda_region_monat;

CREATE VIEW controlling.v_ebitda_region_monat AS
WITH e AS (
  SELECT controlling.f_region_voll(x.auftrag::text, x.kostenstelle::text) AS region,
         x.geschaeftsjahr                                                 AS jahr,
         x.monat,
         b.position                                                       AS pos,
         -x.wert_signed                                                   AS w,
         1                                                                AS beleg
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
       coalesce(sum(w) FILTER (WHERE (left(pos, 4) = '0030'
                                      AND pos NOT LIKE '00307%'
                                      AND pos NOT LIKE '003041%'
                                      AND pos NOT LIKE '00308108%')
                                  OR pos LIKE '006013%'), 0)                   AS ebitda,
       coalesce(sum(w) FILTER (WHERE pos LIKE '0040%'), 0)                     AS finanzergebnis,
       coalesce(sum(w) FILTER (WHERE pos LIKE '00307%'), 0)                    AS abschreibungen,
       coalesce(sum(w) FILTER (WHERE pos LIKE '003041%'
                                  OR pos LIKE '00308108%'
                                  OR pos LIKE '006013%'), 0)                   AS neutral_steuern,
       coalesce(sum(w) FILTER (WHERE left(pos, 4) IN ('0030', '0040')), 0)     AS ergebnis,
       count(*)                                                                AS belege
  FROM e
 GROUP BY 1, 2, 3;

COMMENT ON VIEW controlling.v_ebitda_region_monat IS
  'EBITDA je Region und Monat, gleiche Abgrenzung wie v_kennzahlen_monat. Summe ueber alle Regionen = EBITDA des Unternehmens.';

GRANT SELECT ON controlling.v_ebitda_region_monat TO PUBLIC;
