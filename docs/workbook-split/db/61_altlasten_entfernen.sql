/* ---------------------------------------------------------------------------
   Alte Sichten entfernen
   ---------------------------------------------------------------------------
   Dreizehn Sichten liest niemand mehr - weder eine Seite noch eine andere
   Sicht.  Sie stehen aber weiter in der Datenbank, und die gefaehrlichste
   Sorte davon ist die, die eine plausible Zahl liefert: v_guv rechnet aus
   den Auftragsbuchungen und heisst trotzdem "GuV".  Wer sie aufmacht,
   bekommt +1,2 Mio statt -0,3 Mio und hat keinen Grund zu zweifeln.

   Geprueft ist jede einzelne: kein Treffer im Anwendungscode, keine andere
   Sicht baut darauf auf.  Wo der Name noch vorkommt, steht er in einem
   Kommentar.

     v_guv                  Auftragsrechnung unter dem Namen GuV
     v_ebitda               EBITDA aus sap_struktur, ersetzt durch
                            v_kennzahlen_monat
     v_guv_region_staffel   ersetzt durch die Abfrage mit Zeitraum
     v_verlustbewertung     ersetzt durch v_ebitda_monat
     v_forecast_neu         Zwischenstand einer Umstellung
     v_berichtskopf, v_ertragsteuern, v_klr, v_plan_ist_konto,
     v_projekt_aktiv, v_umlage_satz, v_vergleich, v_verrechnung

   Was bleibt: v_kontenplan_abweichung und v_kontenzuordnung_abgleich.  Die
   liest auch keine Seite - sie sind zum Nachsehen da, wenn Kontenplan und
   SAP-Zuordnung auseinanderlaufen.
--------------------------------------------------------------------------- */

DROP VIEW IF EXISTS controlling.v_guv;
DROP VIEW IF EXISTS controlling.v_ebitda;
DROP VIEW IF EXISTS controlling.v_guv_region_staffel;
DROP VIEW IF EXISTS controlling.v_verlustbewertung;
DROP VIEW IF EXISTS controlling.v_forecast_neu;
DROP VIEW IF EXISTS controlling.v_berichtskopf;
DROP VIEW IF EXISTS controlling.v_ertragsteuern;
DROP VIEW IF EXISTS controlling.v_klr;
DROP VIEW IF EXISTS controlling.v_plan_ist_konto;
DROP VIEW IF EXISTS controlling.v_projekt_aktiv;
DROP VIEW IF EXISTS controlling.v_umlage_satz;
DROP VIEW IF EXISTS controlling.v_vergleich;
DROP VIEW IF EXISTS controlling.v_verrechnung;
