-- =====================================================================
-- 12 · Benutzerkonten aus dem Altsystem
--
-- Das Altsystem fuehrt je Konto mehr als das neue: eine Regionsliste,
-- eine Liste freigeschalteter Bereiche und ein Kennzeichen, dass das
-- Passwort beim naechsten Login zu wechseln ist. Diese Angaben werden
-- mit uebernommen, damit bei der Migration nichts verlorengeht.
-- =====================================================================

SET search_path = controlling, public;

ALTER TABLE controlling.benutzer
  ADD COLUMN IF NOT EXISTS regionen         text[],
  ADD COLUMN IF NOT EXISTS bereiche         text[],
  ADD COLUMN IF NOT EXISTS passwort_aendern boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alt_benutzer_id  varchar(64);

COMMENT ON COLUMN controlling.benutzer.regionen IS
  'Regionen aus dem Altsystem. Derzeit dokumentierend – die Auswertungen '
  'schraenken noch nicht nach Region ein.';
COMMENT ON COLUMN controlling.benutzer.passwort_aendern IS
  'Aus dem Altsystem uebernommenes Kennzeichen must_change_pw. Der Login '
  'erzwingt den Wechsel noch nicht; die betroffenen Konten sind unter '
  '/benutzer sichtbar und gehoeren zurueckgesetzt.';

-- E-Mail-Adressen sind fachlich unabhaengig von der Schreibweise.
-- Ohne diese Normierung legt ein Import 'fabian.siebert@...' neben dem
-- bestehenden 'Fabian.siebert@...' ein zweites Konto an.
UPDATE controlling.benutzer SET email = lower(email) WHERE email <> lower(email);

CREATE UNIQUE INDEX IF NOT EXISTS benutzer_email_klein_idx
  ON controlling.benutzer (lower(email));
