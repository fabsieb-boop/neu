/* ---------------------------------------------------------------------------
   Der Kontenplan der Praesentation gilt
   ---------------------------------------------------------------------------
   kontenmapping_guv und die SAP-Positionszuordnung ordnen vier bebuchte
   Konten verschieden ein:

     401030 Kfz-Steuern                    SAP: Sonstige Steuern (0060130000)
     430010 Vermoegensteuer, Grundsteuer   SAP: Sonstige Steuern (0060130000)
     430040 Sonstige Steuern               SAP: Sonstige Steuern (0060130000)
     890010 Erloese Anlagenverkaeufe       SAP: neutrale Ertraege (0030410190)

   Der Kontenplan des Controllings fuehrt die drei Steuerkonten als
   EBITDA-wirksamen Betriebsaufwand und 890010 als sonstigen betrieblichen
   Ertrag.  Massgeblich ist dieser Kontenplan - er ist die Grundlage, auf
   der die Ergebnisberichte gebaut sind.

   Diese Migration stellt die vier Konten darauf ein, falls sie verstellt
   wurden, und traegt zwei Steuerkonten nach, die dort hingehoeren.
--------------------------------------------------------------------------- */

UPDATE controlling.kontenmapping_guv AS m SET kategorie = v.kategorie
  FROM (VALUES ('401030', 'Betriebsaufwand (EBITDA-wirksam)'),
               ('430010', 'Betriebsaufwand (EBITDA-wirksam)'),
               ('430040', 'Betriebsaufwand (EBITDA-wirksam)'),
               ('890010', 'Sonstige betriebliche Erträge'),
               ('277100', 'Steuern'),
               ('278100', 'Steuern'))
       AS v(konto, kategorie)
 WHERE m.konto = v.konto AND m.kategorie <> v.kategorie;

/* ---------------------------------------------------------------------------
   Und eine Sicht, die zeigt, wo Kontenplan und SAP-Zuordnung auseinander
   liegen - mit Betrag, damit sichtbar ist, ob es etwas ausmacht.
--------------------------------------------------------------------------- */
CREATE OR REPLACE VIEW controlling.v_kontenplan_abweichung AS
SELECT m.konto,
       coalesce(b.text, m.bezeichnung)                    AS bezeichnung,
       m.kategorie                                        AS kontenplan,
       b.position                                         AS sap_position,
       p.text                                             AS sap_text,
       coalesce((SELECT -sum(e.wert_signed)
                   FROM controlling.sap_einzelposten e
                  WHERE controlling.f_konto_norm(e.kostenart::text) = m.konto
                    AND e.geschaeftsjahr = 2026), 0)      AS betrag_jahr
  FROM controlling.kontenmapping_guv m
  LEFT JOIN controlling.bilanz_guv_konto    b ON b.konto = m.konto
  LEFT JOIN controlling.bilanz_guv_position p ON p.position = b.position
 WHERE b.position IS NOT NULL
   AND (m.kategorie IN ('Umsatzerlöse', 'Bestandsveränderung',
                        'Sonstige betriebliche Erträge',
                        'Betriebsaufwand (EBITDA-wirksam)'))
       IS DISTINCT FROM (left(b.position, 4) = '0030'
                         AND b.position NOT LIKE '00307%'
                         AND b.position NOT LIKE '003041%'
                         AND b.position NOT LIKE '00308108%');

COMMENT ON VIEW controlling.v_kontenplan_abweichung IS
  'Konten, die der Kontenplan des Controllings anders ins EBITDA nimmt als die SAP-Positionszuordnung.';

GRANT SELECT ON controlling.v_kontenplan_abweichung TO PUBLIC;
