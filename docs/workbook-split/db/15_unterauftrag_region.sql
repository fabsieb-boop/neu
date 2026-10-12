-- Unteraufträge heißen wie der Hauptauftrag plus Suffix, z. B. P4102157455-01.
-- Die Region steckt in Stelle 6–7 der Stammnummer. Der Suffix hat die Zuordnung
-- bisher auf NULL gesetzt, f_region_voll lieferte dann „Ohne Zuordnung“ und die
-- Lose fielen aus der Regionssicht des Forecasts.

CREATE OR REPLACE FUNCTION controlling.f_regionscode(auftrag text, kostenstelle text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN auftrag ~ '^[A-Za-z]\d{10}(-\d+)?$' THEN substr(auftrag, 6, 2)
    WHEN kostenstelle ~ '^\d{10}$' THEN substr(kostenstelle, 5, 2)
    ELSE NULL
  END
$function$;
