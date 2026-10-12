-- ============================================================================
--  Offizieller GuV-Kontenstamm der TVF ALTWERT GmbH
--
--  Quelle: GuV_FC_Eingabe, Blatt Eingabemaske_Beträge (106 Detailkonten, IST 2025),
--  uebernommen aus dem TVF-Bestandssystem (js/kontenregister.js).
--
--  Zweck: die Klassifizierung in 01_modell.sql leitet die Kontoart aus den
--  Nummernkreisen ab. Fuer die 69 Konten, die in beiden Systemen vorkommen,
--  stimmen beide Verfahren vollstaendig ueberein. Dieser Stamm liefert
--  zusaetzlich Angaben, die sich nicht herleiten lassen:
--    - die firmeneigene Planungsgruppe
--    - das EBITDA-Kennzeichen
--    - den Kostenblock der Mehrjahresplanung
--    - die SAP-GuV-Position
--  und er registriert Konten vor, die noch nicht bebucht wurden, damit
--  kuenftige Importe sie sofort richtig einordnen.
--
--  Idempotent, beliebig oft ausfuehrbar. Setzt 01_modell.sql voraus.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS controlling.kontenstamm_tvf (
  konto             VARCHAR(20) PRIMARY KEY,
  bezeichnung       VARCHAR(255),
  sap_guv_position  VARCHAR(120),
  kontoart          VARCHAR(30) NOT NULL,   -- ertrag | bestandsveraenderung | aufwand | afa | finanz | steuern | neutral
  planungsgruppe    VARCHAR(120),
  ebitda_relevant   BOOLEAN NOT NULL DEFAULT FALSE,
  kostenblock       VARCHAR(120)
);

COMMENT ON TABLE controlling.kontenstamm_tvf IS
  'GuV-Kontenstamm der TVF ALTWERT GmbH aus GuV_FC_Eingabe (IST 2025). Referenz fuer die Klassifizierung.';

TRUNCATE controlling.kontenstamm_tvf;

INSERT INTO controlling.kontenstamm_tvf
  (konto, bezeichnung, sap_guv_position, kontoart, planungsgruppe, ebitda_relevant, kostenblock)
VALUES
  ('201000','Sonst.periodenfr.Auf','periodenfr Aufw','neutral','Neutrales / periodenfremdes Ergebnis',false,NULL),
  ('210000','Übr. Zins. u ähnl. A','übrige Zinsaufw.','finanz','Zinsen und ähnliche Aufw./Ertr.',false,NULL),
  ('210001','Zins+Nebenl.Steuerza','Zinsaufw Steuern','finanz','Zinsen und ähnliche Aufw./Ertr.',false,NULL),
  ('210900','Zinsaufw.an verb.Unt','Zinsaufw verbun','finanz','Zinsen und ähnliche Aufw./Ertr.',false,NULL),
  ('213101','Zinsen Factoring','Zinsen Fact/ABS','finanz','Zinsen und ähnliche Aufw./Ertr.',false,NULL),
  ('213200','Avalgebühren/-prov.','Avalgebühren,-prov.','finanz','Zinsen und ähnliche Aufw./Ertr.',false,NULL),
  ('220000','Körperschaftsteuer','Steuern E+E','steuern','Steuern vom Einkommen und Ertrag',false,NULL),
  ('221200','Solidaritätszuschl.','Steuern E+E','steuern','Steuern vom Einkommen und Ertrag',false,NULL),
  ('231000','Mindererl.b.Anlagenv','Buchverluste','neutral','Neutrales / periodenfremdes Ergebnis',false,NULL),
  ('231500','Mehrerlös b.Anlagena','Buchgewinne','neutral','Neutrales / periodenfremdes Ergebnis',false,NULL),
  ('240000','uneinbringl.Forderun','Ford.verluste','neutral','Neutrales / periodenfremdes Ergebnis',false,NULL),
  ('243000','Einst.EWB zu Ford.','Zuführ.WertberichtFo','neutral','Neutrales / periodenfremdes Ergebnis',false,NULL),
  ('251000','Sonst.periodenfr.Ert','Periodenfr. Ert','neutral','Neutrales / periodenfremdes Ergebnis',false,NULL),
  ('251300','Übrige neutrale Ertr','Uebr.neutr. Ert','neutral','Neutrales / periodenfremdes Ergebnis',false,NULL),
  ('252000','and.sons.betr.Erträ.','Ueb.and.so betE','neutral','Neutrales / periodenfremdes Ergebnis',false,NULL),
  ('265001','Zinsen auf Steuerers','Zinsertr Steuererst','finanz','Zinsen und ähnliche Aufw./Ertr.',false,NULL),
  ('265900','Sonst.Zins.verb Unt.','Zinsertr verbun','finanz','Zinsen und ähnliche Aufw./Ertr.',false,NULL),
  ('273000','Ert.Herabsetz.Pau-WB','Ertr. Verm.Wert','neutral','Neutrales / periodenfremdes Ergebnis',false,NULL),
  ('273200','Ertr.ausgeb.Ford.','Ertr. Verm.Wert','neutral','Neutrales / periodenfremdes Ergebnis',false,NULL),
  ('273500','Ert.Aufl.Accruals','Ertr. Aufl. Rst','neutral','Neutrales / periodenfremdes Ergebnis',false,NULL),
  ('274200','Versicherungsentsch.','Versich.entschä','neutral','Neutrales / periodenfremdes Ergebnis',false,NULL),
  ('278000','Steuererstat.VJ Eink','Steuern E+E','steuern','Steuern vom Einkommen und Ertrag',false,NULL),
  ('278100','Steuererst. E+E Vj.','Steuern E+E Vj','steuern','Steuern vom Einkommen und Ertrag',false,NULL),
  ('286900','and.sonst.betr.Aufw.','So. betr. Aufwa','neutral','Neutrales / periodenfremdes Ergebnis',false,NULL),
  ('287095','Erträge Zinsen Debit','übrige Zinsertr.','finanz','Zinsen und ähnliche Aufw./Ertr.',false,NULL),
  ('300060','Ank.and.Recyc.Prod.','Ankauf Rohstoff','aufwand','Materialaufwand / Fremdleistungen',true,'Vorleistungen'),
  ('310040','Gas (vorn.ind.Anl.)','Aufw. Heizmat.','aufwand','Materialaufwand / Fremdleistungen',true,'Vorleistungen'),
  ('310900','Sonst.Hilfs-Betriebs','Aufw. so. Hilfs','aufwand','Materialaufwand / Fremdleistungen',true,'Vorleistungen'),
  ('330900','Erhaltene Skonti','Aufw. so. Hilfs','aufwand','Materialaufwand / Fremdleistungen',true,'Vorleistungen'),
  ('340030','Fremdleistungen Pers','Fremdl. Persona','aufwand','Materialaufwand / Fremdleistungen',true,'Vorleistungen'),
  ('340050','Fremdleistungen Wart','Ueb. bezog.Leis','aufwand','Materialaufwand / Fremdleistungen',true,'Vorleistungen'),
  ('340100','Fremdl.Fuhrl.+Kippgb','Fremdl. Fuhrlei','aufwand','Materialaufwand / Fremdleistungen',true,'Vorleistungen'),
  ('350500','Weiterb.Fremdkosten','Weiterber. Frem','aufwand','Materialaufwand / Fremdleistungen',true,'Vorleistungen'),
  ('390000','Bestandsveränderung.','Bestandsveraend','bestandsveraenderung','Bestandsveränderung',true,NULL),
  ('400010','Instandhaltung LKW','Instandh.Fuhrp','aufwand','Sonstige betriebliche Aufwendungen',true,'Fuhrparkkosten'),
  ('400011','Reifenkosten','Instandh.Fuhrp','aufwand','Sonstige betriebliche Aufwendungen',true,'Fuhrparkkosten'),
  ('400020','Instandhaltung PKW','Instandh.Fuhrp','aufwand','Sonstige betriebliche Aufwendungen',true,'Fuhrparkkosten'),
  ('400030','Instandhalt.A-Masch.','Instandh.Fuhrp','aufwand','Sonstige betriebliche Aufwendungen',true,'Fuhrparkkosten'),
  ('400035','Inst.Miet.Leas.fahrz','Instandh.Fuhrp','aufwand','Sonstige betriebliche Aufwendungen',true,'Fuhrparkkosten'),
  ('400040','DEKRA / TÜV / sonsti','Instandh.Fuhrp','aufwand','Sonstige betriebliche Aufwendungen',true,'Fuhrparkkosten'),
  ('400111','Anmietung LKW','Miete LKW,Schiffe','aufwand','Sonstige betriebliche Aufwendungen',true,'Fuhrparkkosten'),
  ('400112','Leasing LKW','Leasing LKW','aufwand','Sonstige betriebliche Aufwendungen',true,'Fuhrparkkosten'),
  ('400121','Anmietung PKW','Miete PKW','aufwand','Sonstige betriebliche Aufwendungen',true,'Fuhrparkkosten'),
  ('400122','Leasing PKW','Leasing PKW','aufwand','Sonstige betriebliche Aufwendungen',true,'Fuhrparkkosten'),
  ('400131','Anmietung selbstf. A','Miete LKW,Schiffe','aufwand','Sonstige betriebliche Aufwendungen',true,'Fuhrparkkosten'),
  ('400132','Leasing selbstf. Arb','Leasing LKW','aufwand','Sonstige betriebliche Aufwendungen',true,'Fuhrparkkosten'),
  ('401000','Aufwand Diesel','Treibstoffe, Oe','aufwand','Sonstige betriebliche Aufwendungen',true,'Fuhrparkkosten'),
  ('401010','Benzin/Super','Treibstoffe, Oe','aufwand','Sonstige betriebliche Aufwendungen',true,'Fuhrparkkosten'),
  ('401015','Strom/Wasserstoff','Treibstoffe, Oe','aufwand','Sonstige betriebliche Aufwendungen',true,'Fuhrparkkosten'),
  ('401020','Öle und Fette','Treibstoffe, Oe','aufwand','Sonstige betriebliche Aufwendungen',true,'Fuhrparkkosten'),
  ('401030','Kfz-Steuern','Sonstige Steuer','aufwand','Sonstige betriebliche Aufwendungen',true,'Fuhrparkkosten'),
  ('401040','Kfz-Versicherungen','Sonst Fuhrparkkosten','aufwand','Sonstige betriebliche Aufwendungen',true,'Fuhrparkkosten'),
  ('401050','Autobahngebühren LKW','Sonst Fuhrparkkosten','aufwand','Sonstige betriebliche Aufwendungen',true,'Fuhrparkkosten'),
  ('410000','Löhne','Lohn + Gehalt','aufwand','Personalaufwand',true,'Personalaufwand'),
  ('410030','Sonderzahl./Prämien','Sonderz. Prämie','aufwand','Personalaufwand',true,'Personalaufwand'),
  ('410050','Überstunden Lohnempf','Lohn + Gehalt','aufwand','Personalaufwand',true,'Personalaufwand'),
  ('410100','Gehalt','Lohn + Gehalt','aufwand','Personalaufwand',true,'Personalaufwand'),
  ('411000','Altersversorgung','Aufw. f. Alters','aufwand','Personalaufwand',true,'Personalaufwand'),
  ('411010','Beiträge Berufsgen.','Soziale Abgaben','aufwand','Personalaufwand',true,'Personalaufwand'),
  ('411020','Sozialabgaben','Soziale Abgaben','aufwand','Personalaufwand',true,'Personalaufwand'),
  ('411030','Arbeitgeberzusch.VWL','Lohn + Gehalt','aufwand','Personalaufwand',true,'Personalaufwand'),
  ('411070','Personalwerbung','sonst Personalk','aufwand','Personalaufwand',true,'Personalaufwand'),
  ('411090','Schulung u. Ausbild.','sonst Personalk','aufwand','Personalaufwand',true,'Personalaufwand'),
  ('411100','Arbeitskleid/-bedarf','sonst Personalk','aufwand','Personalaufwand',true,'Personalaufwand'),
  ('411900','Sonst.Personalkosten','sonst Personalk','aufwand','Personalaufwand',true,'Personalaufwand'),
  ('411910','Lohnzuschüsse(Lohnüb','Ueb Lohn-Gehalt','aufwand','Personalaufwand',true,'Personalaufwand'),
  ('420012','So.Kost.Grund u.Geb','Raumkosten','aufwand','Sonstige betriebliche Aufwendungen',true,'Raumkosten'),
  ('420021','Raumpflege eig.Gebäu','Raumkosten','aufwand','Sonstige betriebliche Aufwendungen',true,'Raumkosten'),
  ('420022','Raumpflege frm.Gebäu','Raumkosten','aufwand','Sonstige betriebliche Aufwendungen',true,'Raumkosten'),
  ('420030','Aufwand Energie','Raumkosten','aufwand','Sonstige betriebliche Aufwendungen',true,'Raumkosten'),
  ('420040','Aufwand Wasser','Raumkosten','aufwand','Sonstige betriebliche Aufwendungen',true,'Raumkosten'),
  ('420060','Aufwand Entsorgung','Raumkosten','aufwand','Sonstige betriebliche Aufwendungen',true,'Raumkosten'),
  ('420100','Instand.Betriebsaus.','Instandh. BGA','aufwand','Sonstige betriebliche Aufwendungen',true,'Instandh. Betriebsausstattung'),
  ('420300','Instand.masch.Anlag.','Instandh. BGA','aufwand','Sonstige betriebliche Aufwendungen',true,'Instandh. Betriebsausstattung'),
  ('420400','Instand.Geschäftsaus','Verwaltungskost','aufwand','Sonstige betriebliche Aufwendungen',true,'Verwaltungskosten'),
  ('420450','Inst/Rep.Leasingger.','Instandh. BGA','aufwand','Sonstige betriebliche Aufwendungen',true,'Instandh. Betriebsausstattung'),
  ('420500','Instand.Behälter','Behaelterkosten','aufwand','Sonstige betriebliche Aufwendungen',true,'Instandh. Betriebsausstattung'),
  ('430020','Gewerbeertragsteuer','Steuern E+E','steuern','Steuern vom Einkommen und Ertrag',false,NULL),
  ('430040','Sonstige Steuern','Sonstige Steuer','steuern','Steuern vom Einkommen und Ertrag',false,NULL),
  ('430110','Aufwendungen f.Vers.','So. betr. Aufwa','aufwand','Sonstige betriebliche Aufwendungen',true,'Verwaltungskosten'),
  ('430120','Sonst.Versicherungen','Versicherungskosten','aufwand','Sonstige betriebliche Aufwendungen',true,'Verwaltungskosten'),
  ('431010','Mieten Räume','Miete Grdst/Gebäud','aufwand','Sonstige betriebliche Aufwendungen',true,'Raumkosten'),
  ('431020','Mieten Plätze','Miete Grdst/Gebäud','aufwand','Sonstige betriebliche Aufwendungen',true,'Raumkosten'),
  ('431041','Miete Beh.','Miete Behälter','aufwand','Sonstige betriebliche Aufwendungen',true,'Instandh. Betriebsausstattung'),
  ('431090','Sonstige Mieten','Miete Grdst/Gebäud','aufwand','Sonstige betriebliche Aufwendungen',true,'Raumkosten'),
  ('440020','Kosten d.Vermarktung','Vertriebskosten','aufwand','Sonstige betriebliche Aufwendungen',true,'Vertriebskosten'),
  ('450010','Reisekost.Betriebsan','Vertriebskosten','aufwand','Sonstige betriebliche Aufwendungen',true,'Vertriebskosten'),
  ('450080','Werbung','Vertriebskosten','aufwand','Sonstige betriebliche Aufwendungen',true,'Vertriebskosten'),
  ('450120','Spesen (ohne VSt.)','Vertriebskosten','aufwand','Sonstige betriebliche Aufwendungen',true,'Vertriebskosten'),
  ('460010','Büromaterial','Verwaltungskost','aufwand','Sonstige betriebliche Aufwendungen',true,'Verwaltungskosten'),
  ('460030','Telekommunikation','Verwaltungskost','aufwand','Sonstige betriebliche Aufwendungen',true,'Verwaltungskosten'),
  ('460040','Portogebühren','Verwaltungskost','aufwand','Sonstige betriebliche Aufwendungen',true,'Verwaltungskosten'),
  ('460060','Kosten EDV','IT-Aufwendungen','aufwand','Sonstige betriebliche Aufwendungen',true,'Verwaltungskosten'),
  ('460065','IT Lizenzgebühren','IT-Aufwendungen','aufwand','Sonstige betriebliche Aufwendungen',true,'Verwaltungskosten'),
  ('460900','Sonst.Verwaltungskos','Verwaltungskost','aufwand','Sonstige betriebliche Aufwendungen',true,'Verwaltungskosten'),
  ('470010','Anwalts-,Gerichtskos','Rechts- u. Beratungs','aufwand','Sonstige betriebliche Aufwendungen',true,'Verwaltungskosten'),
  ('470020','Kfm.Berat.u.Buchführ','Rechts- u. Beratungs','aufwand','Sonstige betriebliche Aufwendungen',true,'Verwaltungskosten'),
  ('470030','Beratung Allg. Verw','Verwaltungskost','aufwand','Sonstige betriebliche Aufwendungen',true,'Verwaltungskosten'),
  ('470036','Aufw.Uml.zentr.VW','Aufwand Umlage','aufwand','Sonstige betriebliche Aufwendungen',true,'Verwaltungskosten'),
  ('480100','Normalabschreibung','planm. AfA AV','afa','Abschreibungen',false,NULL),
  ('830510','Erl. Abrisse/Demont.','Erl. so. DL Dt.','ertrag','Umsatzerlöse',true,NULL),
  ('840040','Erl.Verkauf Schrott','Erl. Waren Dt.','ertrag','Umsatzerlöse',true,NULL),
  ('860000','Erlöse weiterb.Kost.','Ertr. weiterber','ertrag','Sonstige betriebliche Erträge',true,NULL),
  ('890010','Erl.Anlagenverkäufe','Uebr.neutr. Ert','ertrag','Sonstige betriebliche Erträge',true,NULL),
  ('890200','Erl.selbstgen.Fahrz','Ertrag KFZ-Nutz','ertrag','Sonstige betriebliche Erträge',true,NULL),
  ('890300','Sonst.Erlösschmälerg','Erloesschmaeler','ertrag','Sonstige betriebliche Erträge',true,NULL)
;

-- ---------------------------------------------------------------------------
-- Kostenarten um die Merkmale des Stamms erweitern
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Noch nicht bebuchte Konten des Stamms vorregistrieren
-- ---------------------------------------------------------------------------

INSERT INTO controlling.kostenarten (kostenart_nr, bezeichnung)
SELECT s.konto || '.0', s.bezeichnung
  FROM controlling.kontenstamm_tvf s
 WHERE NOT EXISTS (
   SELECT 1 FROM controlling.kostenarten k
    WHERE round(k.kostenart_nr::numeric)::text = s.konto
      AND k.kostenart_nr ~ '^[0-9.]+$')
ON CONFLICT (kostenart_nr) DO NOTHING;

-- Klassifizierung aus 01_modell.sql auf die neuen Konten anwenden
CALL controlling.kostenarten_klassifizieren();

-- ---------------------------------------------------------------------------
-- Merkmale aus dem Stamm uebernehmen
-- ---------------------------------------------------------------------------

UPDATE controlling.kostenarten k SET
  kontoart         = s.kontoart,
  planungsgruppe   = s.planungsgruppe,
  kostenblock      = s.kostenblock,
  sap_guv_position = s.sap_guv_position,
  ebitda_relevant  = s.ebitda_relevant,
  quelle           = 'TVF-Kontenstamm'
FROM controlling.kontenstamm_tvf s
WHERE s.konto = k.kontonummer::text;

-- Konten ausserhalb des GuV-Stamms behalten die in 01_modell.sql abgeleiteten
-- Merkmale (CO-interne Konten wie Lohn-/Geraeteverrechnung, Gemeinkostenzuschlag
-- und kalkulatorische Kosten sowie Detailkonten, die der GuV-Stamm zusammenfasst).
CALL controlling.kostenarten_klassifizieren();

-- ---------------------------------------------------------------------------
--  Vollstaendiger Kontenkatalog (Stand 18.08.2026, Version 481)
--
--  Quellen: SAP-Bericht "Projektergebnisse S_4102 1-8/2026", offizieller
--  Bilanz/GuV-Bericht und der Einzelpostenexport Jan-Aug 2026.
--
--  Wichtig fuer die Auswertung: der Katalog kennt auch die Bilanzkonten.
--  Nur damit laesst sich eine GuV sauber von Bestandskonten abgrenzen –
--  aus der Kontonummer allein ist das nicht ableitbar.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS controlling.kontenkatalog_tvf (
  konto          VARCHAR(20) PRIMARY KEY,
  name           VARCHAR(255),
  kategorie      VARCHAR(40) NOT NULL,
  kategorie_text VARCHAR(120),
  import_art     VARCHAR(30),   -- umsatz | kosten | neutral | bilanz | verrechnung | leistung_*
  bilanz_seite   VARCHAR(20)    -- AKTIVA | PASSIVA, nur bei Bilanzkonten
);

COMMENT ON TABLE controlling.kontenkatalog_tvf IS
  'Kontenkatalog der TVF ALTWERT GmbH, Version 481 vom 18.08.2026. Referenz, wird nur gelesen.';

TRUNCATE controlling.kontenkatalog_tvf;

INSERT INTO controlling.kontenkatalog_tvf
  (konto, name, kategorie, kategorie_text, import_art, bilanz_seite)
VALUES
  ('100000','Kasse I','bilanz_bank','Bilanz – Bank / Cash Pool / Kasse','bilanz','AKTIVA'),
  ('1000076','Grunske Metall-Recyc','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz',NULL),
  ('100090','Kasse X','bilanz_bank','Bilanz – Bank / Cash Pool / Kasse','bilanz','AKTIVA'),
  ('100091','Kasse XI','bilanz_bank','Bilanz – Bank / Cash Pool / Kasse','bilanz','AKTIVA'),
  ('100092','Kasse XII','bilanz_bank','Bilanz – Bank / Cash Pool / Kasse','bilanz','AKTIVA'),
  ('110869',NULL,'bilanz_bank','Bilanz – Bank / Cash Pool / Kasse','bilanz',NULL),
  ('111030','Commerzbank (CB)','bilanz_bank','Bilanz – Bank / Cash Pool / Kasse','bilanz','AKTIVA'),
  ('111031','CB Scheckeingang','bilanz_bank','Bilanz – Bank / Cash Pool / Kasse','bilanz',NULL),
  ('111033','CB Überweisungsausg.','bilanz_bank','Bilanz – Bank / Cash Pool / Kasse','bilanz',NULL),
  ('111409','CashPool ALBA  plc & Co. KG (5002) vU','bilanz_bank','Bilanz – Bank / Cash Pool / Kasse','bilanz','PASSIVA'),
  ('119600','Geld inTransit Kasse','bilanz_bank','Bilanz – Bank / Cash Pool / Kasse','bilanz','AKTIVA'),
  ('140000','Forderungen aus L+L','bilanz_forderungen','Bilanz – Forderungen','bilanz','AKTIVA'),
  ('140010','Ford. gegen verbundene Unternehmen','bilanz_forderungen','Bilanz – Forderungen','bilanz','AKTIVA'),
  ('140600','Nachbuchung Ford.L/L','bilanz_forderungen','Bilanz – Forderungen','bilanz','AKTIVA'),
  ('140712','Korrekturkto. Ford. L+L (Factoring)','bilanz_forderungen','Bilanz – Forderungen','bilanz','AKTIVA'),
  ('150000','Sonstige Forderungen','bilanz_forderungen','Bilanz – Forderungen','bilanz','AKTIVA'),
  ('150110','Sicherheitseinbehalte (Debitoren)','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('150719','Sicherheitseinbehalte (Factoring)','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('150720','Forderungen/Verbindlichkeiten BNP (Factoring)','bilanz_forderungen','Bilanz – Forderungen','bilanz','PASSIVA'),
  ('152500','gegebene Kautionen','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('153000','Forderungen gegen Personal','bilanz_forderungen','Bilanz – Forderungen','bilanz','AKTIVA'),
  ('154500','Ford./Verb. aus Steuern vom Einkommen und Ertrag','bilanz_steuern','Bilanz – Steuerforderungen und -schulden','bilanz','AKTIVA'),
  ('154900','Vorsteuer im Folgejahr/in Folgeperiode abziehbar','bilanz_steuern','Bilanz – Steuerforderungen und -schulden','bilanz','AKTIVA'),
  ('155011','Forderungen Zinsen auf Steuererstattungen','bilanz_steuern','Bilanz – Steuerforderungen und -schulden','bilanz','PASSIVA'),
  ('157000','Vorsteuer','bilanz_steuern','Bilanz – Steuerforderungen und -schulden','bilanz','PASSIVA'),
  ('157010','Vorsteuer (Altteile)','bilanz_steuern','Bilanz – Steuerforderungen und -schulden','bilanz','PASSIVA'),
  ('157030','Erwerbsteuer (Eingang)','bilanz_steuern','Bilanz – Steuerforderungen und -schulden','bilanz','PASSIVA'),
  ('157040','Vorsteuer Vergütung Ausland','bilanz_steuern','Bilanz – Steuerforderungen und -schulden','bilanz','AKTIVA'),
  ('158800',NULL,'bilanz_forderungen','Bilanz – Forderungen','bilanz',NULL),
  ('159000','Durchl.Posten Kasse','bilanz_forderungen','Bilanz – Forderungen','bilanz',NULL),
  ('160000','Verbindlichkeiten aus Lieferungen und Leistungen','bilanz_verbindlichkeiten','Bilanz – Verbindlichkeiten','bilanz','PASSIVA'),
  ('160010','Verbindlichkeiten gegenüber verbundenen Unternehme','bilanz_verbindlichkeiten','Bilanz – Verbindlichkeiten','bilanz','PASSIVA'),
  ('160040','Verbindlichkeiten im Rahmen d. sozialen Sicherheit','bilanz_verbindlichkeiten','Bilanz – Verbindlichkeiten','bilanz','PASSIVA'),
  ('160050','Verbindlichkeiten nicht L+L','bilanz_verbindlichkeiten','Bilanz – Verbindlichkeiten','bilanz','PASSIVA'),
  ('166055','Verbindlichkeiten Nicht LuL (BNP Zinsen)','bilanz_verbindlichkeiten','Bilanz – Verbindlichkeiten','bilanz','PASSIVA'),
  ('170510','erhaltene Darlehen von Gesellschaftern','bilanz_darlehen','Bilanz – Darlehen','bilanz','PASSIVA'),
  ('173200','Erhaltene Kautionen','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz','PASSIVA'),
  ('174000','Verbindlichkeiten aus Lohn und Gehalt','bilanz_verbindlichkeiten','Bilanz – Verbindlichkeiten','bilanz','PASSIVA'),
  ('174020','Verbindlichkeiten Pfändung','bilanz_verbindlichkeiten','Bilanz – Verbindlichkeiten','bilanz','AKTIVA'),
  ('174030','Verbindlichkeiten Direktversicherung','bilanz_verbindlichkeiten','Bilanz – Verbindlichkeiten','bilanz','AKTIVA'),
  ('174040','Verbindlichkeiten gegen Mitarbeiter','bilanz_verbindlichkeiten','Bilanz – Verbindlichkeiten','bilanz','PASSIVA'),
  ('174050',NULL,'bilanz_verbindlichkeiten','Bilanz – Verbindlichkeiten','bilanz',NULL),
  ('174100','Verbindlichkeiten aus Lohn-u.Kirchensteuer','bilanz_steuern','Bilanz – Steuerforderungen und -schulden','bilanz','AKTIVA'),
  ('174200','Verbindlichkeiten im Rahmen d. sozialen Sicherheit','bilanz_verbindlichkeiten','Bilanz – Verbindlichkeiten','bilanz','AKTIVA'),
  ('177000','Ausgangssteuer','bilanz_steuern','Bilanz – Steuerforderungen und -schulden','bilanz','PASSIVA'),
  ('177060','Erwerbsteuer Ausgang','bilanz_steuern','Bilanz – Steuerforderungen und -schulden','bilanz','PASSIVA'),
  ('178890','USt Zahllast Organträger','bilanz_steuern','Bilanz – Steuerforderungen und -schulden','bilanz','PASSIVA'),
  ('178901','Zahllast laufendes Jahr Finanzamt','bilanz_steuern','Bilanz – Steuerforderungen und -schulden','bilanz','PASSIVA'),
  ('191529','V-Kto. ALBA SE (4000)','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz','PASSIVA'),
  ('194406','V-Kto 2 ALBA KG (5002)','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz','PASSIVA'),
  ('199901',NULL,'bilanz_verbindlichkeiten','Bilanz – Verbindlichkeiten','bilanz',NULL),
  ('200000','a.o.Aufwendungen','neutral','Neutrales Ergebnis','neutral',NULL),
  ('201000','Sonstige periodenfremde Aufwendungen','neutral','Neutrales Ergebnis','neutral','PASSIVA'),
  ('201010','übrige neutrale Aufwendungen','neutral','Neutrales Ergebnis','neutral',NULL),
  ('21000','Maschinen','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('210000','Übrige Zinsen und ähnliche Aufwendungen','finanzergebnis','Finanzergebnis','kosten','PASSIVA'),
  ('210001','Zinsen und Nebenleistungen auf Steuerzah','finanzergebnis','Finanzergebnis','kosten','PASSIVA'),
  ('210010','Zinsaufwand Aufzinsung Rückstellungen','finanzergebnis','Finanzergebnis','kosten',NULL),
  ('210900','Zinsaufwendungen an verbundene Unternehm','finanzergebnis','Finanzergebnis','kosten','PASSIVA'),
  ('210901','Zinsaufwand verbundene Steuerzahlungen','finanzergebnis','Finanzergebnis','kosten',NULL),
  ('212000','Zinsaufwand Tilgungsdarlehen ggü. KI','finanzergebnis','Finanzergebnis','kosten',NULL),
  ('212200','Zinsen aus Mietkauf und Finanzierungslea','finanzergebnis','Finanzergebnis','kosten',NULL),
  ('213101','Zinsen Factoring','finanzergebnis','Finanzergebnis','kosten','PASSIVA'),
  ('213200','Avalgebühren und -provisionen','finanzergebnis','Finanzergebnis','kosten','PASSIVA'),
  ('213300','Bereitstellungsprov. und ähnliche lfd. B','finanzergebnis','Finanzergebnis','kosten',NULL),
  ('215000','Aufwendungen aus Kursdifferenzen','neutral','Neutrales Ergebnis','neutral',NULL),
  ('220000','Körperschaftsteuer','neutral','Neutrales Ergebnis','neutral',NULL),
  ('221200',NULL,'neutral','Neutrales Ergebnis','neutral',NULL),
  ('231000','Mindererlös bei Anlagenabgang','neutral','Neutrales Ergebnis','neutral',NULL),
  ('231500','Mehrerlös bei Anlagenabgang','neutral','Neutrales Ergebnis','neutral','PASSIVA'),
  ('235000','Grundstücksaufwendungen (f.vermietete Gr','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('237500','Grundsteuern (f.vermietete Grundstücke)','steuern_sonstige','Sonstige Steuern','kosten',NULL),
  ('238000','Spenden (keine Werbung)','neutral','Neutrales Ergebnis','neutral',NULL),
  ('238102','Aufwand Factoringentgelt','neutral','Neutrales Ergebnis','neutral',NULL),
  ('240000','Uneinbringliche Forderungen','neutral','Neutrales Ergebnis','neutral',NULL),
  ('240010','Verbrauch EWB Uneinbring.Forder.Korrektu','neutral','Neutrales Ergebnis','neutral',NULL),
  ('243000','Einstellung i.d.EWB zu Forderungen','neutral','Neutrales Ergebnis','neutral',NULL),
  ('245000','Einstellung i.d.PWB zu Forderungen','neutral','Neutrales Ergebnis','neutral',NULL),
  ('251000','Sonstige periodenfremde Erträge','neutral','Neutrales Ergebnis','neutral','PASSIVA'),
  ('251002','Konzernumlage - periodenfremder Ertrag','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('252000','andere sonst.betriebl. Erträge','sonstige_ertraege','Sonstige betriebliche Erträge','umsatz','PASSIVA'),
  ('26000','Transportanlagen u.ä.','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('260000','Erträge aus Beteiligungen','finanzergebnis','Finanzergebnis','kosten',NULL),
  ('265001','Zinsen auf Steuererstattungen','finanzergebnis','Finanzergebnis','kosten','PASSIVA'),
  ('265030','Übrige Zinsen und ähnliche Erträge','finanzergebnis','Finanzergebnis','kosten',NULL),
  ('265900','Sonstige Zinsen und ähnl. Erträge verb.U','finanzergebnis','Finanzergebnis','kosten','PASSIVA'),
  ('266000','Erträge aus Kursdifferenzen','neutral','Neutrales Ergebnis','neutral',NULL),
  ('266010','Erträge aus Kursdifferenzen (FW-Bewertun','neutral','Neutrales Ergebnis','neutral',NULL),
  ('271000','Erträge aus Zuschreibungen des Anlagenve','neutral','Neutrales Ergebnis','neutral',NULL),
  ('272000','Verrechnete Erlöse aus Anlagenverkauf','neutral','Neutrales Ergebnis','neutral','PASSIVA'),
  ('273000','Erträge aus Herabsetzung Pausch-Wertber.','neutral','Neutrales Ergebnis','neutral',NULL),
  ('273100','Erträge aus Herabsetzung Einzelwertber.','neutral','Neutrales Ergebnis','neutral',NULL),
  ('273200','Erträge aus ausgebuchten Forderungen','neutral','Neutrales Ergebnis','neutral',NULL),
  ('273500','Erträge Auflösung von Rückstellungen (ac','neutral','Neutrales Ergebnis','neutral','PASSIVA'),
  ('274200','Versicherungsentschädigungen','sonstige_ertraege','Sonstige betriebliche Erträge','umsatz','PASSIVA'),
  ('277100','Steuernachzahl. E + E Vorjahre','bilanz_steuern','Bilanz – Steuerforderungen und -schulden','bilanz','PASSIVA'),
  ('278000','StEr E+E VJ bis 2025','neutral','Neutrales Ergebnis','neutral',NULL),
  ('278100','Steuererstattung E + E Vorjahre','bilanz_steuern','Bilanz – Steuerforderungen und -schulden','bilanz','PASSIVA'),
  ('278500','Steuererstattung Vorjahre sonstige Steue','steuern_sonstige','Sonstige Steuern','kosten',NULL),
  ('279400','Erh.Gewinne aus Gewinnabführungsvertrag','finanzergebnis','Finanzergebnis','kosten',NULL),
  ('28000','Betriebsvorrichtungen','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('286900','andere sonstige betriebliche Aufwendunge','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('286910','Verbrauch EWB Periodenfr. Erträge(Korr.K','neutral','Neutrales Ergebnis','neutral',NULL),
  ('287090','Erträge Mahngebühren','sonstige_ertraege','Sonstige betriebliche Erträge','umsatz','PASSIVA'),
  ('287095','Erträge Zinsen Debitoren','finanzergebnis','Finanzergebnis','kosten','PASSIVA'),
  ('289200','Verr. kalk. Zinsen','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz','PASSIVA'),
  ('289300','Verr. kalk. Abschreibungen','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz','PASSIVA'),
  ('300030','Ankauf Kunststoff (Rohstoff zur Weiterve','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('300040','Ankauf Schrott (Rohstoff zur Weiterverar','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('300050','Ankauf Holz (Rohstoff zur Weiterverarbei','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('300060','Ankauf and.Recycl-Prod(Rohstoff zur Weit','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('300075','Materialaufwand Abbruch u. Rückbau','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('310010','Reinigungsmaterial','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('310030','Strom (vornehmlich industr. Anlagen)','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('310040','Gas (vornehmlich industr. Anlagen)','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('310050','Wasser (vornehmlich industr. Anlagen)','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('310080','Technische Gase','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('310900','Sonstige Hilfs- und Betriebsstoffe','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('32000','PKW','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('320050','Warenankauf HW Ersatzteile','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('330120','Ankauf HW Fahrzeuge','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('330900','Erhaltene Skonti','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('340010','Deponie- u.Kippgebühren (incl. Wiegegebü','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('340020','Sonstige Fremdleistungen','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('340030','Fremdleistungen Personal','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('340045','Fremdleistungen Miete Immobilien','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('340050','Fremdleistungen Wartung/Pflege','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('340090','Sonstige bezogene Leistungen( Labor )','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('340100','Fremdleistungen Fuhrleistungen incl. Kip','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('340110','Fremdleistungen Fuhrleistungen ohne Kipp','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('340111','Fremdleist. Fuhrleistg. (o.Kippgeb) Vert','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('340500','Fremdleistungen Containerstandplätze','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('340600','Bezogene Leistung periodenfremd','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('35000','LKW','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('350500','Weiterzuberechnende Fremdkosten','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('36000','Schneefahrzeuge','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('38000','Sonstige Transportmittel','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('380950','Bestände Ersatzteile','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('391000','Betandsveränderungen Fertigerzeugnisse','leistung_fertig','Bestandsveränderung fertig','leistung_fertig',NULL),
  ('392000','Bestandsveränderungen unfertige Erzeugni','leistung_unfertig','Bestandsveränderung unfertig','leistung_unfertig','PASSIVA'),
  ('40000','Betriebsausstattung','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('400010','Instandhaltung Lastkraftwagen','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('400011','Reifenkosten','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('400020','Instandhaltung Personenkraftwagen','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('400030','Instandhaltung selbstfahrende Arbeitsmas','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('400035','Instandhaltung Miet-und Leasingfahrzeuge','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('400040','DEKRA / TÜV / sonstige Gebühren Fuhrpark','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('400111','Anmietung LKW','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('400112','Leasing LKW','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('400121','Anmietung PKW','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('400122','Leasing PKW','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('400131','Anmietung selbstfahrende Arbeitsmaschine','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('400132','Leasing selbstfahrende Arbeitsmaschinen','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('401000','Aufwand Diesel','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('401010','Benzin/Super','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('401015','Alternative Antriebe (u.a. Strom, Wasser','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('401020','Öle und Fette','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('401030','Kfz-Steuern','steuern_sonstige','Sonstige Steuern','kosten','PASSIVA'),
  ('401040','Kfz-Versicherungen','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('401050','Autobahngebühren LKW','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('41000','Geschäftsausstattung/ EDV','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('410000','Löhne','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('410010','Lohnfortzahlung','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('410020','Weihnachtsgratifikation Lohnempfänger','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('410030','Sonderzahlungen und Prämien Lohnempfänge','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('410050','Überstunden Lohnempfänger','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('410060','Aushilfen gewerbl. (Lohnübernahme)','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('410065','Zuschuss Arbeitsamt (Löhne)','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('410100','Gehalt','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('410110','Gehaltsfortzahlung','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('410120','Weihnachtsgratifikation Gehaltsempfänger','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('410130','Sonderzahlungen und Prämien Gehaltsempfä','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('410150','Überstunden Gehaltsemfänger','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('410160','Aushilfen Angestellte (Lohnübernahme)','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('410165','Zuschuss Arbeitsamt (Gehälter)','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('411000','Altersversorgung und Unterstützung','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('411010','Beiträge Berufsgenossenschaft','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('411020','Sozialabgaben','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('411021','Arbeitgeberanteil zur gesetzl. RentenVer','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('411030','Arbeitgeberzuschuß VWL','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('411040','Ausgleichsabgabe','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('411050','Personalversicherung','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('411070','Personalwerbung','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('411090','Schulung und Ausbildung','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('411100','Arbeitskleidung und Arbeitschutzbedarf','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('411890','Reisekosten für Schulungen','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('411900','Sonstige Personalkosten','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('411910','Lohnzuschüsse (Lohnübernahme)','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('42000','Büroeinrichtung','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('420010','Instandhaltungskosten eigene Grundst. un','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('420011','Instandhaltungskosten fremde Grundst. un','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('420012','Sonstige Kosten Grundstücke und Gebäude','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('420015','Instandhaltungskosten fremde  Gebäude','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('420020','Raumpflege','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('420021','Raumpflege eigene Gebäude','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('420022','Raumpflege fremde Gebäude','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('420030','Aufwand Energie','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('420040','Aufwand Wasser','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('420050','Aufwand Heizmaterial','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('420060','Aufwand eigene Entsorgung','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('420100','Instandhaltung Betriebsausstattung','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('420300','Instandhaltung maschinelle Anlagen','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('420400','Instandhaltung Geschäftsausstattung','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('420450','Instandh./Reparatur/Wartung Miet- u. Lea','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('420500','Instandhaltung Behälter','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('420600','Werkstattbedarf (Kleinwerkzeuge b.100,-D','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('420700','Verbrauch Hilfs- u. Betriebsstoffe','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('421000','Behälterkauf unter 51,13 EUR (100,00 DM)','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('43000','Werkstatteinrichtung','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('430010','Vermögensteuer, Grundsteuer u.a.','steuern_sonstige','Sonstige Steuern','kosten','PASSIVA'),
  ('430020','Gewerbeertragsteuer','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('430030','Gewerbekapitalsteuer','steuern_sonstige','Sonstige Steuern','kosten',NULL),
  ('430040','Sonstige Steuern','steuern_sonstige','Sonstige Steuern','kosten','PASSIVA'),
  ('430110','Aufwendungen für Versicherungsschäden','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('430120','Sonstige Versicherungen','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('430121','Warenkreditversicherung','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('431010','Mieten Räume','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('431020','Mieten Plätze','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('431031','Miete Geräte ( Betriebsausstattung)','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('431032','Leasing Geräte ( Betriebsausstattung)','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('431041','Miete Behälter','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('431051','Mieten sonstige Geschäftsausstattung','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('431052','Leasing sonstige Geschäftsausstattung','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('431090','Sonstige Mieten','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('44000','Werkzeuge','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('440020','Kosten der Vermarktung','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('440050','Transportkosten (außerhalb Recy)','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('45000','Container,Pressen und Behälter','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('450010','Reisekosten Betriebsangehörige','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('450011','Verpfl.mehraufwand (pauschal)','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('450012','Kilometergeld (pauschal)','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('450013','Kürzung Verpfleg.mehraufwand','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('450020','Reisekosten Betriebsfremde','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('450030','Bewirtung zu 100 % abzugsfähig','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('450039','Bewirtung zu 70 % abzugsfähig','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('450040','Bewirtung zu 80 % abzugsfähig','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('450045','Dienstleistung Kundenbetreuung AlDe','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('450050','Allgemeine Repräsentationskosten','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('450061','Geschenke Zuwend. < Wertgrenze Dritte/Ar','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('450071','Geschenke oberhalb Wertgrenze § 4 Abs 5','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('450080','Werbung','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('450081','Sponsoring','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('450090','Messe und Ausstellungen','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('450120','Spesen (Lohnübernahme ohne VSt.)','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('460010','Büromaterial','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('460020','Zeitungen, Zeitschrift.und Bücher','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('460030','Telekommunikation','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('460040','Portogebühren','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('460050','Kosten des Geldverkehrs','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('460060','Kosten EDV','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('460065','IT Lizenzgebühren','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('460070','Entwicklungs- und Planungskosten','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('460080','Pflichtbeiträge zu Verbänden','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('460081','Beiträge zu sonstigen Vereinigungen','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('460090','Schreib- und Verwaltungsgebühren an Behö','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('460095','Ordnungsgelder/Geldbußen steuerlich nich','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('460200','Beiträge Fachtagungen','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('460900','Sonstige Verwaltungskosten','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('470010','Anwalts- und Gerichtskosten','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('470020','kaufm. Beratung und Buchführung','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('470025','Steuerberatungskosten','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('470030','Beratungskosten Allgemeine Verwaltung','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('470036','Aufwendungen Umlage zentrale Verwaltung','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('470037','Leistungen zentrale Steuerabteilung','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('48000','Betriebsausstattung GWG','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('480100','Normalabschreibung auf Anlagen','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('480110','Abschreibungen auf Anlagen (GWG)','betriebsaufwand','Betrieblicher Aufwand','kosten','PASSIVA'),
  ('480300','Abschreibungen auf Umlaufvermögen','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('48100','Geschäftsausstattung GWG','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('499200','Kalk. Zinsen','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz','PASSIVA'),
  ('499300','Kalk. Abschreibungen','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz','PASSIVA'),
  ('49951','Bestände unfertige Erzeugnisse','bilanz_bestand','Bilanz – Vorräte / unfertige Erzeugnisse','bilanz','AKTIVA'),
  ('49972','Erhaltene Anzahlungen auf Vorräte','bilanz_anzahlungen','Bilanz – Erhaltene Anzahlungen','bilanz','PASSIVA'),
  ('49999','Anlagenverrechnungsk','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz',NULL),
  ('560002','Arbeitsplatz','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('560004','Druck & Scanservices','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('560006','ERP-Systeme','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('560007','HR-Systeme','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('560008','Mobile Communications','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('560009','Sonstige Software','betriebsaufwand','Betrieblicher Aufwand','kosten',NULL),
  ('599131','Gegenkonto Abgrenzung Berufsgenossenschaft','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz','PASSIVA'),
  ('599136','Gegenkonto Abgrenzung variable Vergütung','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz','PASSIVA'),
  ('599992','Gegenkonto Kostenabgrenzungen (Rückstell.)','bilanz_rueckstellungen','Bilanz – Rückstellungen','bilanz','PASSIVA'),
  ('599994','Gegenkonto aus Kostenabgrenzung Verb. L&L','bilanz_verbindlichkeiten','Bilanz – Verbindlichkeiten','bilanz','PASSIVA'),
  ('7611100','LV Gruppe 1','verrechnung_sap','SAP-Verrechnung','verrechnung',NULL),
  ('7611150','LV manuell','verrechnung_sap','SAP-Verrechnung','verrechnung',NULL),
  ('7611200','LV Gruppe 2','verrechnung_sap','SAP-Verrechnung','verrechnung',NULL),
  ('7612000','Geräteverrechnung','verrechnung_sap','SAP-Verrechnung','verrechnung',NULL),
  ('7652100','Umlagen','verrechnung_sap','SAP-Verrechnung','verrechnung',NULL),
  ('7670000','Teil-/Abrechnung Projekte','verrechnung_sap','SAP-Verrechnung','verrechnung',NULL),
  ('7801020','Gemeinkostenzuschläge 12 %','verrechnung_sap','SAP-Verrechnung','verrechnung',NULL),
  ('799995','Gegenkto.Erlabg.FoLL','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz',NULL),
  ('80000','Gezeichnetes Kapital','bilanz_eigenkapital','Bilanz – Eigenkapital / Ergebnisverwendung','bilanz','PASSIVA'),
  ('810300','Erlöse Verkauf aus Aufbereitung','umsatzerloese','Umsatzerlöse','umsatz',NULL),
  ('810400','Erlöse Verkauf Wertstoffe','umsatzerloese','Umsatzerlöse','umsatz',NULL),
  ('830500','Erlöse sonstige Dienstleistungen','umsatzerloese','Umsatzerlöse','umsatz',NULL),
  ('830510','Erlöse Abrisse/Demontagen','umsatzerloese','Umsatzerlöse','umsatz','PASSIVA'),
  ('84000','Kapitalrücklage','bilanz_eigenkapital','Bilanz – Eigenkapital / Ergebnisverwendung','bilanz','PASSIVA'),
  ('840040','Erlöse Verkauf HW Schrott','umsatzerloese','Umsatzerlöse','umsatz','PASSIVA'),
  ('840070','Umsatzerlöse aus DL Systemgeschäft','umsatzerloese','Umsatzerlöse','umsatz',NULL),
  ('840120','Erlöse Verkauf HW Fahrzeuge','umsatzerloese','Umsatzerlöse','umsatz',NULL),
  ('840400','Erlöse Verkauf HW Schrott and.Länder','umsatzerloese','Umsatzerlöse','umsatz',NULL),
  ('85500','Andere Gewinnrücklagen','bilanz_eigenkapital','Bilanz – Eigenkapital / Ergebnisverwendung','bilanz','PASSIVA'),
  ('860000','Erlöse weiterberechnete Fremdkosten','sonstige_ertraege','Sonstige betriebliche Erträge','umsatz','PASSIVA'),
  ('86800','Gewinn- oder Verlustvortrag','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz','PASSIVA'),
  ('86801','Gewinn- oder Verlustvortrag (HGB nur FW Bew.)','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz','PASSIVA'),
  ('880000','Erlöse aus Vermietung Immobilien','sonstige_ertraege','Sonstige betriebliche Erträge','umsatz',NULL),
  ('890010','Erlöse Anlagenverkäufe','neutral','Neutrales Ergebnis','neutral','PASSIVA'),
  ('890100','Gewährte Skonti','umsatzerloese','Umsatzerlöse','umsatz','PASSIVA'),
  ('890200','Erlöse selbstgenutzte Fahrzeuge','sonstige_ertraege','Sonstige betriebliche Erträge','umsatz','PASSIVA'),
  ('890800','Erlöse Zahlungsdifferenzen Debitoren','sonstige_ertraege','Sonstige betriebliche Erträge','umsatz','PASSIVA'),
  ('890900','Erlöse Vorjahr','umsatzerloese','Umsatzerlöse','umsatz',NULL),
  ('900021','Verb.geg.Gesel.(Korr','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz',NULL),
  ('900025','Ford.Lie/Leis.(Korr','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz',NULL),
  ('900051','Kautionen (Korrektur','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz',NULL),
  ('900052','Kautionen (Restl.>1J','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz',NULL),
  ('900061','Verb.Lief.Leist.(Kor','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz',NULL),
  ('900065','Verb.verb.Unt.(Kor','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz',NULL),
  ('900088','Sonst. Verbl. (Korr)','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz',NULL),
  ('900091','Verblk.sonst.Ste(Kor','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz',NULL),
  ('900400','Deb. Kreditor Lief/L','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz',NULL),
  ('900410','Deb.Kreditor Lief vU','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz',NULL),
  ('900440','Deb.Kred.VerbGesL+L','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz',NULL),
  ('900460','Deb.Kred.VerbNichtL','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz',NULL),
  ('900500','Kred. Debit.Lief/Lei','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz',NULL),
  ('95510','Gewerbesteuerrückstellung','bilanz_steuern','Bilanz – Steuerforderungen und -schulden','bilanz','PASSIVA'),
  ('95520','Körpersch.Rü. + SolZ','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz',NULL),
  ('97030','RS f.aussteh.RE/Lstg','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz',NULL),
  ('97035','Rückst. f. Jahresabschluss/Rechtsberatung','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz','PASSIVA'),
  ('97200','Rückstellung Berufsgenossenschaft','bilanz_rueckstellungen','Bilanz – Rückstellungen','bilanz','PASSIVA'),
  ('97201',NULL,'bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz',NULL),
  ('97202','Rückstellung Urlaubsverpflichtungen','bilanz_rueckstellungen','Bilanz – Rückstellungen','bilanz','PASSIVA'),
  ('97207','Rückstellung Variable Vergütung','bilanz_rueckstellungen','Bilanz – Rückstellungen','bilanz','PASSIVA'),
  ('97209','Rückstellung Überstunden/Mehrarbeit','bilanz_rueckstellungen','Bilanz – Rückstellungen','bilanz','PASSIVA'),
  ('97300','Rückstellung für Zinsen auf Steuernachzahlungen','bilanz_steuern','Bilanz – Steuerforderungen und -schulden','bilanz','PASSIVA'),
  ('98002','ARAP Kfz-Steuer','bilanz_steuern','Bilanz – Steuerforderungen und -schulden','bilanz','AKTIVA'),
  ('98004','ARAP sonstige Versicherungen','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('98006','ARAP OP-verwaltet','bilanz_anlagevermoegen','Bilanz – Anlagevermögen','bilanz','AKTIVA'),
  ('99800','EWB auf Forderungen','bilanz_forderungen','Bilanz – Forderungen','bilanz','AKTIVA'),
  ('999920','Übernahme-Konto offene Posten Debitoren','bilanz_abgrenzung','Bilanz – Abgrenzung / Statistik','bilanz','PASSIVA'),
  ('999930','Übernahme-Konto offene Posten Kreditoren','bilanz_darlehen','Bilanz – Darlehen','bilanz','PASSIVA');

/* Bilanzkennzeichen in den Kostenartenstamm uebernehmen, damit Bestandskonten
   nicht versehentlich in eine Ergebnisrechnung laufen. */
ALTER TABLE controlling.kostenarten
  ADD COLUMN IF NOT EXISTS ist_bilanzkonto BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE controlling.kostenarten k
   SET ist_bilanzkonto = (c.kategorie LIKE 'bilanz%')
  FROM controlling.kontenkatalog_tvf c
 WHERE c.konto = k.kontonummer::text;


-- ---------------------------------------------------------------------------
--  Abgleich der eigenen Klassifizierung gegen den Kontenkatalog
--
--  Der Katalog ist die neuere und breitere Quelle (341 Konten, Stand 18.08.2026).
--  Diese View stellt beide Verfahren je Konto gegenueber, damit Abweichungen
--  sichtbar bleiben statt stillschweigend zu verschwinden.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW controlling.v_klassifizierung_abgleich AS
WITH erwartung AS (
  SELECT k.kostenart_id, k.kostenart_nr, k.kontonummer, k.bezeichnung,
         k.db_stufe, k.klr_typ, k.quelle,
         c.kategorie, c.kategorie_text, c.import_art,
         CASE c.kategorie
           WHEN 'umsatzerloese'     THEN ARRAY[0]
           WHEN 'sonstige_ertraege' THEN ARRAY[0,9]
           WHEN 'leistung_unfertig' THEN ARRAY[0]
           WHEN 'leistung_fertig'   THEN ARRAY[0]
           WHEN 'betriebsaufwand'   THEN ARRAY[1,2]
           WHEN 'verrechnung_sap'   THEN ARRAY[1,2]
           WHEN 'neutral'           THEN ARRAY[9]
           WHEN 'finanzergebnis'    THEN ARRAY[9]
           WHEN 'steuern_sonstige'  THEN ARRAY[9]
           ELSE ARRAY[9]
         END AS erwartete_stufen
    FROM controlling.kostenarten k
    JOIN controlling.kontenkatalog_tvf c ON c.konto = k.kontonummer::text
)
SELECT e.*,
       (e.db_stufe = ANY(e.erwartete_stufen)) AS stimmt_ueberein,
       COALESCE(b.belege, 0) AS belege,
       COALESCE(b.saldo, 0)  AS saldo
  FROM erwartung e
  LEFT JOIN (SELECT kostenart_id, COUNT(*) belege, SUM(wert) saldo
               FROM controlling.v_buchung WHERE ergebnisrelevant
              GROUP BY kostenart_id) b ON b.kostenart_id = e.kostenart_id;


COMMIT;
