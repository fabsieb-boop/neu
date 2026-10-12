<#
.SYNOPSIS
  Baut alle design-html Dateien neu (SharePoint-Struktur TVF-Controlling-Cockpit).

.EXAMPLE
  pwsh
  cd ~/TVF-Cockpit/scripts
  .\Rebuild-TVFHtml.ps1
#>
[CmdletBinding()]
param(
    [string]$Python = "python3"
)

$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$builder = Join-Path $here "build_sharepoint_html.py"

if (-not (Test-Path -LiteralPath $builder)) {
    throw "Fehlt: $builder"
}

Write-Host "Baue HTML neu …"
Write-Host "  $builder"
& $Python $builder
if ($LASTEXITCODE -ne 0) { throw "build_sharepoint_html.py fehlgeschlagen" }

$out = Join-Path (Split-Path -Parent $here) "design-html"
Write-Host "Fertig: $out"
Write-Host "Start Embed:  design-html/STARTSEITE-SHAREPOINT.html"
Write-Host "Unterseiten:  design-html/seiten/*-SHAREPOINT.html"
Write-Host "Danach Ordner design-html nach SharePoint hochladen (Dokumente/TVF-Controlling-Cockpit/design-html)."
