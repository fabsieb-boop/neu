-- =====================================================================
-- 18 · Kostenverfolgung der Regionen gegen die SAP-Buchungen
--
-- Die Kolleginnen und Kollegen in den Regionen haben keinen SAP-Zugang.
-- Sie fuehren ihre Kostenverfolgung in Excel; die Sammeldatei
-- Kostenverfolgung_Dashboard.xlsx traegt je PSP-Element den dort
-- gepflegten Stand.
--
-- Zweck dieser Tabelle ist ausschliesslich der Abgleich: Was steht in
-- der Kostenverfolgung, was ist tatsaechlich gebucht, und wie gross ist
-- die Luecke? Die KV-Werte werden nie in die Ergebnisrechnung
-- uebernommen – dort gilt SAP.
-- =====================================================================

SET search_path = controlling, public;

CREATE TABLE IF NOT EXISTS controlling.kv_dashboard (
  psp                varchar(20)  PRIMARY KEY,
  auftrag            varchar(40),
  region             varchar(40),
  region_quelle      varchar(60),
  projekttitel       varchar(255),
  auftraggeber       varchar(160),
  phase              varchar(40),
  status             varchar(60),
  beginn             date,
  ende               date,
  stand              date,
  bauleiter          varchar(120),
  erfuellung_prozent numeric(8,2),
  umsatz_ist         numeric(18,2),
  kosten_ist         numeric(18,2),
  vvk_region         numeric(18,2),
  vvk_overhead       numeric(18,2),
  ergebnis_ist       numeric(18,2),
  sub_quote          numeric(8,2),
  umsatz_vertrag     numeric(18,2),
  umsatz_prognose    numeric(18,2),
  umsatz_projekt     numeric(18,2),
  kosten_vertrag     numeric(18,2),
  kosten_projekt     numeric(18,2),
  ergebnis_projekt   numeric(18,2),
  quelle_datei       varchar(160),
  eingelesen_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kv_dashboard_auftrag_idx ON controlling.kv_dashboard (auftrag);

-- ---------------------------------------------------------------------
-- Der Abgleich: Kostenverfolgung gegen SAP
--
-- Vorzeichen: die Kostenverfolgung fuehrt Umsatz und Kosten beide
-- positiv. Das SAP-Ist wird hier entsprechend gedreht, damit die
-- Spalten unmittelbar nebeneinander lesbar sind.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_kv_sap AS
WITH sap AS (
  SELECT e.auftrag,
         -sum(e.wert_signed) FILTER (
           WHERE k.kategorie IN ('umsatzerloese','leistung_unfertig',
                                 'leistung_fertig','sonstige_ertraege')) AS umsatz_sap,
          sum(e.wert_signed) FILTER (WHERE k.kategorie = 'betriebsaufwand') AS kosten_sap,
          count(*)                                                          AS belege,
          max(e.buchungsdatum)                                              AS letzte_buchung
    FROM controlling.sap_einzelposten e
    JOIN controlling.kontenkatalog_tvf k
      ON controlling.f_konto_norm(k.konto) = controlling.f_konto_norm(e.kostenart)
   WHERE e.auftrag IS NOT NULL
   GROUP BY e.auftrag
)
SELECT k.psp,
       k.auftrag,
       COALESCE(controlling.f_region_voll(k.auftrag, NULL), k.region) AS region,
       k.projekttitel, k.auftraggeber, k.phase, k.status, k.bauleiter, k.stand,
       k.erfuellung_prozent,
       COALESCE(k.umsatz_ist, 0)                       AS umsatz_kv,
       COALESCE(s.umsatz_sap, 0)                       AS umsatz_sap,
       COALESCE(s.umsatz_sap, 0) - COALESCE(k.umsatz_ist, 0) AS umsatz_delta,
       COALESCE(k.kosten_ist, 0)                       AS kosten_kv,
       COALESCE(s.kosten_sap, 0)                       AS kosten_sap,
       COALESCE(s.kosten_sap, 0) - COALESCE(k.kosten_ist, 0) AS kosten_delta,
       COALESCE(k.umsatz_ist, 0) - COALESCE(k.kosten_ist, 0) AS ergebnis_kv,
       COALESCE(s.umsatz_sap, 0) - COALESCE(s.kosten_sap, 0) AS ergebnis_sap,
       (COALESCE(s.umsatz_sap, 0) - COALESCE(s.kosten_sap, 0))
     - (COALESCE(k.umsatz_ist, 0) - COALESCE(k.kosten_ist, 0))  AS ergebnis_delta,
       k.umsatz_vertrag, k.kosten_vertrag, k.umsatz_projekt, k.kosten_projekt,
       COALESCE(s.belege, 0)   AS belege_sap,
       s.letzte_buchung,
       (s.auftrag IS NOT NULL) AS in_sap,
       k.beginn, k.ende,
       -- Nur wo das Projekt im laufenden Jahr begonnen hat, sind die
       -- Summen unmittelbar vergleichbar: die Kostenverfolgung fuehrt
       -- Werte ueber die gesamte Projektlaufzeit, der SAP-Auszug nur 2026.
       (k.beginn >= date_trunc('year', CURRENT_DATE)::date) AS vergleichbar
  FROM controlling.kv_dashboard k
  LEFT JOIN sap s ON s.auftrag = k.auftrag;

COMMENT ON VIEW controlling.v_kv_sap IS
  'Kostenverfolgung der Regionen gegen die SAP-Buchungen. delta = SAP minus KV: '
  'positiv heisst, in SAP steht mehr als in der Kostenverfolgung. Achtung: die '
  'Spalte vergleichbar trennt Projekte, deren KV-Summe dieselbe Periode abdeckt '
  'wie der SAP-Auszug, von mehrjaehrigen Projekten – dort ist das Delta kein Fehler.';
