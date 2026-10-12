<#
.SYNOPSIS
  Setzt die Dashboard-Startseite mit INLINE-HTML (sichtbares Layout, kein Quellcode).

.DESCRIPTION
  Liest design-html/STARTSEITE-INLINE.html (nur Inline-Styles, SharePoint-Text-Webpart-tauglich),
  schreibt sie auf TVF-ALTWERT-GMBH-Dashboard und hängt den FileViewer für Cockpit.xlsx an.

.EXAMPLE
  .\Connect-TVF.ps1
  .\New-TVFStartseite.ps1

.EXAMPLE
  .\New-TVFStartseite.ps1 -Connect -DeviceLogin -RebuildHtml
#>
[CmdletBinding()]
param(
    [string]$SiteUrl = "https://tvfaltwert.sharepoint.com/sites/03-Finance",
    [string]$ClientId = "409b0310-a1b1-4684-9a92-f79ab67b9c05",
    [string]$PageName = "TVF-ALTWERT-GMBH-Dashboard",
    [string]$LibraryName = "Dokumente",
    [string]$FolderName = "TVF-Controlling-Cockpit",
    [string]$InlineHtml = (Join-Path (Split-Path -Parent $PSScriptRoot) "design-html/STARTSEITE-INLINE.html"),
    [string]$HubFile = (Join-Path (Split-Path -Parent $PSScriptRoot) "Cockpit-Hub-SharePoint.xlsx"),
    [switch]$Connect,
    [switch]$DeviceLogin,
    [switch]$RebuildHtml,
    [switch]$SkipHubUpload
)

$ErrorActionPreference = "Stop"

function Assert-PnP {
    if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
        throw "PnP.PowerShell fehlt. .\Install-PnP.ps1 ausfuehren."
    }
    Import-Module PnP.PowerShell -ErrorAction Stop
}

if ($RebuildHtml) {
    $builder = Join-Path $PSScriptRoot "build_startseite_inline.py"
    Write-Host "Baue STARTSEITE-INLINE.html neu …"
    & python3 $builder
    if ($LASTEXITCODE -ne 0) { throw "build_startseite_inline.py fehlgeschlagen" }
}

if (-not (Test-Path -LiteralPath $InlineHtml)) {
    Write-Host "INLINE-HTML fehlt – baue neu …"
    & python3 (Join-Path $PSScriptRoot "build_startseite_inline.py")
}
if (-not (Test-Path -LiteralPath $InlineHtml)) {
    throw "Fehlt: $InlineHtml"
}

$html = Get-Content -LiteralPath $InlineHtml -Raw -Encoding UTF8
if ($html -match '<!DOCTYPE|<html|<style') {
    throw "Falsche Datei: STARTSEITE-INLINE.html darf kein DOCTYPE/html/style enthalten."
}
if ($html -notmatch '^\s*<div') {
    throw "STARTSEITE-INLINE.html muss mit <div style=… beginnen."
}

Assert-PnP

$need = $Connect
if (-not $need) {
    try { $null = Get-PnPContext -ErrorAction Stop } catch { $need = $true }
}
if ($need) {
    if ($DeviceLogin) {
        Connect-PnPOnline -Url $SiteUrl -DeviceLogin -ClientId $ClientId
    }
    else {
        Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $ClientId
    }
}

try {
    $list = Get-PnPList -Identity $LibraryName -ErrorAction Stop
}
catch {
    $LibraryName = "Documents"
    $list = Get-PnPList -Identity $LibraryName
}
$folderRel = $list.RootFolder.ServerRelativeUrl.TrimEnd("/") + "/" + $FolderName
try { Get-PnPFolder -Url $folderRel -ErrorAction Stop | Out-Null }
catch { Add-PnPFolder -Name $FolderName -Folder $LibraryName | Out-Null }

$siteHost = ([Uri]$SiteUrl).GetLeftPart([UriPartial]::Authority)
$cockpitUrl = $siteHost + $folderRel + "/Cockpit.xlsx"

if (-not $SkipHubUpload -and (Test-Path -LiteralPath $HubFile)) {
    Write-Host "Lade Hub → Cockpit.xlsx"
    Add-PnPFile -Path $HubFile -Folder $folderRel -NewFileName "Cockpit.xlsx" | Out-Null
}

# INLINE-HTML auch in design-html ablegen (für Hand-Upload)
$designRel = $folderRel + "/design-html"
try { Get-PnPFolder -Url $designRel -ErrorAction Stop | Out-Null }
catch { Add-PnPFolder -Name "design-html" -Folder $folderRel | Out-Null }
Add-PnPFile -Path $InlineHtml -Folder $designRel | Out-Null
Write-Host "Hochgeladen: design-html/STARTSEITE-INLINE.html"

# Seite anlegen / Titel setzen
$p = Get-PnPPage -Identity $PageName -ErrorAction SilentlyContinue
if ($null -eq $p) {
    Add-PnPPage -Name $PageName -Title "TVF ALTWERT – Controlling Cockpit" -LayoutType Article | Out-Null
}
else {
    Set-PnPPage -Identity $PageName -Title "TVF ALTWERT – Controlling Cockpit" | Out-Null
}

Write-Host "Schreibe Text-Webpart (Inline-HTML, gerendert) …"
# Moderne Seiten: TextPart rendert erlaubtes HTML – Inline-Styles bleiben sichtbar
Add-PnPPageSection -Page $PageName -SectionTemplate OneColumn -Order 1 -ErrorAction SilentlyContinue
Add-PnPPageTextPart -Page $PageName -Section 1 -Column 1 -Text $html | Out-Null

Write-Host "Datei-Viewer → Cockpit.xlsx …"
Add-PnPPageSection -Page $PageName -SectionTemplate OneColumn -Order 2 -ErrorAction SilentlyContinue
try {
    Add-PnPPageWebPart -Page $PageName -Section 2 -Column 1 -DefaultWebPartType FileViewer -WebPartProperties @{ file = $cockpitUrl } | Out-Null
}
catch {
    Write-Warning ("FileViewer: {0}" -f $_.Exception.Message)
}

Set-PnPPage -Identity $PageName -Publish | Out-Null

$url = "{0}/SitePages/{1}.aspx" -f $SiteUrl.TrimEnd("/"), $PageName
Write-Host ""
Write-Host "Fertig – Startseite veroeffentlicht:"
Write-Host "  $url"
Write-Host "Du musst Kacheln und blauen Kopf sehen, keinen CSS-Quellcode."
Write-Host "Falls noch Code sichtbar: alten Code-Webpart manuell loeschen, Seite neu laden."
