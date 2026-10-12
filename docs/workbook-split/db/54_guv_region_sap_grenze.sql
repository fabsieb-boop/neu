/* ---------------------------------------------------------------------------
   Die GuV je Region auf dieselbe Grenze wie v_guv_ist
   ---------------------------------------------------------------------------
   v_guv_region ist nicht auf v_guv_ist gebaut, sondern daneben - direkt auf
   den Einzelposten.  Die Abgrenzung in 52 ging deshalb an ihr vorbei, und
   die GuV je Region trug die vier Konten der sonstigen Steuern weiter, die
   SAP ausserhalb der GuV fuehrt.

   Zwei Sichten mit demselben Namen und verschiedener Abgrenzung sind genau
   der Zustand, an dem sich heute alles aufgehalten hat.
--------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW controlling.v_guv_region AS
SELECT controlling.f_region_voll(e.auftrag::text, e.kostenstelle::text) AS region,
       controlling.f_konto_norm(e.kostenart::text)                      AS konto,
       k.name                                                           AS kontobezeichnung,
       k.kategorie,
       k.kategorie_text,
       EXTRACT(year  FROM e.buchungsdatum)::integer                     AS jahr,
       EXTRACT(month FROM e.buchungsdatum)::integer                     AS monat,
       e.auftrag IS NOT NULL                                            AS auftragsbezogen,
       sum(e.wert_signed)                                               AS wert,
       count(*)                                                         AS belege
  FROM controlling.sap_einzelposten e
  JOIN controlling.kontenkatalog_tvf k
    ON controlling.f_konto_norm(k.konto::text) = controlling.f_konto_norm(e.kostenart::text)
 WHERE controlling.f_ist_guv_konto(k.kategorie::text)
   AND e.buchungsdatum IS NOT NULL
   AND NOT EXISTS (
         SELECT 1 FROM controlling.bilanz_guv_konto b
          WHERE b.konto = controlling.f_konto_norm(e.kostenart::text)
            AND left(b.position, 4) NOT IN ('0030', '0040'))
 GROUP BY 1, 2, 3, 4, 5, 6, 7, 8;

COMMENT ON VIEW controlling.v_guv_region IS
  'GuV je Region, gleiche Abgrenzung wie v_guv_ist: Zugehoerigkeit nach der SAP-Positionszuordnung.';
