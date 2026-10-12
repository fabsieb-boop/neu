-- Wochenreihe der Liquidität aus liq_monat.
-- Die Ergebnisspalte heißt jahr. Ohne Tabellenalias kollidiert sie mit liq_bestand.jahr
-- und die Funktion bricht ab, bevor eine Woche zurückkommt.

CREATE OR REPLACE FUNCTION controlling.f_liq_wochen(p_wochen integer DEFAULT 52)
 RETURNS TABLE(woche date, jahr integer, kw integer, einzahlung numeric, auszahlung numeric, netto numeric, bestand numeric)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE v_dso integer; v_dpo integer; v_start numeric;
BEGIN
  SELECT COALESCE(max(p.wert) FILTER (WHERE p.schluessel ILIKE '%dso%'), 119)::int,
         COALESCE(max(p.wert) FILTER (WHERE p.schluessel ILIKE '%dpo%'), 45)::int
    INTO v_dso, v_dpo
    FROM controlling.liq_parameter p;

  SELECT COALESCE(b.saldo, 0) INTO v_start
    FROM controlling.liq_bestand b
   ORDER BY b.jahr DESC, b.monat DESC
   LIMIT 1;
  v_start := COALESCE(v_start, 0);

  RETURN QUERY
  WITH w AS (
    SELECT (date_trunc('week', current_date)::date + (i * 7)) AS woche
      FROM generate_series(0, GREATEST(p_wochen, 1) - 1) i
  ),
  wz AS (
    SELECT w.woche, date_trunc('month', w.woche)::date AS zm FROM w
  ),
  anzahl AS (
    SELECT wz.zm, count(*)::numeric AS n FROM wz GROUP BY wz.zm
  ),
  m AS (
    SELECT make_date(lm.jahr, lm.monat, 1) AS m,
           COALESCE(lm.umsatz, 0) AS umsatz,
           COALESCE(lm.umsatz, 0) - COALESCE(lm.ebitda, 0) AS kosten
      FROM controlling.liq_monat lm
  ),
  ein AS (
    SELECT date_trunc('month', m.m + (v_dso || ' days')::interval)::date AS zm,
           sum(m.umsatz) AS betrag
      FROM m
     GROUP BY 1
  ),
  aus AS (
    SELECT date_trunc('month', m.m + (v_dpo || ' days')::interval)::date AS zm,
           sum(m.kosten) AS betrag
      FROM m
     GROUP BY 1
  ),
  je_woche AS (
    SELECT wz.woche,
           COALESCE(ein.betrag / NULLIF(anzahl.n, 0), 0) AS einzahlung,
           COALESCE(aus.betrag / NULLIF(anzahl.n, 0), 0) AS auszahlung
      FROM wz
      JOIN anzahl ON anzahl.zm = wz.zm
      LEFT JOIN ein ON ein.zm = wz.zm
      LEFT JOIN aus ON aus.zm = wz.zm
  )
  SELECT j.woche,
         EXTRACT(isoyear FROM j.woche)::int,
         EXTRACT(week FROM j.woche)::int,
         round(j.einzahlung, 2),
         round(-j.auszahlung, 2),
         round(j.einzahlung - j.auszahlung, 2),
         round(v_start + sum(j.einzahlung - j.auszahlung) OVER (ORDER BY j.woche), 2)
    FROM je_woche j
   ORDER BY j.woche;
END
$function$;
