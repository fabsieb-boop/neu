<#
.SYNOPSIS
  Ein Befehl: Anmelden + Excel hochladen + alle SharePoint-Seiten anlegen.

.EXAMPLE
  cd ~/TVF-Cockpit/scripts
  .\Start-TVFDeploy.ps1

.EXAMPLE
  .\Start-TVFDeploy.ps1 -DeviceLogin
  .\Start-TVFDeploy.ps1 -SkipUpload
#>
[CmdletBinding()]
param(
    [string]$SiteUrl = "https://tvfaltwert.sharepoint.com/sites/03-Finance",
    [string]$ClientId = "409b0310-a1b1-4684-9a92-f79ab67b9c05",
    [switch]$DeviceLogin,
    [switch]$SkipUpload,
    [switch]$SetAsHomePage
)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

Write-Host "=== TVF Controlling Cockpit Deploy ==="
Write-Host "Site:     $SiteUrl"
Write-Host "ClientId: $ClientId"
Write-Host ""

& (Join-Path $PSScriptRoot "Connect-TVF.ps1") -SiteUrl $SiteUrl -ClientId $ClientId -DeviceLogin:$DeviceLogin

$argsDeploy = @{
    SiteUrl       = $SiteUrl
    ClientId      = $ClientId
    SkipUpload    = $SkipUpload
    SetAsHomePage = $SetAsHomePage
}
& (Join-Path $PSScriptRoot "New-TVFCockpitStartseite.ps1") @argsDeploy

Write-Host ""
Write-Host "Dashboard:"
Write-Host "https://tvfaltwert.sharepoint.com/sites/03-Finance/SitePages/TVF-ALTWERT-GMBH-Dashboard.aspx"
