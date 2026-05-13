---
title: "Triggering the Secure Boot Certificate Update with Intune Remediations"
date: "2026-05-13T10:00:00+01:00"
author: "Sascha Stumpler"
layout: post
categories:
  - Intune
tags:
  - Intune
  - Remediation
  - PowerShell
  - "Secure Boot"
image: /assets/images/2026/05/RemediationHeader.png
---

Microsoft's Secure Boot certificate rollout for 2026 requires devices to apply a new boot manager signed by the Windows UEFI CA 2023 (PCA2023). For most managed devices, Windows Update handles this automatically - but in IT-managed environments where that specific update is deferred or blocked, devices may sit unpatched indefinitely. This is a quick walk-through of the Intune Remediation I use to detect those devices and push the update manually.

If you haven't read the previous article on [graceful reboots with Intune](https://sastu-insights.com/posts/Trigger-User-Friendly-Device-Reboots-on-Demand-with-Intune/), this remediation builds directly on top of that setup. The remediation script reuses the same graceful reboot mechanism to prompt users before restarting - rather than forcing a hard reboot the moment the registry key is written.

## Background: What the Registry Key Actually Does

Microsoft published a registry key that tells Windows to apply all Secure Boot certificate updates and switch the boot manager to a PCA2023-signed version:

```
HKLM:\SYSTEM\CurrentControlSet\Control\SecureBoot
  AvailableUpdates = 0x5944 (DWORD)
```

Setting this value to `0x5944` instructs Windows to deploy all needed certificates and update to the PCA2023-signed boot manager on the next applicable opportunity. The progress and result are written back to a separate key:

```
HKLM:\SYSTEM\CurrentControlSet\Control\SecureBoot\Servicing
  UEFICA2023Status  (String)  : "Updated", "InProgress", or absent
  UEFICA2023Error   (DWORD)   : non-zero if something went wrong
```

References:

- [Registry key updates for Secure Boot - Windows devices with IT-managed updates](https://support.microsoft.com/topic/registry-key-updates-for-secure-boot-windows-devices-with-it-managed-updates-a7be69c9-4634-42e1-9ca1-df06f43f360d)
- [Secure Boot playbook for certificates expiring in 2026](https://techcommunity.microsoft.com/blog/windows-itpro-blog/secure-boot-playbook-for-certificates-expiring-in-2026/4469235)

---

## Detection Script

The detection script reads `UEFICA2023Status` from the Servicing key and exits `0` (compliant) if the update has been applied or is currently in progress. Any other state - including the key being absent entirely - exits `1` and marks the device for remediation.

```powershell

$servicingPath = "HKLM:\SYSTEM\CurrentControlSet\Control\SecureBoot\Servicing"
$statusName = "UEFICA2023Status"
$errorName = "UEFICA2023Error"

try {
    $status = Get-ItemProperty -Path $servicingPath -Name $statusName -ErrorAction Stop |
    Select-Object -ExpandProperty $statusName

    $errorVal = 0
    try {
        $errorVal = Get-ItemProperty -Path $servicingPath -Name $errorName -ErrorAction Stop |
        Select-Object -ExpandProperty $errorName
    }
    catch {
        # Key absent means no error
    }

    if ($status -eq "Updated" -and $errorVal -eq 0) {
        Write-Output "Compliant: Secure Boot certificate update already applied ($statusName = $status)"
        exit 0
    }

    if ($status -eq "InProgress") {
        Write-Output "Compliant: Secure Boot certificate update is currently in progress ($statusName = $status)"
        exit 0
    }

    Write-Warning "Not Compliant: $statusName = '$status', $errorName = $errorVal"
    exit 1
}
catch {
    Write-Warning "Not Compliant: $servicingPath\$statusName not found - update not started"
    exit 1
}
```

Detection logic at a glance:

| `UEFICA2023Status` | `UEFICA2023Error` | Result                 |
| ------------------ | ----------------- | ---------------------- |
| `Updated`          | `0`               | Compliant - exit 0     |
| `InProgress`       | any               | Compliant - exit 0     |
| anything else      | any               | Not Compliant - exit 1 |
| key absent         | -                 | Not Compliant - exit 1 |

The `InProgress` state is treated as compliant intentionally. Windows may take time to apply all the certificates and update the boot manager - marking a device in-progress as non-compliant would cause the remediation to run again and set the registry key a second time, which is harmless but noisy.

---

## Remediation Script

The remediation script does three things:

1. Sets `AvailableUpdates = 0x5944` in `HKLM:\SYSTEM\CurrentControlSet\Control\SecureBoot` to kick off the certificate update.
2. Starts the `\Microsoft\Windows\PI\Secure-Boot-Update` scheduled task to trigger the update immediately rather than waiting for the next Windows maintenance window.
3. If the [Graceful Reboot Win32 app](https://sastu-insights.com/posts/Trigger-User-Friendly-Device-Reboots-on-Demand-with-Intune/) is installed on the device, it triggers a user-friendly reboot notification rather than forcing an immediate hard restart.

The `Restart-IntuneWin32AppDetection` helper from the [graceful reboot article](https://sastu-insights.com/posts/Trigger-User-Friendly-Device-Reboots-on-Demand-with-Intune/) is included inline so the remediation is self-contained and can be uploaded directly to Intune without any external dependency.

{% raw %}

```powershell
function Restart-IntuneWin32AppDetection {
    [CmdletBinding()]
    param(
        [string]$Path = "HKLM:\SOFTWARE\Microsoft\IntuneManagementExtension\Win32Apps",
        [string]$UserObjectID,
        [string]$AppID,
        [switch]$SkipServiceRestart
    )
    begin {
        Write-Verbose -Message "Start function: $($MyInvocation.MyCommand.Name)"
        Write-Verbose -Message "Line: $($MyInvocation.Line)"
    }
    process {
        if ($UserObjectID) {
            Write-Verbose ("Processing userObjectID: $($UserObjectID)")
            (Get-ChildItem -Path "$Path\$UserObjectID") -match [regex]::Escape($AppID) | Remove-Item -Recurse -Force
            (Get-Item -Path "$Path\$UserObjectID\GRS" -ErrorAction SilentlyContinue) | Remove-Item -Recurse -Force
        }
        else {
            $UserID = (Get-ChildItem -Path $Path) | Where-Object { $_.PSChildName -ne '00000000-0000-0000-0000-000000000000' -and $_.PSChildName -match '^(?:\{{0,1}(?:[0-9a-fA-F]){8}-(?:[0-9a-fA-F]){4}-(?:[0-9a-fA-F]){4}-(?:[0-9a-fA-F]){4}-(?:[0-9a-fA-F]){12}\}{0,1})$' } | Select-Object -ExpandProperty PSChildName
            foreach ($ID in $UserID) {
                Write-Verbose ("Recursively starting function with userObjectId: $ID")
                Restart-IntuneWin32AppDetection -Path $Path -AppID $AppID -UserObjectID $ID -SkipServiceRestart
            }
        }
        if (-not $SkipServiceRestart) {
            Write-Verbose "Restarting Intune Management Extension"
            Get-Service -DisplayName "Microsoft Intune Management Extension" | Restart-Service
        }
    }
    end {
        Write-Verbose -Message "End function: $($MyInvocation.MyCommand.Name)"
    }
}

$regPath  = "HKLM:\SYSTEM\CurrentControlSet\Control\SecureBoot"
$regName  = "AvailableUpdates"
$regValue = 0x5944   # Deploy all needed certs + update to PCA2023-signed boot manager
$regType  = "DWord"

try {
    if (-not (Test-Path $regPath)) {
        New-Item -Path $regPath -Force | Out-Null
    }

    New-ItemProperty -LiteralPath $regPath -Name $regName -Value $regValue -PropertyType $regType -Force | Out-Null
    Write-Output "Remediated: Set $regName = 0x$("{0:X}" -f $regValue) at $regPath"
    Start-ScheduledTask -TaskName "\Microsoft\Windows\PI\Secure-Boot-Update"
    $restartAppID = Get-ItemPropertyValue -Path 'HKLM:\SOFTWARE\_Custom' -Name 'RestartAppID' -ErrorAction SilentlyContinue
    if ($restartAppID) {
        Set-ItemProperty -Path 'HKLM:\SOFTWARE\_Custom' -Name 'RestartRequired' -Value $true -Type String
        Restart-IntuneWin32AppDetection -AppID $restartAppID
    }
    Exit 0
}
catch {
    Write-Error "Failed to set registry key: $_"
    Exit 1
}
```

{% endraw %}

The graceful reboot path is optional - the script checks for `RestartAppID` in `HKLM:\SOFTWARE\_Custom` before attempting it. If the Win32 app is not deployed on the device, the script still sets the registry key and exits `0`. The device will apply the certificate update the next time Windows processes it, but you'll need to handle the reboot separately.

---

## Intune Configuration

Create a new Remediation in the Intune admin center under **Devices > Remediations > Create**.

| Setting                                         | Value                                                           |
| ----------------------------------------------- | --------------------------------------------------------------- |
| Name                                            | SecureBoot Certificate Update                                   |
| Description                                     | Detects and triggers the PCA2023 Secure Boot certificate update |
| Detection script                                | `detect.ps1`                                                    |
| Remediation script                              | `remediate.ps1`                                                 |
| Run this script using the logged-on credentials | No                                                              |
| Enforce script signature check                  | No                                                              |
| Run script in 64-bit PowerShell                 | Yes                                                             |

Both scripts must run as **Admin** in a **64-bit** context - the Secure Boot registry keys are not accessible from a 32-bit process.

Set the schedule under the assignment to run at a reasonable frequency. Once per day is enough: the detection exits quickly on compliant devices, and remediation only triggers on devices where the update hasn't started yet.

---

## End-to-End Flow

```text
Intune runs detect.ps1 on schedule
  - UEFICA2023Status = "Updated" or "InProgress"  -> exit 0, device stays compliant
  - key absent or any other value                  -> exit 1, remediation triggered

remediate.ps1 runs:
  1. Sets AvailableUpdates = 0x5944
  2. Starts \Microsoft\Windows\PI\Secure-Boot-Update scheduled task
  3. If Graceful Reboot app is installed:
       - Sets RestartRequired = "True"
       - Clears IME detection state for the Restart Device app
       - Restarts IME service

IME re-evaluates Restart Device app -> detection fails -> runs Install-Restart-Device.ps1
  - Sees RestartRequired != "False"
  - Exits 1641 -> Intune triggers graceful restart with user notification

Windows applies Secure Boot certificate update on restart

Next Intune cycle: UEFICA2023Status = "Updated" -> device is compliant
```

---

## Notes

- **The reboot is required.** The boot manager update happens at boot time. Setting the registry key alone is not enough - the device needs to restart before `UEFICA2023Status` will flip to `Updated`.
- **The graceful reboot is optional but recommended.** Without it, users on active devices may experience an abrupt restart driven by other mechanisms. The Win32 app approach gives users the notification and grace period configured in the assignment.
- **`InProgress` does not mean the device is done.** It means Windows has started the process. Run detection again after a restart to confirm `UEFICA2023Status` has moved to `Updated`.
