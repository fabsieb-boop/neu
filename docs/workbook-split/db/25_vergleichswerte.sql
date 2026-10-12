/* ---------------------------------------------------------------------------
   Vergleichswerte
   ---------------------------------------------------------------------------
   Zahlen aus Fremdquellen – Kostenverfolgung der Kollegen, Bautagebuecher,
   Aufmasslisten – gehoeren nebeneinander gestellt, nicht eingerechnet.

   Deshalb liegen sie in einer eigenen Tabelle und nicht in controlling.buchungen.
   Keine Auswertung des Ergebnisses ruehrt sie an: v_buchung, die GuV, die
   Deckungsbeitragsrechnung und der Forecast lesen ausschliesslich
   controlling.buchungen.  Ein Vergleichswert kann das Ergebnis also nicht
   verschieben, auch nicht versehentlich.

   Die Zuordnung zu einem Sachkonto dient allein der Gegenueberstellung:
   damit "Kosten" aus einer Fremdliste dem Konto gegenuebersteht, auf dem
   dieselbe Sache bei uns gebucht ist.
--------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS controlling.vergleichswert (
  vergleich_id  bigserial PRIMARY KEY,
  quelle        text        NOT NULL,             -- 'Kostenverfolgung', 'Aufmass', ...
  jahr          smallint    NOT NULL,
  monat         smallint    NOT NULL CHECK (monat BETWEEN 1 AND 12),
  auftrag       text,
  projekt_nr    text,
  objektbezeichnung text,
  kostenart_nr  text,                             -- gewaehltes Sachkonto
  ausrichtung   text        NOT NULL CHECK (ausrichtung IN ('ERLOES','KOSTEN')),
  wert          numeric(18,2) NOT NULL,           -- Vorzeichen wie in der Buchhaltung
  dateiname     text,
  import_id     bigint,
  eingelesen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_vergleichswert_zuordnung
  ON controlling.vergleichswert (jahr, monat, projekt_nr, kostenart_nr);
CREATE INDEX IF NOT EXISTS ix_vergleichswert_quelle
  ON controlling.vergleichswert (quelle, import_id);

COMMENT ON TABLE controlling.vergleichswert IS
  'Fremdzahlen zur Gegenueberstellung. Fliesst bewusst NICHT in das Ergebnis ein.';

/* ---------------------------------------------------------------------------
   Gegenueberstellung: Fremdzahl gegen eigene Buchung, je Auftrag und Konto.
--------------------------------------------------------------------------- */
CREATE OR REPLACE VIEW controlling.v_vergleich AS
WITH fremd AS (
  SELECT quelle, jahr, monat,
         COALESCE(projekt_nr, auftrag) AS auftrag,
         kostenart_nr, ausrichtung,
         sum(wert) AS wert
    FROM controlling.vergleichswert
   GROUP BY 1,2,3,4,5,6
), eigen AS (
  SELECT jahr, monat, projekt_nr AS auftrag,
         replace(kostenart_nr, '.0', '') AS kostenart_nr,
         sum(wert) AS wert
    FROM controlling.v_buchung
   WHERE ergebnisrelevant
   GROUP BY 1,2,3,4
)
SELECT COALESCE(f.quelle, 'Kostenverfolgung')          AS quelle,
       COALESCE(f.jahr, e.jahr)                        AS jahr,
       COALESCE(f.monat, e.monat)                      AS monat,
       COALESCE(f.auftrag, e.auftrag)                  AS auftrag,
       COALESCE(f.kostenart_nr, e.kostenart_nr)        AS kostenart_nr,
       f.ausrichtung,
       COALESCE(f.wert, 0)                             AS fremd,
       COALESCE(e.wert, 0)                             AS eigen,
       COALESCE(f.wert, 0) - COALESCE(e.wert, 0)       AS abweichung
  FROM fremd f
  FULL JOIN eigen e
    ON e.jahr = f.jahr AND e.monat = f.monat
   AND e.auftrag = f.auftrag AND e.kostenart_nr = f.kostenart_nr
 WHERE f.wert IS NOT NULL;          -- nur Zeilen, zu denen es eine Fremdzahl gibt

GRANT SELECT ON controlling.vergleichswert, controlling.v_vergleich TO PUBLIC;
GRANT INSERT, DELETE ON controlling.vergleichswert TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE controlling.vergleichswert_vergleich_id_seq TO PUBLIC;

/* Fuer den Berichtsbaukasten freigeben – dort ist die Gegenueberstellung
   frei mit anderen Quellen kombinierbar. */
INSERT INTO controlling.bericht_quelle (name, bezeichnung, beschreibung, regionsspalte, sortierung)
VALUES ('v_vergleich', 'Fremdzahlen gegen eigene Buchungen',
        'Kostenverfolgung und andere Fremdlisten je Auftrag und Sachkonto, daneben unsere Buchung und die Abweichung. Fliesst nicht in das Ergebnis ein.',
        NULL, 85)
ON CONFLICT (name) DO UPDATE
   SET bezeichnung = EXCLUDED.bezeichnung,
       beschreibung = EXCLUDED.beschreibung,
       sortierung  = EXCLUDED.sortierung;
