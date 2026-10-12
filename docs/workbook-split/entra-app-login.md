# PnP-Login mit Entra Client-ID (Mac)

Eure App-ID (Client): `409b0310-a1b1-4684-9a92-f79ab67b9c05`

## Verbinden (kopieren)

```powershell
$clientId = "409b0310-a1b1-4684-9a92-f79ab67b9c05"
Connect-PnPOnline -Url "https://tvfaltwert.sharepoint.com/sites/03-Finance" -Interactive -ClientId $clientId
cd ~/TVF-Cockpit/scripts
.\New-TVFCockpitStartseite.ps1
```

Falls Browser hakt:

```powershell
Connect-PnPOnline -Url "https://tvfaltwert.sharepoint.com/sites/03-Finance" -DeviceLogin -ClientId "409b0310-a1b1-4684-9a92-f79ab67b9c05"
```

## App-Einstellungen (falls Login scheitert)

Portal → Entra ID → App-Registrierungen → diese App:

- Redirect URI (öffentlicher Client): `http://localhost`
- Öffentliche Clientflows: **Ja**
- SharePoint delegiert: `AllSites.FullControl` + Admin-Einwilligung
