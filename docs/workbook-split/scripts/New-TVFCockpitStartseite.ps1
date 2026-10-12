<#
.SYNOPSIS
  Lädt alle Cockpit-Exceldateien nach SharePoint und legt Startseite + Fachseiten an.

.DESCRIPTION
  Site: https://tvfaltwert.sharepoint.com/sites/03-Finance
  Startseite: TVF-ALTWERT-GMBH-Dashboard
  Ordner: Dokumente/TVF-Controlling-Cockpit

.EXAMPLE
  .\Connect-TVF.ps1
  .\New-TVFCockpitStartseite.ps1

.EXAMPLE
  .\New-TVFCockpitStartseite.ps1 -Connect
#>
[CmdletBinding()]
param(
    [string]$SiteUrl = "https://tvfaltwert.sharepoint.com/sites/03-Finance",
    [string]$ClientId = "409b0310-a1b1-4684-9a92-f79ab67b9c05",
    [string]$LibraryName = "Dokumente",
    [string]$FolderName = "TVF-Controlling-Cockpit",
    [string]$LocalDateien = (Join-Path (Split-Path -Parent $PSScriptRoot) "dateien"),
    [string]$SeitenKatalog = (Join-Path (Split-Path -Parent $PSScriptRoot) "seiten.json"),
    [string]$StartPageName = "TVF-ALTWERT-GMBH-Dashboard",
    [switch]$Connect,
    [switch]$DeviceLogin,
    [switch]$NurStartseite,
    [switch]$SetAsHomePage,
    [switch]$SkipUpload
)

$ErrorActionPreference = "Stop"

function Assert-PnP {
    if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
        throw "PnP.PowerShell fehlt. Install-Module PnP.PowerShell -Scope CurrentUser -Force"
    }
    Import-Module PnP.PowerShell -ErrorAction Stop
}

function Ensure-Connected {
    param(
        [string]$Url,
        [string]$AppId,
        [switch]$UseDevice,
        [switch]$ForceConnect
    )
    $need = $ForceConnect
    if (-not $need) {
        try {
            $null = Get-PnPContext -ErrorAction Stop
        }
        catch {
            $need = $true
        }
    }
    if (-not $need) { return }

    Write-Host "Verbinde mit $Url …"
    if ($UseDevice) {
        Connect-PnPOnline -Url $Url -DeviceLogin -ClientId $AppId
    }
    else {
        Connect-PnPOnline -Url $Url -Interactive -ClientId $AppId
    }
}

function Get-AbsoluteFileUrl {
    param(
        [string]$SiteHost,
        [string]$FolderServerRel,
        [string]$FileName
    )
    $safe = ($FileName -replace ' ', '%20')
    return "$SiteHost$FolderServerRel/$safe"
}

function Ensure-ModernPage {
    param(
        [string]$PageName,
        [string]$Title
    )
    $page = Get-PnPPage -Identity $PageName -ErrorAction SilentlyContinue
    if ($null -eq $page) {
        Add-PnPPage -Name $PageName -Title $Title -LayoutType Article | Out-Null
    }
    else {
        Set-PnPPage -Identity $PageName -Title $Title | Out-Null
    }
}

function New-Fachseite {
    param(
        [object]$Seite,
        [string]$SiteHost,
        [string]$FolderServerRel,
        [string]$StartPageUrl,
        [bool]$IsHome
    )

    $excelUrl = Get-AbsoluteFileUrl -SiteHost $SiteHost -FolderServerRel $FolderServerRel -FileName $Seite.excel
    $pageName = [string]$Seite.seitenname
    $title = [string]$Seite.titel

    Write-Host ("  Seite: {0} <- {1}" -f $pageName, $Seite.excel)
    Ensure-ModernPage -PageName $pageName -Title $title

    Add-PnPPageSection -Page $pageName -SectionTemplate OneColumn -Order 1 -ErrorAction SilentlyContinue

    $navHome = if ($IsHome) { "" } else {
        "<p><a href=`"$StartPageUrl`">Zurueck zur Startseite</a> · Gruppe: <strong>$($Seite.gruppe)</strong> · Original: $($Seite.originalseite)</p>"
    }

    $hinweis = ""
    if ($Seite.hinweis) {
        $hinweis = "<p>$($Seite.hinweis)</p>"
    }

    $intro = @"
<p><strong>$title</strong></p>
$navHome
$hinweis
<p>Excel-Datei: <a href="$excelUrl" data-interception="off">$($Seite.excel)</a> (Blatt <em>$($Seite.blatt)</em>). Die Datei ist mit den übrigen Arbeitsmappen im Ordner verknüpft.</p>
"@
    Add-PnPPageTextPart -Page $pageName -Section 1 -Column 1 -Text $intro -ErrorAction SilentlyContinue

    Add-PnPPageSection -Page $pageName -SectionTemplate OneColumn -Order 2 -ErrorAction SilentlyContinue
    try {
        Add-PnPPageWebPart -Page $pageName -Section 2 -Column 1 -DefaultWebPartType FileViewer -WebPartProperties @{
            file = $excelUrl
        } | Out-Null
    }
    catch {
        Write-Warning ("FileViewer fuer {0} nicht gesetzt: {1}. Dateilink steht im Textteil." -f $pageName, $_.Exception.Message)
    }

    Set-PnPPage -Identity $pageName -Publish | Out-Null
    return ("{0}/SitePages/{1}.aspx" -f (Get-PnPWeb).Url.TrimEnd("/"), $pageName)
}

Assert-PnP
Ensure-Connected -Url $SiteUrl -AppId $ClientId -UseDevice:$DeviceLogin -ForceConnect:$Connect

if (-not (Test-Path -LiteralPath $SeitenKatalog)) {
    throw "Seitenkatalog fehlt: $SeitenKatalog"
}
$katalog = Get-Content -LiteralPath $SeitenKatalog -Raw -Encoding UTF8 | ConvertFrom-Json

if ($katalog.site_url -and -not $PSBoundParameters.ContainsKey('SiteUrl')) {
    $SiteUrl = [string]$katalog.site_url
}
if ($katalog.entra_client_id -and -not $PSBoundParameters.ContainsKey('ClientId')) {
    $ClientId = [string]$katalog.entra_client_id
}

if ($StartPageName) {
    $katalog.startseite.seitenname = $StartPageName
    foreach ($s in @($katalog.seiten)) {
        if ($s.startseite -eq $true -or $s.blatt -eq 'Cockpit') {
            $s.seitenname = $StartPageName
        }
    }
}
$seiten = @($katalog.seiten)
if ($NurStartseite) {
    $seiten = @($seiten | Where-Object { $_.startseite -eq $true -or $_.seitenname -eq $katalog.startseite.seitenname })
}

# Mac-taugliche Pfade (Join-Path mit 3 Args braucht PS7; Fallback)
if (-not (Test-Path -LiteralPath $LocalDateien)) {
    $alt = Join-Path (Split-Path $PSScriptRoot -Parent) "dateien"
    if (Test-Path -LiteralPath $alt) { $LocalDateien = $alt }
}
if (-not (Test-Path -LiteralPath $SeitenKatalog)) {
    $alt = Join-Path (Split-Path $PSScriptRoot -Parent) "seiten.json"
    if (Test-Path -LiteralPath $alt) { $SeitenKatalog = $alt }
}

if (-not $SkipUpload) {
    if (-not (Test-Path -LiteralPath $LocalDateien)) {
        throw "Ordner nicht gefunden: $LocalDateien"
    }
    $files = Get-ChildItem -LiteralPath $LocalDateien -Filter "*.xlsx" -File
    if ($files.Count -lt 1) {
        throw "Keine .xlsx in $LocalDateien"
    }

    Write-Host "Stelle Ordner $LibraryName/$FolderName bereit …"
    try {
        $list = Get-PnPList -Identity $LibraryName -ErrorAction Stop
    }
    catch {
        Write-Host "Bibliothek '$LibraryName' nicht gefunden, versuche 'Documents' …"
        $LibraryName = "Documents"
        $list = Get-PnPList -Identity $LibraryName
    }
    $folderServerRel = $list.RootFolder.ServerRelativeUrl.TrimEnd("/") + "/" + $FolderName
    try {
        Get-PnPFolder -Url $folderServerRel -ErrorAction Stop | Out-Null
    }
    catch {
        Add-PnPFolder -Name $FolderName -Folder $LibraryName | Out-Null
    }

    Write-Host ("Lade {0} Dateien hoch …" -f $files.Count)
    foreach ($f in $files) {
        Write-Host ("  {0}" -f $f.Name)
        Add-PnPFile -Path $f.FullName -Folder $folderServerRel -ErrorAction Stop | Out-Null
    }
}
else {
    try {
        $list = Get-PnPList -Identity $LibraryName -ErrorAction Stop
    }
    catch {
        $LibraryName = "Documents"
        $list = Get-PnPList -Identity $LibraryName
    }
    $folderServerRel = $list.RootFolder.ServerRelativeUrl.TrimEnd("/") + "/" + $FolderName
}

$web = Get-PnPWeb
$siteHost = ([Uri]$SiteUrl).GetLeftPart([UriPartial]::Authority)
$startName = [string]$katalog.startseite.seitenname
$startUrl = "{0}/SitePages/{1}.aspx" -f $web.Url.TrimEnd("/"), $startName

Write-Host ""
Write-Host ("Erzeuge {0} SharePoint-Seiten …" -f $seiten.Count)

Ensure-ModernPage -PageName $startName -Title ([string]$katalog.startseite.titel)
Add-PnPPageSection -Page $startName -SectionTemplate OneColumn -Order 1 -ErrorAction SilentlyContinue

$gruppen = $seiten | Group-Object gruppe
$navHtml = "<p><strong>TVF ALTWERT – Controlling Cockpit</strong></p>"
$navHtml += "<p>Startseite. Eingabe (Forecast), Auswertung und Projekte – Excel-Dateien im Ordner <strong>$FolderName</strong>.</p>"
$navHtml += "<p><strong>Navigation</strong></p>"
$order = @("Start", "Eingabe", "Auswertung", "Projekte", "Abschluss", "System")
if ($katalog.gruppen_reihenfolge) { $order = @($katalog.gruppen_reihenfolge) }
foreach ($g in ($gruppen | Sort-Object @{ Expression = { [array]::IndexOf($order, $_.Name) } })) {
    $navHtml += "<p><strong>$($g.Name)</strong></p><ul>"
    foreach ($s in ($g.Group | Sort-Object reihenfolge)) {
        $href = "{0}/SitePages/{1}.aspx" -f $web.Url.TrimEnd("/"), $s.seitenname
        $navHtml += "<li><a href=`"$href`">$($s.titel)</a> <span style=`"color:#666`">($($s.excel))</span></li>"
    }
    $navHtml += "</ul>"
}
Add-PnPPageTextPart -Page $startName -Section 1 -Column 1 -Text $navHtml -ErrorAction SilentlyContinue

$cockpitUrl = Get-AbsoluteFileUrl -SiteHost $siteHost -FolderServerRel $folderServerRel -FileName "Cockpit.xlsx"
Add-PnPPageSection -Page $startName -SectionTemplate OneColumn -Order 2 -ErrorAction SilentlyContinue
try {
    Add-PnPPageWebPart -Page $startName -Section 2 -Column 1 -DefaultWebPartType FileViewer -WebPartProperties @{
        file = $cockpitUrl
    } | Out-Null
}
catch {
    Write-Warning "FileViewer Cockpit: $($_.Exception.Message)"
}
Set-PnPPage -Identity $startName -Publish | Out-Null
Write-Host "  Startseite: $startUrl"

$pageUrls = @(@{ name = $startName; url = $startUrl; excel = "Cockpit.xlsx" })
foreach ($seite in ($seiten | Sort-Object reihenfolge)) {
    if ($seite.seitenname -eq $startName) { continue }
    $url = New-Fachseite -Seite $seite -SiteHost $siteHost -FolderServerRel $folderServerRel -StartPageUrl $startUrl -IsHome:$false
    $pageUrls += @{ name = $seite.seitenname; url = $url; excel = $seite.excel }
}

if ($SetAsHomePage) {
    Write-Host "Setze Startseite als Website-Homepage …"
    Set-PnPHomePage -RootFolderRelativeUrl ("SitePages/{0}.aspx" -f $startName)
}

Write-Host ""
Write-Host "Fertig."
Write-Host "Ordner:  $siteHost$folderServerRel"
Write-Host "Start:   $startUrl"
Write-Host ("Seiten:  {0}" -f $pageUrls.Count)
Write-Host ""
Write-Host "Hinweis: Excel-Links nach dem ersten Oeffnen in Excel fuer Mac aktualisieren."
