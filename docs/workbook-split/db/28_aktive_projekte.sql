/* ---------------------------------------------------------------------------
   Aktive Projekte
   ---------------------------------------------------------------------------
   In Forecast und Kostenverfolgung stehen sonst auch die laengst
   abgemeldeten Auftraege – 288 Zeilen, von denen zwei Drittel niemanden mehr
   beschaeftigen.  Diese Sicht sagt einmal zentral, was "aktiv" heisst,
   damit jede Seite dieselbe Antwort gibt.

   Ein Auftrag gilt als aktiv, wenn eines davon zutrifft:
     · in den letzten drei abgerechneten Perioden wurde darauf gebucht
     · die Kostenverfolgung fuehrt ihn nicht als Abmeldung
     · er traegt einen Forecast fuer das laufende Jahr

   Bewusst grosszuegig: lieber ein Auftrag zu viel in der Liste als einer,
   den jemand vermisst.  Wer einen abgemeldeten braucht, blendet ihn auf der
   Seite wieder ein – herausgesucht wird nichts von Hand.
--------------------------------------------------------------------------- */

CREATE OR REPLACE VIEW controlling.v_projekt_aktiv AS
WITH letzte AS (
  SELECT max(monat) AS bis, jahr
    FROM controlling.v_buchung
   WHERE jahr = (SELECT max(jahr) FROM controlling.v_buchung)
   GROUP BY jahr
), bewegt AS (
  SELECT DISTINCT b.projekt_nr
    FROM controlling.v_buchung b, letzte l
   WHERE b.jahr = l.jahr AND b.monat > l.bis - 3 AND b.projekt_nr IS NOT NULL
), geplant AS (
  SELECT DISTINCT p.projekt_nr
    FROM controlling.forecast_monat f
    JOIN controlling.projekte p ON p.projekt_id = f.projekt_id
   WHERE f.jahr = (SELECT max(jahr) FROM controlling.v_buchung)
     AND (COALESCE(f.umsatz_plan,0) <> 0 OR COALESCE(f.umsatz_forecast,0) <> 0
          OR COALESCE(f.kosten_plan,0) <> 0 OR COALESCE(f.kosten_forecast,0) <> 0)
), offen AS (
  SELECT DISTINCT COALESCE(auftrag, psp) AS projekt_nr
    FROM controlling.kv_dashboard
   WHERE COALESCE(status, '') !~* 'abmeldung|abnmeldung|storn'
)
SELECT p.projekt_nr,
       (b.projekt_nr IS NOT NULL) AS zuletzt_gebucht,
       (g.projekt_nr IS NOT NULL) AS hat_forecast,
       (o.projekt_nr IS NOT NULL) AS kv_offen,
       (b.projekt_nr IS NOT NULL OR g.projekt_nr IS NOT NULL
        OR o.projekt_nr IS NOT NULL) AS aktiv
  FROM controlling.projekte p
  LEFT JOIN bewegt  b ON b.projekt_nr = p.projekt_nr
  LEFT JOIN geplant g ON g.projekt_nr = p.projekt_nr
  LEFT JOIN offen   o ON o.projekt_nr = p.projekt_nr;

COMMENT ON VIEW controlling.v_projekt_aktiv IS
  'Ein Auftrag ist aktiv, wenn zuletzt gebucht, mit Forecast oder in der KV nicht abgemeldet.';

GRANT SELECT ON controlling.v_projekt_aktiv TO PUBLIC;
