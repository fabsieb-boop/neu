/* ---------------------------------------------------------------------------
   Auftragskalkulation
   ---------------------------------------------------------------------------
   Bisher konnte das Cockpit sagen, was ein Projekt gekostet hat, aber nicht,
   was es kosten sollte.  Ohne diesen Vergleich ist jede Abweichung nur eine
   Zahl: 63.000 EUR Kosten sind gut oder schlecht, je nachdem, was kalkuliert
   war.

   Zwei Tabellen, wie bei jedem Beleg: ein Kopf je Kalkulation und die
   Positionen darunter.

   Versioniert, weil eine Kalkulation nicht einmal entsteht und dann gilt.
   Es gibt die Urkalkulation, die Kalkulation nach Nachtrag, die
   Arbeitskalkulation.  Sie loeschen einander nicht - verglichen wird gegen
   die freigegebene, aber nachlesbar bleiben alle.

   Was hier NICHT passiert: das Ergebnis veraendern.  Die Kalkulation ist
   Vergleichsgroesse, nicht Buchung.  GuV, Deckungsbeitrag, Forecast und
   EBITDA lesen sie nicht.
--------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS controlling.kalkulation (
  kalkulation_id BIGSERIAL PRIMARY KEY,
  projekt_nr     VARCHAR(30)  NOT NULL,
  version        SMALLINT     NOT NULL DEFAULT 1,
  bezeichnung    VARCHAR(160) NOT NULL DEFAULT 'Urkalkulation',
  stand          DATE         NOT NULL DEFAULT CURRENT_DATE,
  /* ENTWURF – in Arbeit, ohne Wirkung im Vergleich
     FREIGEGEBEN – die geltende Kalkulation dieses Projekts
     ERSETZT – von einer neueren abgeloest, bleibt zum Nachlesen */
  status         VARCHAR(12)  NOT NULL DEFAULT 'ENTWURF',
  notiz          TEXT,
  quelle_datei   VARCHAR(200),
  erfasst_von    BIGINT REFERENCES controlling.benutzer(benutzer_id),
  erfasst_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  geaendert_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT kalkulation_status_gueltig
    CHECK (status IN ('ENTWURF', 'FREIGEGEBEN', 'ERSETZT')),
  CONSTRAINT kalkulation_version_eindeutig UNIQUE (projekt_nr, version)
);

CREATE TABLE IF NOT EXISTS controlling.kalkulation_position (
  position_id    BIGSERIAL PRIMARY KEY,
  kalkulation_id BIGINT NOT NULL
                 REFERENCES controlling.kalkulation(kalkulation_id) ON DELETE CASCADE,
  lfd            SMALLINT,
  /* ERLOES zaehlt zur Auftragssumme, KOSTEN zur Kalkulationssumme. */
  art            VARCHAR(8)   NOT NULL DEFAULT 'KOSTEN',
  kostenart_nr   VARCHAR(20),
  bezeichnung    VARCHAR(200) NOT NULL,
  menge          NUMERIC(14,3),
  einheit        VARCHAR(12),
  satz           NUMERIC(14,4),
  betrag         NUMERIC(16,2) NOT NULL DEFAULT 0,
  CONSTRAINT kalkulation_art_gueltig CHECK (art IN ('ERLOES', 'KOSTEN'))
);

CREATE INDEX IF NOT EXISTS kalkulation_projekt ON controlling.kalkulation (projekt_nr);
CREATE INDEX IF NOT EXISTS kalkulation_position_kopf
  ON controlling.kalkulation_position (kalkulation_id);

COMMENT ON TABLE controlling.kalkulation IS
  'Auftragskalkulation je Projekt, versioniert. Vergleichsgroesse, keine Buchung.';
COMMENT ON COLUMN controlling.kalkulation.status IS
  'ENTWURF, FREIGEGEBEN (die geltende) oder ERSETZT.';

/* ---------------------------------------------------------------------------
   Die geltende Kalkulation je Projekt
   ---------------------------------------------------------------------------
   Freigegeben schlaegt Entwurf, hoehere Version schlaegt niedrigere.  Gibt es
   keine freigegebene, gilt der juengste Entwurf – sonst stuende ein Projekt
   ohne Vergleich da, nur weil die Freigabe noch fehlt.
--------------------------------------------------------------------------- */
CREATE OR REPLACE VIEW controlling.v_kalkulation AS
WITH gereiht AS (
  SELECT k.*,
         row_number() OVER (
           PARTITION BY k.projekt_nr
           ORDER BY (k.status = 'FREIGEGEBEN') DESC, k.version DESC) AS rang
    FROM controlling.kalkulation k
   WHERE k.status <> 'ERSETZT'
), summen AS (
  SELECT kalkulation_id,
         COALESCE(sum(betrag) FILTER (WHERE art = 'ERLOES'), 0) AS erloes,
         COALESCE(sum(betrag) FILTER (WHERE art = 'KOSTEN'), 0) AS kosten,
         count(*)                                              AS positionen
    FROM controlling.kalkulation_position GROUP BY 1
)
SELECT g.kalkulation_id, g.projekt_nr, g.version, g.bezeichnung, g.stand, g.status,
       g.notiz, g.quelle_datei, g.erfasst_at,
       p.projektname, p.region, p.regionscode,
       COALESCE(s.erloes, 0)     AS erloes,
       COALESCE(s.kosten, 0)     AS kosten,
       COALESCE(s.erloes, 0) - COALESCE(s.kosten, 0) AS deckungsbeitrag,
       CASE WHEN COALESCE(s.erloes, 0) <> 0
            THEN round((COALESCE(s.erloes, 0) - COALESCE(s.kosten, 0))
                        / s.erloes * 100, 1) END AS marge,
       COALESCE(s.positionen, 0) AS positionen,
       (g.rang = 1)              AS geltend
  FROM gereiht g
  LEFT JOIN summen s ON s.kalkulation_id = g.kalkulation_id
  LEFT JOIN controlling.projekte p ON p.projekt_nr = g.projekt_nr;

COMMENT ON VIEW controlling.v_kalkulation IS
  'Kalkulationen mit Summen; geltend = die fuer den Vergleich massgebliche.';

/* ---------------------------------------------------------------------------
   Kalkulation gegen Ist
   ---------------------------------------------------------------------------
   Der eigentliche Zweck.  Verglichen wird je Projekt: was war kalkuliert,
   was ist angefallen, und wie viel der Kalkulation ist verbraucht.
--------------------------------------------------------------------------- */
CREATE OR REPLACE VIEW controlling.v_kalkulation_ist AS
WITH kalk AS (
  SELECT projekt_nr, kalkulation_id, version, bezeichnung, stand, status,
         erloes, kosten, deckungsbeitrag, marge
    FROM controlling.v_kalkulation WHERE geltend
), ist AS (
  SELECT auftrag AS projekt_nr,
         COALESCE(sum(leistung), 0)         AS ist_leistung,
         COALESCE(sum(k_var + k_fix), 0)    AS ist_kosten,
         max(buchungsdatum)                 AS letzte_buchung
    FROM controlling.v_buchung
   WHERE ergebnisrelevant AND auftrag IS NOT NULL
   GROUP BY 1
)
SELECT k.projekt_nr, k.kalkulation_id, k.version, k.bezeichnung, k.stand, k.status,
       k.erloes                              AS kalk_erloes,
       k.kosten                              AS kalk_kosten,
       k.deckungsbeitrag                     AS kalk_db,
       k.marge                               AS kalk_marge,
       COALESCE(i.ist_leistung, 0)           AS ist_leistung,
       COALESCE(i.ist_kosten, 0)             AS ist_kosten,
       COALESCE(i.ist_leistung, 0) - COALESCE(i.ist_kosten, 0) AS ist_db,
       i.letzte_buchung,
       COALESCE(i.ist_kosten, 0) - k.kosten  AS kostenabweichung,
       CASE WHEN k.kosten > 0
            THEN round(COALESCE(i.ist_kosten, 0) / k.kosten * 100, 1) END AS verbraucht,
       CASE WHEN k.erloes > 0
            THEN round(COALESCE(i.ist_leistung, 0) / k.erloes * 100, 1) END AS abgearbeitet
  FROM kalk k
  LEFT JOIN ist i ON i.projekt_nr = k.projekt_nr;

COMMENT ON VIEW controlling.v_kalkulation_ist IS
  'Geltende Kalkulation gegen die gebuchten Ist-Werte je Projekt.';

GRANT SELECT ON controlling.kalkulation, controlling.kalkulation_position,
                controlling.v_kalkulation, controlling.v_kalkulation_ist TO PUBLIC;

/* Schreibrechte fuer die Anwendung – dieselben Rollen, die Buchungen
   schreiben duerfen (siehe db/31_stunden.sql). */
DO $$
DECLARE rolle text;
BEGIN
  FOR rolle IN
    SELECT DISTINCT grantee FROM information_schema.table_privileges
     WHERE table_schema = 'controlling' AND table_name = 'buchungen'
       AND privilege_type = 'INSERT' AND grantee <> 'PUBLIC'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON controlling.kalkulation,'
                 || ' controlling.kalkulation_position TO %I', rolle);
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE controlling.kalkulation_kalkulation_id_seq,'
                 || ' controlling.kalkulation_position_position_id_seq TO %I', rolle);
  END LOOP;
END $$;
