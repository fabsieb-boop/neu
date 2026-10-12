-- Umlagen je Region und Monat aus den KLR-Buchungen.
-- Die Arten kommen aus dem Kostenartenstamm (klr_typ), nicht aus einer Kontonummer.
-- Jeder Monat mit Kostentraegerrechnung oder mit einer dieser Buchungen bekommt
-- eine Zeile. Monate ohne Innenverrechnung bleiben mit Betrag 0 sichtbar, damit
-- die Seite den Monat selbst waehlen kann.
--
-- Geraete: Empfaengerzeile der Verrechnung (positiv, Kostenstelle mit Leistungsart).
-- V+V: Entlastung der Bereichskostenstellen auf dem Gemeinkostenzuschlag.
-- Verwaltung: direkt in der Region, und der Block der Zentrale. Den Anteil der
-- Zentrale auf den Umsatz rechnet die Seite.

DROP VIEW IF EXISTS controlling.v_umlage_region;

CREATE VIEW controlling.v_umlage_region AS
WITH monate AS (
  SELECT v.jahr::integer AS jahr, v.monat::integer AS monat
    FROM controlling.v_buchung v
   WHERE v.monat BETWEEN 1 AND 12
     AND v.klr_typ IN ('GERAETEVERRECHNUNG', 'GEMEINKOSTENUMLAGE', 'VERWALTUNG', 'BERATUNG_UMLAGE')
   GROUP BY v.jahr, v.monat
  UNION
  SELECT d.jahr::integer, d.monat::integer
    FROM controlling.v_db_monat_region d
   WHERE d.monat BETWEEN 1 AND 12
),
geraete AS (
  SELECT v.jahr::integer AS jahr,
         v.monat::integer AS monat,
         v.region,
         sum(v.wert) AS geraete
    FROM controlling.v_buchung v
    JOIN monate m ON m.jahr = v.jahr AND m.monat = v.monat
   WHERE v.klr_typ = 'GERAETEVERRECHNUNG'
     AND v.wert > 0
     AND position('/' IN coalesce(v.kostenstelle, '')) > 0
     AND v.belegkreis = 'VERRECHNUNG'
   GROUP BY v.jahr, v.monat, v.region
),
vv AS (
  SELECT v.jahr::integer AS jahr,
         v.monat::integer AS monat,
         v.region,
         -sum(v.wert) AS vv
    FROM controlling.v_buchung v
    JOIN monate m ON m.jahr = v.jahr AND m.monat = v.monat
   WHERE v.klr_typ = 'GEMEINKOSTENUMLAGE'
     AND v.kostentraeger = 'BEREICH'
   GROUP BY v.jahr, v.monat, v.region
),
verw AS (
  SELECT v.jahr::integer AS jahr,
         v.monat::integer AS monat,
         v.region,
         sum(v.wert) FILTER (WHERE v.kostentraeger = 'ZENTRALE') AS verw_zentrale,
         sum(v.wert) FILTER (WHERE v.kostentraeger IN ('BEREICH', 'PROJEKT')) AS verw_direkt
    FROM controlling.v_buchung v
    JOIN monate m ON m.jahr = v.jahr AND m.monat = v.monat
   WHERE v.klr_typ IN ('VERWALTUNG', 'BERATUNG_UMLAGE')
     AND v.belegkreis <> 'ABRECHNUNG'
   GROUP BY v.jahr, v.monat, v.region
),
basis AS (
  SELECT d.jahr::integer AS jahr,
         d.monat::integer AS monat,
         d.region,
         sum(d.leistung) AS umsatz,
         sum(d.variable_kosten + d.fixe_projektkosten) AS kosten
    FROM controlling.v_db_monat_region d
    JOIN monate m ON m.jahr = d.jahr AND m.monat = d.monat
   GROUP BY d.jahr, d.monat, d.region
),
regionen AS (
  SELECT jahr, monat, region FROM geraete
  UNION
  SELECT jahr, monat, region FROM vv
  UNION
  SELECT jahr, monat, region FROM verw
  UNION
  SELECT jahr, monat, region FROM basis
)
SELECT r.jahr,
       r.monat,
       r.region,
       round(COALESCE(b.umsatz, 0), 2) AS umsatz,
       round(COALESCE(b.kosten, 0), 2) AS kosten,
       round(COALESCE(g.geraete, 0), 2) AS geraete,
       round(COALESCE(v.vv, 0), 2) AS vv,
       round(COALESCE(w.verw_direkt, 0), 2) AS verw_direkt,
       round(COALESCE(w.verw_zentrale, 0), 2) AS verw_zentrale
  FROM regionen r
  LEFT JOIN basis b ON b.jahr = r.jahr AND b.monat = r.monat AND b.region = r.region
  LEFT JOIN geraete g ON g.jahr = r.jahr AND g.monat = r.monat AND g.region = r.region
  LEFT JOIN vv v ON v.jahr = r.jahr AND v.monat = r.monat AND v.region = r.region
  LEFT JOIN verw w ON w.jahr = r.jahr AND w.monat = r.monat AND w.region = r.region;
