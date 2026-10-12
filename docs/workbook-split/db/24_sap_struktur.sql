/* ---------------------------------------------------------------------------
   SAP-Bilanz-/GuV-Struktur im Original
   ---------------------------------------------------------------------------
   Die Auswertung "Bilanz/GuV" aus SAP liefert eine fertig gegliederte
   Hierarchie: Positionsueberschriften, darunter die Konten, darunter die
   Zwischensumme.  Genau diese Gliederung wird hier eins zu eins abgelegt,
   damit das Cockpit die GuV in derselben Form zeigen kann wie SAP selbst.

   Bewusst KEINE eigene Systematik: die Zeilen behalten ihre Reihenfolge
   (lfd), ihre Hierarchiestufe und ihre Positionsnummer aus dem Export.
   Unsere eigene Kostenarten-Systematik bleibt davon unberuehrt.
--------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS controlling.sap_struktur (
  struktur_id      bigserial PRIMARY KEY,
  buchungskreis    text        NOT NULL,
  jahr             smallint    NOT NULL,
  periode          smallint    NOT NULL,   -- 16 = Abschluss
  art              text        NOT NULL CHECK (art IN ('GUV','BILANZ')),
  lfd              integer     NOT NULL,   -- Reihenfolge im Export
  stufe            smallint    NOT NULL,   -- Hierachiestufe (Einrueckung)
  position         text        NOT NULL,   -- Bilanz/GuV-Position aus SAP
  zeilentyp        text        NOT NULL CHECK (zeilentyp IN ('POSITION','KONTO','SUMME')),
  text             text        NOT NULL,
  kontonummer      text,
  berichtsperiode  numeric(18,2) NOT NULL DEFAULT 0,
  vergleichsperiode numeric(18,2) NOT NULL DEFAULT 0,
  UNIQUE (buchungskreis, jahr, periode, art, lfd)
);

CREATE INDEX IF NOT EXISTS ix_sap_struktur_lauf
  ON controlling.sap_struktur (buchungskreis, jahr, periode, art, lfd);
CREATE INDEX IF NOT EXISTS ix_sap_struktur_konto
  ON controlling.sap_struktur (kontonummer) WHERE kontonummer IS NOT NULL;

COMMENT ON TABLE controlling.sap_struktur IS
  'Bilanz-/GuV-Gliederung im Original aus SAP, Zeile fuer Zeile.';

/* ---------------------------------------------------------------------------
   Welche Laeufe liegen vor?  Fuer die Auswahlliste der Seite.
--------------------------------------------------------------------------- */
CREATE OR REPLACE VIEW controlling.v_sap_lauf AS
SELECT buchungskreis, jahr, periode, art,
       count(*)                                   AS zeilen,
       count(*) FILTER (WHERE zeilentyp = 'KONTO') AS konten
  FROM controlling.sap_struktur
 GROUP BY 1,2,3,4;

/* ---------------------------------------------------------------------------
   Kontosalden je Region aus unseren eigenen Buchungen.
   ---------------------------------------------------------------------------
   Damit laesst sich dieselbe SAP-Gliederung je Niederlassung fuellen.
   Der Buchungskreis ist in allen vorliegenden Exporten 4102; die einzige
   Untergliederung, die die Daten hergeben, ist die Niederlassung.
--------------------------------------------------------------------------- */
CREATE OR REPLACE VIEW controlling.v_konto_region AS
SELECT b.jahr,
       b.monat,
       replace(b.kostenart_nr, '.0', '') AS kontonummer,
       b.regionscode,
       b.region,
       sum(b.wert) AS wert
  FROM controlling.v_buchung b
 WHERE b.ergebnisrelevant
 GROUP BY 1,2,3,4,5;

GRANT SELECT ON controlling.sap_struktur, controlling.v_sap_lauf,
                controlling.v_konto_region TO PUBLIC;
