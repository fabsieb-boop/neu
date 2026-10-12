/* ---------------------------------------------------------------------------
   Bestandsveraenderung automatisch mitbuchen
   ---------------------------------------------------------------------------
   Bei Projekten, die nach Fertigstellungsgrad bewertet werden, gehoert zu
   jeder Kosten- oder Erloesbuchung die Fortschreibung der unfertigen
   Erzeugnisse.  Wird sie vergessen, stimmt das Projektergebnis nicht mehr
   mit der Bilanz ueberein.

   Der Buchungssatz:

     Bestandsaufbau (Kosten entstehen)
       Soll   049951  Bestaende unfertige Erzeugnisse      (Bilanz)
       Haben  392000  Bestandsveraenderungen unfertige E.  (GuV)

     Bestandsabbau (Leistung wird abgerechnet)
       umgekehrt

   Welche Konten das sind, steht in den Einstellungen und nicht im
   Programmtext – ein Kontenrahmen aendert sich haeufiger als eine Anwendung.
--------------------------------------------------------------------------- */

INSERT INTO controlling.app_einstellung (schluessel, wert) VALUES
  ('bv_konto_bestand',  '049951'),
  ('bv_konto_guv',      '392000'),
  ('bv_automatik',      'ja')
ON CONFLICT (schluessel) DO NOTHING;

/* ---------------------------------------------------------------------------
   Welche Projekte werden nach Fertigstellungsgrad bewertet?
   ---------------------------------------------------------------------------
   Erkennbar daran, dass auf ihnen bereits eine Bestandsveraenderung gebucht
   wurde.  Zusaetzlich wird die zuletzt gebuchte Richtung ausgewiesen – sie
   hilft der Maske, den Vorschlag sinnvoll vorzubelegen.
--------------------------------------------------------------------------- */
CREATE OR REPLACE VIEW controlling.v_projekt_bestandsveraenderung AS
WITH bv AS (
  SELECT projekt_nr,
         count(*)                                     AS belege,
         sum(wert)                                    AS saldo,
         max(monat)                                   AS letzter_monat,
         min(monat)                                   AS erster_monat
    FROM controlling.v_buchung
   WHERE replace(kostenart_nr, '.0', '') =
         (SELECT wert FROM controlling.app_einstellung WHERE schluessel = 'bv_konto_guv')
     AND projekt_nr IS NOT NULL
   GROUP BY projekt_nr
)
SELECT p.projekt_nr,
       p.projektname,
       (bv.projekt_nr IS NOT NULL)      AS hat_bestandsveraenderung,
       COALESCE(bv.belege, 0)           AS belege,
       COALESCE(bv.saldo, 0)            AS saldo,
       bv.erster_monat,
       bv.letzter_monat
  FROM controlling.projekte p
  LEFT JOIN bv ON bv.projekt_nr = p.projekt_nr;

COMMENT ON VIEW controlling.v_projekt_bestandsveraenderung IS
  'Projekte mit Bewertung nach Fertigstellungsgrad, erkannt an gebuchter Bestandsveraenderung.';

GRANT SELECT ON controlling.v_projekt_bestandsveraenderung TO PUBLIC;
