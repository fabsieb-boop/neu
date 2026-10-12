<#
.SYNOPSIS
  Meldet dich an der TVF Finance-Site an (PnP + Entra Client-ID).

.EXAMPLE
  .\Connect-TVF.ps1
  .\Connect-TVF.ps1 -DeviceLogin
#>
[CmdletBinding()]
param(
    [string]$SiteUrl = "https://tvfaltwert.sharepoint.com/sites/03-Finance",
    [string]$ClientId = "409b0310-a1b1-4684-9a92-f79ab67b9c05",
    [switch]$DeviceLogin
)

$ErrorActionPreference = "Stop"

if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
    Write-Host "Installiere PnP.PowerShell …"
    Install-Module PnP.PowerShell -Scope CurrentUser -Force
}
Import-Module PnP.PowerShell -ErrorAction Stop

Write-Host "Site:     $SiteUrl"
Write-Host "ClientId: $ClientId"

if ($DeviceLogin) {
    Connect-PnPOnline -Url $SiteUrl -DeviceLogin -ClientId $ClientId
}
else {
    Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $ClientId
}

$web = Get-PnPWeb
Write-Host ("Verbunden: {0}" -f $web.Url)
Write-Host "Als Nächstes: .\New-TVFCockpitStartseite.ps1"
