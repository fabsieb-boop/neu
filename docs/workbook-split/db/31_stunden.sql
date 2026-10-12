/* ---------------------------------------------------------------------------
   Arbeitszeit je Mitarbeiter, Tag und Kostentraeger
   ---------------------------------------------------------------------------
   Die Luecke, die das Cockpit von Anfang an hatte: es kannte Kosten, aber
   keine Stunden.  Damit war jede Aussage zur Auslastung eine Schaetzung –
   und stand deshalb bewusst als Datenluecke im Vorstandsbericht.

   Grundlage ist das Kalendarium der Zeitwirtschaft.  Es liefert je Tag,
   Mitarbeiter und Lohnart die geleisteten Stunden und – bei produktiver
   Arbeit – den Kostentraeger dazu.

   Was hier NICHT passiert: bewerten.  Die Tabelle haelt fest, was
   gearbeitet wurde.  Ob eine Auslastung gut ist, entscheidet die Seite,
   die sie liest, und nicht die Ablage.
--------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS controlling.stunde (
  stunde_id      BIGSERIAL PRIMARY KEY,
  import_id      BIGINT,
  datum          DATE          NOT NULL,
  personalnummer VARCHAR(20),
  mitarbeiter    VARCHAR(120)  NOT NULL,
  lohnart        VARCHAR(60)   NOT NULL,
  kostentraeger  VARCHAR(80),
  projekt_nr     VARCHAR(30),
  regionscode    VARCHAR(4),
  stunden        NUMERIC(8,2)  NOT NULL,
  produktiv      BOOLEAN       NOT NULL DEFAULT false,
  quelle_datei   VARCHAR(200),
  eingelesen_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

/* Derselbe Tag, Mitarbeiter, Lohnart und Kostentraeger genau einmal – der
   Kalendarium-Export wird monatlich neu gezogen und ueberschneidet sich. */
CREATE UNIQUE INDEX IF NOT EXISTS stunde_eindeutig
  ON controlling.stunde (datum, mitarbeiter, lohnart, COALESCE(kostentraeger, ''));
CREATE INDEX IF NOT EXISTS stunde_projekt ON controlling.stunde (projekt_nr);
CREATE INDEX IF NOT EXISTS stunde_monat   ON controlling.stunde
  (EXTRACT(YEAR FROM datum), EXTRACT(MONTH FROM datum));

COMMENT ON TABLE controlling.stunde IS
  'Arbeitszeit je Tag, Mitarbeiter und Kostentraeger aus dem Kalendarium der Zeitwirtschaft.';
COMMENT ON COLUMN controlling.stunde.produktiv IS
  'Auf einen echten Auftrag gebucht – nicht Sozialkosten, Urlaub oder Krankheit.';

/* ---------------------------------------------------------------------------
   Auslastung je Mitarbeiter und Monat
   ---------------------------------------------------------------------------
   Auslastung ist der Anteil produktiver Stunden an den anwesenden Stunden.
   Urlaub, Krankheit und Feiertag zaehlen nicht als Anwesenheit – wer im
   Urlaub war, war nicht schlecht ausgelastet, sondern nicht da.
--------------------------------------------------------------------------- */
CREATE OR REPLACE VIEW controlling.v_stunden_mitarbeiter AS
WITH je AS (
  SELECT EXTRACT(YEAR  FROM datum)::int  AS jahr,
         EXTRACT(MONTH FROM datum)::int  AS monat,
         mitarbeiter, max(personalnummer) AS personalnummer,
         sum(stunden) FILTER (WHERE produktiv)                        AS produktiv,
         sum(stunden) FILTER (WHERE NOT produktiv
               AND lohnart !~* 'urlaub|krank|feiertag|arbeitszeitkonto')  AS unproduktiv,
         sum(stunden) FILTER (WHERE lohnart ~* 'urlaub')               AS urlaub,
         sum(stunden) FILTER (WHERE lohnart ~* 'krank')                AS krankheit,
         sum(stunden) FILTER (WHERE lohnart ~* 'feiertag')             AS feiertag,
         sum(stunden)                                                  AS gesamt,
         count(DISTINCT datum)                                         AS tage,
         count(DISTINCT projekt_nr) FILTER (WHERE produktiv)           AS projekte
    FROM controlling.stunde
   GROUP BY 1, 2, 3
)
SELECT jahr, monat, mitarbeiter, personalnummer,
       COALESCE(produktiv, 0)   AS produktiv,
       COALESCE(unproduktiv, 0) AS unproduktiv,
       COALESCE(urlaub, 0)      AS urlaub,
       COALESCE(krankheit, 0)   AS krankheit,
       COALESCE(feiertag, 0)    AS feiertag,
       gesamt, tage, projekte,
       COALESCE(produktiv, 0) + COALESCE(unproduktiv, 0) AS anwesend,
       CASE WHEN COALESCE(produktiv, 0) + COALESCE(unproduktiv, 0) > 0
            THEN round(COALESCE(produktiv, 0)
                     / (COALESCE(produktiv, 0) + COALESCE(unproduktiv, 0)) * 100, 1)
       END AS auslastung,
       /* Zweite Sicht auf dieselbe Frage: Anteil produktiver Stunden an
          allen bezahlten.  Die Auslastung sagt, wie gut die Anwesenden
          eingesetzt waren; die Produktivquote, was von der bezahlten Zeit
          beim Auftrag ankam.  Der Vorstand fragt meist nach der zweiten. */
       CASE WHEN gesamt > 0
            THEN round(COALESCE(produktiv, 0) / gesamt * 100, 1)
       END AS produktivquote
  FROM je;

COMMENT ON VIEW controlling.v_stunden_mitarbeiter IS
  'Stunden und Auslastung je Mitarbeiter und Monat. Auslastung = produktiv / anwesend.';

/* ---------------------------------------------------------------------------
   Stunden je Projekt – und was die Stunde erwirtschaftet hat
--------------------------------------------------------------------------- */
CREATE OR REPLACE VIEW controlling.v_stunden_projekt AS
SELECT EXTRACT(YEAR  FROM s.datum)::int AS jahr,
       EXTRACT(MONTH FROM s.datum)::int AS monat,
       s.projekt_nr, s.regionscode,
       controlling.f_region(s.regionscode)      AS region,
       max(p.projektname)                       AS projektname,
       sum(s.stunden)                           AS stunden,
       count(DISTINCT s.mitarbeiter)            AS mitarbeiter,
       count(DISTINCT s.datum)                  AS tage
  FROM controlling.stunde s
  LEFT JOIN controlling.projekte p ON p.projekt_nr = s.projekt_nr
 WHERE s.produktiv AND s.projekt_nr IS NOT NULL
 GROUP BY 1, 2, 3, 4;

COMMENT ON VIEW controlling.v_stunden_projekt IS
  'Produktive Stunden je Projekt und Monat.';

/* ---------------------------------------------------------------------------
   Kopfzahl fuers Cockpit
--------------------------------------------------------------------------- */
CREATE OR REPLACE VIEW controlling.v_stunden_jahr AS
SELECT jahr,
       sum(produktiv)   AS produktiv,
       sum(unproduktiv) AS unproduktiv,
       sum(urlaub)      AS urlaub,
       sum(krankheit)   AS krankheit,
       sum(feiertag)    AS feiertag,
       sum(gesamt)      AS gesamt,
       count(DISTINCT mitarbeiter) AS mitarbeiter,
       max(monat)       AS bis_monat,
       CASE WHEN sum(produktiv) + sum(unproduktiv) > 0
            THEN round(sum(produktiv) / (sum(produktiv) + sum(unproduktiv)) * 100, 1)
       END AS auslastung,
       CASE WHEN sum(gesamt) > 0
            THEN round(sum(produktiv) / sum(gesamt) * 100, 1)
       END AS produktivquote
  FROM controlling.v_stunden_mitarbeiter
 GROUP BY jahr;

GRANT SELECT ON controlling.v_stunden_mitarbeiter,
                controlling.v_stunden_projekt, controlling.v_stunden_jahr TO PUBLIC;

/* ---------------------------------------------------------------------------
   Schreibrechte fuer die Anwendung
   ---------------------------------------------------------------------------
   Wird diese Datei als Eigentuemer eingespielt (auf dem Server: postgres),
   gehoert die neue Tabelle nicht dem Benutzer, mit dem die Anwendung
   verbindet – der Import koennte dann nichts schreiben.

   Wem die Rechte zu geben sind, wird nicht geraten und nicht fest
   eingetragen: es sind genau die Rollen, die schon heute Buchungen
   schreiben duerfen.  Damit passt sich die Migration jeder Installation an
   und muss bei einem Benutzerwechsel nicht angefasst werden.
--------------------------------------------------------------------------- */
DO $$
DECLARE rolle text;
BEGIN
  FOR rolle IN
    SELECT DISTINCT grantee FROM information_schema.table_privileges
     WHERE table_schema = 'controlling' AND table_name = 'buchungen'
       AND privilege_type = 'INSERT' AND grantee <> 'PUBLIC'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON controlling.stunde TO %I', rolle);
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE controlling.stunde_stunde_id_seq TO %I', rolle);
    RAISE NOTICE 'Schreibrechte auf controlling.stunde fuer %', rolle;
  END LOOP;
END $$;
