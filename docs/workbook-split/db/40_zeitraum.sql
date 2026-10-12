/* ---------------------------------------------------------------------------
   Auswertungen nach Zeitraum
   ---------------------------------------------------------------------------
   Bisher liessen sich die Auswertungen nur nach Geschaeftsjahr und Region
   einschraenken.  Fast alle Sichten fuehren aber ohnehin einen Monat
   (v_guv, v_guv_region, v_db_monat, v_db_monat_region, v_buchung,
   v_kostenart_monat, v_guv_ist) – dort genuegt eine Bedingung in der Abfrage,
   dafuer braucht es kein Skript.

   Eine einzige Sicht rechnet ueber das ganze Jahr, ohne den Monat
   durchzureichen: v_projekt_db.  Sie verdichtet v_buchung je Projekt und
   verteilt anschliessend die Unternehmensgemeinkosten anteilig.  Genau diese
   Verteilung ist der Grund, warum sich das Ergebnis nicht einfach nachtraeglich
   auf Monate filtern laesst: der Verteilungsschluessel muss aus demselben
   Zeitraum stammen wie die Zahlen.

   Deshalb wandert die Rechnung in eine Funktion mit Zeitraum, und die Sicht
   ruft die Funktion fuer das volle Jahr auf.  Eine Rechnung, zwei Zugaenge –
   die Pruefsumme der Projektergebnisse bleibt dadurch unveraendert.
--------------------------------------------------------------------------- */

CREATE OR REPLACE FUNCTION controlling.f_projekt_db(
  p_jahr smallint, p_von smallint DEFAULT 1, p_bis smallint DEFAULT 12)
RETURNS TABLE (
  jahr               smallint,
  projekt_id         bigint,
  projekt_nr         varchar(80),
  projektname        varchar(255),
  regionscode        varchar,
  region             varchar,
  leistung           numeric,
  variable_kosten    numeric,
  fixe_projektkosten numeric,
  verrechnete_gk     numeric,
  neutral            numeric,
  belege             bigint,
  erste_buchung      date,
  letzte_buchung     date,
  db1                numeric,
  db2                numeric,
  db3                numeric,
  umlage_zentrale    numeric,
  db4                numeric,
  db1_marge          numeric,
  db3_marge          numeric
)
LANGUAGE sql STABLE AS $$
  WITH proj AS (
    SELECT b.jahr, b.projekt_id, b.projekt_nr, b.projektname, b.regionscode, b.region,
           sum(b.leistung) AS leistung,
           sum(b.k_var)    AS variable_kosten,
           sum(b.k_fix)    AS fixe_projektkosten,
           sum(b.umlage)   AS verrechnete_gk,
           sum(b.neutral)  AS neutral,
           count(*)        AS belege,
           min(b.buchungsdatum) AS erste_buchung,
           max(b.buchungsdatum) AS letzte_buchung
      FROM controlling.v_buchung b
     WHERE b.ergebnisrelevant AND b.kostentraeger = 'PROJEKT'
       AND b.jahr = p_jahr AND b.monat BETWEEN p_von AND p_bis
     GROUP BY b.jahr, b.projekt_id, b.projekt_nr, b.projektname, b.regionscode, b.region
  ), zentrale AS (
    /* Die Unternehmensgemeinkosten desselben Zeitraums – sonst verteilt ein
       Quartal die Kosten eines ganzen Jahres. */
    SELECT sum(b.k_var + b.k_fix - b.leistung + b.umlage) AS unternehmens_gk
      FROM controlling.v_buchung b
     WHERE b.ergebnisrelevant AND b.kostentraeger = 'ZENTRALE'
       AND b.jahr = p_jahr AND b.monat BETWEEN p_von AND p_bis
  ), bezug AS (
    SELECT sum(GREATEST(proj.leistung, 0)) AS gesamt_leistung FROM proj
  )
  SELECT p.jahr, p.projekt_id, p.projekt_nr, p.projektname, p.regionscode, p.region,
         p.leistung, p.variable_kosten, p.fixe_projektkosten, p.verrechnete_gk,
         p.neutral, p.belege, p.erste_buchung, p.letzte_buchung,
         p.leistung - p.variable_kosten                                          AS db1,
         p.leistung - p.variable_kosten - p.fixe_projektkosten                    AS db2,
         p.leistung - p.variable_kosten - p.fixe_projektkosten - p.verrechnete_gk AS db3,
         round(COALESCE(z.unternehmens_gk, 0) *
               CASE WHEN bz.gesamt_leistung > 0
                    THEN GREATEST(p.leistung, 0) / bz.gesamt_leistung ELSE 0 END, 2)
                                                                                  AS umlage_zentrale,
         p.leistung - p.variable_kosten - p.fixe_projektkosten - p.verrechnete_gk
           - round(COALESCE(z.unternehmens_gk, 0) *
                   CASE WHEN bz.gesamt_leistung > 0
                        THEN GREATEST(p.leistung, 0) / bz.gesamt_leistung ELSE 0 END, 2)
                                                                                  AS db4,
         CASE WHEN p.leistung <> 0
              THEN (p.leistung - p.variable_kosten) / p.leistung * 100 END        AS db1_marge,
         CASE WHEN p.leistung <> 0
              THEN (p.leistung - p.variable_kosten - p.fixe_projektkosten - p.verrechnete_gk)
                   / p.leistung * 100 END                                         AS db3_marge
    FROM proj p CROSS JOIN zentrale z CROSS JOIN bezug bz;
$$;

COMMENT ON FUNCTION controlling.f_projekt_db(smallint, smallint, smallint) IS
  'Projektergebnisse eines Zeitraums. Die Umlage der Unternehmensgemeinkosten wird innerhalb desselben Zeitraums verteilt.';

/* Die Sicht bleibt, was sie war: dasselbe Ergebnis fuer das volle Jahr.
   Die beiden laengenbehafteten Textspalten werden ausdruecklich zurueckgecastet –
   eine Funktion gibt varchar ohne Laenge zurueck, und CREATE OR REPLACE VIEW
   besteht auf denselben Spaltentypen wie bisher. */
CREATE OR REPLACE VIEW controlling.v_projekt_db AS
SELECT f.jahr, f.projekt_id,
       f.projekt_nr::varchar(80)   AS projekt_nr,
       f.projektname::varchar(255) AS projektname,
       f.regionscode, f.region,
       f.leistung, f.variable_kosten, f.fixe_projektkosten, f.verrechnete_gk,
       f.neutral, f.belege, f.erste_buchung, f.letzte_buchung,
       f.db1, f.db2, f.db3, f.umlage_zentrale, f.db4, f.db1_marge, f.db3_marge
  FROM (SELECT DISTINCT jahr FROM controlling.v_buchung WHERE ergebnisrelevant) j
  CROSS JOIN LATERAL controlling.f_projekt_db(j.jahr, 1::smallint, 12::smallint) f;

GRANT EXECUTE ON FUNCTION controlling.f_projekt_db(smallint, smallint, smallint) TO PUBLIC;
GRANT SELECT ON controlling.v_projekt_db TO PUBLIC;
