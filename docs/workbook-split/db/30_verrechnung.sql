/* ---------------------------------------------------------------------------
   Innerbetriebliche Verrechnung: Menge zur Buchung
   ---------------------------------------------------------------------------
   Geraete- und Mitarbeiterkosten entstehen nicht als Rechnung, sondern als
   Verrechnung: eine Menge mal einem Satz.  Bisher kam nur der Betrag im
   System an, die Menge blieb in der Vorlage zurueck.  Damit fehlte dem
   Cockpit genau die Groesse, aus der sich Auslastung und Stundensatz
   ergeben – beides war deshalb nicht berechenbar.

   Zwei Spalten schliessen die Luecke.  Sie sind leer erlaubt: alle
   bisherigen Buchungen bleiben unveraendert gueltig, und nichts, was heute
   rechnet, rechnet dadurch anders.
--------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
   ACHTUNG beim Einspielen
   ---------------------------------------------------------------------------
   ALTER TABLE und COMMENT verlangen Eigentuemerrechte.  Auf dem Server
   gehoert controlling.buchungen dem Benutzer postgres, waehrend die
   Anwendung als ubuntu verbindet.  Diese Datei ist deshalb als Eigentuemer
   einzuspielen:

     sudo -u postgres psql -d controlling -f db/30_verrechnung.sql

   Auf dem Arbeitsplatz, wo derselbe Benutzer alles besitzt, genuegt
   npm run db:setup.
--------------------------------------------------------------------------- */

ALTER TABLE controlling.buchungen
  ADD COLUMN IF NOT EXISTS menge   NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS einheit VARCHAR(12),
  ADD COLUMN IF NOT EXISTS satz    NUMERIC(14,4);

COMMENT ON COLUMN controlling.buchungen.menge   IS
  'Verrechnete Menge, etwa Stunden oder Tage. Leer bei Rechnungen.';
COMMENT ON COLUMN controlling.buchungen.einheit IS 'Std, Tag, km, psch';
COMMENT ON COLUMN controlling.buchungen.satz    IS 'Verrechnungssatz je Mengeneinheit.';

/* ---------------------------------------------------------------------------
   Welche Konten sind Verrechnung?
   ---------------------------------------------------------------------------
   Steht im Kostenartenstamm und nicht hier – der Kontenrahmen aendert sich
   haeufiger als eine Anwendung.  Die Einstellungen halten nur fest, welches
   Konto die Maske vorschlaegt.
--------------------------------------------------------------------------- */

INSERT INTO controlling.app_einstellung (schluessel, wert) VALUES
  ('vuv_konto_geraete',  '7612000'),
  ('vuv_konto_personal', '7611100'),
  ('vuv_einheit_geraete',  'Std'),
  ('vuv_einheit_personal', 'Std')
ON CONFLICT (schluessel) DO NOTHING;

/* ---------------------------------------------------------------------------
   Verrechnete Mengen je Monat und Auftrag
   ---------------------------------------------------------------------------
   Grundlage fuer Auslastung und Stundensatz.  Bewusst ohne Bewertung: die
   Sicht zeigt, was verrechnet wurde, und ueberlaesst die Beurteilung der
   Seite, die sie liest.
--------------------------------------------------------------------------- */
CREATE OR REPLACE VIEW controlling.v_verrechnung AS
SELECT b.geschaeftsjahr                       AS jahr,
       b.periode                              AS monat,
       k.klr_typ,
       b.auftrag,
       b.kostenstelle,
       b.kostenart,
       max(k.bezeichnung)                     AS kostenart_bez,
       sum(b.menge)                           AS menge,
       max(b.einheit)                         AS einheit,
       sum(b.wert)                            AS wert,
       CASE WHEN COALESCE(sum(b.menge), 0) <> 0
            THEN round(sum(b.wert) / sum(b.menge), 2) END AS satz_effektiv,
       count(*)                               AS belege
  FROM controlling.buchungen b
  JOIN controlling.kostenarten k ON k.kostenart_id = b.kostenart_id
 WHERE b.gueltig
   AND k.klr_typ IN ('LOHNVERRECHNUNG', 'GERAETEVERRECHNUNG')
 GROUP BY 1, 2, 3, 4, 5, 6;

COMMENT ON VIEW controlling.v_verrechnung IS
  'Innerbetriebliche Verrechnung je Monat, Auftrag und Konto – mit Menge, soweit erfasst.';

GRANT SELECT ON controlling.v_verrechnung TO PUBLIC;
