/* ---------------------------------------------------------------------------
   Bilanz und GuV nach der Kontenzuordnung aus SAP
   ---------------------------------------------------------------------------
   Bisher grenzte jede Ergebnisrechnung die GuV ueber kostenarten.guv_gruppe
   ab.  Das war der Fehler, an dem sich alles aufgehalten hat: der Kontenstamm
   fuehrt Kassen, Forderungen und ARAP mit, und wer ihn zur GuV erklaert,
   rechnet Bilanzkonten ins Ergebnis.  Deshalb stimmte keine einzige Zeile.

   Massgeblich ist ab hier der Bericht, den SAP selbst ausgibt (RFBILA00,
   Geschaeftsjahr 2026, Buchungsperiode 7).  Er bringt die Kontenzuordnung
   mit: jedes Konto haengt an einer Bilanz-/GuV-Position, die Positionen
   haengen ineinander.  Die Aufrisslogik steckt in der Positionsnummer -
   eine Position enthaelt alle Konten, deren Position mit ihr beginnt, wenn
   man die nachlaufenden Nullen abschneidet.  0030100000 ("00301") faengt so
   0030110120 und 0030110130 mit ein.

   Probe gegen den Bericht, Januar bis Juli 2026, SAP-Vorzeichen:

     Umsatzerloese                       -10.450.250,85
     Bestandsveraenderung                 -3.886.319,32
     Sonstige betriebliche Ertraege         -162.767,35
     Materialaufwand                      10.258.197,78
     Personalaufwand                       2.671.099,13
     Abschreibungen                           66.566,92
     Sonstige betriebliche Aufwendungen    1.738.357,25
     Finanzergebnis                           67.462,28
     Ergebnis der gew. Geschaeftstaetigk.    302.345,84

   Alle 123 GuV-Konten des Berichts stimmen auf den Cent mit unseren
   SAP-Einzelposten ueberein.  Die Daten waren nie falsch, nur die Gruppen.

   Der Personalaufwand ist damit entschieden: 2.671.099,13 EUR - die Zahl der
   Folie 22.  Die 2.489.312 der alten guv_referenz waren um den
   Arbeitgeberanteil Rentenversicherung zu niedrig.

   Festgeschrieben wird hier nur die Zuordnung, kein einziger Betrag.  Alle
   Zahlen rechnet die Datenbank aus den Einzelposten; der Bericht dient als
   Probe, nicht als Quelle.
--------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS controlling.bilanz_guv_position (
  position    varchar(20) PRIMARY KEY,
  text        varchar(255) NOT NULL,
  stufe       smallint     NOT NULL,
  sortierung  integer      NOT NULL
);
COMMENT ON TABLE controlling.bilanz_guv_position IS
  'Positionen der Bilanz-/GuV-Gliederung aus SAP (RFBILA00). Aufriss ueber die Positionsnummer ohne nachlaufende Nullen.';

CREATE TABLE IF NOT EXISTS controlling.bilanz_guv_konto (
  konto     varchar(20) PRIMARY KEY,
  position  varchar(20) NOT NULL REFERENCES controlling.bilanz_guv_position(position),
  text      varchar(255)
);
COMMENT ON TABLE controlling.bilanz_guv_konto IS
  'Zuordnung Sachkonto zu Bilanz-/GuV-Position, wie SAP sie fuehrt.';

INSERT INTO controlling.bilanz_guv_position (position, text, stufe, sortierung) VALUES
  ('0010000000', 'A K T I V A', 2, 1),
  ('0010300000', 'Anlagevermoegen', 3, 2),
  ('0010320000', 'Sachanlagen', 4, 3),
  ('0010320200', 'Technische Anlagen und Maschinen', 6, 4),
  ('0010320300', 'Andere Anlagen, Betriebs- und Geschaefts-', 5, 6),
  ('0010320310', 'Fahrzeuge', 6, 8),
  ('0010320320', 'Behaelter', 6, 9),
  ('0010320330', 'And. Anlagen / sonst. BGA', 6, 10),
  ('0010400000', 'Umlaufvermoegen', 3, 15),
  ('0010410000', 'Vorraete', 4, 16),
  ('0010410100', 'Roh-,Hilfs- und Betriebsstoffe', 5, 17),
  ('0010410200', 'Unfertige Erzeugnisse, unfertige Leistungen', 5, 18),
  ('0010410500', 'Erhaltene Anzahlungen auf Bestellungen', 5, 19),
  ('0010420000', 'Ford. / Sonst. VgG', 4, 21),
  ('0010420100', 'Ford. L+L', 5, 22),
  ('0010420110', 'Ford. L+L Nominalwert (RLZ<1J)  ab 102015', 6, 23),
  ('0010420111', 'EWB auf Forderungen L+L (RLZ < 1J) ab 102015', 6, 24),
  ('0010420113', 'Veräußerte Ford.Factoring(RLZ < 1J)ab 102015', 6, 25),
  ('0010420200', 'Ford. verbund.', 5, 27),
  ('0010420210', 'Ford.verb. L+L', 6, 28),
  ('0010421000', 'Sonst. VermögensG.', 5, 30),
  ('0010421100', 'sonst. Steuerford.', 7, 31),
  ('0010421110', 'sonst. Steuerford. (RLZ <1J)', 8, 32),
  ('0010421300', 'And. sonst. VermögensG.', 6, 33),
  ('0010421310', 'And. sonst. VG (RLZ <1J)', 7, 34),
  ('0010421320', 'And. sonst. VG (RLZ >1J)', 7, 35),
  ('0010440000', 'Schecks, Kassenbestand, Bundesbank- und Post-', 4, 38),
  ('0010440010', 'Kasse', 5, 40),
  ('0010600000', 'ARAP', 3, 43),
  ('0010630000', 'ARAP Sonstige', 4, 44),
  ('0020000000', 'P A S S I V A', 2, 47),
  ('0020100000', 'Eigenkapital', 3, 48),
  ('0020110000', 'Gezeichnetes Kapital / Kommanditkapital', 4, 49),
  ('0020130000', 'Kapitalruecklagen', 4, 50),
  ('0020140000', 'Gewinnrücklagen', 4, 51),
  ('0020140400', 'Andere Gewinnrücklagen', 5, 52),
  ('0020162100', 'Bilanzgewinn', 4, 53),
  ('0020300000', 'Rueckstellungen', 3, 55),
  ('0020340000', 'Sonstige Rueckstellungen', 4, 56),
  ('0020340200', 'Uebrige Rueckstellungen', 5, 57),
  ('0020400000', 'Verbindlichkeiten', 3, 59),
  ('0020440000', 'Verbindlk. L+L', 4, 60),
  ('0020440100', 'Verblk. L+L (RLZ <1J)', 5, 61),
  ('0020460000', 'Verblk. verbund.', 4, 63),
  ('0020460100', 'Verb. verbund. L+L', 5, 64),
  ('0020460200', 'Verb. verbund. Transfer', 5, 65),
  ('0020460300', 'Verb. verbund. Sonst.', 5, 66),
  ('0020490000', 'Sonst. Verbindlichkeiten', 4, 68),
  ('0020490100', 'Verblk. sonst. Steuern', 6, 69),
  ('0020490110', 'Verblk. sonst. Steuern (RLZ <1J)', 7, 70),
  ('0020491000', 'And. Sonst. Verbindlk.', 5, 71),
  ('0020491100', 'Verb. Lohn und Gehalt', 6, 72),
  ('0020491200', 'Uebr.and.sonst.Verb.', 6, 73),
  ('0020500000', 'PRAP ohne Abgrenz.', 4, 77),
  ('0030000000', 'GuV- Gesamtkostenverfahren', 2, 79),
  ('0030100000', 'Umsatzerloese', 5, 80),
  ('0030110100', 'Umsatzerloese Deutschland', 6, 81),
  ('0030110119', 'Erl. sonst. DL Deutschland', 7, 82),
  ('0030110120', 'Erl. sonst. DL Deutschland', 8, 83),
  ('0030110130', 'Erl. Waren Dt.', 7, 86),
  ('0030120000', 'Erloesschmaelerungen', 6, 89),
  ('0030200000', 'Bestandsveraend. UE und FE', 5, 91),
  ('0030400000', 'Sonst. betriebl. Ertraege', 5, 92),
  ('0030410000', 'Neutrale Ertraege', 6, 93),
  ('0030410100', 'Buchgewinne', 7, 94),
  ('0030410140', 'Ertr. Auflös. Rueckstellungen', 7, 95),
  ('0030410160', 'Periodenfr. Ertraege', 7, 96),
  ('0030410190', 'Uebrige neutrale Ertraege', 7, 97),
  ('0030430000', 'Andere sonstige betriebliche Ertraege', 6, 99),
  ('0030430110', 'Ertrag KFZ-Nutzung', 7, 100),
  ('0030430130', 'Versicherungsentschaedigungen', 7, 101),
  ('0030430140', 'Ertrag weiterber. Kosten', 7, 102),
  ('0030430190', 'Uebr. and. sonst. betriebl. Ertraege', 7, 103),
  ('0030500000', 'Materialaufwand', 5, 106),
  ('0030510000', 'Aufwendungen fuer Roh-, Hilfs- und', 6, 107),
  ('0030510099', 'Ankauf Rohstoffe', 7, 109),
  ('0030510100', 'Ankauf Rohstoffe', 8, 110),
  ('0030510200', 'Aufw. Heizmat. Strom Gas Wasser', 8, 111),
  ('0030510900', 'Aufw. sonst. Hilfs-u.Betriebstsoffe', 7, 112),
  ('0030520000', 'Aufwend. f. bezog. Leistg.', 6, 115),
  ('0030520130', 'Fremdleistg. Personal', 8, 116),
  ('0030520190', 'Uebrige bezog. Leistg.', 7, 117),
  ('0030600000', 'Personalaufwand', 5, 120),
  ('0030610000', 'Loehne und Gehaelter', 6, 121),
  ('0030610100', 'Loehne und Gehaelter', 7, 122),
  ('0030610110', 'Sonderzahl. und Praemien', 7, 123),
  ('0030610120', 'Uebrige Lohn- und Gehaltszahlungen', 7, 124),
  ('0030620000', 'Soz. Abgaben / Aufw. F. Unterstützung', 6, 126),
  ('0030620100', 'Soziale Abgaben', 7, 127),
  ('0030620200', 'Aufw. f. Altersversorgung u. Unterst.', 7, 128),
  ('0030700000', 'Abschreibungen', 5, 131),
  ('0030710000', 'Abschreibungen auf Anlagevermögen', 6, 132),
  ('0030710100', 'planm. Abschreibung AV', 7, 133),
  ('0030800000', 'Sonst. betriebl. Aufwendungen', 5, 135),
  ('0030810499', 'Vertriebskosten', 6, 136),
  ('0030810500', 'Vertriebskosten', 7, 137),
  ('0030810599', 'Verwaltungskosten', 6, 138),
  ('0030810600', 'Verwaltungskosten', 7, 139),
  ('0030810000', 'Betriebskosten', 6, 140),
  ('0030810099', 'Raumkosten', 7, 141),
  ('0030810100', 'Raumkosten', 8, 142),
  ('0030810199', 'Behaelterkosten', 7, 143),
  ('0030810200', 'Behaelterkosten', 8, 144),
  ('0030810300', 'Fuhrparkkosten', 7, 145),
  ('0030810310', 'Treibstoffe, Oele und Fette', 8, 146),
  ('0030810320', 'Instandhaltung Fuhrpark', 8, 147),
  ('0030810399', 'Instandh. Betriebsausst./masch. Anla.', 7, 149),
  ('0030810400', 'Instandh. Betriebsausst./masch. Anla.', 8, 150),
  ('0030810700', 'And.sonst. betriebl. Aufwendungen', 6, 151),
  ('0030810710', 'sonst. Betriebl. Aufwendungen', 7, 152),
  ('0030810720', 'sonstige Personalkosten', 7, 153),
  ('0030810800', 'Neutrale Aufwendungen', 6, 155),
  ('0030810850', 'periodenfremde Aufwendungen', 7, 156),
  ('0040100000', 'Finanzergebnis', 5, 159),
  ('0040140000', 'Sonstige Zinsen u.ä. Ertraege', 6, 160),
  ('0040140200', 'Zinserträge verbunde', 7, 161),
  ('0040170000', 'Zinsen u.ä. Aufwendungen', 6, 162),
  ('0040170200', 'Zinsaufwand verbundene', 7, 163),
  ('0040180000', 'Ergeb. der gewoehnlichen Geschaeftstaetigk.', 4, 165),
  ('0060100000', 'Steuern', 4, 166),
  ('0060129999', 'Sonstige Steuern', 5, 167),
  ('0060130000', 'Sonstige Steuern', 6, 168),
  ('0060200000', 'Jahresueberschuß / Jahresfehlbetrag', 3, 170),
  ('0070000000', 'Ergebnis-Verwendung', 3, 171),
  ('0070400000', 'Gewinnvortrag aus dem Vorjahr', 4, 172),
  ('0090000000', 'Anhang', 2, 173),
  ('0091300000', 'Konten, die Saldo Null ausweisen muessen', 3, 174),
  ('0091300020', 'IFRS Konten', 3, 175),
  ('0010420130', 'Ford. L+L', 7, 178),
  ('0010420211', 'Ford.verb. L+L', 8, 179),
  ('0010420236', 'Ford. verbund.', 8, 180),
  ('0010421151', 'sonst. Steuerford.', 9, 181),
  ('0010421251', 'Sonst. VermögensG.', 8, 182),
  ('0010421271', 'Sonst. VermögensG.', 8, 183),
  ('0010421309', 'And. sonst. VermögensG.', 7, 184),
  ('0020330010', 'Rueckstellungen', 6, 185),
  ('0020340102', 'Sonstige Rueckstellungen', 7, 186),
  ('0020340104', 'Sonstige Rueckstellungen', 7, 187),
  ('0020340105', 'Sonstige Rueckstellungen', 7, 188),
  ('0020340109', 'Sonstige Rueckstellungen', 7, 189),
  ('0020340250', 'Uebrige Rueckstellungen', 7, 190),
  ('0020340265', 'Uebrige Rueckstellungen', 7, 191),
  ('0020340270', 'Uebrige Rueckstellungen', 7, 192),
  ('0020440400', 'Verbindlk. L+L', 6, 193),
  ('0020460110', 'Verb. verbund. L+L', 7, 194),
  ('0020460210', 'Verb. verbund. Transfer', 7, 195),
  ('0020460310', 'Verb. verbund. Sonst.', 7, 196),
  ('0020460351', 'Verb. verbund. Sonst.', 7, 197),
  ('0020491110', 'Verb. Lohn und Gehalt', 8, 198),
  ('0020491210', 'Uebr.and.sonst.Verb.', 8, 199),
  ('0020491511', 'And. Sonst. Verbindlk.', 8, 200),
  ('0020491541', 'And. Sonst. Verbindlk.', 8, 201),
  ('0030810604', 'Verwaltungskosten', 8, 202),
  ('0030810605', 'Verwaltungskosten', 8, 203),
  ('0030810609', 'Verwaltungskosten', 8, 204),
  ('0030810611', 'Verwaltungskosten', 8, 205),
  ('0030810103', 'Raumkosten', 9, 206),
  ('0030810203', 'Behaelterkosten', 9, 207),
  ('0030810331', 'Fuhrparkkosten', 9, 208),
  ('0030810332', 'Fuhrparkkosten', 9, 209),
  ('0030810333', 'Fuhrparkkosten', 9, 210),
  ('0030810334', 'Fuhrparkkosten', 9, 211),
  ('0030810339', 'Fuhrparkkosten', 9, 212),
  ('0040140130', 'Sonstige Zinsen u.ä. Ertraege', 9, 213),
  ('0040140102', 'Sonstige Zinsen u.ä. Ertraege', 8, 214),
  ('0040170160', 'Zinsen u.ä. Aufwendungen', 9, 215),
  ('0040170170', 'Zinsen u.ä. Aufwendungen', 9, 216),
  ('0040170190', 'Zinsen u.ä. Aufwendungen', 9, 217),
  ('0040170102', 'Zinsen u.ä. Aufwendungen', 8, 218),
  ('0060110010', 'Steuern', 6, 219)
ON CONFLICT (position) DO UPDATE SET text = EXCLUDED.text,
  stufe = EXCLUDED.stufe, sortierung = EXCLUDED.sortierung;

INSERT INTO controlling.bilanz_guv_konto (konto, position, text) VALUES
  ('100000', '0010440010', 'Kasse I'),
  ('100090', '0010440010', 'Kasse X'),
  ('100091', '0010440010', 'Kasse XI'),
  ('100092', '0010440010', 'Kasse XII'),
  ('111409', '0020460210', 'CashPool ALBA  plc & Co. KG (5002) vU'),
  ('140000', '0010420110', 'Forderungen aus L+L'),
  ('140010', '0010420211', 'Ford. gegen verbundene Unternehmen'),
  ('140016', '0010420236', 'Forderungen gegen verbundene Unternehmen Zinsen'),
  ('140600', '0010420110', 'Nachbuchung Ford.L/L'),
  ('140712', '0010420113', 'Korrekturkto. Ford. L+L (Factoring)'),
  ('150000', '0010421310', 'Sonstige Forderungen'),
  ('150110', '0010421310', 'Sicherheitseinbehalte (Debitoren)'),
  ('150719', '0010421309', 'Sicherheitseinbehalte (Factoring)'),
  ('150720', '0020491511', 'Forderungen/Verbindlichkeiten BNP (Factoring)'),
  ('152500', '0010421310', 'gegebene Kautionen'),
  ('153000', '0010421310', 'Forderungen gegen Personal'),
  ('154500', '0010421151', 'Ford./Verb. aus Steuern vom Einkommen und Ertrag'),
  ('154900', '0010421110', 'Vorsteuer im Folgejahr/in Folgeperiode abziehbar'),
  ('155011', '0010421271', 'Forderungen Zinsen auf Steuererstattungen'),
  ('157000', '0020490110', 'Vorsteuer'),
  ('157010', '0020490110', 'Vorsteuer (Altteile)'),
  ('157030', '0020490110', 'Erwerbsteuer (Eingang)'),
  ('157040', '0010421110', 'Vorsteuer Vergütung Ausland'),
  ('160000', '0020440100', 'Verbindlichkeiten aus Lieferungen und Leistungen'),
  ('160010', '0020460110', 'Verbindlichkeiten gegenüber verbundenen Unternehme'),
  ('160016', '0020460351', 'Verb. gegenüber verbundenen Unternehmen Zinsen'),
  ('160050', '0020491210', 'Verbindlichkeiten nicht L+L'),
  ('166055', '0020491541', 'Verbindlichkeiten Nicht LuL (BNP Zinsen)'),
  ('173200', '0020491210', 'Erhaltene Kautionen'),
  ('174000', '0020491110', 'Verbindlichkeiten aus Lohn und Gehalt'),
  ('174020', '0010421310', 'Verbindlichkeiten Pfändung'),
  ('174030', '0010421310', 'Verbindlichkeiten Direktversicherung'),
  ('174040', '0020491210', 'Verbindlichkeiten gegen Mitarbeiter'),
  ('174100', '0020490110', 'Verbindlichkeiten aus Lohn-u.Kirchensteuer'),
  ('177000', '0020490110', 'Ausgangssteuer'),
  ('177060', '0020490110', 'Erwerbsteuer Ausgang'),
  ('178890', '0020490110', 'USt Zahllast Organträger'),
  ('178901', '0020490110', 'Zahllast laufendes Jahr Finanzamt'),
  ('191529', '0020460310', 'V-Kto. ALBA SE (4000)'),
  ('194406', '0020460310', 'V-Kto 2 ALBA KG (5002)'),
  ('199901', '0010421310', 'Verrechnung Lieferantenskonti (Nettoverfahren)'),
  ('201000', '0030810850', 'Sonstige periodenfremde Aufwendungen'),
  ('21000', '0010320200', 'Maschinen'),
  ('210000', '0040170190', 'Übrige Zinsen und ähnliche Aufwendungen'),
  ('210001', '0040170102', 'Zinsen und Nebenleistungen auf Steuerzahlungen'),
  ('210900', '0040170200', 'Zinsaufwendungen an verbundene Unternehmen'),
  ('213101', '0040170160', 'Zinsen Factoring'),
  ('213200', '0040170170', 'Avalgebühren und -provisionen'),
  ('231500', '0030410100', 'Mehrerlös bei Anlagenabgang'),
  ('251000', '0030410160', 'Sonstige periodenfremde Erträge'),
  ('252000', '0030430190', 'andere sonst.betriebl. Erträge'),
  ('26000', '0010320200', 'Transportanlagen u.ä.'),
  ('265001', '0040140102', 'Zinsen auf Steuererstattungen'),
  ('265900', '0040140200', 'Sonstige Zinsen und ähnl. Erträge verb.Unternehmen'),
  ('272000', '0030410190', 'Verrechnete Erlöse aus Anlagenverkauf'),
  ('273500', '0030410140', 'Erträge Auflösung von Rückstellungen (accruals)'),
  ('274200', '0030430130', 'Versicherungsentschädigungen'),
  ('277100', '0060110010', 'Steuernachzahl. E + E Vorjahre'),
  ('278100', '0060110010', 'Steuererstattung E + E Vorjahre'),
  ('28000', '0010320200', 'Betriebsvorrichtungen'),
  ('286900', '0030810710', 'andere sonstige betriebliche Aufwendungen'),
  ('287090', '0030430190', 'Erträge Mahngebühren'),
  ('287095', '0040140130', 'Erträge Zinsen Debitoren'),
  ('289200', '0020500000', 'Verr. kalk. Zinsen'),
  ('289300', '0020500000', 'Verr. kalk. Abschreibungen'),
  ('300075', '0030510100', 'Materialaufwand Abbruch u. Rückbau'),
  ('310010', '0030510900', 'Reinigungsmaterial'),
  ('310040', '0030510200', 'Gas (vornehmlich industr. Anlagen)'),
  ('310080', '0030510900', 'Technische Gase'),
  ('310900', '0030510900', 'Sonstige Hilfs- und Betriebsstoffe'),
  ('32000', '0010320310', 'PKW'),
  ('330900', '0030510900', 'Erhaltene Skonti'),
  ('340030', '0030520130', 'Fremdleistungen Personal'),
  ('340050', '0030520190', 'Fremdleistungen Wartung/Pflege'),
  ('340600', '0030520190', 'Bezogene Leistung periodenfremd'),
  ('35000', '0010320310', 'LKW'),
  ('36000', '0010320310', 'Schneefahrzeuge'),
  ('38000', '0010320310', 'Sonstige Transportmittel'),
  ('380950', '0010410100', 'Bestände Ersatzteile'),
  ('392000', '0030200000', 'Bestandsveränderungen unfertige Erzeugnisse'),
  ('40000', '0010320330', 'Betriebsausstattung'),
  ('400010', '0030810320', 'Instandhaltung Lastkraftwagen'),
  ('400011', '0030810320', 'Reifenkosten'),
  ('400020', '0030810320', 'Instandhaltung Personenkraftwagen'),
  ('400030', '0030810320', 'Instandhaltung selbstfahrende Arbeitsmaschinen'),
  ('400035', '0030810320', 'Instandhaltung Miet-und Leasingfahrzeuge'),
  ('400040', '0030810320', 'DEKRA / TÜV / sonstige Gebühren Fuhrpark'),
  ('400111', '0030810334', 'Anmietung LKW'),
  ('400112', '0030810332', 'Leasing LKW'),
  ('400121', '0030810333', 'Anmietung PKW'),
  ('400122', '0030810331', 'Leasing PKW'),
  ('400131', '0030810334', 'Anmietung selbstfahrende Arbeitsmaschinen'),
  ('401000', '0030810310', 'Aufwand Diesel'),
  ('401010', '0030810310', 'Benzin/Super'),
  ('401015', '0030810310', 'Alternative Antriebe (u.a. Strom, Wasserstoff)'),
  ('401020', '0030810310', 'Öle und Fette'),
  ('401030', '0060130000', 'Kfz-Steuern'),
  ('401040', '0030810339', 'Kfz-Versicherungen'),
  ('401050', '0030810339', 'Autobahngebühren LKW'),
  ('41000', '0010320330', 'Geschäftsausstattung/ EDV'),
  ('410000', '0030610100', 'Löhne'),
  ('410010', '0030610120', 'Lohnfortzahlung'),
  ('410030', '0030610110', 'Sonderzahlungen und Prämien Lohnempfänger'),
  ('410050', '0030610100', 'Überstunden Lohnempfänger'),
  ('410060', '0030610100', 'Aushilfen gewerbl. (Lohnübernahme)'),
  ('410100', '0030610100', 'Gehalt'),
  ('410110', '0030610120', 'Gehaltsfortzahlung'),
  ('410130', '0030610110', 'Sonderzahlungen und Prämien Gehaltsempfänger'),
  ('410160', '0030610100', 'Aushilfen Angestellte (Lohnübernahme)'),
  ('411000', '0030620200', 'Altersversorgung und Unterstützung'),
  ('411010', '0030620100', 'Beiträge Berufsgenossenschaft'),
  ('411020', '0030620100', 'Sozialabgaben'),
  ('411021', '0030620100', 'Arbeitgeberanteil zur gesetzl. RentenVersicherung'),
  ('411030', '0030610100', 'Arbeitgeberzuschuß VWL'),
  ('411050', '0030810605', 'Personalversicherung'),
  ('411070', '0030810720', 'Personalwerbung'),
  ('411090', '0030810720', 'Schulung und Ausbildung'),
  ('411100', '0030810720', 'Arbeitskleidung und Arbeitschutzbedarf'),
  ('411900', '0030810720', 'Sonstige Personalkosten'),
  ('411910', '0030610120', 'Lohnzuschüsse (Lohnübernahme)'),
  ('42000', '0010320330', 'Büroeinrichtung'),
  ('420012', '0030810100', 'Sonstige Kosten Grundstücke und Gebäude'),
  ('420015', '0030810100', 'Instandhaltungskosten fremde  Gebäude'),
  ('420021', '0030810100', 'Raumpflege eigene Gebäude'),
  ('420022', '0030810100', 'Raumpflege fremde Gebäude'),
  ('420030', '0030810100', 'Aufwand Energie'),
  ('420040', '0030810100', 'Aufwand Wasser'),
  ('420060', '0030810100', 'Aufwand eigene Entsorgung'),
  ('420100', '0030810400', 'Instandhaltung Betriebsausstattung'),
  ('420400', '0030810600', 'Instandhaltung Geschäftsausstattung'),
  ('420450', '0030810400', 'Instandh./Reparatur/Wartung Miet- u. Leasinggeräte'),
  ('420500', '0030810200', 'Instandhaltung Behälter'),
  ('420600', '0030810400', 'Werkstattbedarf (Kleinwerkzeuge b.100,-DM u.ä.)'),
  ('420700', '0030810400', 'Verbrauch Hilfs- u. Betriebsstoffe'),
  ('43000', '0010320330', 'Werkstatteinrichtung'),
  ('430010', '0060130000', 'Vermögensteuer, Grundsteuer u.a.'),
  ('430040', '0060130000', 'Sonstige Steuern'),
  ('430110', '0030810710', 'Aufwendungen für Versicherungsschäden'),
  ('430120', '0030810605', 'Sonstige Versicherungen'),
  ('430121', '0030810605', 'Warenkreditversicherung'),
  ('431010', '0030810103', 'Mieten Räume'),
  ('431020', '0030810103', 'Mieten Plätze'),
  ('431041', '0030810203', 'Miete Behälter'),
  ('431090', '0030810103', 'Sonstige Mieten'),
  ('44000', '0010320330', 'Werkzeuge'),
  ('440050', '0030810710', 'Transportkosten (außerhalb Recy)'),
  ('45000', '0010320320', 'Container,Pressen und Behälter'),
  ('450010', '0030810500', 'Reisekosten Betriebsangehörige'),
  ('450011', '0030810500', 'Verpfl.mehraufwand (pauschal)'),
  ('450012', '0030810500', 'Kilometergeld (pauschal)'),
  ('450013', '0030810500', 'Kürzung Verpfleg.mehraufwand'),
  ('450020', '0030810500', 'Reisekosten Betriebsfremde'),
  ('450030', '0030810500', 'Bewirtung zu 100 % abzugsfähig'),
  ('450039', '0030810500', 'Bewirtung zu 70 % abzugsfähig'),
  ('450050', '0030810500', 'Allgemeine Repräsentationskosten'),
  ('450061', '0030810500', 'Geschenke Zuwend. < Wertgrenze Dritte/Arbeitnehmer'),
  ('450080', '0030810500', 'Werbung'),
  ('450081', '0030810500', 'Sponsoring'),
  ('450120', '0030810500', 'Spesen (Lohnübernahme ohne VSt.)'),
  ('460010', '0030810600', 'Büromaterial'),
  ('460020', '0030810600', 'Zeitungen, Zeitschrift.und Bücher'),
  ('460030', '0030810600', 'Telekommunikation'),
  ('460040', '0030810600', 'Portogebühren'),
  ('460050', '0030810600', 'Kosten des Geldverkehrs'),
  ('460060', '0030810611', 'Kosten EDV'),
  ('460065', '0030810611', 'IT Lizenzgebühren'),
  ('460080', '0030810600', 'Pflichtbeiträge zu Verbänden'),
  ('460081', '0030810600', 'Beiträge zu sonstigen Vereinigungen'),
  ('460090', '0030810600', 'Schreib- und Verwaltungsgebühren an Behörden'),
  ('460200', '0030810500', 'Beiträge Fachtagungen'),
  ('460900', '0030810600', 'Sonstige Verwaltungskosten'),
  ('470010', '0030810604', 'Anwalts- und Gerichtskosten'),
  ('470020', '0030810604', 'kaufm. Beratung und Buchführung'),
  ('470025', '0030810604', 'Steuerberatungskosten'),
  ('470030', '0030810600', 'Beratungskosten Allgemeine Verwaltung'),
  ('470036', '0030810609', 'Aufwendungen Umlage zentrale Verwaltung'),
  ('48000', '0010320330', 'Betriebsausstattung GWG'),
  ('480100', '0030710100', 'Normalabschreibung auf Anlagen'),
  ('480110', '0030710100', 'Abschreibungen auf Anlagen (GWG)'),
  ('48100', '0010320330', 'Geschäftsausstattung GWG'),
  ('499200', '0020500000', 'Kalk. Zinsen'),
  ('499300', '0020500000', 'Kalk. Abschreibungen'),
  ('49951', '0010410200', 'Bestände unfertige Erzeugnisse'),
  ('49972', '0010410500', 'Erhaltene Anzahlungen auf Vorräte'),
  ('599131', '0020340109', 'Gegenkonto Abgrenzung Berufsgenossenschaft'),
  ('599136', '0020340102', 'Gegenkonto Abgrenzung variable Vergütung'),
  ('599992', '0020340270', 'Gegenkonto Kostenabgrenzungen (Rückstell.)'),
  ('599994', '0020440400', 'Gegenkonto aus Kostenabgrenzung Verb. L&L'),
  ('799995', '0010420130', 'Gegenkonto aus Erlösabgrenzung Ford L&L'),
  ('80000', '0020110000', 'Gezeichnetes Kapital'),
  ('830510', '0030110120', 'Erlöse Abrisse/Demontagen'),
  ('84000', '0020130000', 'Kapitalrücklage'),
  ('840040', '0030110130', 'Erlöse Verkauf HW Schrott'),
  ('85500', '0020140400', 'Andere Gewinnrücklagen'),
  ('860000', '0030430140', 'Erlöse weiterberechnete Fremdkosten'),
  ('86800', '0070400000', 'Gewinn- oder Verlustvortrag'),
  ('86801', '0070400000', 'Gewinn- oder Verlustvortrag (HGB nur FW Bew.)'),
  ('890010', '0030410190', 'Erlöse Anlagenverkäufe'),
  ('890100', '0030120000', 'Gewährte Skonti'),
  ('890200', '0030430110', 'Erlöse selbstgenutzte Fahrzeuge'),
  ('890800', '0030430190', 'Erlöse Zahlungsdifferenzen Debitoren'),
  ('900051', '0010421310', 'Kautionen (Korrekturkonto)'),
  ('900052', '0010421320', 'Kautionen (RLZ >1 Jahr)'),
  ('900061', '0020440100', 'Verbind.aus L+L (Korrekturkto)'),
  ('900065', '0020460110', 'Verbind.verb.Unternehmen (Korrekturkto)'),
  ('900088', '0020491210', 'And. Sonst. Verbindlichkeiten (Korrekturkto)'),
  ('900091', '0020490110', 'Verbindlichk. sonstige Steuern (Korrekturkonto)'),
  ('900400', '0010421251', 'Debitorische Kreditoren (Verb.a.L+L)'),
  ('900410', '0010420211', 'Debitorische Kreditoren (Verb.a.verb.Untern.)'),
  ('900460', '0010421251', 'Debitorische Kreditoren (Verb. nicht L+L)'),
  ('95510', '0020330010', 'Gewerbesteuerrückstellung'),
  ('97035', '0020340250', 'Rückst. f. Jahresabschluss/Rechtsberatung'),
  ('97200', '0020340109', 'Rückstellung Berufsgenossenschaft'),
  ('97202', '0020340104', 'Rückstellung Urlaubsverpflichtungen'),
  ('97207', '0020340102', 'Rückstellung Variable Vergütung'),
  ('97209', '0020340105', 'Rückstellung Überstunden/Mehrarbeit'),
  ('97300', '0020340265', 'Rückstellung für Zinsen auf Steuernachzahlungen'),
  ('98002', '0010630000', 'ARAP Kfz-Steuer'),
  ('98004', '0010630000', 'ARAP sonstige Versicherungen'),
  ('98006', '0010630000', 'ARAP OP-verwaltet'),
  ('99800', '0010420111', 'EWB auf Forderungen'),
  ('999920', '0091300000', 'Übernahme-Konto offene Posten Debitoren'),
  ('999930', '0091300000', 'Übernahme-Konto offene Posten Kreditoren'),
  ('F008600', '0091300020', 'Nutzungsrechte Grund und Boden'),
  ('F009100', '0091300020', 'Nutzungsrechte Gebaeude'),
  ('F033000', '0091300020', 'Nutzungsrechte Fahrzeuge'),
  ('F049002', '0091300020', 'Nutzungsrechte sonstige BGA'),
  ('F049951', '0091300020', 'Bestände unfertige Erzeugnisse'),
  ('F049956', '0091300020', 'WB Bestände unfertige Erzeugnisse'),
  ('F085500', '0091300020', 'Andere Gewinnrücklagen'),
  ('F086800', '0091300020', 'Gewinn- oder Verlustvortrag (IFRS)'),
  ('F095550', '0091300020', 'Rückstellung latente Steuern > 1 Jahr'),
  ('F098100', '0091300020', 'Akt. Latente Steuern'),
  ('F098110', '0091300020', 'Aktive latente Steuern auf Verlustvorträge'),
  ('F099610', '0091300020', 'ECL auf Vertragsvermögenswerte'),
  ('F153905', '0091300020', 'Forderungen aus POC-Aufträgen < 1 Jahr'),
  ('F170202', '0091300020', 'Verbindlichkeiten aus Leasing RLZ < 1 Jahr'),
  ('F170593', '0091300020', 'Verbindlichkeiten aus POC-Aufträgen < 1 Jahr'),
  ('F900026', '0091300020', 'Forderungen L+L ( RLZ > 1Jahr )'),
  ('F900108', '0091300020', 'Mietkaufverbindlichkeiten (Korrekturkonto)'),
  ('F900109', '0091300020', 'Mietkaufverbindlichkeiten  (RLZ 1-5 Jahre)'),
  ('F900110', '0091300020', 'Mietkaufverbindlichkeiten (RLZ > 5 Jahre)'),
  ('F999910', '0091300020', 'Übernahmekonto Salden Sachkonten')
ON CONFLICT (konto) DO UPDATE SET position = EXCLUDED.position, text = EXCLUDED.text;

/* ---------------------------------------------------------------------------
   Die GuV je Monat und Position - aus den Einzelposten, nicht aus dem
   Bericht: der Bericht kennt nur den kumulierten Stand, die Einzelposten
   koennen den Monat.  Beides zusammen muss per Juli denselben Wert ergeben.
--------------------------------------------------------------------------- */
CREATE OR REPLACE VIEW controlling.v_guv_position_monat AS
SELECT e.geschaeftsjahr                              AS jahr,
       e.monat,
       k.position,
       p.text                                        AS position_text,
       p.sortierung,
       sum(-e.wert_signed)                           AS betrag,     -- kaufmaennisch
       count(*)                                      AS belege
  FROM controlling.sap_einzelposten e
  JOIN controlling.bilanz_guv_konto    k ON k.konto = split_part(e.kostenart, '.', 1)
  JOIN controlling.bilanz_guv_position p ON p.position = k.position
 WHERE e.monat BETWEEN 1 AND 12
 GROUP BY 1, 2, 3, 4, 5;

COMMENT ON VIEW controlling.v_guv_position_monat IS
  'GuV je Monat und SAP-Position aus den Einzelposten, kaufmaennisch (Ertrag positiv).';

/* ---------------------------------------------------------------------------
   Die Kennzahlen der Ergebnispraesentation
   ---------------------------------------------------------------------------
   Gesamtleistung = Umsatzerloese + Bestandsveraenderung.
   EBITDA         = alle GuV-Positionen ohne Abschreibungen und ohne
                    Finanzergebnis, ohne die neutralen Posten, zuzueglich der
                    sonstigen Steuern (0060130000).  Die sonstigen Steuern
                    fuehrt der Bericht ausserhalb der GuV-Positionen, die
                    Praesentation zaehlt sie als Betriebsaufwand mit.

   Probe gegen Folie 1.1, Januar bis Juli 2026:

     Gesamtleistung YTD          14.336.570,17   (Folie 14,3 M EUR)
     EBITDA YTD                    -122.862,29   (Folie   -123 T EUR)
     EBITDA nach neutralen Kosten  -171.033,59   (Folie   -171 T EUR)
     Umsatzrentabilitaet                -0,86 %  (Folie  -0,86 %)

   Und Monat fuer Monat, in T EUR:

     Jan 292  Feb 325  Mrz 23  Apr -181  Mai -142  Jun 57  Jul -496

   Das sind die Balken der Folie, jeder einzeln getroffen.
--------------------------------------------------------------------------- */
CREATE OR REPLACE VIEW controlling.v_kennzahlen_monat AS
WITH e AS (
  SELECT e.geschaeftsjahr AS jahr, e.monat, k.position AS pos, -e.wert_signed AS w
    FROM controlling.sap_einzelposten e
    JOIN controlling.bilanz_guv_konto k ON k.konto = split_part(e.kostenart, '.', 1)
   WHERE e.monat BETWEEN 1 AND 12
)
SELECT jahr,
       monat,
       coalesce(sum(w) FILTER (WHERE pos LIKE '00301%'), 0)                    AS umsatzerloese,
       coalesce(sum(w) FILTER (WHERE pos LIKE '00302%'), 0)                    AS bestandsveraenderung,
       coalesce(sum(w) FILTER (WHERE pos LIKE '00301%'
                                  OR pos LIKE '00302%'), 0)                    AS gesamtleistung,
       coalesce(sum(w) FILTER (WHERE (left(pos, 4) = '0030'
                                      AND pos NOT LIKE '00307%'
                                      AND pos NOT LIKE '003041%'
                                      AND pos NOT LIKE '00308108%')
                                  OR pos LIKE '006013%'), 0)                   AS ebitda,
       coalesce(sum(w) FILTER (WHERE pos LIKE '003041%'
                                  OR pos LIKE '00308108%'), 0)                 AS neutrales_ergebnis,
       coalesce(sum(w) FILTER (WHERE (left(pos, 4) = '0030'
                                      AND pos NOT LIKE '00307%')
                                  OR pos LIKE '006013%'), 0)                   AS ebitda_nach_neutral,
       coalesce(sum(w) FILTER (WHERE pos LIKE '00307%'), 0)                    AS abschreibungen,
       coalesce(sum(w) FILTER (WHERE pos LIKE '0040%'), 0)                     AS finanzergebnis
  FROM e GROUP BY jahr, monat;

COMMENT ON VIEW controlling.v_kennzahlen_monat IS
  'Gesamtleistung und EBITDA je Monat nach der Abgrenzung der Ergebnispraesentation.';

GRANT SELECT ON controlling.v_guv_position_monat, controlling.v_kennzahlen_monat TO PUBLIC;
