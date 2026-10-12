/* ---------------------------------------------------------------------------
   Die Kostenverfolgung der Projektleitung
   ---------------------------------------------------------------------------
   Nicht zu verwechseln mit kv_dashboard: das ist die Sammeldatei, die je
   PSP-Element zwei Summen traegt.  Hier geht es um die Datei, die jede
   Projektleitung selbst fuehrt - eine Mappe je Projekt, neun Blaetter, und
   vorn das Uebersichtsblatt.  Es traegt die Staffel von der Auftragssumme
   bis zum Ergebnis, und zwar dreifach: wie kalkuliert, wie nachkalkuliert
   und wie es aktuell steht.

   Diese Werte gehen nie in die Ergebnisrechnung - dort gilt SAP.  Sie sind
   der Gegenwert dazu: was die Projektleitung erwartet, gegen das, was
   gebucht ist.  Aus ihnen speist sich die Spalte "FC Kostenverfolgung" im
   Rolling Forecast.

   Die Werte stehen als lange Tabelle, nicht als vierzig Spalten.  Das
   Uebersichtsblatt ist ein Formular, und Formulare bekommen Zeilen dazu;
   eine neue Kostenart soll den Import nicht brechen, sondern einfach als
   weiterer Block ankommen.  Zum Lesen gibt es die Sicht v_kv_deckblatt.
--------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS controlling.kv_deckblatt (
  psp            varchar(20) PRIMARY KEY,
  projekttitel   varchar(255),
  auftraggeber   varchar(255),
  region         varchar(60),
  beginn         date,
  erfuellung     numeric(12,4),
  quelle_datei   varchar(200),
  stand          date,
  eingelesen_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE controlling.kv_deckblatt IS
  'Kopf des Uebersichtsblatts je Projekt-Kostenverfolgung. Vergleichsgroesse, nie Ergebnisrechnung.';

CREATE TABLE IF NOT EXISTS controlling.kv_deckblatt_wert (
  psp     varchar(20) NOT NULL REFERENCES controlling.kv_deckblatt(psp) ON DELETE CASCADE,
  block   varchar(40) NOT NULL,
  rolle   varchar(20) NOT NULL,
  betrag  numeric(18,2) NOT NULL,
  PRIMARY KEY (psp, block, rolle)
);
COMMENT ON TABLE controlling.kv_deckblatt_wert IS
  'Werte des Uebersichtsblatts: block = Umsatz, Personalkosten, ...; rolle = kalkuliert, nachkalkuliert, aktuell, differenz.';

CREATE INDEX IF NOT EXISTS kv_deckblatt_wert_block_idx
  ON controlling.kv_deckblatt_wert (block, rolle);

/* ---------------------------------------------------------------------------
   Zum Lesen: eine Zeile je Projekt.
--------------------------------------------------------------------------- */
CREATE OR REPLACE VIEW controlling.v_kv_deckblatt AS
SELECT d.psp,
       d.projekttitel,
       d.auftraggeber,
       d.region,
       d.beginn,
       d.erfuellung,
       d.stand,
       d.quelle_datei,
       max(w.betrag) FILTER (WHERE w.block='umsatz'          AND w.rolle='vertrag')   AS umsatz_vertrag,
       max(w.betrag) FILTER (WHERE w.block='umsatz'          AND w.rolle='nachtraege') AS umsatz_nachtraege,
       max(w.betrag) FILTER (WHERE w.block='umsatz'          AND w.rolle='aktuell')   AS umsatz_aktuell,
       max(w.betrag) FILTER (WHERE w.block='gesamtumsatz'    AND w.rolle='kalkuliert') AS gesamtumsatz_kalk,
       max(w.betrag) FILTER (WHERE w.block='gesamtumsatz'    AND w.rolle='aktuell')   AS gesamtumsatz_ist,
       max(w.betrag) FILTER (WHERE w.block='personalkosten'  AND w.rolle='kalkuliert') AS personal_kalk,
       max(w.betrag) FILTER (WHERE w.block='personalkosten'  AND w.rolle='aktuell')   AS personal_ist,
       max(w.betrag) FILTER (WHERE w.block='geraetekosten'   AND w.rolle='kalkuliert') AS geraete_kalk,
       max(w.betrag) FILTER (WHERE w.block='geraetekosten'   AND w.rolle='aktuell')   AS geraete_ist,
       max(w.betrag) FILTER (WHERE w.block='fremdleistungen' AND w.rolle='kalkuliert') AS fremd_kalk,
       max(w.betrag) FILTER (WHERE w.block='fremdleistungen' AND w.rolle='aktuell')   AS fremd_ist,
       max(w.betrag) FILTER (WHERE w.block='sonstige_kosten' AND w.rolle='kalkuliert') AS sonstige_kalk,
       max(w.betrag) FILTER (WHERE w.block='sonstige_kosten' AND w.rolle='aktuell')   AS sonstige_ist,
       max(w.betrag) FILTER (WHERE w.block='schrott'         AND w.rolle='kalkuliert') AS schrott_kalk,
       max(w.betrag) FILTER (WHERE w.block='schrott'         AND w.rolle='aktuell')   AS schrott_ist,
       max(w.betrag) FILTER (WHERE w.block='vvk'             AND w.rolle='aktuell')   AS vvk_ist,
       max(w.betrag) FILTER (WHERE w.block='bestellungen'    AND w.rolle='aktuell')   AS bestellungen_offen,
       max(w.betrag) FILTER (WHERE w.block='gesamtkosten'    AND w.rolle='kalkuliert') AS gesamtkosten_kalk,
       max(w.betrag) FILTER (WHERE w.block='gesamtkosten'    AND w.rolle='aktuell')   AS gesamtkosten_ist,
       max(w.betrag) FILTER (WHERE w.block='ergebnis'        AND w.rolle='kalkuliert') AS ergebnis_kalk,
       max(w.betrag) FILTER (WHERE w.block='ergebnis'        AND w.rolle='aktuell')   AS ergebnis_ist
  FROM controlling.kv_deckblatt d
  LEFT JOIN controlling.kv_deckblatt_wert w ON w.psp = d.psp
 GROUP BY d.psp, d.projekttitel, d.auftraggeber, d.region, d.beginn,
          d.erfuellung, d.stand, d.quelle_datei;

COMMENT ON VIEW controlling.v_kv_deckblatt IS
  'Uebersichtsblatt je Projekt, eine Zeile: kalkuliert gegen aktuell.';

GRANT SELECT ON controlling.v_kv_deckblatt TO PUBLIC;
