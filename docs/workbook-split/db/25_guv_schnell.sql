-- Dieselbe Kontenzuordnung wie in db/10, nur ohne den Vergleich jeder Buchung
-- mit jedem GuV-Konto. Beträge bleiben gleich. Die Dashboard-Daten und der
-- Forecast je Region warten sonst mehrere Sekunden auf diese beiden Sichten.

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
