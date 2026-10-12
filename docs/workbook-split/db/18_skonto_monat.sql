-- Skonto je Monat aus denselben Buchungen wie die GuV.
-- Die Konten kommen aus dem Kontenkatalog (Name), nicht aus einer festen Nummer.
-- SAP-Vorzeichen: Aufwand positiv. Gezogener Skonto steht auf Erhaltene Skonti
-- im Haben, deshalb wird das Vorzeichen fuer die Anzeige gedreht.
--
-- Satz gezogen = Erhaltene Skonti / Einkauf vor Skonto.
-- Der Einkauf ist der Betriebsaufwand derselben fuehrenden Kontenstelle wie
-- das Konto Erhaltene Skonti (Material und Fremdleistungen), ohne das
-- Skontokonto. Das Skontokonto mindert den Aufwand in der GuV schon und
-- gehoert deshalb nicht in die Basis.
-- Satz gewaehrt rechnet die Seite als Gewaehrte Skonti / (Umsatzerloese +
-- Gewaehrte Skonti), weil der gewaehrte Skonto in den Erloesen schon steckt.

CREATE OR REPLACE VIEW controlling.v_skonto_monat AS
WITH konten AS (
  SELECT controlling.f_konto_norm(konto) AS konto,
         CASE
           WHEN btrim(name) ILIKE 'Erhaltene Skonti%' THEN 'gezogen'
           WHEN btrim(name) ILIKE 'Gewährte Skonti%'
             OR btrim(name) ILIKE 'Gewaehrte Skonti%' THEN 'gewaehrt'
         END AS art
    FROM controlling.kontenkatalog_tvf
   WHERE btrim(name) ILIKE 'Erhaltene Skonti%'
      OR btrim(name) ILIKE 'Gewährte Skonti%'
      OR btrim(name) ILIKE 'Gewaehrte Skonti%'
),
klasse AS (
  SELECT DISTINCT left(konto, 1) AS praefix
    FROM konten
   WHERE art = 'gezogen'
     AND konto <> ''
),
einkauf AS (
  SELECT controlling.f_konto_norm(k.konto) AS konto
    FROM controlling.kontenkatalog_tvf k
    JOIN klasse c ON c.praefix = left(controlling.f_konto_norm(k.konto), 1)
   WHERE k.kategorie = 'betriebsaufwand'
     AND btrim(k.name) NOT ILIKE 'Erhaltene Skonti%'
),
posten AS (
  SELECT b.geschaeftsjahr::integer AS jahr,
         b.monat::integer AS monat,
         k.art,
         b.wert_signed
    FROM controlling.v_guv_buchung b
    JOIN konten k ON k.konto = controlling.f_konto_norm(b.kostenart)
),
basis AS (
  SELECT b.geschaeftsjahr::integer AS jahr,
         b.monat::integer AS monat,
         sum(b.wert_signed) AS einkauf_vor_skonto
    FROM controlling.v_guv_buchung b
    JOIN einkauf e ON e.konto = controlling.f_konto_norm(b.kostenart)
   GROUP BY b.geschaeftsjahr, b.monat
)
SELECT p.jahr,
       p.monat,
       q.quelle,
       round(-COALESCE(sum(p.wert_signed) FILTER (WHERE p.art = 'gezogen'), 0), 2) AS skonto_gezogen,
       count(*) FILTER (WHERE p.art = 'gezogen')::integer AS belege_gezogen,
       round(COALESCE(sum(p.wert_signed) FILTER (WHERE p.art = 'gewaehrt'), 0), 2) AS skonto_gewaehrt,
       count(*) FILTER (WHERE p.art = 'gewaehrt')::integer AS belege_gewaehrt,
       kn.umsatzerloese,
       round(COALESCE(ba.einkauf_vor_skonto, 0), 2) AS einkauf_vor_skonto
  FROM posten p
  JOIN controlling.v_guv_quelle q ON q.jahr = p.jahr AND q.monat = p.monat
  LEFT JOIN controlling.v_kennzahlen_monat kn ON kn.jahr = p.jahr AND kn.monat = p.monat
  LEFT JOIN basis ba ON ba.jahr = p.jahr AND ba.monat = p.monat
 GROUP BY p.jahr, p.monat, q.quelle, kn.umsatzerloese, ba.einkauf_vor_skonto;
