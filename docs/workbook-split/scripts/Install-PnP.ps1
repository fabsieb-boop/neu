<#
.SYNOPSIS
  Installiert PnP.PowerShell fuer den aktuellen Benutzer (Mac/Windows).

.EXAMPLE
  pwsh
  cd ~/TVF-Cockpit/scripts
  .\Install-PnP.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

Write-Host "PowerShell: $($PSVersionTable.PSVersion)"
Write-Host "Installiere PnP.PowerShell (CurrentUser) …"

Install-Module PnP.PowerShell -Scope CurrentUser -Force -AllowClobber
Import-Module PnP.PowerShell -Force

Get-Module PnP.PowerShell -ListAvailable | Select-Object Name, Version | Format-Table -AutoSize
Write-Host "Fertig. Weiter mit: .\Connect-TVF.ps1"
