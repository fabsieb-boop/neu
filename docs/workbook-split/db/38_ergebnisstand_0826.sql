/* ---------------------------------------------------------------------------
   Ergebnisstand 08/2026 – Abgleich mit dem Datenmodell der Ergebnispraesentation
   ---------------------------------------------------------------------------
   Die Ergebnispraesentation Juli 2026 (Datenmodell_Ergebnispraesentation_Juli-
   2026.xlsx, Blaetter "Bewertung", "GuV 2026", "Forecast 2026", "FI-Monats-
   werte") ist der abgestimmte Stand.  Drei Bestaende standen noch auf dem
   Rolling Forecast 5 vom Juni und werden hier nachgezogen:

     1. verlustbewertung  – Stand 08/2026 statt Stand Juni (Folie 20)
     2. ebitda_monat      – die Zerlegung des Blattes "GuV 2026"
     3. liq_monat         – Juli auf Ist, August bis Dezember auf den
                            Forecast der Praesentation

   Es gibt eine GuV und ein EBITDA.  Wo diese Datenbank frueher zwischen
   Folie 12 und Folie 18 geschwankt hat – am deutlichsten beim Overhead –
   gilt jetzt durchgehend das Blatt "GuV 2026".

   Was NICHT nachgezogen wird und warum:

     August bleibt im Forecast bei -151 T EUR.  Das Excel-Modell zieht dort
     ueber das Blatt "FI-Monatswerte" den SAP-Teilstand vom 20.08. (-441 T EUR)
     in eine Spalte, deren Umsatz und Bestandsveraenderung weiter auf dem
     Forecast des vollen Monats stehen.  Aus zwei Dritteln eines Monats laesst
     sich kein Monatsergebnis ableiten; sobald der August abgeschlossen ist,
     traegt der Einzelpostenimport den echten Wert ein.  Genau diese -290 T EUR
     sind es, die im Blatt "Folienwerte" vier Kennzahlen auf "PPTX anpassen"
     setzen.

   Nach diesem Skript gilt:

     EBITDA Jan-Jul   -121 T EUR   (Blatt "GuV 2026": -121)
     Overhead Jan-Jul -909 T EUR   (dito)
     EBITDA 2026       210 T EUR   (Folie 18: 210)
     offene Bewertung    0 T EUR   (alles gebucht oder im Forecast)
--------------------------------------------------------------------------- */

BEGIN;

/* ---------------------------------------------------------------------------
   1. Verlustfreie Bewertung, Stand 31.07.2026 / Ansatz FC 4 (Folie 20)
   ---------------------------------------------------------------------------
   Die -725 T EUR, die im Juni offen waren, loesen sich vollstaendig auf:

     -376  im Juli gebucht     (TKSE -310, RB Floorflexplatten -3, B1 -63)
     -293  im Forecast Oktober (Marggrafenbruecke -206, BASF O 405D -87)
      +56  Verbesserung Marggrafenbruecke gegenueber dem Juni-Ansatz
     -----
     -725

   Dazu kommt ein Sachverhalt, der nicht 2026 betrifft: fuer Marggrafenbruecke
   sind nach dem Stand 08/26 zusaetzlich -290 T EUR dem Jahr 2025 zuzuordnen.

   Die frueheren Zeilen stammen aus dem Rolling Forecast 5 und aus einer
   Handerfassung vom 21.08.  Beide sind durch den Stand 08/2026 ersetzt und
   werden deshalb entfernt – gezielt ueber ihre Quelle, damit spaeter von Hand
   erfasste Sachverhalte stehen bleiben.
--------------------------------------------------------------------------- */

DELETE FROM controlling.verlustbewertung
 WHERE quelle IN ('Rolling Forecast-5', 'Fabian 21.08.2026', 'Bewertungsstand 08/2026');

INSERT INTO controlling.verlustbewertung
  (jahr, monat, projekt_nr, betrag, gebucht, im_forecast, nachrichtlich, quelle, notiz) VALUES
  (2026,  7, NULL, -310000.00, true,  false, false, 'Bewertungsstand 08/2026',
   'TKSE WBW4 Hallenrueckbau – im Juli 2026 gebucht'),
  (2026,  7, NULL,   -3000.00, true,  false, false, 'Bewertungsstand 08/2026',
   'RB Floorflexplatten Berlin – im Juli 2026 gebucht'),
  (2026,  7, NULL,  -63000.00, true,  false, false, 'Bewertungsstand 08/2026',
   'B1 Brandenburg – im Juli 2026 gebucht'),
  (2026, 10, NULL, -206000.00, false, true,  false, 'Bewertungsstand 08/2026',
   'Marggrafenbruecke – Ansatz Oktober 2026, im Forecast enthalten (Juni -262, jetzt -206)'),
  (2026, 10, NULL,  -87000.00, false, true,  false, 'Bewertungsstand 08/2026',
   'BASF O 405D – Ansatz Oktober 2026, im Forecast enthalten'),
  (2025, 12, NULL, -290000.00, false, false, false, 'Bewertungsstand 08/2026',
   'Marggrafenbruecke – Korrektur, betrifft das Geschaeftsjahr 2025');

/* ---------------------------------------------------------------------------
   2. EBITDA-Monatsreihe 2026 – die Zerlegung der GuV
   ---------------------------------------------------------------------------
   Es gibt eine GuV und ein EBITDA.  Massgeblich ist das Blatt "GuV 2026" der
   Ergebnispraesentation; die Reihe hier traegt genau dessen Zerlegung:

     overhead              = Zeile "Overhead"
     operatives_ergebnis   = "EBITDA vor verlustfreier Bewertung" ./. Overhead
     bewertung             = gebuchte plus nicht gebuchte Bewertung

   Die mittlere Zeile ist eine Restgroesse und nicht das "Operative Ergebnis"
   der Folie 12: jene Zeile ist nachrichtlich und nicht additiv, das sagt die
   Excel selbst.  Additiv ist diese Zerlegung, und nur darauf kommt es an –
   op + overhead + bewertung ergibt das EBITDA des Monats.

   Damit stimmen Overhead YTD (-909) und die Aufteilung der verlustfreien
   Bewertung (-447 gebucht, -293 offen) mit der Praesentation ueberein.

   Einzige bewusste Abweichung: der August steht auf dem Forecast (-151) und
   nicht auf dem SAP-Teilstand vom 20.08. (-441).  Aus zwei Dritteln eines
   Monats laesst sich kein Monatsergebnis ableiten; sobald der August
   abgeschlossen ist, traegt der Einzelpostenimport den echten Wert ein.
--------------------------------------------------------------------------- */

INSERT INTO controlling.ebitda_monat
  (jahr, monat, art, operatives_ergebnis, overhead, bewertung, quelle, stand) VALUES
  (2026,  1, 'IST',  381000.00,  -89000.00,       0.00, 'Ergebnispraesentation 07/2026', DATE '2026-08-27'),
  (2026,  2, 'IST',  429000.00, -104000.00,       0.00, 'Ergebnispraesentation 07/2026', DATE '2026-08-27'),
  (2026,  3, 'IST',  174000.00, -151000.00,       0.00, 'Ergebnispraesentation 07/2026', DATE '2026-08-27'),
  (2026,  4, 'IST',   14000.00, -152000.00,  -43000.00, 'Ergebnispraesentation 07/2026', DATE '2026-08-27'),
  (2026,  5, 'IST',  -71000.00, -142000.00,   71000.00, 'Ergebnispraesentation 07/2026', DATE '2026-08-27'),
  (2026,  6, 'IST',  308000.00, -149000.00, -102000.00, 'Ergebnispraesentation 07/2026', DATE '2026-08-27'),
  (2026,  7, 'IST',       0.00, -122000.00, -373000.00, 'Ergebnispraesentation 07/2026', DATE '2026-08-27'),
  (2026,  8, 'FC',    2000.00, -153000.00,       0.00, 'Ergebnispraesentation 07/2026', DATE '2026-08-27'),
  (2026,  9, 'FC',  362000.00, -159000.00,       0.00, 'Ergebnispraesentation 07/2026', DATE '2026-08-27'),
  (2026, 10, 'FC',  294000.00, -143000.00, -293000.00, 'Ergebnispraesentation 07/2026', DATE '2026-08-27'),
  (2026, 11, 'FC',  206000.00, -137000.00,       0.00, 'Ergebnispraesentation 07/2026', DATE '2026-08-27'),
  (2026, 12, 'FC',  489000.00, -137000.00,       0.00, 'Ergebnispraesentation 07/2026', DATE '2026-08-27')
ON CONFLICT (jahr, monat) DO UPDATE
   SET art                 = EXCLUDED.art,
       operatives_ergebnis = EXCLUDED.operatives_ergebnis,
       overhead            = EXCLUDED.overhead,
       bewertung           = EXCLUDED.bewertung,
       quelle              = EXCLUDED.quelle,
       stand               = EXCLUDED.stand;

/* ---------------------------------------------------------------------------
   3. Liquiditaetsmodell auf denselben Stand
   ---------------------------------------------------------------------------
   liq_monat wurde zuletzt aus einem aelteren Rolling Forecast geladen und
   widersprach dem eigenen Haus: Juli stand mit Umsatz 1.006 und EBITDA -877
   T EUR, waehrend v_guv_ist und ebitda_monat 1.324 und -496 ausweisen.  Die
   Liquiditaetsplanung rechnete damit auf anderen Zahlen als das Cockpit.

   Juli kommt jetzt aus den SAP-Einzelposten (v_guv_ist), August bis Dezember
   aus dem Forecast der Praesentation.  Das EBITDA stammt durchgaengig aus
   ebitda_monat – eine Zahl, eine Quelle.

   Hinweis: scripts/abschluss-laden.py ueberschreibt liq_monat wieder, wenn es
   mit einer aelteren Rolling-Forecast-Datei laeuft.  Danach dieses Skript
   erneut ausfuehren (npm run db:setup).
--------------------------------------------------------------------------- */

UPDATE controlling.liq_monat l
   SET umsatz            = f.umsatz,
       bestandsaenderung = f.bestand
  FROM (VALUES
      ( 7, 1323928.20,  294716.46),   -- Ist, SAP-Einzelposten
      ( 8,  626000.00, 1158000.00),   -- Forecast lt. Praesentation
      ( 9, 1427000.00, 1040000.00),
      (10, 5445000.00,-3378000.00),
      (11, 3546000.00,-1542000.00),
      (12, 6163000.00,-3897000.00)
    ) AS f(monat, umsatz, bestand)
 WHERE l.jahr = 2026 AND l.monat = f.monat;

/* Januar bis Juni standen mit den gerundeten Folienwerten (292,0 statt 292,5)
   in liq_monat.  Das EBITDA kommt jetzt fuer alle zwoelf Monate aus
   ebitda_monat – dieselbe Reihe, die auch das Cockpit ausweist. */

UPDATE controlling.liq_monat l
   SET ebitda = e.operatives_ergebnis + e.overhead + e.bewertung
  FROM controlling.ebitda_monat e
 WHERE e.jahr = l.jahr AND e.monat = l.monat AND l.jahr = 2026;

COMMIT;
