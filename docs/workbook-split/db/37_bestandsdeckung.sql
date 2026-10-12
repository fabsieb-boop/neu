-- ===========================================================================
-- Bestandsdeckung: die Bestaende gegen die Kosten pruefen
--
-- Die bisherige Kontrolle v_bestand_ohne_rechnung stellt genau eine Frage:
-- wie lange ist die letzte Rechnung her?  Das laesst sich mit einer einzigen
-- Buchung in der Erloesgruppe aushebeln - und genau das passiert.  Neun
-- Projekte mit zusammen 5,76 Mio EUR nicht abgerechneter Leistung tragen
-- alle das Rechnungsdatum 31.07.2026 und stehen deshalb auf keiner Liste.
--
-- Diese Sicht stellt die eigentliche Frage: geht die Rechnung auf?
--
--     Kosten  =  berechnet  +  Bestandsveraenderung  +  Ergebnis
--
-- Bleibt eine Luecke, ist entweder Leistung weder berechnet noch aktiviert
-- (das Projekt zeigt einen Verlust, den es nicht hat), oder es wurde mehr
-- berechnet und aktiviert als Kosten angefallen sind (das Projekt zeigt ein
-- Ergebnis, das es noch nicht verdient hat).  Beides ist ein Befund, und
-- beides bleibt heute unsichtbar.
-- ===========================================================================

CREATE OR REPLACE VIEW controlling.v_bestand_deckung AS
WITH stand AS (
  SELECT max(buchungsdatum) AS bezugstag FROM controlling.v_buchung
), grenze AS (
  SELECT
    COALESCE((SELECT wert::numeric FROM controlling.app_einstellung
               WHERE schluessel = 'bestand_tage_ohne_rechnung'), 35)      AS tage,
    COALESCE((SELECT wert::numeric FROM controlling.app_einstellung
               WHERE schluessel = 'bestand_bagatelle'), 1000)             AS bagatelle,
    -- Ab welcher Luecke die Sache gemeldet wird.  Kleiner als die Bagatelle
    -- darf sie nicht sein, sonst meldet die Pruefung Rundungsreste.
    COALESCE((SELECT wert::numeric FROM controlling.app_einstellung
               WHERE schluessel = 'bestand_luecke'), 25000)               AS luecke
), je AS (
  SELECT b.auftrag,
         max(p.projektname)                                               AS projektname,
         max(b.region)::text                                              AS region,
         max(b.regionscode)::text                                         AS regionscode,
         sum(b.k_var + b.k_fix)                                           AS kosten,
         COALESCE(sum(-b.wert) FILTER (WHERE b.klr_gruppe = 'Umsatzerlöse'), 0)        AS erloes,
         COALESCE(sum(-b.wert) FILTER (WHERE b.klr_gruppe = 'Bestandsveränderung'), 0) AS bestandsveraenderung,
         count(*) FILTER (WHERE b.klr_gruppe = 'Umsatzerlöse')            AS rechnungen,
         count(*) FILTER (WHERE b.klr_gruppe = 'Bestandsveränderung')     AS bestandsbuchungen,
         max(b.buchungsdatum) FILTER (WHERE b.klr_gruppe = 'Umsatzerlöse') AS letzte_rechnung,
         min(b.buchungsdatum) FILTER (WHERE (b.k_var + b.k_fix) <> 0)     AS erste_kosten,
         max(b.buchungsdatum)                                             AS letzte_buchung
    FROM controlling.v_buchung b
    JOIN controlling.projekte p
      ON p.projekt_nr = b.auftrag AND p.auftragstyp = 'PROJEKT'
   WHERE b.ergebnisrelevant
   GROUP BY b.auftrag
)
SELECT
  je.auftrag,
  je.projektname,
  je.region,
  je.regionscode,
  round(je.kosten, 2)                                        AS kosten,
  round(je.erloes, 2)                                        AS erloes,
  round(je.bestandsveraenderung, 2)                          AS bestandsveraenderung,
  round(je.kosten - je.erloes, 2)                            AS bestand,
  -- Die Luecke ist das gebuchte Projektergebnis mit umgedrehtem Vorzeichen:
  -- positiv heisst, das Projekt traegt Kosten, die weder berechnet noch
  -- aktiviert sind.
  round(je.kosten - je.erloes - je.bestandsveraenderung, 2)   AS luecke,
  CASE WHEN je.kosten > 0
       THEN round((je.erloes + je.bestandsveraenderung) / je.kosten * 100, 1) END AS deckung,
  je.rechnungen,
  je.bestandsbuchungen,
  je.letzte_rechnung,
  je.erste_kosten,
  je.letzte_buchung,
  (SELECT bezugstag FROM stand)                              AS bezugstag,
  (SELECT bezugstag FROM stand) - COALESCE(je.letzte_rechnung, je.erste_kosten) AS tage_ohne_rechnung,
  CASE
    -- Kosten liegen da, ohne Rechnung und ohne Bestandsbuchung.
    WHEN je.bestandsbuchungen = 0
     AND je.kosten - je.erloes > (SELECT luecke FROM grenze)
      THEN 'OHNE_BESTANDSBUCHUNG'
    -- Mehr aktiviert, als das Projekt gekostet hat.
    WHEN je.bestandsveraenderung > je.kosten + (SELECT luecke FROM grenze)
      THEN 'UEBERAKTIVIERT'
    -- Mehr berechnet, als Kosten angefallen sind, ohne Bestandsabbau.
    WHEN je.erloes - je.kosten > (SELECT luecke FROM grenze)
     AND je.bestandsveraenderung >= 0
      THEN 'VORAUSBERECHNET'
    -- Die alte Frage bleibt gueltig, nur nicht mehr als einzige.
    WHEN je.kosten - je.erloes > (SELECT bagatelle FROM grenze)
     AND ((SELECT bezugstag FROM stand) - COALESCE(je.letzte_rechnung, je.erste_kosten))
         > (SELECT tage FROM grenze)
      THEN 'LANGE_OHNE_RECHNUNG'
    ELSE 'OK'
  END                                                        AS befund
FROM je;

COMMENT ON VIEW controlling.v_bestand_deckung IS
  'Prueft je Auftrag, ob Kosten, berechnete Leistung und Bestandsveraenderung zusammenpassen.';

-- Die Wesentlichkeitsgrenze ist einstellbar wie die beiden anderen auch.
INSERT INTO controlling.app_einstellung (schluessel, wert)
VALUES ('bestand_luecke', '25000')
ON CONFLICT (schluessel) DO NOTHING;
