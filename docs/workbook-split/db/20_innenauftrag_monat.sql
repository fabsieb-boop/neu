-- Innenaufträge je Monat. Die Jahresliste bleibt v_innenauftrag.
CREATE OR REPLACE VIEW controlling.v_innenauftrag_monat AS
SELECT p.periode AS monat,
       p.auftrag,
       max(p.objektbezeichnung::text) AS bezeichnung,
       controlling.f_region_voll(p.auftrag::text, NULL::text) AS region,
       count(*) AS zeilen,
       round(sum(p.wert), 2) AS saldo
  FROM controlling.innenauftrag_posten p
 GROUP BY p.periode, p.auftrag;
