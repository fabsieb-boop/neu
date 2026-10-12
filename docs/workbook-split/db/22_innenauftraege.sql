-- =====================================================================
-- 22 · Einzelposten der Innenauftraege
--
-- Der Hauptexport (neu.XLSX) enthaelt die sekundaeren Kostenarten nicht.
-- Vor allem fehlt 7801020 "Gemeinkostenzuschlaege 12 %" mit 1,37 Mio EUR
-- ueber 309 Zeilen – genau die Umlage, die die Vertriebs-Innenauftraege
-- der Regionen entlastet und die Kosten auf die Projekte bucht.
--
-- Dadurch stehen die Regions-Innenauftraege im Hauptexport mit falschem
-- Vorzeichen da: Vertrieb Region West mit +80.438 statt -462.435.
--
-- Diese Tabelle nimmt die Innenauftrags-Auswertung als eigene Quelle auf.
-- Sie fliesst ausdruecklich NICHT in die GuV: sekundaere Kostenarten
-- existieren nur im CO und saldieren ueber alle Auftraege auf null. Sie
-- dient der Kostenstellen- und Umlagerechnung.
-- =====================================================================

SET search_path = controlling, public;

CREATE TABLE IF NOT EXISTS controlling.innenauftrag_posten (
  id               bigserial PRIMARY KEY,
  auftrag          varchar(40)   NOT NULL,
  objektbezeichnung varchar(160),
  belegart         varchar(10),
  periode          smallint,
  gegenkonto       varchar(30),
  gegenkonto_text  varchar(160),
  wert             numeric(18,2) NOT NULL DEFAULT 0,
  kostenart        varchar(20),
  kostenart_text   varchar(160),
  text             varchar(255),
  quelle_datei     varchar(160),
  eingelesen_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS innenauftrag_posten_auftrag_idx  ON controlling.innenauftrag_posten (auftrag);
CREATE INDEX IF NOT EXISTS innenauftrag_posten_kostenart_idx ON controlling.innenauftrag_posten (kostenart);

-- ---------------------------------------------------------------------
-- Die Innenauftraege mit ihrer Funktion und Region
--
-- Die Objektbezeichnung nennt die Funktion im Klartext ("Vertrieb Region
-- West", "Lager Region Berlin"). Daraus laesst sich die Kostenart der
-- Stelle ableiten, ohne eine eigene Zuordnungstabelle zu pflegen.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_innenauftrag AS
SELECT p.auftrag,
       max(p.objektbezeichnung)                                AS bezeichnung,
       controlling.f_region_voll(p.auftrag, NULL)              AS region,
       CASE
         WHEN max(p.objektbezeichnung) ILIKE '%vertrieb%' OR max(p.objektbezeichnung) ILIKE '%vetrieb%'
           OR max(p.objektbezeichnung) ILIKE '%VVK%'      THEN 'Vertrieb'
         WHEN max(p.objektbezeichnung) ILIKE '%lager%'    THEN 'Lager'
         WHEN max(p.objektbezeichnung) ILIKE '%werkstatt%' THEN 'Werkstatt'
         WHEN max(p.objektbezeichnung) ILIKE 'CB%'         THEN 'Firmenwagen'
         WHEN max(p.objektbezeichnung) ILIKE '%steuer%'    THEN 'Steuern'
         ELSE 'Verwaltung'
       END                                                     AS funktion,
       -- Primaere Kosten: das, was die Stelle tatsaechlich verbraucht
       sum(p.wert) FILTER (WHERE NOT controlling.f_ist_sekundaer(p.kostenart)) AS primaerkosten,
       -- Entlastung durch die Umlage auf die Projekte
       sum(p.wert) FILTER (WHERE controlling.f_ist_sekundaer(p.kostenart))     AS umlage,
       sum(p.wert)                                             AS saldo,
       count(*)                                                AS zeilen
  FROM controlling.innenauftrag_posten p
 GROUP BY p.auftrag;

-- ---------------------------------------------------------------------
-- Gemeinkosten je Region: was die Stellen kosten und was umgelegt wird
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_gemeinkosten_region AS
SELECT region, funktion,
       sum(primaerkosten) AS primaerkosten,
       sum(umlage)        AS umlage,
       sum(saldo)         AS deckungsdifferenz,
       count(*)           AS innenauftraege
  FROM controlling.v_innenauftrag
 GROUP BY region, funktion;

COMMENT ON TABLE controlling.innenauftrag_posten IS
  'Einzelposten der Innenauftraege einschliesslich der sekundaeren Kostenarten. '
  'Nicht Bestandteil der GuV – dort gelten die Primaerbuchungen aus sap_einzelposten.';
