-- =====================================================================
-- 17 · Massnahmen gegen Projektrisiken
--
-- Der Risikokatalog des Altsystems (Fraunhofer IRB F 2975, BBSR 63/2024)
-- benennt Risiken und ihre Eintrittswahrscheinlichkeit, aber keine
-- Gegenmassnahmen. Die fehlen genau dort, wo sie gebraucht werden: beim
-- Oeffnen eines Auftrags.
--
-- Deshalb hier zweierlei:
--   massnahme_katalog  Vorschlaege je Risikokategorie – fachlich aus den
--                      einschlaegigen Regelwerken abgeleitet, als Angebot
--                      und nicht als Vorgabe.
--   risiko_massnahme   was tatsaechlich beschlossen wurde, mit dem Betrag,
--                      um den das Risiko dadurch sinken soll.
-- =====================================================================

SET search_path = controlling, public;

CREATE TABLE IF NOT EXISTS controlling.massnahme_katalog (
  id          serial PRIMARY KEY,
  kategorie   varchar(40)  NOT NULL,
  massnahme   varchar(200) NOT NULL,
  wirkung     varchar(300),
  grundlage   varchar(120),
  sortierung  smallint NOT NULL DEFAULT 100,
  UNIQUE (kategorie, massnahme)
);

CREATE TABLE IF NOT EXISTS controlling.risiko_massnahme (
  id             bigserial PRIMARY KEY,
  risiko_id      text          NOT NULL REFERENCES controlling.projekt_risiko(id) ON DELETE CASCADE,
  massnahme      varchar(300)  NOT NULL,
  ziel_reduktion numeric(18,2) NOT NULL DEFAULT 0,
  status         varchar(20)   NOT NULL DEFAULT 'offen'
                 CHECK (status IN ('offen','in Umsetzung','erledigt','verworfen')),
  verantwortlich varchar(120),
  frist          date,
  notiz          text,
  erstellt_at    timestamptz NOT NULL DEFAULT now(),
  erstellt_von   bigint REFERENCES controlling.benutzer(benutzer_id)
);

CREATE INDEX IF NOT EXISTS risiko_massnahme_risiko_idx
  ON controlling.risiko_massnahme (risiko_id);

-- ---------------------------------------------------------------------
-- Vorschlaege je Kategorie
-- ---------------------------------------------------------------------
INSERT INTO controlling.massnahme_katalog (kategorie, massnahme, wirkung, grundlage, sortierung) VALUES
 ('Schadstoffe','Erkundung nach DIN 18014 vor Angebotsabgabe',
  'Findet Asbest, PAK, PCB und PCP, bevor sie zur Nachtragsdiskussion werden.','TRGS 519 / 524', 10),
 ('Schadstoffe','Schadstoffkataster vom Auftraggeber einfordern',
  'Verlagert die Beweislast und begründet Nachträge bei Abweichung.','VOB/B § 2 Abs. 5', 20),
 ('Schadstoffe','Eventualposition für Sanierung in das Angebot aufnehmen',
  'Der Mehraufwand ist bepreist, statt später verhandelt zu werden.','VOB/A § 7', 30),
 ('Schadstoffe','Sachkundigen nach TRGS 519 Anlage 3 fest einplanen',
  'Vermeidet Stillstand, weil die Freimessung sonst nicht abgenommen wird.','TRGS 519', 40),

 ('Entsorgung','Deponieklasse vorab durch Analytik bestimmen',
  'Die teuerste Überraschung im Abbruch ist eine höhere Deponieklasse.','DepV § 8', 10),
 ('Entsorgung','Entsorgungswege vertraglich als Auftraggeberrisiko festhalten',
  'Preisänderungen der Deponie treffen dann nicht die Kalkulation.','VOB/B § 2', 20),
 ('Entsorgung','Zweiten Entsorger als Rückfallebene binden',
  'Ein Annahmestopp legt sonst die Baustelle still.','–', 30),
 ('Entsorgung','Recyclingquote mit Probeaufbereitung absichern',
  'Zeigt vor Ausführung, ob die kalkulierte Quote erreichbar ist.','GewAbfV § 8', 40),

 ('Statik','Bestandsunterlagen und Bewehrungspläne anfordern',
  'Ohne Pläne wird jede Rückbaufolge zur Schätzung.','–', 10),
 ('Statik','Rückbaustatik durch Prüfingenieur bestätigen lassen',
  'Sichert die Reihenfolge ab und ist bei Schäden der Nachweis.','DIN EN 1990', 20),
 ('Statik','Sondierung der Fundamente vor Angebotsabgabe',
  'Unterirdische Tragkonstruktionen sind der häufigste Nachtragsgrund.','–', 30),
 ('Statik','Temporäre Aussteifung im Ablaufplan verankern',
  'Verhindert unkontrollierten Einsturz und Bauverzug.','DIN 4123', 40),

 ('Termin','Pufferzeiten je Bauabschnitt vereinbaren',
  'Ein Puffer im Vertrag ist billiger als eine Vertragsstrafe.','VOB/B § 5', 10),
 ('Termin','Witterungsbedingte Ausfalltage vertraglich regeln',
  'Ohne Regelung trägt der Auftragnehmer das Wetterrisiko allein.','VOB/B § 6 Abs. 2', 20),
 ('Termin','Gerätevorhaltung frühzeitig verbindlich buchen',
  'Longfront-Geräte sind knapp; kurzfristige Anmietung kostet deutlich mehr.','–', 30),
 ('Termin','Behinderungsanzeige unverzüglich schriftlich stellen',
  'Ohne Anzeige verfällt der Anspruch auf Bauzeitverlängerung.','VOB/B § 6 Abs. 1', 40),

 ('Emissionen','Staubbindung mit Sprühnebel fest einkalkulieren',
  'Staub ist laut Branchenumfrage der aufwendigste Emissionspunkt.','TA Luft', 10),
 ('Emissionen','Messkonzept für Lärm und Erschütterung vereinbaren',
  'Belegt die Einhaltung und entkräftet Anwohnerbeschwerden.','DIN 4150 / AVV Baulärm', 20),
 ('Emissionen','Arbeitszeitfenster mit der Behörde abstimmen',
  'Nachträgliche Auflagen verkürzen sonst die nutzbare Bauzeit.','AVV Baulärm', 30),

 ('Genehmigung','Entsorgungsnachweise vor Baubeginn vollständig führen',
  'Fehlende Nachweise stoppen die Abfuhr und damit den Rückbau.','NachwV', 10),
 ('Genehmigung','Abbruchanzeige mit Fristenkontrolle einreichen',
  'Die Anzeigefrist wird regelmäßig unterschätzt.','LBO der Länder', 20),
 ('Genehmigung','Auflagen des Bescheids in die Kalkulation überführen',
  'Auflagen sind Leistungen – sie gehören bepreist.','–', 30),

 ('Markt','Preisgleitklausel für Sekundärstoffe vereinbaren',
  'Schrott- und Gerätepreise schwanken stärker als die Marge.','VOB/A § 9 Abs. 9', 10),
 ('Markt','Nachunternehmerpreise vor Angebotsabgabe verbindlich binden',
  'Ohne Bindung wird die eigene Kalkulation zur Wette.','–', 20),
 ('Markt','Gerätemiete über die volle Bauzeit festschreiben',
  'Verlängerungen zu Tagespreisen sind der teuerste Fall.','–', 30)
ON CONFLICT (kategorie, massnahme) DO NOTHING;

-- ---------------------------------------------------------------------
-- Risiko mit Massnahmen: Brutto, Zielreduktion, Netto
--
-- Die Zielreduktion wird auf den Erwartungswert gedeckelt – ein Risiko
-- laesst sich nicht unter null senken.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW controlling.v_risiko_netto AS
SELECT r.id, r.projekt_nr, r.bezeichnung, r.kategorie,
       r.wahrscheinlichkeit, r.kosten_min, r.kosten_wahrsch, r.kosten_max,
       r.kosten_erwartet                                     AS brutto,
       COALESCE(m.ziel, 0)                                   AS ziel,
       greatest(r.kosten_erwartet - COALESCE(m.ziel, 0), 0)  AS netto,
       COALESCE(m.anzahl, 0)                                 AS massnahmen,
       COALESCE(m.offen, 0)                                  AS massnahmen_offen
  FROM controlling.projekt_risiko r
  LEFT JOIN (
    SELECT risiko_id,
           sum(ziel_reduktion) FILTER (WHERE status <> 'verworfen') AS ziel,
           count(*)                                                  AS anzahl,
           count(*) FILTER (WHERE status = 'offen')                   AS offen
      FROM controlling.risiko_massnahme GROUP BY risiko_id
  ) m ON m.risiko_id = r.id
 WHERE r.aktiv;

COMMENT ON TABLE controlling.massnahme_katalog IS
  'Vorschlaege je Risikokategorie. Angebot fuer die Projektleitung, keine Vorgabe – '
  'die Spalte grundlage nennt das Regelwerk, damit nachvollziehbar bleibt, woher der Vorschlag kommt.';
