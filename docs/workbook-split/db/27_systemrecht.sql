/* ---------------------------------------------------------------------------
   Recht "system.read" – Innenansicht des Cockpits
   ---------------------------------------------------------------------------
   Rechenwege, Selbstpruefung und interne Notizen zeigen, wie die Zahlen
   zustande kommen und wo die Datenlage Luecken hat.  Das gehoert in die
   Hand derer, die es einordnen koennen – nicht in jede Regionsbesprechung.

   Bewusst ein eigenes Recht statt "audit.read" mitzubenutzen: wer das
   Protokoll lesen darf, muss nicht zwangslaeufig die Rechenwege sehen,
   und umgekehrt.
--------------------------------------------------------------------------- */

INSERT INTO controlling.berechtigungen (code, beschreibung)
VALUES ('system.read', 'Rechenwege, Selbstprüfung und interne Notizen anzeigen')
ON CONFLICT (code) DO UPDATE SET beschreibung = EXCLUDED.beschreibung;

/* Nur ADMIN. Andere Rollen bekommen es ausdruecklich nicht. */
INSERT INTO controlling.rollen_berechtigungen (rollen_id, berechtigung_id)
SELECT r.rollen_id, b.berechtigung_id
  FROM controlling.rollen r, controlling.berechtigungen b
 WHERE r.rollenname = 'ADMIN' AND b.code = 'system.read'
ON CONFLICT DO NOTHING;

DELETE FROM controlling.rollen_berechtigungen rb
 USING controlling.rollen r, controlling.berechtigungen b
 WHERE rb.rollen_id = r.rollen_id AND rb.berechtigung_id = b.berechtigung_id
   AND b.code = 'system.read' AND r.rollenname <> 'ADMIN';

/* Wer hat es jetzt? */
DO $$
DECLARE n integer;
BEGIN
  SELECT count(DISTINCT br.benutzer_id) INTO n
    FROM controlling.benutzer_rollen br
    JOIN controlling.rollen_berechtigungen rb ON rb.rollen_id = br.rollen_id
    JOIN controlling.berechtigungen b ON b.berechtigung_id = rb.berechtigung_id
   WHERE b.code = 'system.read';
  RAISE NOTICE 'system.read: % Benutzer', n;
END $$;
