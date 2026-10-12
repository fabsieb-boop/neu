#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Reproduzierbarkeitsprobe.
#
#  Baut die Datenbank in einer Wegwerf-Datenbank komplett neu auf
#  (database.sql + alle Migrationen) und vergleicht das Ergebnis mit der
#  laufenden Datenbank: Zeilenzahlen, Kennzahlen und Pruefsummen ueber
#  Projektergebnisse und Kostenartenstamm.
#
#  Beantwortet die Frage "koennen wir das neu aufbauen, ohne etwas zu
#  verlieren" jederzeit mit einem echten Testlauf statt einer Vermutung.
#
#  Die laufende Datenbank wird dabei nur gelesen.
#
#  Aufruf:  npm run db:pruefen
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."
source db/umgebung.sh

TEST_DB="${TEST_DB:-controlling_pruefung}"
TEST_URL="postgresql:///$TEST_DB"

echo "Baue $TEST_DB neu auf – die laufende Datenbank bleibt unberuehrt."
dropdb --if-exists "$TEST_DB"
createdb "$TEST_DB"
psql -q "$TEST_URL" -v ON_ERROR_STOP=1 -f database.sql
# Genau dieselben Migrationen wie im Regelbetrieb – sonst prueft die Probe
# einen anderen Stand als den, der wirklich aufgebaut wird.
DATABASE_URL="$TEST_URL" bash db/setup.sh > /dev/null

abweichungen=0

vergleiche() {                       # $1 Beschreibung, $2 SQL
  local a b
  a="$(psql -tA "$DATABASE_URL" -c "$2")"
  b="$(psql -tA "$TEST_URL" -c "$2")"
  if [ "$a" = "$b" ]; then
    printf '  %-46s gleich\n' "$1"
  else
    printf '  %-46s ABWEICHUNG\n      laufend: %s\n      neu:     %s\n' "$1" "$a" "$b"
    abweichungen=$((abweichungen + 1))
  fi
}

echo
echo "Vergleich:"
# Aus database.sql und den Migrationen reproduzierbar – hier muss alles stimmen.
# verlustbewertung, ebitda_monat und plan_monat stehen seit 38_ergebnisstand_0826
# und 39_monatsplan_2026 in den Migrationen und gehoeren deshalb hierher.
for t in projekte kostenarten buchungen rollen berechtigungen rollen_berechtigungen \
         forecast_monat sap_buchungskopf \
         kontenstamm_tvf kontenkatalog_tvf guv_referenz guv_konten_referenz \
         liq_monat liq_bestand liq_parameter liq_finanzierung \
         verlustbewertung ebitda_monat plan_monat \
         nachtrag kassenbuch vertrag vertrag_rate risiken; do
  vergleiche "Zeilen $t" "SELECT count(*) FROM controlling.$t"
done

# Aus externen Dateien nachzuladen – hier ist eine Abweichung erwartbar.
#
# import_lauefe, audit_log und chance standen bis August 2026 in der Liste
# darueber und meldeten bei jedem Lauf eine Abweichung: die beiden ersten sind
# Betriebsprotokolle, chance kommt aus dem Pipeline-Import.  Aus den Skripten
# sind sie nicht reproduzierbar, und eine Probe, die immer fehlschlaegt, wird
# nicht mehr gelesen.
echo
echo "Nur aus externen Dateien nachladbar (npm run db:admin bzw. scripts/abschluss-laden.py):"
for t in benutzer benutzer_rollen sap_einzelposten projekt_risiko projekt_kennzahlen \
         offener_posten factoring abschluss_konto abschluss_gliederung \
         import_lauefe audit_log chance; do
  a="$(psql -tA "$DATABASE_URL" -c "SELECT count(*) FROM controlling.$t")"
  printf '  %-46s laufend %s\n' "$t" "$a"
done

vergleiche "Kennzahlen DB1-DB4" \
  "SELECT round(sum(leistung),2)||'/'||round(sum(db1),2)||'/'||round(sum(db3),2)||'/'||round(sum(db4),2)||'/'||round(sum(ergebnis_vor_steuern),2) FROM controlling.v_db_monat"
vergleiche "Pruefsumme Projektergebnisse" \
  "SELECT md5(string_agg(projekt_nr||':'||round(db1,2)||':'||round(db3,2)||':'||round(db4,2),'|' ORDER BY projekt_nr)) FROM controlling.v_projekt_db"
vergleiche "Pruefsumme Kostenartenstamm" \
  "SELECT md5(string_agg(kostenart_nr||':'||db_stufe||':'||klr_typ||':'||COALESCE(kontoart,'')||':'||COALESCE(quelle,''),'|' ORDER BY kostenart_nr)) FROM controlling.kostenarten"

echo
if [ "$abweichungen" -eq 0 ]; then
  echo "Ergebnis: alles aus den Skripten Reproduzierbare ist deckungsgleich."
  echo "Die oben aufgefuehrten Bestaende kommen aus externen Dateien und werden"
  echo "mit npm run db:admin bzw. scripts/abschluss-laden.py nachgeladen."
else
  echo "Ergebnis: $abweichungen Abweichung(en) bei Daten, die reproduzierbar sein sollten."
  echo "Das gehoert geprueft."
fi

dropdb --if-exists "$TEST_DB"
echo "Wegwerf-Datenbank entfernt."
exit 0
