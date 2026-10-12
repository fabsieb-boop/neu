<#
.SYNOPSIS
  Baut das TVF Controlling Dashboard aus app.zip-Navigation + geretteten Zahlen.

.DESCRIPTION
  Liest dashboard-design.json (Schema v2-app): Startseite, alle App-Unterseiten,
  Excel-Hub, Zahlen-Export (zahlen/TVF_Zahlen_Export.xlsx).

  Site-Default: https://tvfaltwert.sharepoint.com/sites/03-Finance
  Startseite:   TVF-ALTWERT-GMBH-Dashboard

.EXAMPLE
  .\Connect-TVF.ps1
  .\New-TVFDashboardDesign.ps1

.EXAMPLE
  .\New-TVFDashboardDesign.ps1 -Connect -SkipExcelUpload
#>
[CmdletBinding()]
param(
    [string]$SiteUrl = "https://tvfaltwert.sharepoint.com/sites/03-Finance",
    [string]$ClientId = "409b0310-a1b1-4684-9a92-f79ab67b9c05",
    [string]$LibraryName = "Dokumente",
    [string]$FolderName = "TVF-Controlling-Cockpit",
    [string]$DesignJson = (Join-Path (Split-Path -Parent $PSScriptRoot) "dashboard-design.json"),
    [string]$LocalDateien = (Join-Path (Split-Path -Parent $PSScriptRoot) "dateien"),
    [string]$LocalZahlen = (Join-Path (Split-Path -Parent $PSScriptRoot) "zahlen"),
    [string]$HubFile = (Join-Path (Split-Path -Parent $PSScriptRoot) "Cockpit-Hub-SharePoint.xlsx"),
    [switch]$Connect,
    [switch]$DeviceLogin,
    [switch]$SkipExcelUpload,
    [switch]$OnlyStartseite
)

$ErrorActionPreference = "Stop"

function Assert-PnP {
    if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
        throw "PnP.PowerShell fehlt. .\Install-PnP.ps1 ausfuehren."
    }
    Import-Module PnP.PowerShell -ErrorAction Stop
}

function Connect-TVFSite {
    param([string]$Url, [string]$AppId, [switch]$Device, [switch]$Force)
    $need = $Force
    if (-not $need) {
        try { $null = Get-PnPContext -ErrorAction Stop } catch { $need = $true }
    }
    if (-not $need) { return }
    if ($Device) {
        Connect-PnPOnline -Url $Url -DeviceLogin -ClientId $AppId
    }
    else {
        Connect-PnPOnline -Url $Url -Interactive -ClientId $AppId
    }
}

function Get-FileUrl {
    param($SiteHost, $FolderRel, $FileName)
    return ($SiteHost + $FolderRel + "/" + ($FileName -replace ' ', '%20'))
}

function Get-PageUrl {
    param($WebUrl, $PageName)
    return ("{0}/SitePages/{1}.aspx" -f $WebUrl.TrimEnd("/"), $PageName)
}

function Ensure-Page {
    param([string]$Name, [string]$Title)
    $p = Get-PnPPage -Identity $Name -ErrorAction SilentlyContinue
    if ($null -eq $p) {
        Add-PnPPage -Name $Name -Title $Title -LayoutType Article | Out-Null
    }
    else {
        Set-PnPPage -Identity $Name -Title $Title | Out-Null
    }
}

function Get-NavHtml {
    param($WebUrl, $Items, $Active)
    $html = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 20px 0;">'
    foreach ($i in $Items) {
        $href = Get-PageUrl $WebUrl $i.seite
        $bg = if ($i.label -eq $Active) { "#1F4E79" } else { "#E8EEF5" }
        $fg = if ($i.label -eq $Active) { "#FFFFFF" } else { "#1F4E79" }
        $html += ('<a href="{0}" style="text-decoration:none;background:{1};color:{2};padding:8px 14px;font-family:Segoe UI,Arial,sans-serif;font-size:13px;font-weight:600;border:1px solid #1F4E79;">{3}</a>' -f $href, $bg, $fg, $i.label)
    }
    $html += '</div>'
    return $html
}

function Get-HeroHtml {
    param([string]$Title, [string]$Sub, [string]$HomeUrl)
    @"
<div style="background:linear-gradient(120deg,#1F4E79 0%,#5B2C6F 100%);color:#fff;padding:28px 24px;font-family:Segoe UI,Arial,sans-serif;">
  <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">TVF ALTWERT GmbH · Finance Controlling</div>
  <div style="font-size:28px;font-weight:700;margin-top:6px;line-height:1.2;">$Title</div>
  <div style="font-size:14px;margin-top:8px;max-width:720px;opacity:.95;">$Sub</div>
  <div style="margin-top:14px;"><a href="$HomeUrl" style="color:#fff;font-size:13px;">← Zurueck zum Dashboard</a></div>
</div>
"@
}

function Get-TileHtml {
    param($WebUrl, $Tiles)
    $html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin:8px 0 20px 0;font-family:Segoe UI,Arial,sans-serif;">'
    foreach ($t in $Tiles) {
        $href = Get-PageUrl $WebUrl $t.seite
        $html += @"
<a href="$href" style="text-decoration:none;color:#1A1A1A;background:#F3F6F9;border-left:4px solid #1F4E79;padding:16px;">
  <div style="font-size:15px;font-weight:700;color:#1F4E79;">$($t.label)</div>
  <div style="font-size:12px;color:#5F6B7A;margin-top:4px;">$($t.desc)</div>
</a>
"@
    }
    $html += '</div>'
    return $html
}

function Get-NavItemsFromDesign {
    param($Design)
    $items = @([pscustomobject]@{ label = "Dashboard"; seite = [string]$Design.startseite.seitenname })
    # v2: navigation.schnell + gruppen; v1: navigation.haupt
    if ($Design.navigation.schnell) {
        foreach ($n in $Design.navigation.schnell) {
            if ($n.seite -and $n.seite -ne $Design.startseite.seitenname) {
                $items += [pscustomobject]@{ label = [string]$n.label; seite = [string]$n.seite }
            }
        }
    }
    if ($Design.navigation.haupt) {
        foreach ($n in $Design.navigation.haupt) {
            $items += [pscustomobject]@{ label = [string]$n.label; seite = [string]$n.seite }
        }
    }
    # Kern-Nav immer sichtbar
    $core = @(
        @{ label = "Cockpit"; seite = "TVF-Cockpit" },
        @{ label = "Steuerung"; seite = "TVF-Steuerung" },
        @{ label = "GuV"; seite = "TVF-GuV" },
        @{ label = "Forecast"; seite = "TVF-Forecast" },
        @{ label = "Regionen"; seite = "TVF-Regionen" },
        @{ label = "Projekte"; seite = "TVF-Projekte" },
        @{ label = "Zahlen"; seite = "TVF-Zahlen" }
    )
    $seen = @{}
    foreach ($i in $items) { $seen[$i.seite] = $true }
    foreach ($c in $core) {
        if (-not $seen.ContainsKey($c.seite)) {
            $items += [pscustomobject]@{ label = $c.label; seite = $c.seite }
            $seen[$c.seite] = $true
        }
    }
    return $items
}

function Publish-ExcelPage {
    param(
        $Seite,
        $WebUrl,
        $SiteHost,
        $FolderRel,
        $NavItems,
        $HomeUrl
    )
    $name = [string]$Seite.seitenname
    $title = [string]$Seite.titel
    if ([string]::IsNullOrWhiteSpace($name)) { return }
    Write-Host ("  Seite: {0}" -f $name)
    Ensure-Page -Name $name -Title $title

    $excelName = [string]$Seite.excel
    $layout = [string]$Seite.layout
    $sub = if ($Seite.beschreibung) { [string]$Seite.beschreibung } else { "Seite aus dem Controlling-Cockpit (App → SharePoint)." }
    $hero = Get-HeroHtml -Title $title -Sub $sub -HomeUrl $HomeUrl
    $nav = Get-NavHtml -WebUrl $WebUrl -Items $NavItems -Active ($title -replace ' /.*','')

    $hint = ""
    if ($Seite.hubBlatt) {
        $hint = "<p style='font-family:Segoe UI,Arial,sans-serif;font-size:13px;color:#5F6B7A;'>Hub-Datei <strong>$excelName</strong> – Blatt <strong>$($Seite.hubBlatt)</strong> im Excel unten waehlen.</p>"
    }
    elseif ($Seite.region) {
        $hint = "<p style='font-family:Segoe UI,Arial,sans-serif;font-size:13px;color:#5F6B7A;'>Region <strong>$($Seite.region)</strong> – Zeile in Regionen.xlsx bzw. Filter in Steuerung setzen.</p>"
    }
    if ($Seite.appRoute) {
        $hint += "<p style='font-family:Segoe UI,Arial,sans-serif;font-size:12px;color:#5F6B7A;'>App-Route: <code>$($Seite.appRoute)</code></p>"
    }

    $excelUrl = $null
    $fileLink = ""
    if ($excelName -and $layout -ne "html" -and $layout -ne "start") {
        $rel = $FolderRel
        if ($excelName -eq "TVF_Zahlen_Export.xlsx") {
            $rel = $FolderRel + "/zahlen"
        }
        $excelUrl = Get-FileUrl $SiteHost $rel $excelName
        $fileLink = "<p style=`"font-family:Segoe UI,Arial,sans-serif;font-size:13px;`">Datei: <a href=`"$excelUrl`" data-interception=`"off`">$excelName</a></p>"
    }

    $body = @"
$hero
$nav
$hint
$fileLink
"@

    Add-PnPPageSection -Page $name -SectionTemplate OneColumn -Order 1 -ErrorAction SilentlyContinue
    Add-PnPPageTextPart -Page $name -Section 1 -Column 1 -Text $body -ErrorAction SilentlyContinue
    if ($excelUrl) {
        Add-PnPPageSection -Page $name -SectionTemplate OneColumn -Order 2 -ErrorAction SilentlyContinue
        try {
            Add-PnPPageWebPart -Page $name -Section 2 -Column 1 -DefaultWebPartType FileViewer -WebPartProperties @{ file = $excelUrl } | Out-Null
        }
        catch {
            Write-Warning ("FileViewer {0}: {1}" -f $name, $_.Exception.Message)
        }
    }
    Set-PnPPage -Identity $name -Publish | Out-Null
}

Assert-PnP
Connect-TVFSite -Url $SiteUrl -AppId $ClientId -Device:$DeviceLogin -Force:$Connect

if (-not (Test-Path -LiteralPath $DesignJson)) {
    throw "Design fehlt: $DesignJson"
}
$design = Get-Content -LiteralPath $DesignJson -Raw -Encoding UTF8 | ConvertFrom-Json

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

$zahlenRel = $folderRel + "/zahlen"
try { Get-PnPFolder -Url $zahlenRel -ErrorAction Stop | Out-Null }
catch { Add-PnPFolder -Name "zahlen" -Folder $folderRel | Out-Null }

$web = Get-PnPWeb
$webUrl = $web.Url
$siteHost = ([Uri]$SiteUrl).GetLeftPart([UriPartial]::Authority)
$homeName = [string]$design.startseite.seitenname
$homeUrl = Get-PageUrl $webUrl $homeName

if (-not $SkipExcelUpload) {
    if (Test-Path -LiteralPath $HubFile) {
        Write-Host "Lade Hub: $HubFile → Cockpit.xlsx"
        Add-PnPFile -Path $HubFile -Folder $folderRel -NewFileName "Cockpit.xlsx" | Out-Null
    }
    if (Test-Path -LiteralPath $LocalDateien) {
        $files = Get-ChildItem -LiteralPath $LocalDateien -Filter "*.xlsx" -File
        Write-Host ("Lade {0} Excel-Dateien …" -f $files.Count)
        foreach ($f in $files) {
            if ($f.Name -eq "Cockpit.xlsx" -and (Test-Path $HubFile)) { continue }
            Write-Host ("  {0}" -f $f.Name)
            Add-PnPFile -Path $f.FullName -Folder $folderRel | Out-Null
        }
    }
    if (Test-Path -LiteralPath $LocalZahlen) {
        $zfiles = Get-ChildItem -LiteralPath $LocalZahlen -File | Where-Object { $_.Extension -in ".xlsx", ".csv", ".json" }
        Write-Host ("Lade {0} Zahlen-Dateien …" -f $zfiles.Count)
        foreach ($f in $zfiles) {
            Write-Host ("  zahlen/{0}" -f $f.Name)
            Add-PnPFile -Path $f.FullName -Folder $zahlenRel | Out-Null
        }
    }
}

$allPages = @()
foreach ($g in $design.seitenbaum) {
    foreach ($s in $g.seiten) { $allPages += $s }
}
if ($OnlyStartseite) {
    $allPages = @($allPages | Where-Object { $_.seitenname -eq $homeName })
}

$navMain = Get-NavItemsFromDesign -Design $design

# KPI aus Design
$buch = 0; $proj = 0; $ka = 0
if ($design.kpiAusDb) {
    $buch = [int]$design.kpiAusDb.buchungen
    $proj = [int]$design.kpiAusDb.projekte
    $ka = [int]$design.kpiAusDb.kostenarten
}

Write-Host ""
Write-Host "=== Startseite / Dashboard ==="
Ensure-Page -Name $homeName -Title ([string]$design.startseite.titel)

$cockpitUrl = Get-FileUrl $siteHost $folderRel "Cockpit.xlsx"
$zahlenUrl = Get-FileUrl $siteHost ($folderRel + "/zahlen") "TVF_Zahlen_Export.xlsx"

# Kacheln aus Design-Gruppen (erste Ebene)
$tiles = @()
$tiles += @{ label = "Cockpit"; seite = "TVF-Cockpit"; desc = "Lagebild & Kennzahlen (Hub)" }
$tiles += @{ label = "Steuerung"; seite = "TVF-Steuerung"; desc = "Jahr, Monat, Region, Projekt" }
$tiles += @{ label = "GuV / EBITDA"; seite = "TVF-GuV"; desc = "GuV-Staffel wie App /guv" }
$tiles += @{ label = "Forecast"; seite = "TVF-Forecast"; desc = "Ist + Forecast" }
$tiles += @{ label = "Forecast eingeben"; seite = "TVF-FC-Eingabe"; desc = "Deltas erfassen" }
$tiles += @{ label = "Regionen"; seite = "TVF-Regionen"; desc = "West, Süd-West, Ost, Berlin, Verwaltung" }
$tiles += @{ label = "Projekte"; seite = "TVF-Projekte"; desc = "Projektergebnisse" }
$tiles += @{ label = "Liquidität"; seite = "TVF-Liquiditaet"; desc = "Liquiditätsplanung" }
$tiles += @{ label = "Bestand"; seite = "TVF-Bestand"; desc = "Bestandsprüfung" }
$tiles += @{ label = "Kostenverfolgung"; seite = "TVF-Kostenverfolgung"; desc = "KV gegen SAP" }
$tiles += @{ label = "Berichte"; seite = "TVF-Berichte"; desc = "Berichtsgenerator" }
$tiles += @{ label = "Zahlen-Export"; seite = "TVF-Zahlen"; desc = "Gerettete DB-Zahlen" }

$tileHtml = Get-TileHtml -WebUrl $webUrl -Tiles $tiles
$navHtml = Get-NavHtml -WebUrl $webUrl -Items $navMain -Active "Dashboard"

# Gruppen-Kacheln (alle App-Seiten)
$gruppenHtml = ""
if ($design.navigation.gruppen) {
    foreach ($g in $design.navigation.gruppen) {
        $gt = @()
        foreach ($it in $g.items) {
            $gt += @{ label = [string]$it.label; seite = [string]$it.seite; desc = [string]($it.excel) }
        }
        $gruppenHtml += ("<h3 style=`"font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#5F6B7A;text-transform:uppercase;letter-spacing:.08em;margin:18px 0 8px 0;`">{0}</h3>" -f [string]$g.gruppe)
        $gruppenHtml += (Get-TileHtml -WebUrl $webUrl -Tiles $gt)
    }
}

$startBody = @"
<div style="background:linear-gradient(120deg,#1F4E79 0%,#5B2C6F 100%);color:#fff;padding:32px 24px;font-family:Segoe UI,Arial,sans-serif;">
  <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">TVF ALTWERT GmbH · 03-Finance</div>
  <div style="font-size:32px;font-weight:700;margin-top:8px;">TVF ALTWERT</div>
  <div style="font-size:20px;font-weight:600;margin-top:4px;opacity:.95;">Controlling Cockpit 2026</div>
  <div style="font-size:15px;margin-top:10px;max-width:760px;opacity:.95;">
    Navigation und Seiten aus der Web-App (app.zip). Zahlen aus der Datenbank (db.zip) gerettet:
    <strong>$buch</strong> Buchungen · <strong>$proj</strong> Projekte · <strong>$ka</strong> Kostenarten.
  </div>
</div>
$navHtml
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:12px 0 20px 0;font-family:Segoe UI,Arial,sans-serif;">
  <div style="background:#fff;border-left:4px solid #1F4E79;padding:12px 14px;"><div style="font-size:11px;color:#5F6B7A;">BUCHUNGEN</div><div style="font-size:20px;font-weight:700;color:#1F4E79;">$buch</div></div>
  <div style="background:#fff;border-left:4px solid #1F4E79;padding:12px 14px;"><div style="font-size:11px;color:#5F6B7A;">PROJEKTE</div><div style="font-size:20px;font-weight:700;color:#1F4E79;">$proj</div></div>
  <div style="background:#fff;border-left:4px solid #1F4E79;padding:12px 14px;"><div style="font-size:11px;color:#5F6B7A;">KOSTENARTEN</div><div style="font-size:20px;font-weight:700;color:#1F4E79;">$ka</div></div>
  <div style="background:#fff;border-left:4px solid #5B2C6F;padding:12px 14px;"><div style="font-size:11px;color:#5F6B7A;">GESCHÄFTSJAHR</div><div style="font-size:20px;font-weight:700;color:#5B2C6F;">2026</div></div>
</div>
<h2 style="font-family:Segoe UI,Arial,sans-serif;font-size:18px;color:#1F4E79;margin:8px 0;">Direktzugriff</h2>
$tileHtml
<div style="font-family:Segoe UI,Arial,sans-serif;font-size:13px;color:#5F6B7A;margin-bottom:12px;">
  <strong>Regionen:</strong>
  <a href="$(Get-PageUrl $webUrl 'TVF-Region-West')">West</a> ·
  <a href="$(Get-PageUrl $webUrl 'TVF-Region-Sued-West')">Süd-West</a> ·
  <a href="$(Get-PageUrl $webUrl 'TVF-Region-Ost')">Ost</a> ·
  <a href="$(Get-PageUrl $webUrl 'TVF-Region-Berlin')">Berlin</a> ·
  <a href="$(Get-PageUrl $webUrl 'TVF-Region-Verwaltung')">Verwaltung</a>
</div>
$gruppenHtml
<p style="font-family:Segoe UI,Arial,sans-serif;font-size:13px;">Excel-Hub: <a href="$cockpitUrl" data-interception="off">Cockpit.xlsx</a> · Gerettete Zahlen: <a href="$zahlenUrl" data-interception="off">TVF_Zahlen_Export.xlsx</a></p>
"@

Add-PnPPageSection -Page $homeName -SectionTemplate OneColumn -Order 1 -ErrorAction SilentlyContinue
Add-PnPPageTextPart -Page $homeName -Section 1 -Column 1 -Text $startBody -ErrorAction SilentlyContinue
Add-PnPPageSection -Page $homeName -SectionTemplate OneColumn -Order 2 -ErrorAction SilentlyContinue
try {
    Add-PnPPageWebPart -Page $homeName -Section 2 -Column 1 -DefaultWebPartType FileViewer -WebPartProperties @{ file = $cockpitUrl } | Out-Null
}
catch { Write-Warning "FileViewer Start: $($_.Exception.Message)" }
Set-PnPPage -Identity $homeName -Publish | Out-Null
Write-Host "  Start: $homeUrl"

Write-Host ""
Write-Host "=== Unterseiten ==="
foreach ($seite in $allPages) {
    if ($seite.seitenname -eq $homeName) { continue }
    Publish-ExcelPage -Seite $seite -WebUrl $webUrl -SiteHost $siteHost -FolderRel $folderRel -NavItems $navMain -HomeUrl $homeUrl
}

Write-Host ""
Write-Host "Fertig."
Write-Host "Dashboard: $homeUrl"
Write-Host "Ordner:    $siteHost$folderRel"
Write-Host "Zahlen:    $siteHost$zahlenRel"
Write-Host ("Seiten:    {0}" -f ($allPages.Count))
