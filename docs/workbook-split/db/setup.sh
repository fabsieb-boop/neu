#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Alle Migrationen der Reihe nach ausfuehren.
#  Idempotent: beliebig oft wiederholbar, auch nach jedem Import.
#
#  Setzt eine bestehende Datenbank voraus.  01_modell.sql beginnt mit
#  ALTER TABLE controlling.projekte - Schema und Grundtabellen kommen aus
#  dem Anwendungsschema, nicht von hier.  Gegen eine leere Datenbank
#  bricht der Lauf in der ersten Zeile ab; das ist so gemeint.
#
#  Alle Dateien laufen in EINEM psql-Aufruf mit ON_ERROR_STOP.  Ein Fehler
#  in der Mitte laesst alles Folgende aus - deshalb muss jede Migration
#  auch dann durchlaufen, wenn eine spaetere die Sicht schon veraendert
#  hat.  Wo eine spaetere Migration Spalten oder Typen aendert, gehoert vor
#  das CREATE ein DROP VIEW IF EXISTS.
#
#  Aufruf:  npm run db:setup
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."
source db/umgebung.sh

echo "Datenbank: $DATABASE_URL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q \
  -f db/01_modell.sql \
  -f db/02_views.sql \
  -f db/03_kontenstamm.sql \
  -f db/04_referenzen.sql \
  -f db/05_liquiditaet.sql \
  -f db/06_altbestand.sql \
  -f db/07_zahlungsdaten.sql \
  -f db/08_planung.sql \
  -f db/09_einzelposten_neu.sql \
  -f db/10_abstimmung.sql \
  -f db/11_forecast.sql \
  -f db/12_benutzer.sql \
  -f db/13_einstellungen.sql \
  -f db/14_guv_region.sql \
  -f db/15_liquiditaet_woche.sql \
  -f db/16_planung_konto.sql \
  -f db/17_risiko_massnahmen.sql \
  -f db/18_kostenverfolgung.sql \
  -f db/19_berichtsrecht.sql \
  -f db/20_ertragsteuern.sql \
  -f db/21_belastbare_perioden.sql \
  -f db/22_innenauftraege.sql \
  -f db/23_berichtsbaukasten.sql \
  -f db/24_sap_struktur.sql \
  -f db/25_vergleichswerte.sql \
  -f db/26_verlustbewertung.sql \
  -f db/27_systemrecht.sql \
  -f db/28_aktive_projekte.sql \
  -f db/29_bestandsveraenderung.sql \
  -f db/30_verrechnung.sql \
  -f db/31_stunden.sql \
  -f db/32_umlage.sql \
  -f db/33_bestandsalter.sql \
  -f db/34_kalkulation.sql \
  -f db/35_baukasten_quellen.sql \
  -f db/36_rollen.sql \
  -f db/37_bestandsdeckung.sql \
  -f db/38_ergebnisstand_0826.sql \
  -f db/39_monatsplan_2026.sql \
  -f db/40_zeitraum.sql \
  -f db/41_forecast_ausblenden.sql \
  -f db/42_guv_aus_sap.sql \
  -f db/43_abstimmung_periode.sql \
  -f db/44_ebitda_region.sql \
  -f db/45_forecast_vorzeichen.sql \
  -f db/46_guv_staffel.sql \
  -f db/47_bilanz_guv.sql \
  -f db/48_ebitda_gerechnet.sql \
  -f db/49_forecast_rolling.sql \
  -f db/50_kv_deckblatt.sql \
  -f db/51_guv_staffel_sap.sql \
  -f db/52_guv_ist_sap_grenze.sql \
  -f db/53_referenz_personal.sql \
  -f db/54_guv_region_sap_grenze.sql \
  -f db/55_ebitda_region_sap.sql \
  -f db/56_bruecke_ein_ebitda.sql \
  -f db/57_referenz_ist_gegen_sap.sql \
  -f db/58_ebitda_ohne_sonstige_steuern.sql \
  -f db/59_kontenplan_abgleich.sql \
  -f db/60_ebitda_nach_kontenplan.sql \
  -f db/61_altlasten_entfernen.sql \
  -f db/62_sap_bericht_periode7.sql \
  -f db/63_kv_kalkuliert_ableiten.sql \
  -f db/64_monatsfreigabe.sql \
  -f db/65_bestand_ungedeckt.sql \
  -f db/66_bestand_mit_umlage.sql
echo "Alle Migrationen ausgefuehrt."
