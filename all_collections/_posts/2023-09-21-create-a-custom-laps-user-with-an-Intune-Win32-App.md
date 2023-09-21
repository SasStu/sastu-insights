---
title: 'Create a custom LAPS user with an Intune Win32 App'
date: '2023-09-21T10:22:54+01:00'
author: 'Sascha Stumpler'
layout: post
categories:
    - Intune
tags:
    - Intune
    - Remediation
    - Application
---
I was recently part of a discussion about creating a custom user to manage with [Windows LAPS](https://learn.microsoft.com/en-us/windows-server/identity/laps/laps-overview) with Microsoft Intune without using Remediations due to licensing constraints (Business Premium). And the solution I came up with is what I want to show you here.

## Problem

Windows LAPS is a easy solution to manage a single local Windows account password. But it lacks the ability to create the user if it not exists.

Remediations in Microsoft Intune are the perfect tool to create a user account if it not exists because they are repeatedly checking for a wanted status on a device and repair/remediate it if it is not present. I use it myself and published an Intune version of my script I used in [Configuration Manager with Configuration Baselines]( {{ "/posts/create-laps-managed-user-sccm-ci/" | relative_url}} ) to the [EndpointAnalyticsRemediationScripts GitHub repo](https://github.com/JayRHa/EndpointAnalyticsRemediationScripts/tree/main/Test-LAPSUser).

But the use of Remediations is limited to [Enterprise customers](https://learn.microsoft.com/en-us/mem/intune/fundamentals/remediations#licensing) and how can non Enterprise customers handle this?

## Solution

The solution I came up with was packaging the [new-LAPSUser.ps1](https://github.com/JayRHa/EndpointAnalyticsRemediationScripts/blob/main/Test-LAPSUser/new-LAPSUser.ps1) as a Win32App and use the [detect-LAPSUser.ps1](https://github.com/JayRHa/EndpointAnalyticsRemediationScripts/blob/main/Test-LAPSUser/detect-LAPSUser.ps1) as detection method for it.

Sounds simple? Yes but there are some caveats like running the script in the 32-bit PowerShell Host.

### What the scripts are doing

Both scripts are checking if an [AdministratorAccountName](https://learn.microsoft.com/en-us/windows-server/identity/laps/laps-management-policy-settings#administratoraccountname) is set via the [CSP](https://learn.microsoft.com/en-us/windows-server/identity/laps/laps-management-policy-settings#supported-policy-roots) and if a [Backup Directory](https://learn.microsoft.com/en-us/windows-server/identity/laps/laps-management-policy-settings#supported-policy-settings-by-backupdirectory) is configured and if Windows LAPS is present on the system.

The [detect-LAPSUser.ps1](https://github.com/JayRHa/EndpointAnalyticsRemediationScripts/blob/main/Test-LAPSUser/detect-LAPSUser.ps1) also checks if a local account with the configured AdministratorAccountName is present.

The [new-LAPSUser.ps1](https://github.com/JayRHa/EndpointAnalyticsRemediationScripts/blob/main/Test-LAPSUser/new-LAPSUser.ps1) creates a user account with the AdministratorAccountName with a random password.

### Package the script

1. Put the [new-LAPSUser.ps1](https://github.com/JayRHa/EndpointAnalyticsRemediationScripts/blob/main/Test-LAPSUser/new-LAPSUser.ps1) script in an empty folder.
2. Download and execute the [Microsoft Win32 Content Prep Tool](https://github.com/Microsoft/Microsoft-Win32-Content-Prep-Tool)
3. Use the folder from step 1. as source folder
4. The setup file is new-LAPSUser.ps1
5. Choose a path were the .intunewin file will be saved

### Create the application

1. In Intune open Apps - Windows - Create new application and choose __Windows app (Win32)__
![Create application 1]({{ "/assets/images/2023/09/laps-intune-app-create-app1.png" | relative_url}})
2. Upload the .intunewin created in the last step
![Create application 1]({{ "/assets/images/2023/09/laps-intune-app-create-app2.png" | relative_url}})
3. Fill out at least __Name, Description and Publisher__ and press __Next__
![Create application 1]({{ "/assets/images/2023/09/laps-intune-app-create-app3.png" | relative_url}})
4. The install command uses the sysnative folder to run the script in the 64-bit PowerShell: __c:\Windows\sysnative\WindowsPowerShell\v1.0\powershell.exe -noprofile -executionpolicy bypass -file .\new-LAPSUser.ps1__
5. Uninstall command: __cmd /c exit 0__ (currently not included)
6. Allow available uninstall: __No__
7. Install behavior: __System__
8. Device restart behavior: __No specific action__
![Create application 1]({{ "/assets/images/2023/09/laps-intune-app-create-app4.png" | relative_url}})
9.  __Next__
10. OS architecture: __64-bit__
11. Minimum OS: __Windows 10 20H2__ (oldest version supported by Windows LAPS)
![Create application 1]({{ "/assets/images/2023/09/laps-intune-app-create-app5.png" | relative_url}})
12. __Add+__ additional requirement rule
13. Type: __Registry__
14. Key path: __HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Policies\LAPS__
15. Value name: __AdministratorAccountName__
16. Registry key requirement: __Value exists__ then __OK__
![Create application 1]({{ "/assets/images/2023/09/laps-intune-app-create-app6.png" | relative_url}})
17. __Next__
18. Choose __Detection script__ and use the following script (added a line with Write-Output to signal the detection)
{% gist db016346d0365c4e3bb54528b1ba19a0 %}
![Create application 1]({{ "/assets/images/2023/09/laps-intune-app-create-app7.png" | relative_url}})

### Bring it all together

Now you only have to assign the __application__ and a __LAPS configuration containing an AdministratorAccountName__ to the devices and an user with the configured name should be created for LAPS to take over.

### The Flow

1. The device checks in with Intune and recognizes the app deployment
2. The Intune Management Extension runs the detection script to check if the application is installed. It therefore checks if a user account is necessary and if it is already present.
3. If the user is configured but does not exist the installation will be started which will create the account
4. The detection is script runs again and discovers the user and therefore the application.
5. If the AdministratorAccountName is changed the application [re-evaluation](https://learn.microsoft.com/en-us/mem/intune/apps/apps-win32-add#step-4-detection-rules) will detect the app as not installed and it will retry the installation and this will create a new local account.
