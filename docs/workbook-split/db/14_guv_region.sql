-- =====================================================================
-- 14 · GuV heruntergebrochen auf die Regionen
--
-- Bisher war die Regionszuordnung nur ueber die Auftragsnummer moeglich.
-- Damit fielen 3.211 Zeilen mit 3,11 Mio. EUR heraus – alles, was auf
-- Kostenstellen gebucht ist statt auf Auftraegen, also im Wesentlichen
-- Personal und Verwaltung.
--
-- Die Loesung steckt in der Nummernsystematik: Kostenstellen tragen
-- denselben Regionsschluessel wie Auftraege, nur eine Stelle frueher,
-- weil ihnen der fuehrende Buchstabe fehlt.
--
--   Auftrag       W 4102 15 4968   -> Stellen 6-7
--   Kostenstelle    4102 15 5101   -> Stellen 5-6
--
-- Damit ist die GuV zu 99,7 % regionsscharf. Was uebrig bleibt, wird
-- als 'Ohne Zuordnung' ausgewiesen und nicht stillschweigend verteilt.
-- =====================================================================

SET search_path = controlling, public;

CREATE OR REPLACE FUNCTION controlling.f_regionscode(auftrag text, kostenstelle text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    -- Auftragsnummern: ein Buchstabe, dann Buchungskreis, dann Region
    WHEN auftrag ~ '^[A-Za-z]\d{10}$'  THEN substr(auftrag, 6, 2)
    -- Kostenstellen: Buchungskreis, dann Region
    WHEN kostenstelle ~ '^\d{10}$'     THEN substr(kostenstelle, 5, 2)
    ELSE NULL
  END
$$;

-- Die Sammelkostenstelle 4102099999 traegt die IT-Leistungsverrechnung
-- der Zentrale. Sie hat keinen eigenen Regionsschluessel und gehoert
-- fachlich zur Verwaltung.
CREATE OR REPLACE FUNCTION controlling.f_region_voll(auftrag text, kostenstelle text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN kostenstelle = '4102099999' THEN 'Verwaltung'
    ELSE controlling.f_region(controlling.f_regionscode(auftrag, kostenstelle))
  END
$$;

-- ---------------------------------------------------------------------
-- Die vollstaendige GuV je Region, Monat und Konto
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_guv_region AS
SELECT controlling.f_region_voll(e.auftrag, e.kostenstelle)   AS region,
       controlling.f_konto_norm(e.kostenart)                  AS konto,
       k.name                                                 AS kontobezeichnung,
       k.kategorie,
       k.kategorie_text,
       EXTRACT(YEAR  FROM e.buchungsdatum)::int               AS jahr,
       EXTRACT(MONTH FROM e.buchungsdatum)::int               AS monat,
       (e.auftrag IS NOT NULL)                                AS auftragsbezogen,
       sum(e.wert_signed)                                     AS wert,
       count(*)                                               AS belege
  FROM controlling.sap_einzelposten e
  JOIN controlling.kontenkatalog_tvf k
    ON controlling.f_konto_norm(k.konto) = controlling.f_konto_norm(e.kostenart)
 WHERE controlling.f_ist_guv_konto(k.kategorie)
   AND e.buchungsdatum IS NOT NULL
 GROUP BY 1,2,3,4,5,6,7,8;

COMMENT ON VIEW controlling.v_guv_region IS
  'Vollstaendige GuV je Region. Vorzeichen wie in SAP: Aufwand positiv, '
  'Ertrag negativ, positive Summe = Verlust. Die Summe ueber alle Regionen '
  'ergibt exakt das Gesamtergebnis aus v_guv_ist.';

-- ---------------------------------------------------------------------
-- Verdichtung: die GuV-Staffel je Region
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_guv_region_staffel AS
SELECT region, jahr,
       -sum(wert) FILTER (WHERE kategorie = 'umsatzerloese')       AS umsatzerloese,
       -sum(wert) FILTER (WHERE kategorie IN ('leistung_unfertig','leistung_fertig'))
                                                                   AS bestandsveraenderung,
       -sum(wert) FILTER (WHERE kategorie IN ('umsatzerloese','leistung_unfertig',
                                              'leistung_fertig'))  AS gesamtleistung,
       -sum(wert) FILTER (WHERE kategorie = 'sonstige_ertraege')    AS sonstige_ertraege,
        sum(wert) FILTER (WHERE kategorie = 'betriebsaufwand' AND auftragsbezogen)
                                                                   AS aufwand_auftrag,
        sum(wert) FILTER (WHERE kategorie = 'betriebsaufwand' AND NOT auftragsbezogen)
                                                                   AS aufwand_kostenstelle,
        sum(wert) FILTER (WHERE kategorie = 'betriebsaufwand')      AS betriebsaufwand,
        sum(wert) FILTER (WHERE kategorie = 'finanzergebnis')       AS finanzergebnis,
        sum(wert) FILTER (WHERE kategorie IN ('steuern_sonstige','neutral'))
                                                                   AS steuern_neutral,
        sum(wert)                                                   AS ergebnis,
       -sum(wert)                                                   AS ergebnis_kaufmaennisch,
        count(DISTINCT konto)                                       AS konten,
        sum(belege)                                                 AS belege
  FROM controlling.v_guv_region
 GROUP BY region, jahr;

COMMENT ON VIEW controlling.v_guv_region_staffel IS
  'GuV-Staffel je Region. ergebnis folgt der SAP-Konvention (positiv = Verlust), '
  'ergebnis_kaufmaennisch ist dasselbe mit gedrehtem Vorzeichen (positiv = Gewinn).';
