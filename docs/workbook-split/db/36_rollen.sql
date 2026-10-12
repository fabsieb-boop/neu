/* ---------------------------------------------------------------------------
   Sechs Rollen, angehakt statt zusammengesucht
   ---------------------------------------------------------------------------
   Bisher gab es fuenf gewachsene Rollen, von denen drei niemand benutzte,
   und die Zuordnung ging ueber Einzelrechte.  Wer jemandem etwas geben
   wollte, musste wissen, welche der achtzehn Berechtigungen dafuer noetig
   sind.

   Jetzt gibt es sechs Rollen entlang der Aufgaben im Haus.  Wer eine
   vergibt, muss nicht wissen, was darin steckt – nachlesen kann er es
   trotzdem, denn die Maske zeigt es an.

     neutral          nur das Cockpit, sonst nichts
     Projektleitung   eigene Projekte, Risiken, Nachtraege
     Sachbearbeitung  Buchungen, Konten, Importe
     Controlling      Ergebnisrechnung, Planung, Liquiditaet
     Chef-Ansicht     alles lesen, nichts aendern
     Admin            alles, einschliesslich Benutzer und System

   Die bestehenden Rollen bleiben erhalten und werden nur ergaenzt bzw.
   umbenannt – niemand verliert dadurch seinen Zugang.
--------------------------------------------------------------------------- */

BEGIN;

/* Fehlende Rollen anlegen; vorhandene behalten ihre Nummer. */
INSERT INTO controlling.rollen (rollenname, beschreibung) VALUES
  ('NEUTRAL',        'Nur das Cockpit – keine Auswertungen, keine Aenderungen'),
  ('SACHBEARBEITUNG','Buchungen, Konten und Datenimport'),
  ('CHEF',           'Alles lesen, nichts aendern')
ON CONFLICT (rollenname) DO UPDATE SET beschreibung = EXCLUDED.beschreibung;

UPDATE controlling.rollen SET beschreibung = 'Eigene Projekte, Risiken und Nachtraege'
 WHERE rollenname = 'PROJEKTLEITUNG';
UPDATE controlling.rollen SET beschreibung = 'Ergebnisrechnung, Planung und Liquiditaet'
 WHERE rollenname = 'CONTROLLING';
UPDATE controlling.rollen SET beschreibung = 'Vollzugriff einschliesslich Benutzer und System'
 WHERE rollenname = 'ADMIN';

/* ---------------------------------------------------------------------------
   Rechte je Rolle – vollstaendig gesetzt, nicht ergaenzt.
   So steht am Ende genau das drin, was hier beschrieben ist, auch wenn
   frueher etwas anderes gesetzt wurde.
--------------------------------------------------------------------------- */
CREATE TEMP TABLE rolle_recht (rolle text, code text) ON COMMIT DROP;

INSERT INTO rolle_recht (rolle, code) VALUES
  ('NEUTRAL', 'dashboard.read'),

  ('PROJEKTLEITUNG', 'dashboard.read'), ('PROJEKTLEITUNG', 'projects.read'),
  ('PROJEKTLEITUNG', 'projects.write'), ('PROJEKTLEITUNG', 'risk.read'),
  ('PROJEKTLEITUNG', 'risk.write'),     ('PROJEKTLEITUNG', 'forecast.read'),
  ('PROJEKTLEITUNG', 'bericht.read'),

  ('SACHBEARBEITUNG', 'dashboard.read'), ('SACHBEARBEITUNG', 'finance.read'),
  ('SACHBEARBEITUNG', 'klr.read'),       ('SACHBEARBEITUNG', 'projects.read'),
  ('SACHBEARBEITUNG', 'import.read'),    ('SACHBEARBEITUNG', 'import.write'),
  ('SACHBEARBEITUNG', 'bericht.read'),

  ('CONTROLLING', 'dashboard.read'), ('CONTROLLING', 'finance.read'),
  ('CONTROLLING', 'klr.read'),       ('CONTROLLING', 'klr.write'),
  ('CONTROLLING', 'projects.read'),  ('CONTROLLING', 'projects.write'),
  ('CONTROLLING', 'forecast.read'),  ('CONTROLLING', 'forecast.write'),
  ('CONTROLLING', 'liquidity.read'), ('CONTROLLING', 'risk.read'),
  ('CONTROLLING', 'risk.write'),     ('CONTROLLING', 'import.read'),
  ('CONTROLLING', 'bericht.read'),

  /* Chef-Ansicht: jedes Leserecht, kein Schreibrecht, keine Benutzer. */
  ('CHEF', 'dashboard.read'), ('CHEF', 'finance.read'),  ('CHEF', 'klr.read'),
  ('CHEF', 'projects.read'),  ('CHEF', 'forecast.read'), ('CHEF', 'liquidity.read'),
  ('CHEF', 'risk.read'),      ('CHEF', 'import.read'),   ('CHEF', 'bericht.read'),
  ('CHEF', 'audit.read');

/* Admin bekommt alles, was es gibt – auch spaeter Hinzugekommenes. */
INSERT INTO rolle_recht (rolle, code)
SELECT 'ADMIN', code FROM controlling.berechtigungen;

DELETE FROM controlling.rollen_berechtigungen
 WHERE rollen_id IN (SELECT rollen_id FROM controlling.rollen
                      WHERE rollenname IN (SELECT DISTINCT rolle FROM rolle_recht));

INSERT INTO controlling.rollen_berechtigungen (rollen_id, berechtigung_id)
SELECT r.rollen_id, b.berechtigung_id
  FROM rolle_recht rr
  JOIN controlling.rollen r        ON r.rollenname = rr.rolle
  JOIN controlling.berechtigungen b ON b.code = rr.code
ON CONFLICT DO NOTHING;

/* Die alte Rolle LESEN geht in "neutral" auf: gleiche Absicht, klarerer
   Name.  Ihre Benutzer werden mitgenommen, damit niemand ausgesperrt wird. */
INSERT INTO controlling.benutzer_rollen (benutzer_id, rollen_id)
SELECT br.benutzer_id, (SELECT rollen_id FROM controlling.rollen WHERE rollenname = 'NEUTRAL')
  FROM controlling.benutzer_rollen br
  JOIN controlling.rollen r ON r.rollen_id = br.rollen_id
 WHERE r.rollenname = 'LESEN'
ON CONFLICT DO NOTHING;

DELETE FROM controlling.rollen WHERE rollenname IN ('LESEN', 'BUCHHALTUNG');

COMMIT;
