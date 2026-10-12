/* ---------------------------------------------------------------------------
   Was zur GuV gehoert, entscheidet SAP
   ---------------------------------------------------------------------------
   v_guv_ist ist die Wurzel: darauf bauen v_guv_region, v_guv_vorjahr,
   v_bilanz, v_kv_sap, v_abstimmung_guv und die Forecast-Sichten auf.  Sie
   grenzte die GuV ueber kontenkatalog_tvf ab und kam auf -305.063 EUR, der
   Bericht auf -302.346.

   Die Differenz sind genau vier Konten:

     401030 Kfz-Steuer                    -10.670,15
     430040 Sonstige Steuern                8.249,38
     430010 Vermoegensteuer, Grundsteuer     -296,18
     411040                                     0,00
     --------------------------------------------------
                                           -2.716,95

   Alle vier fuehrt SAP auf Position 0060130000 "Sonstige Steuern", also
   ausserhalb der GuV.  Der Katalog haelt sie fuer Betriebsaufwand.  Beides
   ist vertretbar, aber es kann nur eine Grenze geben, und massgeblich ist
   die des Berichts.

   Wichtig ist, was hier NICHT passiert: Konten ohne Position im Bericht
   bleiben drin.  Der Bericht ist ein Stichtag; ein Konto, das erst danach
   zum ersten Mal bewegt wird, kennt er noch nicht, und es soll nicht
   lautlos aus der GuV fallen.  Ausgeschlossen wird nur, was der Bericht
   ausdruecklich woanders fuehrt.

   Die sonstigen Steuern sind damit nicht verloren: das EBITDA nimmt sie
   ueber v_kennzahlen_monat weiterhin mit, so wie die Praesentation es tut.
--------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW controlling.v_guv_ist AS
SELECT controlling.f_konto_norm(e.kostenart::text)      AS konto,
       k.name                                           AS kontobezeichnung,
       k.kategorie,
       k.kategorie_text,
       EXTRACT(year  FROM e.buchungsdatum)::integer     AS jahr,
       EXTRACT(month FROM e.buchungsdatum)::integer     AS monat,
       sum(e.wert_signed)                               AS wert,
       count(*)                                         AS belege
  FROM controlling.sap_einzelposten e
  JOIN controlling.kontenkatalog_tvf k
    ON controlling.f_konto_norm(k.konto::text) = controlling.f_konto_norm(e.kostenart::text)
 WHERE controlling.f_ist_guv_konto(k.kategorie::text)
   AND e.buchungsdatum IS NOT NULL
   AND NOT EXISTS (
         SELECT 1 FROM controlling.bilanz_guv_konto b
          WHERE b.konto = controlling.f_konto_norm(e.kostenart::text)
            AND left(b.position, 4) NOT IN ('0030', '0040'))
 GROUP BY 1, 2, 3, 4, 5, 6;

COMMENT ON VIEW controlling.v_guv_ist IS
  'GuV-Einzelposten. Abgrenzung: Kategorie aus dem Kontenkatalog, Zugehoerigkeit nach der SAP-Positionszuordnung.';

/* ---------------------------------------------------------------------------
   Damit die beiden Zuordnungen nicht wieder auseinanderlaufen, ohne dass es
   auffaellt: diese Sicht zeigt jede Abweichung mit Betrag.
--------------------------------------------------------------------------- */
CREATE OR REPLACE VIEW controlling.v_kontenzuordnung_abgleich AS
SELECT b.konto,
       b.text                                   AS bezeichnung,
       b.position,
       p.text                                   AS position_text,
       k.kategorie                              AS katalog_kategorie,
       left(b.position, 4) IN ('0030', '0040')  AS sap_guv,
       controlling.f_ist_guv_konto(k.kategorie::text) AS katalog_guv
  FROM controlling.bilanz_guv_konto b
  JOIN controlling.bilanz_guv_position p ON p.position = b.position
  LEFT JOIN controlling.kontenkatalog_tvf k
    ON controlling.f_konto_norm(k.konto::text) = b.konto
 WHERE (left(b.position, 4) IN ('0030', '0040'))
       IS DISTINCT FROM coalesce(controlling.f_ist_guv_konto(k.kategorie::text), false);

COMMENT ON VIEW controlling.v_kontenzuordnung_abgleich IS
  'Konten, die der Kontenkatalog anders in die GuV einordnet als der SAP-Bericht.';

GRANT SELECT ON controlling.v_kontenzuordnung_abgleich TO PUBLIC;
