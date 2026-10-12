-- =====================================================================
-- 19 · Eigene Freigabe fuer den Berichtsgenerator
--
-- Bisher hing der Berichtsgenerator an klr.read. Wer die Kosten- und
-- Leistungsrechnung sehen durfte, konnte damit automatisch auch jeden
-- Bericht erzeugen und ausdrucken – und umgekehrt liess sich das
-- Berichtswesen nicht freigeben, ohne die KLR mitzugeben.
--
-- Mit einem eigenen Code laesst sich beides getrennt steuern. Die
-- Startbelegung entspricht genau dem bisherigen Zustand, damit durch
-- die Umstellung niemand Zugriff verliert oder dazubekommt.
-- =====================================================================

SET search_path = controlling, public;

INSERT INTO controlling.berechtigungen (code, beschreibung)
VALUES ('bericht.read', 'Berichtsgenerator nutzen')
ON CONFLICT (code) DO UPDATE SET beschreibung = EXCLUDED.beschreibung;

-- Wer bisher ueber klr.read an die Berichte kam, behaelt den Zugang.
INSERT INTO controlling.rollen_berechtigungen (rollen_id, berechtigung_id)
SELECT rb.rollen_id, (SELECT berechtigung_id FROM controlling.berechtigungen
                       WHERE code = 'bericht.read')
  FROM controlling.rollen_berechtigungen rb
  JOIN controlling.berechtigungen b ON b.berechtigung_id = rb.berechtigung_id
 WHERE b.code = 'klr.read'
ON CONFLICT DO NOTHING;
