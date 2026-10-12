#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Vollstaendige Sicherung der Datenbank.
#
#  Schreibt einen komprimierten Dump nach sicherung/. Der Dump enthaelt alles:
#  Schema, Stammdaten, Buchungen, Benutzer, erfasste Risiken und Forecasts,
#  SAP-Belege und das Audit-Protokoll. Damit geht bei einem Neuaufbau nichts
#  verloren, auch nicht die nach dem Erstimport hinzugekommenen Buchungen.
#
#  Aufruf:  npm run db:sichern
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."
source db/umgebung.sh

ZIEL="${1:-sicherung}"
mkdir -p "$ZIEL"

ZEITPUNKT="$(date +%Y%m%d_%H%M%S)"
DATEI="$ZIEL/controlling_$ZEITPUNKT.sql.gz"

echo "Sichere $DATABASE_URL"
pg_dump "$DATABASE_URL" --no-owner --no-privileges --schema=controlling | gzip > "$DATEI"

GROESSE="$(du -h "$DATEI" | cut -f1)"
echo "Fertig: $DATEI ($GROESSE)"
echo
echo "Zurueckspielen in eine leere Datenbank:"
echo "  createdb controlling_neu"
echo "  gunzip -c $DATEI | psql \"postgresql:///controlling_neu\""
