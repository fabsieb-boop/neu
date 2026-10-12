-- =====================================================================
-- 21 · Welche Perioden sind belastbar?
--
-- Der August-Auszug enthaelt nur 454 Belegzeilen gegen rund 1.400 im
-- Monatsschnitt. Die Erloese fehlen weitgehend, wodurch die Gesamt-
-- leistung des Monats negativ wird. Ein Ergebnis, das diesen Monat
-- enthaelt, ist keine Aussage ueber das Geschaeft, sondern ueber die
-- Vollstaendigkeit des Auszugs.
--
-- Bisher stand genau diese Zahl als Kopfzahl im Cockpit. Diese Sicht
-- macht die Unvollstaendigkeit messbar, damit die Auswertungen von
-- selbst auf dem letzten belastbaren Monat stehenbleiben.
-- =====================================================================

SET search_path = controlling, public;

CREATE OR REPLACE VIEW controlling.v_periode_status AS
WITH monate AS (
  SELECT EXTRACT(YEAR  FROM buchungsdatum)::int AS jahr,
         EXTRACT(MONTH FROM buchungsdatum)::int AS monat,
         count(*)                               AS belege
    FROM controlling.sap_einzelposten
   WHERE buchungsdatum IS NOT NULL
   GROUP BY 1, 2
), mass AS (
  -- Der Median ist gegen einzelne Ausreisser unempfindlicher als der
  -- Mittelwert und damit der bessere Massstab fuer "ueblich".
  SELECT jahr,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY belege) AS median_belege
    FROM monate GROUP BY jahr
)
SELECT m.jahr, m.monat, m.belege,
       round(s.median_belege)                              AS median_belege,
       round(100.0 * m.belege / NULLIF(s.median_belege,0)) AS fuellgrad,
       -- Unter 70 Prozent des Medians gilt ein Monat als unvollstaendig.
       (m.belege >= 0.7 * s.median_belege)                 AS belastbar
  FROM monate m JOIN mass s USING (jahr);

-- ---------------------------------------------------------------------
-- Der letzte Monat, bis zu dem durchgehend belastbare Daten vorliegen.
-- Bricht beim ersten unvollstaendigen Monat ab – ein spaeterer voller
-- Monat macht eine Luecke davor nicht wett.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION controlling.f_letzter_belastbarer_monat(p_jahr int)
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT COALESCE(max(monat), 0) FROM (
    SELECT monat, bool_and(belastbar) OVER (ORDER BY monat) AS durchgehend
      FROM controlling.v_periode_status WHERE jahr = p_jahr
  ) x WHERE durchgehend
$$;

COMMENT ON VIEW controlling.v_periode_status IS
  'Vollstaendigkeit der Monate, gemessen an der Belegzahl gegen den Jahresmedian. '
  'Unter 70 Prozent gilt ein Monat als unvollstaendig.';
