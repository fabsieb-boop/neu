/* ---------------------------------------------------------------------------
   Das EBITDA rechnet nach dem Kontenplan des Controllings
   ---------------------------------------------------------------------------
   Aus dem Blatt "FI-Monatswerte 2026", Kopfzeile:

     "EBITDA-Abgrenzung auf den Konzernbericht kalibriert: periodenfremde
      Posten und Rueckstellungsaufloesungen neutral (201000, 231500, 251000),
      sonstige Steuern im EBITDA (401030, 430010, 430040)."

   Damit ist entschieden, was ich zweimal falsch hatte:

   Die sonstigen Steuern GEHOEREN ins EBITDA.  Migration 58 hatte sie
   herausgenommen, weil das Jahr dann auf 210 T EUR kam - das war der
   richtige Zielwert, aber der falsche Weg dorthin.  58 wird hiermit
   zurueckgenommen.

   Und neutral sind genau drei Konten, nicht eine SAP-Positionsgruppe.  Die
   SAP-Gliederung zieht die Grenze anders; fuer das EBITDA gilt der
   Kontenplan.

   Die Sichten rechnen deshalb ab hier ueber kontenmapping_guv statt ueber
   die Positionsnummer.  Die Positionszuordnung bleibt, wo sie hingehoert:
   in der GuV-Staffel und der Bilanz, die den Abschluss abbilden sollen.

   Probe gegen das Blatt, Zeile "EBITDA (FI, inkl. gebuchter Bewertung)":

     Jan 292,5  Feb 324,6  Mrz 22,8  Apr -181,4
     Mai -142,2 Jun  57,0  Jul -495,9
--------------------------------------------------------------------------- */

/* Zwei Konten standen als neutral, der Kontenplan fuehrt sie als Ertrag. */
UPDATE controlling.kontenmapping_guv SET kategorie = 'Sonstige betriebliche Erträge'
 WHERE konto IN ('272000', '273500')
   AND kategorie <> 'Sonstige betriebliche Erträge';

CREATE OR REPLACE VIEW controlling.v_kennzahlen_monat AS
WITH e AS (
  SELECT x.geschaeftsjahr AS jahr, x.monat, m.kategorie AS kat, -x.wert_signed AS w
    FROM controlling.sap_einzelposten x
    JOIN controlling.kontenmapping_guv m
      ON m.konto = controlling.f_konto_norm(x.kostenart::text)
   WHERE x.monat BETWEEN 1 AND 12
)
SELECT jahr,
       monat,
       coalesce(sum(w) FILTER (WHERE kat = 'Umsatzerlöse'), 0)                 AS umsatzerloese,
       coalesce(sum(w) FILTER (WHERE kat = 'Bestandsveränderung'), 0)          AS bestandsveraenderung,
       coalesce(sum(w) FILTER (WHERE kat IN ('Umsatzerlöse',
                                             'Bestandsveränderung')), 0)       AS gesamtleistung,
       coalesce(sum(w) FILTER (WHERE kat IN ('Umsatzerlöse', 'Bestandsveränderung',
                     'Sonstige betriebliche Erträge',
                     'Betriebsaufwand (EBITDA-wirksam)')), 0)                  AS ebitda,
       coalesce(sum(w) FILTER (WHERE kat = 'Neutrales Ergebnis (nicht EBITDA)'), 0)
                                                                               AS neutrales_ergebnis,
       coalesce(sum(w) FILTER (WHERE kat IN ('Umsatzerlöse', 'Bestandsveränderung',
                     'Sonstige betriebliche Erträge',
                     'Betriebsaufwand (EBITDA-wirksam)',
                     'Neutrales Ergebnis (nicht EBITDA)')), 0)                 AS ebitda_nach_neutral,
       coalesce(sum(w) FILTER (WHERE kat = 'Abschreibungen'), 0)               AS abschreibungen,
       coalesce(sum(w) FILTER (WHERE kat = 'Zinsen und Finanzergebnis'), 0)    AS finanzergebnis
  FROM e GROUP BY jahr, monat;

COMMENT ON VIEW controlling.v_kennzahlen_monat IS
  'Gesamtleistung und EBITDA je Monat nach dem Kontenplan des Controllings (kontenmapping_guv).';

CREATE OR REPLACE VIEW controlling.v_ebitda_region_monat AS
WITH e AS (
  SELECT controlling.f_region_voll(x.auftrag::text, x.kostenstelle::text) AS region,
         x.geschaeftsjahr AS jahr, x.monat, m.kategorie AS kat, -x.wert_signed AS w
    FROM controlling.sap_einzelposten x
    JOIN controlling.kontenmapping_guv m
      ON m.konto = controlling.f_konto_norm(x.kostenart::text)
   WHERE x.monat BETWEEN 1 AND 12
)
SELECT jahr::integer AS jahr, monat::integer AS monat, region,
       coalesce(sum(w) FILTER (WHERE kat = 'Umsatzerlöse'), 0)                 AS umsatzerloese,
       coalesce(sum(w) FILTER (WHERE kat = 'Bestandsveränderung'), 0)          AS bestandsveraenderung,
       coalesce(sum(w) FILTER (WHERE kat = 'Sonstige betriebliche Erträge'), 0) AS sonstige_ertraege,
       coalesce(sum(w) FILTER (WHERE kat = 'Betriebsaufwand (EBITDA-wirksam)'), 0) AS betriebsaufwand,
       coalesce(sum(w) FILTER (WHERE kat IN ('Umsatzerlöse',
                                             'Bestandsveränderung')), 0)       AS gesamtleistung,
       coalesce(sum(w) FILTER (WHERE kat IN ('Umsatzerlöse', 'Bestandsveränderung',
                     'Sonstige betriebliche Erträge',
                     'Betriebsaufwand (EBITDA-wirksam)')), 0)                  AS ebitda,
       coalesce(sum(w) FILTER (WHERE kat = 'Zinsen und Finanzergebnis'), 0)    AS finanzergebnis,
       coalesce(sum(w) FILTER (WHERE kat = 'Abschreibungen'), 0)               AS abschreibungen,
       coalesce(sum(w) FILTER (WHERE kat IN ('Neutrales Ergebnis (nicht EBITDA)',
                                             'Steuern')), 0)                   AS neutral_steuern,
       coalesce(sum(w) FILTER (WHERE kat <> 'Verrechnung/kalkulatorisch'), 0)  AS ergebnis,
       count(*)                                                                AS belege
  FROM e GROUP BY 1, 2, 3;

COMMENT ON VIEW controlling.v_ebitda_region_monat IS
  'EBITDA je Region nach demselben Kontenplan. Summe ueber alle Regionen = EBITDA des Unternehmens.';
