/* ---------------------------------------------------------------------------
   Neue Sichten im Berichtsbaukasten
   ---------------------------------------------------------------------------
   Der Baukasten kennt nur, was in bericht_quelle steht.  Alles, was seither
   dazugekommen ist – Stunden, Kalkulation, Umlage, Bestandskontrolle –,
   liess sich deshalb nicht auswerten, obwohl die Sichten laengst da sind.
   Ebenso fehlten die Deckungsbeitragsstaffel und die Kostenartenrechnung,
   also ausgerechnet das, wonach am haeufigsten gefragt wird.

   `regionsspalte` sagt, worueber die Regionsfreigabe eines Benutzers greift.
   Bleibt sie leer, ist die Sicht nicht regionsbezogen und jeder sieht sie
   ganz.
--------------------------------------------------------------------------- */

INSERT INTO controlling.bericht_quelle (name, bezeichnung, beschreibung, regionsspalte, sortierung)
VALUES
  ('v_db_monat', 'Deckungsbeitragsstaffel je Monat',
   'DB I bis DB IV je Monat, aus den Buchungszeilen abgeleitet.', NULL, 25),
  ('v_db_monat_region', 'Deckungsbeitragsstaffel je Region und Monat',
   'Dieselbe Staffel, aufgerissen nach Niederlassung.', 'region', 26),
  ('v_klr', 'Kostenartenrechnung',
   'Sachkonten mit Monatswerten, KLR-Typ und Deckungsbeitragsstufe.', NULL, 27),
  ('v_stunden_mitarbeiter', 'Stunden je Mitarbeiter und Monat',
   'Produktive und unproduktive Stunden, Abwesenheit und Auslastung.', NULL, 60),
  ('v_stunden_projekt', 'Stunden je Projekt und Monat',
   'Produktive Stunden auf Auftraegen, mit Mitarbeiterzahl und Tagen.', 'region', 61),
  ('v_verrechnung', 'Innerbetriebliche Verrechnung',
   'Geraete- und Lohnverrechnung je Auftrag, mit Menge und effektivem Satz.', NULL, 62),
  ('v_kalkulation', 'Kalkulationen',
   'Auftragskalkulationen mit Summen, Marge und Fassung.', 'region', 70),
  ('v_kalkulation_ist', 'Kalkulation gegen Ist',
   'Kalkulierte Erloese und Kosten gegen die gebuchten Werte je Projekt.', NULL, 71),
  ('v_bestand_ohne_rechnung', 'Bestand ohne Rechnung',
   'Projekte mit nicht abgerechneter Leistung und dem Alter der letzten Rechnung.', 'region', 72),
  ('v_umlage_satz', 'Gemeinkostenzuschlag je Auftrag',
   'Tatsaechlich gebuchter Zuschlag, gemessen an der Kostenbasis.', 'region', 73)
ON CONFLICT (name) DO UPDATE
  SET bezeichnung = EXCLUDED.bezeichnung,
      beschreibung = EXCLUDED.beschreibung,
      regionsspalte = EXCLUDED.regionsspalte,
      sortierung = EXCLUDED.sortierung;
