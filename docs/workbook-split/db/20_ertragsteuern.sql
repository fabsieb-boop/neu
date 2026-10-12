-- =====================================================================
-- 20 · Ertragsteuern gehoeren unter das Ergebnis vor Steuern
--
-- Der Abgleich gegen die mitgelieferte Referenz-GuV (Periode 1-6) zeigte
-- eine Abweichung von exakt 101.645,56 EUR. Sie stammt aus drei Konten:
--
--   220000  Koerperschaftsteuer     51.592,00
--   430020  Gewerbeertragsteuer     47.216,00
--   221200  Solidaritaetszuschlag    2.837,56
--
-- Das sind Steuern vom Einkommen und Ertrag. Sie mindern den Jahres-
-- ueberschuss, nicht das Ergebnis vor Steuern – bisher liefen sie als
-- Betriebsaufwand beziehungsweise als neutrales Ergebnis mit und haben
-- das Betriebsergebnis um diesen Betrag zu schlecht dargestellt.
--
-- Umgekehrt gehoert die Kfz-Steuer (401030) in den Betriebsaufwand: sie
-- ist eine Verkehrsteuer, keine Ertragsteuer. Der Kontenstamm weist sie
-- korrekt als 'aufwand' aus.
-- =====================================================================

SET search_path = controlling, public;

-- Ertragsteuern als eigene Kategorie
UPDATE controlling.kontenkatalog_tvf
   SET kategorie = 'ertragsteuer',
       kategorie_text = 'Steuern vom Einkommen und Ertrag'
 WHERE controlling.f_konto_norm(konto) IN ('220000','221200','430020','278000','278100');

-- Kfz-Steuer ist Betriebsaufwand
UPDATE controlling.kontenkatalog_tvf
   SET kategorie = 'betriebsaufwand',
       kategorie_text = COALESCE(NULLIF(kategorie_text,''), 'Sonstige betriebliche Aufwendungen')
 WHERE controlling.f_konto_norm(konto) = '401030';

-- 274200 Versicherungsentschaedigungen bleibt bei den sonstigen
-- betrieblichen Ertraegen. Der Kontenstamm fuehrt das Konto als
-- 'neutral', die massgebliche Referenz-GuV weist es dagegen unter
-- sonstErtraege aus – und danach wird berichtet. Auf das Ergebnis wirkt
-- sich die Einordnung nicht aus, wohl aber auf die Gliederung.
UPDATE controlling.kontenkatalog_tvf
   SET kategorie = 'sonstige_ertraege', kategorie_text = 'Sonstige betriebliche Erträge'
 WHERE controlling.f_konto_norm(konto) = '274200';

-- Konten, die im Katalog fehlten
INSERT INTO controlling.kontenkatalog_tvf (konto, name, kategorie, kategorie_text)
VALUES ('390000','Bestandsveränderungen fertige Erzeugnisse','leistung_fertig','Bestandsveränderung'),
       ('251300','Übrige neutrale Erträge','neutral','Neutrales Ergebnis'),
       ('890300','Sonstige Erlösschmälerungen','umsatzerloese','Umsatzerlöse')
ON CONFLICT (konto) DO NOTHING;

-- ---------------------------------------------------------------------
-- Ergebnis vor Steuern schliesst die Ertragsteuern aus.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION controlling.f_ist_guv_konto(kategorie text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT kategorie IN ('umsatzerloese','leistung_unfertig','leistung_fertig',
                       'sonstige_ertraege','betriebsaufwand','finanzergebnis',
                       'steuern_sonstige','neutral')
$$;

-- Eigene Funktion fuer alles, was zum Jahresueberschuss gehoert –
-- also einschliesslich der Ertragsteuern.
CREATE OR REPLACE FUNCTION controlling.f_ist_jahresergebnis_konto(kategorie text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT controlling.f_ist_guv_konto(kategorie) OR kategorie = 'ertragsteuer'
$$;

-- ---------------------------------------------------------------------
-- Die Ertragsteuern je Jahr, fuer die Ueberleitung zum Jahresueberschuss
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_ertragsteuern AS
SELECT EXTRACT(YEAR  FROM e.buchungsdatum)::int AS jahr,
       EXTRACT(MONTH FROM e.buchungsdatum)::int AS monat,
       controlling.f_konto_norm(e.kostenart)    AS konto,
       max(k.name)                              AS kontobezeichnung,
       sum(e.wert_signed)                       AS wert
  FROM controlling.sap_einzelposten e
  JOIN controlling.kontenkatalog_tvf k
    ON controlling.f_konto_norm(k.konto) = controlling.f_konto_norm(e.kostenart)
 WHERE k.kategorie = 'ertragsteuer' AND e.buchungsdatum IS NOT NULL
 GROUP BY 1,2,3;

COMMENT ON VIEW controlling.v_ertragsteuern IS
  'Steuern vom Einkommen und Ertrag. Sie stehen unter dem Ergebnis vor Steuern '
  'und fuehren zum Jahresueberschuss.';
