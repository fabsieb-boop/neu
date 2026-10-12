-- Korrekturebene und Buchungsweg der Bestandsbuchungen.
--
-- Eine Admin-Korrektur legt einen Beleg mit Belegart KORR an und ersetzt
-- nur die angezeigte Zeile. Die SAP-Zeile bleibt in controlling.buchungen
-- stehen. v_guv_buchung liest weiter die FI-/CO-Einzelposten, der
-- August-EBITDA aus dem FI bleibt davon unberührt.
--
-- Der Buchungsweg zeigt, von welchem GuV-Konto (leistung_unfertig /
-- leistung_fertig) eine Bestandsbuchung im Soll oder Haben kommt und auf
-- welches Gegenkonto sie geht.

CREATE OR REPLACE FUNCTION controlling.f_bestand_richtung(soll_haben text, betrag numeric)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN upper(btrim(COALESCE(soll_haben, ''))) IN ('S', 'SOLL') THEN 'Soll'
    WHEN upper(btrim(COALESCE(soll_haben, ''))) IN ('H', 'HABEN') THEN 'Haben'
    WHEN COALESCE(betrag, 0) < 0 THEN 'Haben'
    WHEN COALESCE(betrag, 0) > 0 THEN 'Soll'
    ELSE 'ohne Soll/Haben'
  END
$$;

CREATE OR REPLACE FUNCTION controlling.f_bestand_gegenrichtung(soll_haben text, betrag numeric)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE controlling.f_bestand_richtung(soll_haben, betrag)
    WHEN 'Soll' THEN 'Haben'
    WHEN 'Haben' THEN 'Soll'
    ELSE 'Gegenseite'
  END
$$;

CREATE OR REPLACE FUNCTION controlling.f_bestand_weg(
  konto text, konto_name text, kategorie text,
  gegen text, gegen_name text, gegen_kategorie text,
  soll_haben text, betrag numeric
) RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(btrim(konto), '') = '' THEN ''
    ELSE
      'Von ' || konto ||
      COALESCE(' ' || NULLIF(btrim(konto_name), ''), '') ||
      ' (' || COALESCE(NULLIF(btrim(kategorie), ''), 'ohne Kategorie') || ') im ' ||
      controlling.f_bestand_richtung(soll_haben, betrag) ||
      ' nach ' || COALESCE(NULLIF(btrim(gegen), ''), '–') ||
      COALESCE(' ' || NULLIF(btrim(gegen_name), ''), '') ||
      ' (' || COALESCE(NULLIF(btrim(gegen_kategorie), ''), 'ohne Kategorie') || ') im ' ||
      controlling.f_bestand_gegenrichtung(soll_haben, betrag) ||
      CASE
        WHEN upper(btrim(COALESCE(soll_haben, ''))) IN ('S', 'H', 'SOLL', 'HABEN')
          THEN '. Soll/Haben steht im Beleg.'
        ELSE '. Soll/Haben ist im Beleg leer, die Richtung folgt dem Vorzeichen wie bei den übrigen Monaten.'
      END
  END
$$;

CREATE INDEX IF NOT EXISTS idx_buchungen_korr_ersetzt
  ON controlling.buchungen ((quelle->>'ersetzt'))
  WHERE gueltig AND belegart = 'KORR';

CREATE OR REPLACE VIEW controlling.v_buchung AS
 SELECT b.buchung_id,
    b.geschaeftsjahr AS jahr,
    b.periode AS monat,
    b.buchungsdatum,
    b.belegdatum,
    b.belegart,
    b.belegnummer,
    b.waehrung,
    b.kostenstelle,
    b.auftrag,
    COALESCE(p.projekt_nr, b.auftrag) AS projekt_nr,
    COALESCE(p.projektname, b.objektbezeichnung) AS projektname,
    p.projekt_id,
    COALESCE(p.auftragstyp, 'SONSTIGES'::character varying) AS auftragstyp,
    COALESCE(p.regionscode, '--'::character varying) AS regionscode,
    COALESCE(p.region, 'Ohne Zuordnung'::character varying) AS region,
    b.kostenart AS kostenart_nr,
    k.kostenart_id,
    COALESCE(k.bezeichnung, 'Nicht zugeordnet'::character varying) AS kostenart_bez,
    COALESCE(k.klr_typ, 'SONSTIGES'::character varying) AS klr_typ,
    COALESCE(k.klr_gruppe, 'Sonstiges'::character varying) AS klr_gruppe,
    COALESCE(k.guv_gruppe, '8 Sonstige betriebliche Aufwendungen'::character varying) AS guv_gruppe,
    COALESCE(k.sortierung, 999) AS guv_sort,
    COALESCE(k.db_stufe::integer, 2) AS db_stufe,
    b.wert,
    CASE
      WHEN b.belegnummer::text ~~ '80%'::text THEN 'ABRECHNUNG'::text
      WHEN b.belegnummer::text ~~ '9900%'::text THEN 'UMLAGE'::text
      WHEN b.belegnummer::text ~~ '9%'::text THEN 'VERRECHNUNG'::text
      ELSE 'PRIMAER'::text
    END AS belegkreis,
    b.belegnummer::text !~~ '80%'::text AS ergebnisrelevant,
    CASE
      WHEN COALESCE(k.db_stufe::integer, 2) = 0 THEN - b.wert
      ELSE 0::numeric
    END AS leistung,
    CASE
      WHEN COALESCE(k.db_stufe::integer, 2) = 1 THEN b.wert
      ELSE 0::numeric
    END AS k_var,
    CASE
      WHEN COALESCE(k.db_stufe::integer, 2) = 2 AND b.belegnummer::text !~~ '9900%'::text THEN b.wert
      ELSE 0::numeric
    END AS k_fix,
    CASE
      WHEN b.belegnummer::text ~~ '9900%'::text THEN b.wert
      ELSE 0::numeric
    END AS umlage,
    CASE
      WHEN COALESCE(k.db_stufe::integer, 2) = 9 THEN b.wert
      ELSE 0::numeric
    END AS neutral,
    CASE
      WHEN COALESCE(p.auftragstyp, 'SONSTIGES'::character varying)::text = 'PROJEKT'::text THEN 'PROJEKT'::text
      WHEN COALESCE(p.regionscode, '--'::character varying)::text = '50'::text THEN 'ZENTRALE'::text
      WHEN COALESCE(p.auftragstyp, 'SONSTIGES'::character varying)::text = 'INNENAUFTRAG'::text THEN 'BEREICH'::text
      ELSE 'NICHT_ZUGEORDNET'::text
    END AS kostentraeger
   FROM controlling.buchungen b
     LEFT JOIN controlling.projekte p ON p.projekt_id = b.projekt_id
     LEFT JOIN controlling.kostenarten k ON k.kostenart_id = b.kostenart_id
  WHERE b.gueltig
    AND NOT EXISTS (
      SELECT 1
        FROM controlling.buchungen korr
       WHERE korr.gueltig
         AND korr.belegart = 'KORR'
         AND korr.buchung_id <> b.buchung_id
         AND (
           korr.quelle->>'ersetzt' = b.buchung_id::text
           OR (
             COALESCE(korr.quelle->>'sap_beleg', '') <> ''
             AND korr.quelle->>'sap_beleg' = b.belegnummer
             AND COALESCE(korr.quelle->>'sap_zeile', '') = COALESCE(b.buchungszeile::text, '')
             AND korr.quelle->>'sap_jahr' = b.geschaeftsjahr::text
             AND korr.quelle->>'sap_konto' = b.kostenart
             AND COALESCE(korr.quelle->>'sap_auftrag', '') = COALESCE(b.auftrag, '')
           )
         )
    );

CREATE OR REPLACE VIEW controlling.v_bestand_buchungsweg AS
WITH roh AS (
  SELECT e.geschaeftsjahr AS jahr,
         e.monat,
         controlling.f_konto_norm(e.kostenart) AS konto,
         controlling.f_konto_norm(e.konto_gegenbuchung) AS gegenkonto,
         COALESCE(e.soll_haben, '') AS soll_haben,
         e.wert_signed
    FROM controlling.sap_einzelposten e
   WHERE controlling.f_konto_norm(e.kostenart) IN ('390000', '391000', '392000')
),
agg AS (
  SELECT jahr, monat, konto, gegenkonto, soll_haben,
         count(*)::integer AS anzahl,
         round(sum(wert_signed), 2) AS betrag_sap
    FROM roh
   GROUP BY jahr, monat, konto, gegenkonto, soll_haben
)
SELECT a.jahr,
       a.monat,
       a.konto,
       kk.name AS konto_name,
       kk.kategorie::text AS kategorie,
       kk.kategorie_text,
       a.gegenkonto,
       gk.name AS gegen_name,
       gk.kategorie::text AS gegen_kategorie,
       gk.kategorie_text AS gegen_kategorie_text,
       a.soll_haben,
       controlling.f_bestand_richtung(a.soll_haben, a.betrag_sap) AS richtung,
       controlling.f_bestand_gegenrichtung(a.soll_haben, a.betrag_sap) AS gegen_richtung,
       CASE
         WHEN upper(btrim(a.soll_haben)) IN ('S', 'H', 'SOLL', 'HABEN') THEN 'beleg'
         ELSE 'vorzeichen'
       END AS richtung_quelle,
       a.anzahl,
       a.betrag_sap,
       round(-a.betrag_sap, 2) AS betrag_ertrag,
       controlling.f_bestand_weg(
         a.konto, kk.name, kk.kategorie::text,
         a.gegenkonto, gk.name, gk.kategorie::text,
         a.soll_haben, a.betrag_sap) AS weg
  FROM agg a
  LEFT JOIN controlling.kontenkatalog_tvf kk
    ON controlling.f_konto_norm(kk.konto::text) = a.konto
  LEFT JOIN controlling.kontenkatalog_tvf gk
    ON controlling.f_konto_norm(gk.konto::text) = a.gegenkonto;
