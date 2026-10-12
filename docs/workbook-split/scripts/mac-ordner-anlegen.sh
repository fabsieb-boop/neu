#!/bin/bash
# Auf dem Mac im Terminal:
#   bash ~/TVF-Cockpit/scripts/mac-ordner-anlegen.sh
# oder aus Downloads, bevor das ZIP entpackt ist:
#   bash mac-ordner-anlegen.sh

set -euo pipefail

TARGET="${HOME}/TVF-Cockpit"
ZIP_DEFAULT="${HOME}/Downloads/TVF_Cockpit_SharePoint_Paket.zip"

mkdir -p "${TARGET}/dateien" "${TARGET}/scripts"
echo "Ordner bereit: ${TARGET}"

if [[ -f "${ZIP_DEFAULT}" ]]; then
  echo "Entpacke ${ZIP_DEFAULT} ..."
  unzip -o "${ZIP_DEFAULT}" -d "${TARGET}"
else
  echo "ZIP nicht gefunden unter: ${ZIP_DEFAULT}"
  echo "Bitte ZIP dorthin legen oder:"
  echo "  unzip -o /pfad/zum/TVF_Cockpit_SharePoint_Paket.zip -d ~/TVF-Cockpit"
fi

echo "Excel-Dateien:"
find "${TARGET}/dateien" -name '*.xlsx' 2>/dev/null | wc -l | tr -d ' '

echo "Skripte:"
ls -1 "${TARGET}/scripts" 2>/dev/null || true

open "${TARGET}"
ls -la "${TARGET}"
echo ""
echo "Als Naechstes in PowerShell:"
echo "  pwsh"
echo "  cd ~/TVF-Cockpit/scripts"
echo "  ./Install-PnP.ps1"
echo "  ./Start-TVFDeploy.ps1"
