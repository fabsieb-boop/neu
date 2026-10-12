-- ============================================================================
--  Einzelpostenexport um die Felder des vollstaendigen SAP-Berichts erweitern
--
--  Der Export "neu-2.XLSX" fuehrt 38 Spalten und ist neuer als der Bestand aus
--  dem Altsystem. Er bringt Angaben, die fuer die Zahlungsrechnung zaehlen:
--  Buchungsschluessel und Soll/Haben-Kennzeichen, das Valutadatum, sowie die
--  vollstaendige CO-Kontierung mit PSP-Element und Profitcenter.
--
--  Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE controlling.sap_einzelposten
  ADD COLUMN IF NOT EXISTS buchungsschluessel VARCHAR(10),
  ADD COLUMN IF NOT EXISTS soll_haben         VARCHAR(2),
  ADD COLUMN IF NOT EXISTS kontoart_sap       VARCHAR(10),
  ADD COLUMN IF NOT EXISTS belegstatus        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS psp_element        VARCHAR(80),
  ADD COLUMN IF NOT EXISTS profitcenter       VARCHAR(40),
  ADD COLUMN IF NOT EXISTS valutadatum        DATE,
  ADD COLUMN IF NOT EXISTS buchungsdatum      DATE,
  ADD COLUMN IF NOT EXISTS erfassungsdatum    DATE,
  ADD COLUMN IF NOT EXISTS material           VARCHAR(80),
  ADD COLUMN IF NOT EXISTS position           VARCHAR(20),
  ADD COLUMN IF NOT EXISTS referenz           VARCHAR(80),
  ADD COLUMN IF NOT EXISTS referenzschluessel VARCHAR(80),
  ADD COLUMN IF NOT EXISTS text_id            VARCHAR(20),
  ADD COLUMN IF NOT EXISTS bearbeiter         VARCHAR(80),
  ADD COLUMN IF NOT EXISTS partnergesellschaft VARCHAR(40),
  ADD COLUMN IF NOT EXISTS quelle_datei       VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_einzelposten_valuta ON controlling.sap_einzelposten(valutadatum);
CREATE INDEX IF NOT EXISTS idx_einzelposten_psp    ON controlling.sap_einzelposten(psp_element);

-- Kontoart und Typ aus dem Kontenkatalog ableiten, statt sie zu uebernehmen.
-- Der Katalog ist die gepflegte Quelle; der Export fuehrt nur Rohwerte.
UPDATE controlling.sap_einzelposten e SET typ =
  CASE c.import_art
    WHEN 'umsatz'            THEN CASE WHEN c.kategorie='sonstige_ertraege' THEN 'sonst_ertrag' ELSE 'umsatz' END
    WHEN 'bilanz'            THEN 'bilanz'
    WHEN 'verrechnung'       THEN 'verrechnung'
    WHEN 'leistung_unfertig' THEN 'bestand'
    WHEN 'leistung_fertig'   THEN 'bestand'
    WHEN 'neutral'           THEN 'neutral'
    ELSE 'kosten'
  END
FROM controlling.kontenkatalog_tvf c
WHERE c.konto = e.kostenart;

COMMIT;
