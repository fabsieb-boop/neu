-- Kontenzuordnung: eine Schreibweise, eine Kategorie.
--
-- Vorher zog jede Schicht eine eigene Grenze:
--   * f_konto_norm hat mit lpad(..., 6) aufgefuellt und dabei laengere
--     Konten abgeschnitten (7611100 wurde 761110) und kuerzere aufgepolstert
--     (49951 wurde 049951). Verknuepfungen, die nur eine Seite normalisierten,
--     trafen das Konto deshalb nicht.
--   * Nummernkreis, Kontenkatalog, Kontenmapping und die SAP-Position
--     ordneten dieselben Sachkonten verschiedenen Ergebnisschichten zu.
--
-- Massgeblich ist die SAP-Position aus bilanz_guv_konto.

CREATE OR REPLACE FUNCTION controlling.f_konto_norm(konto text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE
    WHEN btrim(COALESCE(konto, '')) ~ '^[0-9]+(\.0+)?$' THEN
      -- Fuehrende Nullen und ein Excel-Suffix ".0" abstreifen, nie abschneiden.
      -- 049951, 49951 und 49951.0 sind dasselbe Konto. 7611100 bleibt 7611100.
      NULLIF(ltrim(regexp_replace(btrim(konto), '\.0+$', ''), '0'), '')
    ELSE upper(btrim(COALESCE(konto, '')))
  END
$$;

CREATE OR REPLACE FUNCTION controlling.f_db_stufe(konto integer) RETURNS smallint
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE
    WHEN konto BETWEEN 830000 AND 869999 THEN 0
    WHEN konto IN (890100, 890200, 890300, 890800) THEN 0
    WHEN konto BETWEEN 390000 AND 399999 THEN 0
    -- SAP-Position 003043 bleibt sonstiger Ertrag im EBITDA, gehoert aber nicht
    -- in die Betriebsleistung. Die ist Umsatz plus Bestandsveraenderung.
    -- Stufe 9 haelt 252000, 274200 und 287090 aus DB I heraus.
    WHEN konto IN (201000,231000,231500,240000,243000,251000,251300,
                   252000,272000,273000,273200,273500,274200,287090,890010) THEN 9
    WHEN konto BETWEEN 210000 AND 213999 THEN 9
    WHEN konto IN (265001,265900,287095) THEN 9
    WHEN konto IN (220000,221200,278000,278100,401030,430010,430020,430040) THEN 9
    WHEN konto IN (289200,289300,499200,499300) THEN 9
    WHEN konto BETWEEN 300000 AND 319999 THEN 1
    WHEN konto = 330900 THEN 1
    WHEN konto BETWEEN 340000 AND 359999 THEN 1
    WHEN konto = 401000 THEN 1
    WHEN konto = 420060 THEN 1
    WHEN konto = 440050 THEN 1
    WHEN konto BETWEEN 7611000 AND 7611999 THEN 1
    WHEN konto = 7612000 THEN 1
    ELSE 2
  END::smallint
$$;

CREATE OR REPLACE FUNCTION controlling.f_klr_typ(konto integer) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE
    WHEN konto BETWEEN 830000 AND 869999 THEN 'ERLOES'
    WHEN konto IN (890100, 890300) THEN 'ERLOESSCHMAELERUNG'
    WHEN konto IN (890200, 890800) THEN 'ERLOES'
    WHEN konto BETWEEN 390000 AND 399999 THEN 'BESTANDSVERAENDERUNG'
    WHEN konto IN (252000, 274200, 287090) THEN 'SONSTIGER_ERTRAG'
    WHEN konto IN (251000,251300,265001,265900,272000,273000,273200,273500,287095,890010)
      THEN 'NEUTRALER_ERTRAG'
    WHEN konto IN (201000,231000,231500,240000,243000) THEN 'NEUTRALER_AUFWAND'
    WHEN konto BETWEEN 210000 AND 213999 THEN 'ZINSEN'
    WHEN konto IN (220000,221200,278000,278100,401030,430010,430020,430040) THEN 'STEUERN'
    WHEN konto IN (289200,289300,499200,499300) THEN 'KALKULATORISCH'
    WHEN konto BETWEEN 300000 AND 339999 THEN 'MATERIAL'
    WHEN konto BETWEEN 340000 AND 359999 THEN 'FREMDLEISTUNG'
    WHEN konto BETWEEN 7611000 AND 7611999 THEN 'LOHNVERRECHNUNG'
    WHEN konto = 7612000 THEN 'GERAETEVERRECHNUNG'
    WHEN konto = 7801020 THEN 'GEMEINKOSTENUMLAGE'
    WHEN konto BETWEEN 400000 AND 409999 THEN 'FUHRPARK'
    WHEN konto BETWEEN 410000 AND 419999 THEN 'PERSONAL'
    WHEN konto BETWEEN 420000 AND 429999 THEN 'RAUM_ANLAGEN'
    WHEN konto BETWEEN 430000 AND 439999 THEN 'VERSICHERUNG_MIETE'
    WHEN konto BETWEEN 440000 AND 449999 THEN 'TRANSPORT'
    WHEN konto BETWEEN 450000 AND 459999 THEN 'REISE_WERBUNG'
    WHEN konto BETWEEN 460000 AND 469999 THEN 'VERWALTUNG'
    WHEN konto BETWEEN 470000 AND 479999 THEN 'BERATUNG_UMLAGE'
    WHEN konto BETWEEN 480000 AND 489999 THEN 'ABSCHREIBUNG'
    ELSE 'SONSTIGES'
  END
$$;

CREATE OR REPLACE FUNCTION controlling.f_guv_gruppe(konto integer) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE
    WHEN konto BETWEEN 830000 AND 869999
      OR konto IN (890100,890200,890300,890800) THEN '1 Umsatzerlöse'
    WHEN konto BETWEEN 390000 AND 399999 THEN '2 Bestandsveränderungen'
    WHEN konto IN (251000,251300,252000,273000,273200,274200,287090)
      THEN '3 Sonstige betriebliche Erträge'
    WHEN konto BETWEEN 300000 AND 339999 THEN '4 Materialaufwand'
    WHEN konto BETWEEN 340000 AND 359999 THEN '5 Aufwand für bezogene Leistungen'
    WHEN konto BETWEEN 410000 AND 419999
      OR konto BETWEEN 7611000 AND 7611999 THEN '6 Personalaufwand'
    WHEN konto BETWEEN 480000 AND 489999 THEN '7 Abschreibungen'
    WHEN konto IN (289200,289300,499200,499300) THEN '9 Kalkulatorische Kosten'
    WHEN konto BETWEEN 210000 AND 213999
      OR konto IN (265001,265900,287095) THEN '10 Zinsergebnis'
    WHEN konto IN (220000,221200,278000,278100,401030,430010,430020,430040)
      THEN '11 Steuern vom Einkommen und Ertrag'
    WHEN konto IN (201000,231000,231500,240000,243000,272000,273500,890010)
      THEN '12 Periodenfremdes Ergebnis'
    ELSE '8 Sonstige betriebliche Aufwendungen'
  END
$$;

CREATE OR REPLACE FUNCTION controlling.f_klr_gruppe(konto integer) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE
    WHEN konto BETWEEN 830000 AND 869999
      OR konto IN (890100,890200,890300,890800) THEN 'Umsatzerlöse'
    WHEN konto IN (252000, 274200, 287090) THEN 'Sonstige betriebliche Erträge'
    WHEN konto BETWEEN 390000 AND 399999 THEN 'Bestandsveränderung'
    WHEN konto BETWEEN 300000 AND 359999 THEN 'Material und Fremdleistungen'
    WHEN konto BETWEEN 7611000 AND 7612999
      OR konto = 7801020 THEN 'Innerbetriebliche Verrechnung'
    WHEN konto = 401030 THEN 'Versicherungen, Mieten, Steuern'
    WHEN konto BETWEEN 400000 AND 409999 THEN 'Fuhrpark'
    WHEN konto BETWEEN 410000 AND 419999 THEN 'Personal'
    WHEN konto BETWEEN 420000 AND 429999 THEN 'Raum, Energie, Instandhaltung'
    WHEN konto BETWEEN 430000 AND 439999 THEN 'Versicherungen, Mieten, Steuern'
    WHEN konto BETWEEN 440000 AND 459999 THEN 'Transport, Reise, Werbung'
    WHEN konto BETWEEN 460000 AND 479999 THEN 'Verwaltung und Beratung'
    WHEN konto BETWEEN 480000 AND 489999 THEN 'Abschreibungen'
    WHEN konto BETWEEN 499000 AND 499999
      OR konto BETWEEN 289000 AND 289999 THEN 'Kalkulatorische Kosten'
    WHEN konto BETWEEN 210000 AND 213999
      OR konto IN (265001,265900,287095) THEN 'Zinsergebnis'
    ELSE 'Sonstiges'
  END
$$;

-- Sonstiger Ertrag bleibt Ertrag, auch wenn er nicht in der Betriebsleistung steht.
CREATE OR REPLACE FUNCTION controlling.f_kontoart(konto integer) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE
    WHEN controlling.f_klr_typ(konto) = 'BESTANDSVERAENDERUNG' THEN 'bestandsveraenderung'
    WHEN controlling.f_db_stufe(konto) = 0                     THEN 'ertrag'
    WHEN controlling.f_klr_typ(konto) = 'SONSTIGER_ERTRAG'     THEN 'ertrag'
    WHEN controlling.f_klr_typ(konto) = 'ZINSEN'               THEN 'finanz'
    WHEN controlling.f_klr_typ(konto) = 'STEUERN'              THEN 'steuern'
    WHEN controlling.f_klr_typ(konto) IN ('NEUTRALER_ERTRAG','NEUTRALER_AUFWAND','KALKULATORISCH')
                                                               THEN 'neutral'
    WHEN controlling.f_klr_typ(konto) = 'ABSCHREIBUNG'         THEN 'afa'
    ELSE 'aufwand'
  END
$$;

-- Kostenartenstamm aus den korrigierten Regeln nachziehen.
UPDATE controlling.kostenarten a
   SET db_stufe = controlling.f_db_stufe(a.kontonummer),
       klr_typ = controlling.f_klr_typ(a.kontonummer),
       guv_gruppe = controlling.f_guv_gruppe(a.kontonummer),
       klr_gruppe = controlling.f_klr_gruppe(a.kontonummer),
       kontoart = controlling.f_kontoart(a.kontonummer),
       einzelkosten = controlling.f_einzelkosten(a.kontonummer),
       sortierung = controlling.f_sortierung(a.kontonummer),
       variabel = controlling.f_db_stufe(a.kontonummer) = 1
 WHERE a.kontonummer IN (252000, 272000, 273500, 274200, 286900, 287090, 401030, 890010);

UPDATE controlling.kostenarten
   SET bezeichnung = 'Verrechnete Erlöse aus Anlagenverkauf',
       ebitda_relevant = false
 WHERE kontonummer = 272000;

UPDATE controlling.kostenarten
   SET bezeichnung = 'Erträge Mahngebühren',
       ebitda_relevant = true
 WHERE kontonummer = 287090;

UPDATE controlling.kostenarten SET ebitda_relevant = true
 WHERE kontonummer IN (252000, 274200, 286900);

UPDATE controlling.kostenarten SET ebitda_relevant = false
 WHERE kontonummer IN (273500, 401030, 890010);

-- Planungsgruppe und Kostenblock folgen derselben SAP-Position, nicht dem alten Nummernkreis.
UPDATE controlling.kostenarten SET planungsgruppe = 'Sonstige betriebliche Erträge', sap_guv_position = 'Andere sonstige betriebliche Erträge', kostenblock = NULL
 WHERE kontonummer IN (252000, 274200, 287090);
UPDATE controlling.kostenarten SET planungsgruppe = 'Neutrales / periodenfremdes Ergebnis', sap_guv_position = 'Uebrige neutrale Ertraege', kostenblock = NULL
 WHERE kontonummer IN (272000, 273500, 890010);
UPDATE controlling.kostenarten SET planungsgruppe = 'Sonstige betriebliche Aufwendungen', sap_guv_position = 'sonst. Betriebl. Aufwendungen', kostenblock = NULL
 WHERE kontonummer = 286900;
UPDATE controlling.kostenarten SET planungsgruppe = 'Steuern vom Einkommen und Ertrag', sap_guv_position = 'Sonstige Steuern', kostenblock = NULL
 WHERE kontonummer = 401030;

UPDATE controlling.kontenstamm_tvf SET planungsgruppe = 'Sonstige betriebliche Erträge', sap_guv_position = 'Andere sonstige betriebliche Erträge', kostenblock = NULL
 WHERE controlling.f_konto_norm(konto) IN ('252000', '274200');
UPDATE controlling.kontenstamm_tvf SET planungsgruppe = 'Neutrales / periodenfremdes Ergebnis', sap_guv_position = 'Uebrige neutrale Ertraege', kostenblock = NULL
 WHERE controlling.f_konto_norm(konto) IN ('273500', '890010');
UPDATE controlling.kontenstamm_tvf SET planungsgruppe = 'Sonstige betriebliche Aufwendungen', sap_guv_position = 'sonst. Betriebl. Aufwendungen', kostenblock = NULL
 WHERE controlling.f_konto_norm(konto) = '286900';
UPDATE controlling.kontenstamm_tvf SET planungsgruppe = 'Steuern vom Einkommen und Ertrag', sap_guv_position = 'Sonstige Steuern', kostenblock = NULL
 WHERE controlling.f_konto_norm(konto) = '401030';

-- Kontenmapping der Ergebnisrechnung auf die SAP-Position ziehen.
UPDATE controlling.kontenmapping_guv
   SET kategorie = 'Steuern'
 WHERE controlling.f_konto_norm(konto) IN ('401030', '430010', '430040');

UPDATE controlling.kontenmapping_guv
   SET kategorie = 'Neutrales Ergebnis (nicht EBITDA)'
 WHERE controlling.f_konto_norm(konto) IN ('272000', '273500', '890010');

-- Sekundaere CO-Konten (Arbeitsplatz, ERP, Druck) haben keine GuV-Position.
-- Im FI-Monat August standen sie trotzdem im Betriebsaufwand und rissen
-- die Ergebnisstaffel um 5.059 Euro von den Einzelposten ab.
UPDATE controlling.kontenmapping_guv
   SET kategorie = 'Verrechnung/kalkulatorisch'
 WHERE controlling.f_konto_norm(konto) IN ('560002', '560004', '560006', '560009');

UPDATE controlling.kontenkatalog_tvf
   SET kategorie = 'verrechnung_sap',
       kategorie_text = 'Innerbetriebliche Verrechnung (keine GuV-Position)'
 WHERE controlling.f_konto_norm(konto) IN
       ('560002', '560004', '560006', '560007', '560008', '560009');

UPDATE controlling.kostenarten
   SET bezeichnung = CASE kontonummer
         WHEN 560002 THEN 'Arbeitsplatz'
         WHEN 560004 THEN 'Druck & Scanservices'
         WHEN 560006 THEN 'ERP-Systeme'
         WHEN 560007 THEN 'HR-Systeme'
         WHEN 560008 THEN 'Mobile Communications'
         WHEN 560009 THEN 'Sonstige Software'
       END,
       ebitda_relevant = false
 WHERE kontonummer IN (560002, 560004, 560006, 560007, 560008, 560009);

-- Katalog: Kfz-Steuer stand als Betriebsaufwand, der Text sagte schon "Sonstige Steuern".
UPDATE controlling.kontenkatalog_tvf
   SET kategorie = 'steuern_sonstige',
       kategorie_text = 'Sonstige Steuern'
 WHERE controlling.f_konto_norm(konto) = '401030';

-- Steuernachzahlung liegt in der GuV-Position 006011, nicht auf einem Bilanzkonto.
UPDATE controlling.kontenkatalog_tvf
   SET kategorie = 'ertragsteuer',
       kategorie_text = 'Steuern vom Einkommen und Ertrag'
 WHERE controlling.f_konto_norm(konto) = '277100'
   AND kategorie = 'bilanz_steuern';

UPDATE controlling.kontenstamm_tvf
   SET kontoart = 'steuern', ebitda_relevant = false
 WHERE controlling.f_konto_norm(konto) = '401030';

UPDATE controlling.kontenstamm_tvf
   SET kontoart = 'ertrag', ebitda_relevant = true
 WHERE controlling.f_konto_norm(konto) IN ('252000', '274200');

UPDATE controlling.kontenstamm_tvf
   SET kontoart = 'aufwand', ebitda_relevant = true
 WHERE controlling.f_konto_norm(konto) = '286900';

UPDATE controlling.kontenstamm_tvf
   SET kontoart = 'neutral', ebitda_relevant = false
 WHERE controlling.f_konto_norm(konto) IN ('890010', '273500');

-- Bestandsveraenderung bucht auf das Konto, das im Journal steht, nicht auf 049951.
UPDATE controlling.app_einstellung
   SET wert = '49951'
 WHERE schluessel = 'bv_konto_bestand'
   AND wert IN ('049951', '0049951');

-- Verknuepfungen normalisieren beide Seiten, sonst trifft 49951 nicht 049951.
CREATE OR REPLACE VIEW controlling.v_kennzahlen_monat AS
 WITH e AS (
         SELECT x.geschaeftsjahr AS jahr,
            x.monat,
            m.kategorie AS kat,
            (- x.wert_signed) AS w
           FROM controlling.v_guv_buchung x
             JOIN controlling.kontenmapping_guv m
               ON controlling.f_konto_norm(m.konto::text) = controlling.f_konto_norm(x.kostenart::text)
          WHERE x.monat >= 1 AND x.monat <= 12
        )
 SELECT jahr,
    monat,
    COALESCE(sum(w) FILTER (WHERE kat::text = 'Umsatzerlöse'), 0::numeric) AS umsatzerloese,
    COALESCE(sum(w) FILTER (WHERE kat::text = 'Bestandsveränderung'), 0::numeric) AS bestandsveraenderung,
    COALESCE(sum(w) FILTER (WHERE kat::text = ANY (ARRAY['Umsatzerlöse','Bestandsveränderung'])), 0::numeric) AS gesamtleistung,
    COALESCE(sum(w) FILTER (WHERE kat::text = ANY (ARRAY['Umsatzerlöse','Bestandsveränderung','Sonstige betriebliche Erträge','Betriebsaufwand (EBITDA-wirksam)'])), 0::numeric) AS ebitda,
    COALESCE(sum(w) FILTER (WHERE kat::text = 'Neutrales Ergebnis (nicht EBITDA)'), 0::numeric) AS neutrales_ergebnis,
    COALESCE(sum(w) FILTER (WHERE kat::text = ANY (ARRAY['Umsatzerlöse','Bestandsveränderung','Sonstige betriebliche Erträge','Betriebsaufwand (EBITDA-wirksam)','Neutrales Ergebnis (nicht EBITDA)'])), 0::numeric) AS ebitda_nach_neutral,
    COALESCE(sum(w) FILTER (WHERE kat::text = 'Abschreibungen'), 0::numeric) AS abschreibungen,
    COALESCE(sum(w) FILTER (WHERE kat::text = 'Zinsen und Finanzergebnis'), 0::numeric) AS finanzergebnis
   FROM e
  GROUP BY jahr, monat;

CREATE OR REPLACE VIEW controlling.v_guv_kategorie_monat AS
 SELECT e.geschaeftsjahr AS jahr,
    e.monat,
    COALESCE(m.kategorie, 'nicht zugeordnet'::character varying) AS kategorie,
    - sum(e.wert_signed) AS betrag,
    count(*) AS belege,
    count(DISTINCT e.kostenart) AS konten
   FROM controlling.v_guv_buchung e
     LEFT JOIN controlling.kontenmapping_guv m
       ON controlling.f_konto_norm(m.konto::text) = controlling.f_konto_norm(e.kostenart::text)
  WHERE e.geschaeftsjahr IS NOT NULL AND e.monat IS NOT NULL
  GROUP BY e.geschaeftsjahr, e.monat, COALESCE(m.kategorie, 'nicht zugeordnet'::character varying);

-- Konto einmal normalisieren und dann per Hash verbinden.
-- Die alte Form hat jede Buchung mit jedem GuV-Konto verglichen und die Seite blockiert.
CREATE OR REPLACE VIEW controlling.v_guv_ist AS
WITH buchung AS MATERIALIZED (
  SELECT controlling.f_konto_norm(e.kostenart::text) AS konto,
         e.wert_signed,
         EXTRACT(year FROM e.buchungsdatum)::integer AS jahr,
         EXTRACT(month FROM e.buchungsdatum)::integer AS monat
    FROM controlling.v_guv_buchung e
   WHERE e.buchungsdatum IS NOT NULL
),
katalog AS MATERIALIZED (
  SELECT controlling.f_konto_norm(k.konto::text) AS konto,
         k.name,
         k.kategorie,
         k.kategorie_text
    FROM controlling.kontenkatalog_tvf k
   WHERE controlling.f_ist_guv_konto(k.kategorie::text)
),
guvpos AS MATERIALIZED (
  SELECT DISTINCT controlling.f_konto_norm(b.konto::text) AS konto
    FROM controlling.bilanz_guv_konto b
   WHERE left(b.position::text, 4) = ANY (ARRAY['0030','0040'])
)
SELECT e.konto,
       k.name AS kontobezeichnung,
       k.kategorie,
       k.kategorie_text,
       e.jahr,
       e.monat,
       sum(e.wert_signed) AS wert,
       count(*) AS belege
  FROM buchung e
  JOIN katalog k ON k.konto = e.konto
  JOIN guvpos g ON g.konto = e.konto
 GROUP BY e.konto, k.name, k.kategorie, k.kategorie_text, e.jahr, e.monat;

CREATE OR REPLACE VIEW controlling.v_guv_region AS
WITH buchung AS MATERIALIZED (
  SELECT controlling.f_region_voll(e.auftrag::text, e.kostenstelle::text) AS region,
         controlling.f_konto_norm(e.kostenart::text) AS konto,
         EXTRACT(year FROM e.buchungsdatum)::integer AS jahr,
         EXTRACT(month FROM e.buchungsdatum)::integer AS monat,
         (e.auftrag IS NOT NULL) AS auftragsbezogen,
         e.wert_signed
    FROM controlling.v_guv_buchung e
   WHERE e.buchungsdatum IS NOT NULL
),
katalog AS MATERIALIZED (
  SELECT controlling.f_konto_norm(k.konto::text) AS konto,
         k.name,
         k.kategorie,
         k.kategorie_text
    FROM controlling.kontenkatalog_tvf k
   WHERE controlling.f_ist_guv_konto(k.kategorie::text)
),
guvpos AS MATERIALIZED (
  SELECT DISTINCT controlling.f_konto_norm(b.konto::text) AS konto
    FROM controlling.bilanz_guv_konto b
   WHERE left(b.position::text, 4) = ANY (ARRAY['0030','0040'])
)
SELECT e.region,
       e.konto,
       k.name AS kontobezeichnung,
       k.kategorie,
       k.kategorie_text,
       e.jahr,
       e.monat,
       e.auftragsbezogen,
       sum(e.wert_signed) AS wert,
       count(*) AS belege
  FROM buchung e
  JOIN katalog k ON k.konto = e.konto
  JOIN guvpos g ON g.konto = e.konto
 GROUP BY e.region, e.konto, k.name, k.kategorie, k.kategorie_text, e.jahr, e.monat, e.auftragsbezogen;

CREATE OR REPLACE VIEW controlling.v_kontenzuordnung_abgleich AS
 SELECT b.konto,
    b.text AS bezeichnung,
    b.position,
    p.text AS position_text,
    k.kategorie AS katalog_kategorie,
    (left(b.position::text, 4) = ANY (ARRAY['0030','0040','0060'])) AS sap_guv,
    (controlling.f_ist_guv_konto(k.kategorie::text) OR k.kategorie::text = 'ertragsteuer') AS katalog_guv
   FROM controlling.bilanz_guv_konto b
     JOIN controlling.bilanz_guv_position p ON p.position::text = b.position::text
     LEFT JOIN controlling.kontenkatalog_tvf k
       ON controlling.f_konto_norm(k.konto::text) = controlling.f_konto_norm(b.konto::text)
  WHERE (left(b.position::text, 4) = ANY (ARRAY['0030','0040','0060']))
        IS DISTINCT FROM COALESCE(controlling.f_ist_guv_konto(k.kategorie::text) OR k.kategorie::text = 'ertragsteuer', false);

CREATE OR REPLACE VIEW controlling.v_kontenplan_abweichung AS
 SELECT m.konto,
    COALESCE(b.text, m.bezeichnung) AS bezeichnung,
    m.kategorie AS kontenplan,
    b.position AS sap_position,
    p.text AS sap_text,
    COALESCE(( SELECT - sum(e.wert_signed)
           FROM controlling.sap_einzelposten e
          WHERE controlling.f_konto_norm(e.kostenart::text) = controlling.f_konto_norm(m.konto::text)
            AND e.geschaeftsjahr = 2026), 0::numeric) AS betrag_jahr
   FROM controlling.kontenmapping_guv m
     LEFT JOIN controlling.bilanz_guv_konto b
       ON controlling.f_konto_norm(b.konto::text) = controlling.f_konto_norm(m.konto::text)
     LEFT JOIN controlling.bilanz_guv_position p ON p.position::text = b.position::text
  WHERE b.position IS NOT NULL
    AND ((m.kategorie::text = ANY (ARRAY['Umsatzerlöse','Bestandsveränderung','Sonstige betriebliche Erträge','Betriebsaufwand (EBITDA-wirksam)']))
         IS DISTINCT FROM (left(b.position::text, 4) = '0030'
           AND b.position::text !~~ '00307%'
           AND b.position::text !~~ '003041%'
           AND b.position::text !~~ '00308108%'));
