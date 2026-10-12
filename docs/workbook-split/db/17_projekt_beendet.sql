-- Statusbericht (kv_dashboard.phase = abgeschlossen) in den Projektstamm übernehmen.
-- Unteraufträge folgen dem Hauptauftrag. Forecast-Zeilen und Buchungen bleiben liegen;
-- die Forecast-Seiten blenden diese Aufträge nur aus.
UPDATE controlling.projekte p
   SET status = 'ABGESCHLOSSEN'
  FROM (
    SELECT DISTINCT ON (auftrag) auftrag, lower(phase) AS phase
      FROM controlling.kv_dashboard
     WHERE auftrag IS NOT NULL AND btrim(auftrag) <> ''
     ORDER BY auftrag, stand DESC NULLS LAST
  ) k
 WHERE k.auftrag = p.projekt_nr
   AND k.phase = 'abgeschlossen'
   AND upper(coalesce(p.status, '')) IS DISTINCT FROM 'ABGESCHLOSSEN';

UPDATE controlling.projekte s
   SET status = 'ABGESCHLOSSEN'
  FROM controlling.projekte h
 WHERE s.hauptprojekt_nr = h.projekt_nr
   AND upper(coalesce(h.status, '')) = 'ABGESCHLOSSEN'
   AND upper(coalesce(s.status, '')) IS DISTINCT FROM 'ABGESCHLOSSEN';
