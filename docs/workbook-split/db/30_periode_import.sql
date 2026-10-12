-- Datenstatus zaehlt je Monat das vollere Journal.
-- Gezaehlt werden SAP-Einzelposten, importierte Buchungen und der FI-Kontenexport.
-- Die drei Quellen bleiben einzeln sichtbar, damit ein Import ueber alle Monate
-- sofort in der Ampel steht. Die GuV-Quelle bleibt v_guv_quelle.
-- Die Grenze rueckt nur nach vorn.

DROP INDEX IF EXISTS controlling.ux_buchungen_beleg;
CREATE UNIQUE INDEX ux_buchungen_beleg
  ON controlling.buchungen (belegnummer, buchungszeile, auftrag, kostenart, wert, geschaeftsjahr, periode)
  WHERE belegnummer IS NOT NULL;

CREATE OR REPLACE VIEW controlling.v_periode_status AS
 SELECT b.jahr,
    b.monat,
    b.belege,
    b.median_belege,
    b.fuellgrad,
    (COALESCE(b.freigabe, false) OR (b.belastbar AND COALESCE(a.co_vollstaendig, false))) AS belastbar,
    b.freigabe,
    COALESCE(b.freigabe, b.belastbar AND COALESCE(a.co_vollstaendig, false)) AS belastbar_effektiv,
    COALESCE(a.lohn_gebucht, false) AS lohn_gebucht,
    COALESCE(a.co_gebucht, false) AS co_gebucht,
    COALESCE(a.abgeschlossen, false) AS abgeschlossen,
    COALESCE(a.quelle, 'keine'::text) AS quelle,
    b.belege_journal,
    b.belege_fi,
    b.belege_sap
   FROM ( WITH monate AS (
                 SELECT COALESCE(sap.jahr, imp.jahr, fi.jahr) AS jahr,
                    COALESCE(sap.monat, imp.monat, fi.monat) AS monat,
                    GREATEST(COALESCE(sap.belege, 0), COALESCE(imp.belege, 0), COALESCE(fi.belege, 0)) AS belege,
                    COALESCE(imp.belege, 0) AS belege_journal,
                    COALESCE(fi.belege, 0) AS belege_fi,
                    COALESCE(sap.belege, 0) AS belege_sap
                   FROM (
                          SELECT sap_einzelposten.geschaeftsjahr::integer AS jahr,
                             sap_einzelposten.monat::integer AS monat,
                             count(*) AS belege
                            FROM controlling.sap_einzelposten
                           WHERE sap_einzelposten.buchungsdatum IS NOT NULL
                             AND sap_einzelposten.geschaeftsjahr IS NOT NULL
                             AND sap_einzelposten.monat BETWEEN 1 AND 12
                           GROUP BY sap_einzelposten.geschaeftsjahr::integer, sap_einzelposten.monat::integer
                        ) sap
                     FULL JOIN (
                          SELECT buchungen.geschaeftsjahr::integer AS jahr,
                             buchungen.periode::integer AS monat,
                             count(*) AS belege
                            FROM controlling.buchungen
                           WHERE COALESCE(buchungen.gueltig, true)
                             AND buchungen.geschaeftsjahr IS NOT NULL
                             AND buchungen.periode BETWEEN 1 AND 12
                           GROUP BY buchungen.geschaeftsjahr::integer, buchungen.periode::integer
                        ) imp ON imp.jahr = sap.jahr AND imp.monat = sap.monat
                     FULL JOIN (
                          SELECT sap_fi_konten.geschaeftsjahr::integer AS jahr,
                             sap_fi_konten.periode::integer AS monat,
                             count(*) AS belege
                            FROM controlling.sap_fi_konten
                           WHERE sap_fi_konten.geschaeftsjahr IS NOT NULL
                             AND sap_fi_konten.periode BETWEEN 1 AND 12
                           GROUP BY sap_fi_konten.geschaeftsjahr::integer, sap_fi_konten.periode::integer
                        ) fi ON fi.jahr = COALESCE(sap.jahr, imp.jahr) AND fi.monat = COALESCE(sap.monat, imp.monat)
                ), mass AS (
                 SELECT monate.jahr,
                    percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (monate.belege::double precision)) AS median_belege
                   FROM monate
                  GROUP BY monate.jahr
                )
         SELECT m.jahr,
            m.monat,
            m.belege,
            m.belege_journal,
            m.belege_fi,
            m.belege_sap,
            round(s.median_belege) AS median_belege,
            round((100.0 * m.belege::numeric)::double precision / NULLIF(s.median_belege, 0::double precision))::numeric AS fuellgrad,
            m.belege::double precision >= (0.7::double precision * s.median_belege) AS belastbar,
            f.freigegeben AS freigabe,
            COALESCE(f.freigegeben, m.belege::double precision >= (0.7::double precision * s.median_belege)) AS belastbar_effektiv
           FROM monate m
             JOIN mass s ON s.jahr = m.jahr
             LEFT JOIN controlling.monat_freigabe f ON f.jahr = m.jahr AND f.monat = m.monat) b
     LEFT JOIN ( SELECT q.jahr,
            q.monat,
            COALESCE(c.lg, false) OR q.fi_vollstaendig AS lohn_gebucht,
            COALESCE(c.co, false) OR q.fi_belege IS NOT NULL AS co_gebucht,
            q.co_vollstaendig OR q.fi_vollstaendig AS abgeschlossen,
            q.co_vollstaendig,
            q.quelle
           FROM controlling.v_guv_quelle q
             LEFT JOIN ( SELECT sap_einzelposten.geschaeftsjahr::integer AS jahr,
                    sap_einzelposten.monat::integer AS monat,
                    bool_or(sap_einzelposten.belegart::text = 'LG'::text) AS lg,
                    bool_or(sap_einzelposten.belegart::text = 'CO'::text) AS co
                   FROM controlling.sap_einzelposten
                  GROUP BY sap_einzelposten.geschaeftsjahr::integer, sap_einzelposten.monat::integer) c ON c.jahr = q.jahr AND c.monat = q.monat) a ON a.jahr = b.jahr AND a.monat = b.monat;

CREATE OR REPLACE VIEW controlling.v_monat_ampel AS
 WITH p AS (
         SELECT v_periode_status.jahr,
            v_periode_status.monat,
            v_periode_status.belege,
            v_periode_status.median_belege,
            v_periode_status.fuellgrad,
            v_periode_status.belastbar,
            v_periode_status.freigabe,
            v_periode_status.belastbar_effektiv,
            v_periode_status.lohn_gebucht,
            v_periode_status.co_gebucht,
            v_periode_status.abgeschlossen,
            v_periode_status.quelle,
            v_periode_status.belege_journal,
            v_periode_status.belege_fi,
            v_periode_status.belege_sap
           FROM controlling.v_periode_status
        ), kz AS (
         SELECT v_guv_staffel.jahr,
            v_guv_staffel.monat,
            sum(v_guv_staffel.betrag) FILTER (WHERE v_guv_staffel.guv_gruppe::text ~~ '1 %'::text) AS umsatz,
            sum(v_guv_staffel.betrag) FILTER (WHERE v_guv_staffel.guv_gruppe::text ~~ '2 %'::text) AS bestand,
            sum(v_guv_staffel.betrag) FILTER (WHERE v_guv_staffel.guv_gruppe::text ~~ '5 %'::text) AS personal,
            sum(v_guv_staffel.betrag) AS ergebnis
           FROM controlling.v_guv_staffel
          GROUP BY v_guv_staffel.jahr, v_guv_staffel.monat
        ), ab AS (
         SELECT v_guv_abgleich_sap.jahr,
            v_guv_abgleich_sap.periode,
            count(*) AS gruppen,
            count(*) FILTER (WHERE NOT v_guv_abgleich_sap.stimmt) AS abweichend,
            max(abs(v_guv_abgleich_sap.differenz)) AS max_differenz
           FROM controlling.v_guv_abgleich_sap
          GROUP BY v_guv_abgleich_sap.jahr, v_guv_abgleich_sap.periode
        )
 SELECT p.jahr,
    p.monat,
    p.belege,
    p.fuellgrad,
    p.lohn_gebucht,
    p.co_gebucht,
    p.freigabe,
    p.belastbar_effektiv,
    kz.umsatz,
    kz.bestand,
    kz.personal,
    kz.ergebnis,
    ab.periode IS NOT NULL AS sap_bericht,
    ab.abweichend,
    ab.max_differenz,
        CASE
            WHEN p.belastbar_effektiv AND ab.periode IS NOT NULL AND COALESCE(ab.abweichend, 0) = 0 THEN 'GRUEN'::text
            WHEN p.belastbar_effektiv OR (p.quelle = 'FI'::text AND p.lohn_gebucht AND p.belege > 0) THEN 'GELB'::text
            ELSE 'ROT'::text
        END AS ampel,
    concat_ws(' · '::text,
        CASE
            WHEN p.fuellgrad < 70::numeric THEN ('Füllgrad '::text || round(p.fuellgrad)) || ' % (< 70 %)'::text
            ELSE NULL::text
        END,
        CASE
            WHEN NOT p.lohn_gebucht THEN 'Lohn fehlt'::text
            ELSE NULL::text
        END,
        CASE
            WHEN NOT p.co_gebucht THEN 'CO-Verrechnung fehlt'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(kz.umsatz, 0::numeric) <= 0::numeric AND p.belege > 0 THEN 'Umsatz ≤ 0'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(kz.personal, 0::numeric) = 0::numeric AND p.belege > 0 THEN 'kein Personalaufwand'::text
            ELSE NULL::text
        END,
        CASE
            WHEN p.quelle = 'FI'::text AND NOT COALESCE(p.freigabe, false) AND NOT p.belastbar_effektiv THEN 'FI geladen, Monat bleibt Forecast bis zur Freigabe'::text
            WHEN p.quelle = 'FI'::text THEN 'GuV aus FI-Konten (CO-Export unvollständig – Projektsicht wartet)'::text
            ELSE NULL::text
        END,
        CASE
            WHEN p.freigabe THEN 'manuell freigegeben'::text
            ELSE NULL::text
        END,
        CASE
            WHEN ab.periode IS NULL THEN 'SAP-Bericht nicht geladen'::text
            WHEN ab.abweichend > 0 THEN ((ab.abweichend || ' Gruppe/n weichen ab (max '::text) || round(ab.max_differenz / 1000::numeric)) || ' T€)'::text
            ELSE 'SAP-Abgleich stimmt'::text
        END) AS hinweis,
    p.quelle,
    p.belege_journal,
    p.belege_fi,
    p.belege_sap
   FROM p
     LEFT JOIN kz ON kz.jahr = p.jahr AND kz.monat = p.monat
     LEFT JOIN ab ON ab.jahr = p.jahr AND ab.periode = p.monat;
