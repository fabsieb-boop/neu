/* ---------------------------------------------------------------------------
   Ein Monat wird gerechnet, wenn er freigegeben ist
   ---------------------------------------------------------------------------
   Bisher entschied das die Datenlage allein: ein Monat galt als belastbar,
   sobald er mindestens 70 Prozent der ueblichen Belegzahl trug.  Das ist
   eine gute Vermutung, aber eine Vermutung.  Der August 2026 steht bei 39
   Prozent und faellt damit heraus - richtig, aber niemand hat es
   entschieden, und niemand kann es entscheiden.

   Ab hier gibt es die ausdrueckliche Freigabe je Monat, zu finden unter
   Einstellungen.  Sie schlaegt die Vermutung in beide Richtungen:

     kein Eintrag   die Datenlage entscheidet wie bisher
     freigegeben    der Monat wird gerechnet, auch wenn er duenn ist
     gesperrt       der Monat wird nicht gerechnet, auch wenn er voll ist

   Was nicht gerechnet wird, verschwindet nicht - es wird schraffiert
   gezeigt.  Ein leerer Monat sieht aus wie ein Monat ohne Geschaeft; ein
   schraffierter sieht aus wie das, was er ist.
--------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS controlling.monat_freigabe (
  jahr          smallint    NOT NULL,
  monat         smallint    NOT NULL CHECK (monat BETWEEN 1 AND 12),
  freigegeben   boolean     NOT NULL,
  notiz         text,
  geaendert_von bigint,
  geaendert_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (jahr, monat)
);

COMMENT ON TABLE controlling.monat_freigabe IS
  'Ausdrueckliche Freigabe eines Monats. Ohne Eintrag entscheidet die Datenlage.';

GRANT SELECT, INSERT, UPDATE, DELETE ON controlling.monat_freigabe TO PUBLIC;

/* ---------------------------------------------------------------------------
   Der Periodenstand traegt jetzt beides: was die Daten hergeben und was
   entschieden wurde.
--------------------------------------------------------------------------- */
DROP VIEW IF EXISTS controlling.v_periode_status;

CREATE VIEW controlling.v_periode_status AS
WITH monate AS (
  SELECT EXTRACT(year  FROM buchungsdatum)::integer AS jahr,
         EXTRACT(month FROM buchungsdatum)::integer AS monat,
         count(*)                                   AS belege
    FROM controlling.sap_einzelposten
   WHERE buchungsdatum IS NOT NULL
   GROUP BY 1, 2
), mass AS (
  SELECT jahr, percentile_cont(0.5) WITHIN GROUP (ORDER BY belege::double precision)
                                                  AS median_belege
    FROM monate GROUP BY jahr
)
SELECT m.jahr,
       m.monat,
       m.belege,
       round(s.median_belege)                                            AS median_belege,
       round(100.0 * m.belege / NULLIF(s.median_belege, 0))::numeric     AS fuellgrad,
       /* Wie bisher: reicht die Belegzahl? */
       m.belege >= 0.7 * s.median_belege                                 AS belastbar,
       f.freigegeben                                                     AS freigabe,
       /* Massgeblich: die Entscheidung, sonst die Datenlage. */
       COALESCE(f.freigegeben, m.belege >= 0.7 * s.median_belege)        AS belastbar_effektiv
  FROM monate m
  JOIN mass s ON s.jahr = m.jahr
  LEFT JOIN controlling.monat_freigabe f ON f.jahr = m.jahr AND f.monat = m.monat;

COMMENT ON VIEW controlling.v_periode_status IS
  'Belegdichte je Monat und die Freigabe. belastbar_effektiv entscheidet, was gerechnet wird.';

GRANT SELECT ON controlling.v_periode_status TO PUBLIC;

/* Der letzte belastbare Monat richtet sich nach der Entscheidung. */
CREATE OR REPLACE FUNCTION controlling.f_letzter_belastbarer_monat(p_jahr integer)
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT COALESCE(max(monat), 0) FROM (
    SELECT monat, bool_and(belastbar_effektiv) OVER (ORDER BY monat) AS durchgehend
      FROM controlling.v_periode_status WHERE jahr = p_jahr
  ) x WHERE durchgehend
$$;
