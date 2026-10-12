/* ---------------------------------------------------------------------------
   Die GuV aus den SAP-Einzelposten
   ---------------------------------------------------------------------------
   Bisher lief der Weg SAP -> Excel -> von Hand ins Dashboard.  Jede Zahl der
   Ergebnispraesentation musste dabei einzeln nachgezogen werden, und bei jedem
   neuen Monat begann das von vorn.

   Hier wird derselbe Rechenweg, den das Blatt "FI-Monatswerte" der
   Praesentation geht, in die Datenbank gelegt:

     1. Jede Kostenart bekommt eine Kategorie (Tabelle kontenmapping_guv,
        177 Konten, uebernommen aus dem Blatt "Kontenmapping").
     2. Die Einzelposten werden je Kategorie und Buchungsmonat verdichtet.
     3. Vier Kategorien ergeben das EBITDA, die uebrigen stehen nachrichtlich
        daneben.

   Zwei Feinheiten, ohne die die Rechnung falsch waere:

   * Vorzeichen.  Im SAP-Export stehen Ertraege im Haben und damit negativ.
     Die Sichten drehen auf die kaufmaennische Leseart, in der ein Gewinn
     positiv ist.
   * Verrechnung.  Die innerbetriebliche Verrechnung (21 Konten) gehoert
     NICHT ins EBITDA.  Sie hebt sich ueber alle Kostenstellen hinweg auf,
     verzerrt aber jeden einzelnen Monat.  Deutlichstes Beispiel: im Februar
     tragen 392000 (Bestandsveraenderung) und 49951 (Gegenbuchung der
     Umgliederung) beide 200.177 EUR.  Wer beide zaehlt, liegt um 200 T EUR
     daneben.
--------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS controlling.kontenmapping_guv (
  konto       varchar(40) PRIMARY KEY,
  bezeichnung varchar(255),
  kategorie   varchar(60) NOT NULL
);

COMMENT ON TABLE controlling.kontenmapping_guv IS
  'Kostenart zu GuV-Kategorie fuer die Ergebnisrechnung. Pflegetabelle, Quelle: Blatt "Kontenmapping" der Ergebnispraesentation.';

BEGIN;

INSERT INTO controlling.kontenmapping_guv (konto, bezeichnung, kategorie) VALUES
  ('140016', 'Forderungen gegen verbundene Unternehmen Zinsen', 'Zinsen und Finanzergebnis'),
  ('155011', 'Forderungen Zinsen auf Steuererstattungen', 'Zinsen und Finanzergebnis'),
  ('160016', 'Verb. gegenüber verbundenen Unternehmen Zinsen', 'Zinsen und Finanzergebnis'),
  ('166055', 'Verbindlichkeiten Nicht LuL (BNP Zinsen)', 'Zinsen und Finanzergebnis'),
  ('201000', 'Sonstige periodenfremde Aufwendungen', 'Neutrales Ergebnis (nicht EBITDA)'),
  ('210000', 'Übrige Zinsen und ähnliche Aufwendungen', 'Zinsen und Finanzergebnis'),
  ('210001', 'Zinsen und Nebenleistungen auf Steuerzahlungen', 'Zinsen und Finanzergebnis'),
  ('210900', 'Zinsaufwendungen an verbundene Unternehmen', 'Zinsen und Finanzergebnis'),
  ('213101', 'Zinsen Factoring', 'Zinsen und Finanzergebnis'),
  ('213200', 'Avalgebühren und -provisionen', 'Zinsen und Finanzergebnis'),
  ('231500', 'Mehrerlös bei Anlagenabgang', 'Neutrales Ergebnis (nicht EBITDA)'),
  ('251000', 'Sonstige periodenfremde Erträge', 'Neutrales Ergebnis (nicht EBITDA)'),
  ('252000', 'andere sonst.betriebl. Erträge', 'Sonstige betriebliche Erträge'),
  ('265001', 'Zinsen auf Steuererstattungen', 'Zinsen und Finanzergebnis'),
  ('265900', 'Sonstige Zinsen und ähnl. Erträge verb.Unternehmen', 'Zinsen und Finanzergebnis'),
  ('272000', 'Verrechnete Erlöse aus Anlagenverkauf', 'Sonstige betriebliche Erträge'),
  ('273500', 'Erträge Auflösung von Rückstellungen (accruals)', 'Sonstige betriebliche Erträge'),
  ('274200', 'Versicherungsentschädigungen', 'Sonstige betriebliche Erträge'),
  ('277100', 'Steuernachzahl. E + E Vorjahre', 'Steuern'),
  ('278100', 'Steuererstattung E + E Vorjahre', 'Steuern'),
  ('286900', 'andere sonstige betriebliche Aufwendungen', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('287090', 'Erträge Mahngebühren', 'Sonstige betriebliche Erträge'),
  ('287095', 'Erträge Zinsen Debitoren', 'Zinsen und Finanzergebnis'),
  ('289200', 'Verr. kalk. Zinsen', 'Verrechnung/kalkulatorisch'),
  ('289300', 'Verr. kalk. Abschreibungen', 'Verrechnung/kalkulatorisch'),
  ('300075', 'Materialaufwand Abbruch u. Rückbau', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('310010', 'Reinigungsmaterial', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('310040', 'Gas (vornehmlich industr. Anlagen)', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('310080', 'Technische Gase', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('310900', 'Sonstige Hilfs- und Betriebsstoffe', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('330900', 'Erhaltene Skonti', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('340030', 'Fremdleistungen Personal', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('340050', 'Fremdleistungen Wartung/Pflege', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('340600', 'Bezogene Leistung periodenfremd', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('392000', 'Bestandsveränderungen unfertige Erzeugnisse', 'Bestandsveränderung'),
  ('400010', 'Instandhaltung Lastkraftwagen', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('400011', 'Reifenkosten', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('400020', 'Instandhaltung Personenkraftwagen', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('400030', 'Instandhaltung selbstfahrende Arbeitsmaschinen', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('400035', 'Instandhaltung Miet-und Leasingfahrzeuge', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('400040', 'DEKRA / TÜV / sonstige Gebühren Fuhrpark', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('400111', 'Anmietung LKW', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('400112', 'Leasing LKW', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('400121', 'Anmietung PKW', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('400122', 'Leasing PKW', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('400131', 'Anmietung selbstfahrende Arbeitsmaschinen', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('401000', 'Aufwand Diesel', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('401010', 'Benzin/Super', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('401015', 'Alternative Antriebe (u.a. Strom, Wasserstoff)', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('401020', 'Öle und Fette', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('401030', 'Kfz-Steuern', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('401040', 'Kfz-Versicherungen', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('401050', 'Autobahngebühren LKW', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('410000', 'Löhne', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('410010', 'Lohnfortzahlung', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('410030', 'Sonderzahlungen und Prämien Lohnempfänger', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('410050', 'Überstunden Lohnempfänger', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('410060', 'Aushilfen gewerbl. (Lohnübernahme)', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('410100', 'Gehalt', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('410110', 'Gehaltsfortzahlung', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('410130', 'Sonderzahlungen und Prämien Gehaltsempfänger', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('410160', 'Aushilfen Angestellte (Lohnübernahme)', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('411000', 'Altersversorgung und Unterstützung', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('411010', 'Beiträge Berufsgenossenschaft', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('411020', 'Sozialabgaben', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('411021', 'Arbeitgeberanteil zur gesetzl. RentenVersicherung', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('411030', 'Arbeitgeberzuschuß VWL', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('411050', 'Personalversicherung', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('411070', 'Personalwerbung', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('411090', 'Schulung und Ausbildung', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('411100', 'Arbeitskleidung und Arbeitschutzbedarf', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('411900', 'Sonstige Personalkosten', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('411910', 'Lohnzuschüsse (Lohnübernahme)', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('420012', 'Sonstige Kosten Grundstücke und Gebäude', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('420015', 'Instandhaltungskosten fremde  Gebäude', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('420021', 'Raumpflege eigene Gebäude', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('420022', 'Raumpflege fremde Gebäude', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('420030', 'Aufwand Energie', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('420040', 'Aufwand Wasser', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('420060', 'Aufwand eigene Entsorgung', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('420100', 'Instandhaltung Betriebsausstattung', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('420400', 'Instandhaltung Geschäftsausstattung', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('420450', 'Instandh./Reparatur/Wartung Miet- u. Leasinggeräte', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('420500', 'Instandhaltung Behälter', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('420600', 'Werkstattbedarf (Kleinwerkzeuge b.100,-DM u.ä.)', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('420700', 'Verbrauch Hilfs- u. Betriebsstoffe', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('430010', 'Vermögensteuer, Grundsteuer u.a.', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('430040', 'Sonstige Steuern', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('430110', 'Aufwendungen für Versicherungsschäden', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('430120', 'Sonstige Versicherungen', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('430121', 'Warenkreditversicherung', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('431010', 'Mieten Räume', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('431020', 'Mieten Plätze', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('431041', 'Miete Behälter', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('431090', 'Sonstige Mieten', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('440050', 'Transportkosten (außerhalb Recy)', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('450010', 'Reisekosten Betriebsangehörige', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('450011', 'Verpfl.mehraufwand (pauschal)', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('450012', 'Kilometergeld (pauschal)', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('450013', 'Kürzung Verpfleg.mehraufwand', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('450020', 'Reisekosten Betriebsfremde', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('450030', 'Bewirtung zu 100 % abzugsfähig', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('450039', 'Bewirtung zu 70 % abzugsfähig', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('450050', 'Allgemeine Repräsentationskosten', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('450061', 'Geschenke Zuwend. < Wertgrenze Dritte/Arbeitnehmer', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('450080', 'Werbung', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('450081', 'Sponsoring', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('450120', 'Spesen (Lohnübernahme ohne VSt.)', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('460010', 'Büromaterial', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('460020', 'Zeitungen, Zeitschrift.und Bücher', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('460030', 'Telekommunikation', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('460040', 'Portogebühren', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('460050', 'Kosten des Geldverkehrs', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('460060', 'Kosten EDV', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('460065', 'IT Lizenzgebühren', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('460080', 'Pflichtbeiträge zu Verbänden', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('460081', 'Beiträge zu sonstigen Vereinigungen', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('460090', 'Schreib- und Verwaltungsgebühren an Behörden', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('460200', 'Beiträge Fachtagungen', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('460900', 'Sonstige Verwaltungskosten', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('470010', 'Anwalts- und Gerichtskosten', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('470020', 'kaufm. Beratung und Buchführung', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('470025', 'Steuerberatungskosten', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('470030', 'Beratungskosten Allgemeine Verwaltung', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('470036', 'Aufwendungen Umlage zentrale Verwaltung', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('480100', 'Normalabschreibung auf Anlagen', 'Abschreibungen'),
  ('480110', 'Abschreibungen auf Anlagen (GWG)', 'Abschreibungen'),
  ('499200', 'Kalk. Zinsen', 'Verrechnung/kalkulatorisch'),
  ('499300', 'Kalk. Abschreibungen', 'Verrechnung/kalkulatorisch'),
  ('7612000', 'Verrechnung Geräte', 'Verrechnung/kalkulatorisch'),
  ('7801020', 'Gemeinkostenzuschläge 12 % TVF Altwert', 'Verrechnung/kalkulatorisch'),
  ('830510', 'Erlöse Abrisse/Demontagen', 'Umsatzerlöse'),
  ('840040', 'Erlöse Verkauf HW Schrott', 'Umsatzerlöse'),
  ('860000', 'Erlöse weiterberechnete Fremdkosten', 'Sonstige betriebliche Erträge'),
  ('890010', 'Erlöse Anlagenverkäufe', 'Sonstige betriebliche Erträge'),
  ('890100', 'Gewährte Skonti', 'Umsatzerlöse'),
  ('890200', 'Erlöse selbstgenutzte Fahrzeuge', 'Sonstige betriebliche Erträge'),
  ('890800', 'Erlöse Zahlungsdifferenzen Debitoren', 'Sonstige betriebliche Erträge'),
  ('999920', 'Übernahme-Konto offene Posten Debitoren', 'Verrechnung/kalkulatorisch'),
  ('999930', 'Übernahme-Konto offene Posten Kreditoren', 'Verrechnung/kalkulatorisch'),
  ('220000', 'Körperschaftsteuer', 'Steuern'),
  ('221200', 'Solidaritätszuschlag', 'Steuern'),
  ('231000', 'Mindererlös bei Anlagenabgang', 'Sonstige betriebliche Erträge'),
  ('243000', 'Einstellung i.d.EWB zu Forderungen', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('273200', 'Erträge aus ausgebuchten Forderungen', 'Sonstige betriebliche Erträge'),
  ('279000', 'Erträge aus Verlustübergabe', 'Zinsen und Finanzergebnis'),
  ('300040', 'Ankauf Schrott', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('340100', 'Fremdleistungen Fuhrleistungen', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('340500', 'Fremdleistungen Containerstandplätze', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('350500', 'Weiterzuberechnende Fremdkosten', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('391000', 'Bestandsveränderungen Fertigerzeugnisse', 'Bestandsveränderung'),
  ('400132', 'Leasing selbstfahrende Arbeitsmaschinen', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('411040', 'Ausgleichsabgabe', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('420020', 'Raumpflege', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('420300', 'Instandhaltung maschinelle Anlagen', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('430020', 'Gewerbeertragsteuer', 'Steuern'),
  ('430030', 'Gewerbekapitalsteuer', 'Steuern'),
  ('460070', 'Entwicklungs- und Planungskosten', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('480300', 'Abschreibungen auf Umlaufvermögen', 'Abschreibungen'),
  ('560002', 'Arbeitsplatz', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('560004', 'Druck & Scanservices', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('560006', 'ERP-Systeme', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('560009', 'Sonstige Software', 'Betriebsaufwand (EBITDA-wirksam)'),
  ('761110', 'Lohnverr. Gruppe 1', 'Verrechnung/kalkulatorisch'),
  ('7611100', 'Lohnverr. Gruppe1', 'Verrechnung/kalkulatorisch'),
  ('7611200', 'Lohnverr. Gruppe 2', 'Verrechnung/kalkulatorisch'),
  ('761200', 'Verrechnung Geräte', 'Verrechnung/kalkulatorisch'),
  ('767000', 'Teil-/Abrechnung PRO', 'Verrechnung/kalkulatorisch'),
  ('7670000', 'Teil/Abrechnung', 'Verrechnung/kalkulatorisch'),
  ('278000', '(aus FI-Export)', 'Sonstige betriebliche Erträge'),
  ('49951', '(aus FI-Export)', 'Verrechnung/kalkulatorisch'),
  ('49972', '(aus FI-Export)', 'Verrechnung/kalkulatorisch'),
  ('49999', '(aus FI-Export)', 'Verrechnung/kalkulatorisch'),
  ('599131', '(aus FI-Export)', 'Verrechnung/kalkulatorisch'),
  ('599136', '(aus FI-Export)', 'Verrechnung/kalkulatorisch'),
  ('599992', '(aus FI-Export)', 'Verrechnung/kalkulatorisch'),
  ('599994', '(aus FI-Export)', 'Verrechnung/kalkulatorisch')
ON CONFLICT (konto) DO UPDATE
   SET bezeichnung = EXCLUDED.bezeichnung,
       kategorie   = EXCLUDED.kategorie;

COMMIT;

/* ---------------------------------------------------------------------------
   Je Kategorie und Monat, kaufmaennische Vorzeichen
--------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW controlling.v_guv_kategorie_monat AS
SELECT e.geschaeftsjahr                     AS jahr,
       e.monat,
       COALESCE(m.kategorie, 'nicht zugeordnet') AS kategorie,
       -sum(e.wert_signed)                  AS betrag,
       count(*)                             AS belege,
       count(DISTINCT e.kostenart)          AS konten
  FROM controlling.sap_einzelposten e
  LEFT JOIN controlling.kontenmapping_guv m ON m.konto = e.kostenart
 WHERE e.geschaeftsjahr IS NOT NULL AND e.monat IS NOT NULL
 GROUP BY 1, 2, 3;

COMMENT ON VIEW controlling.v_guv_kategorie_monat IS
  'Einzelposten je GuV-Kategorie und Monat, Vorzeichen kaufmaennisch (Ertrag positiv).';

/* ---------------------------------------------------------------------------
   Die Monatsstaffel, wie sie in der Praesentation steht
--------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW controlling.v_guv_fi_monat AS
SELECT jahr, monat,
       COALESCE(sum(betrag) FILTER (WHERE kategorie = 'Umsatzerlöse'), 0)                     AS umsatzerloese,
       COALESCE(sum(betrag) FILTER (WHERE kategorie = 'Sonstige betriebliche Erträge'), 0)    AS sonstige_ertraege,
       COALESCE(sum(betrag) FILTER (WHERE kategorie = 'Bestandsveränderung'), 0)              AS bestandsveraenderung,
       COALESCE(sum(betrag) FILTER (WHERE kategorie = 'Betriebsaufwand (EBITDA-wirksam)'), 0) AS betriebsaufwand,
       COALESCE(sum(betrag) FILTER (WHERE kategorie IN ('Umsatzerlöse',
                 'Sonstige betriebliche Erträge','Bestandsveränderung',
                 'Betriebsaufwand (EBITDA-wirksam)')), 0)                                     AS ebitda,
       COALESCE(sum(betrag) FILTER (WHERE kategorie = 'Umsatzerlöse'), 0)
         + COALESCE(sum(betrag) FILTER (WHERE kategorie = 'Bestandsveränderung'), 0)          AS gesamtleistung,
       COALESCE(sum(betrag) FILTER (WHERE kategorie = 'Abschreibungen'), 0)                   AS abschreibungen,
       COALESCE(sum(betrag) FILTER (WHERE kategorie = 'Zinsen und Finanzergebnis'), 0)        AS finanzergebnis,
       COALESCE(sum(betrag) FILTER (WHERE kategorie = 'Steuern'), 0)                          AS steuern,
       COALESCE(sum(betrag) FILTER (WHERE kategorie = 'Neutrales Ergebnis (nicht EBITDA)'), 0) AS neutral,
       COALESCE(sum(betrag) FILTER (WHERE kategorie = 'Verrechnung/kalkulatorisch'), 0)       AS verrechnung,
       COALESCE(sum(betrag) FILTER (WHERE kategorie = 'nicht zugeordnet'), 0)                 AS nicht_zugeordnet,
       COALESCE(sum(belege), 0)                                                               AS belege
  FROM controlling.v_guv_kategorie_monat
 GROUP BY jahr, monat;

COMMENT ON VIEW controlling.v_guv_fi_monat IS
  'Monatsstaffel der Ergebnisrechnung aus den SAP-Einzelposten. EBITDA = Umsatz + sonstige Ertraege + Bestandsveraenderung + Betriebsaufwand.';

GRANT SELECT ON controlling.kontenmapping_guv, controlling.v_guv_kategorie_monat,
                controlling.v_guv_fi_monat TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON controlling.kontenmapping_guv TO PUBLIC;
