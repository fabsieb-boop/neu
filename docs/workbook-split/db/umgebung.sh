# ---------------------------------------------------------------------------
#  Gemeinsame Umgebung fuer die Datenbankskripte.
#
#  npm laedt .env.local nicht von sich aus. Damit die Befehle ohne
#  Vorbereitung laufen, wird die Datei hier eingelesen – bereits gesetzte
#  Variablen der Shell haben Vorrang.
#
#  Einbinden mit:  source "$(dirname "$0")/umgebung.sh"
# ---------------------------------------------------------------------------

lade_env_datei() {
  local datei="$1"
  [ -f "$datei" ] || return 0
  while IFS= read -r zeile || [ -n "$zeile" ]; do
    case "$zeile" in
      ''|'#'*) continue ;;
    esac
    local name="${zeile%%=*}"
    local wert="${zeile#*=}"
    # Nur gueltige Variablennamen, keine bereits gesetzten ueberschreiben
    case "$name" in
      [A-Za-z_][A-Za-z0-9_]*) ;;
      *) continue ;;
    esac
    [ -n "${!name:-}" ] && continue
    # Umschliessende Anfuehrungszeichen entfernen
    wert="${wert%\"}"; wert="${wert#\"}"
    wert="${wert%\'}"; wert="${wert#\'}"
    export "$name=$wert"
  done < "$datei"
}

lade_env_datei ".env.local"
lade_env_datei ".env"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL ist nicht gesetzt." >&2
  echo "Erwartet in .env.local, z. B.:  DATABASE_URL=postgresql:///controlling" >&2
  exit 1
fi
