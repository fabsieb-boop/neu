/* ---------------------------------------------------------------------------
   Monatsplan 2026
   ---------------------------------------------------------------------------
   Die Datenbank fuehrte bisher nur die Mehrjahresplanung je Region und Konto
   (plan_konto, 2027 bis 2031).  Fuer das laufende Jahr gab es keinen Plan –
   und damit keinen Plan-Ist-Vergleich, obwohl jede Ergebnispraesentation
   genau den zeigt.

   plan_konto ist dafuer die falsche Form: dort steht ein Jahreswert je Region
   und Konto, hier braucht es zwei Zeilen je Monat.  Deshalb eine eigene,
   sehr schmale Tabelle.

   Quelle der Werte: Ergebnispraesentation Juli 2026, Folien 11, 12 und 18
   (Blatt "Upload GuV", Zeilen "Gesamtleistung Plan" und "EBITDA Plan").

   Kontrollsummen: Gesamtleistung 9.842 T EUR YTD / 17.123 T EUR Jahr,
                   EBITDA          477 T EUR YTD /  1.000 T EUR Jahr.
--------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS controlling.plan_monat (
  jahr           smallint      NOT NULL,
  monat          smallint      NOT NULL CHECK (monat BETWEEN 1 AND 12),
  gesamtleistung numeric(18,2) NOT NULL DEFAULT 0,
  ebitda         numeric(18,2) NOT NULL DEFAULT 0,
  quelle         text,
  PRIMARY KEY (jahr, monat)
);

COMMENT ON TABLE controlling.plan_monat IS
  'Monatsplan der Gesellschaft (Gesamtleistung und EBITDA). Quelle ist die verabschiedete Jahresplanung, nicht der Forecast.';

BEGIN;

DELETE FROM controlling.plan_monat
 WHERE jahr = 2026 AND quelle = 'Ergebnispraesentation 07/2026';

INSERT INTO controlling.plan_monat (jahr, monat, gesamtleistung, ebitda, quelle) VALUES
  (2026,  1, 1416000.00,   76000.00, 'Ergebnispraesentation 07/2026'),
  (2026,  2, 1348000.00,   25000.00, 'Ergebnispraesentation 07/2026'),
  (2026,  3, 1483000.00,  127000.00, 'Ergebnispraesentation 07/2026'),
  (2026,  4, 1348000.00,   24000.00, 'Ergebnispraesentation 07/2026'),
  (2026,  5, 1213000.00,  -79000.00, 'Ergebnispraesentation 07/2026'),
  (2026,  6, 1483000.00,  126000.00, 'Ergebnispraesentation 07/2026'),
  (2026,  7, 1551000.00,  178000.00, 'Ergebnispraesentation 07/2026'),
  (2026,  8, 1416000.00,   76000.00, 'Ergebnispraesentation 07/2026'),
  (2026,  9, 1483000.00,  125000.00, 'Ergebnispraesentation 07/2026'),
  (2026, 10, 1483000.00,  125000.00, 'Ergebnispraesentation 07/2026'),
  (2026, 11, 1416000.00,   73000.00, 'Ergebnispraesentation 07/2026'),
  (2026, 12, 1483000.00,  124000.00, 'Ergebnispraesentation 07/2026')
ON CONFLICT (jahr, monat) DO UPDATE
   SET gesamtleistung = EXCLUDED.gesamtleistung,
       ebitda         = EXCLUDED.ebitda,
       quelle         = EXCLUDED.quelle;

COMMIT;

/* ---------------------------------------------------------------------------
   Plan gegen Ist und Forecast, Monat fuer Monat
   ---------------------------------------------------------------------------
   Beide Seiten kommen aus derselben Quelle wie im Cockpit: die Gesamtleistung
   aus liq_monat (Umsatz plus Bestandsveraenderung), das EBITDA aus
   ebitda_monat.  Die Spalte `art` sagt, ob der Monat schon abgerechnet ist.
--------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW controlling.v_plan_ist_monat AS
SELECT p.jahr,
       p.monat,
       e.art,
       p.gesamtleistung                                   AS gl_plan,
       l.umsatz + l.bestandsaenderung                     AS gl_ist,
       l.umsatz + l.bestandsaenderung - p.gesamtleistung  AS gl_delta,
       p.ebitda                                           AS ebitda_plan,
       e.operatives_ergebnis + e.overhead + e.bewertung   AS ebitda_ist,
       e.operatives_ergebnis + e.overhead + e.bewertung
         - p.ebitda                                       AS ebitda_delta
  FROM controlling.plan_monat p
  LEFT JOIN controlling.liq_monat    l ON l.jahr = p.jahr AND l.monat = p.monat
  LEFT JOIN controlling.ebitda_monat e ON e.jahr = p.jahr AND e.monat = p.monat;

GRANT SELECT ON controlling.plan_monat, controlling.v_plan_ist_monat TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON controlling.plan_monat TO PUBLIC;
