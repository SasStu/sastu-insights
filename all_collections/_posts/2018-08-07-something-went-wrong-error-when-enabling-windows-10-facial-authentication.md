---
title: 'Something went wrong error when enabling Windows 10 facial authentication'
date: '2018-08-07T02:28:09+01:00'
author: 'Sascha Stumpler'
layout: post
image: /assets/images/2018/08/2018-07-23-18_15_30-Windows-Hello-setup.jpg
categories:
    - 'Group Policy'
    - 'Windows'
    - 'Windows Hello'
tags:
    - GPO
    - 'Group Policy'
    - 'Windows'
    - 'Windows Hello'
---

## Problem

When I was at a customer's site lately and tried to enable the Windows Hello face recognition feature I encountered an error. After pressing the *Get started* button on the *Windows Hello setup* page *Sorry, something went wrong* was displayed without further explanations.

![Windows Hello Setup]({{ "/assets/images/2018/08/2018-07-23-18_15_01-Windows-Hello-setup.jpg" | relative_url}})
![Windows Hello Setup Error]({{ "/assets/images/2018/08/2018-07-23-18_15_30-Windows-Hello-setup.jpg" | relative_url}})

When I checked the Windows Event Log I could find a DistributedCOM error with the EventID 10016 which stated that the application did not have the *local activation permission for the COM application*.

![Windows eventlog error DCOM]({{ "/assets/images/2018/08/2018-07-23-18_39_12-Clipboard.png")

After that I looked up the *APPID* from the event in the *Component Services* and found out that it was the *RuntimeBroker* which controls the execution of the AppX(Universial)-Apps. Thinking about that I remembered that we had limited the access to the camera to certain AppX-Apps via Group Policy.

![Component Services]({{ "/assets/images/2018/08/2018-07-23-18_28_18-Component-Services.jpg" | relative_url}})

I opened regedit as an Administrator and removed the value

__HKLM:\Software\Policies\Microsoft\Windows\AppPrivacy!LetAppsAccessCamera__

and tested again. Then it worked! So I just needed to find out which AppX needs access to the camera. I looked up the installed AppX with the PowerShell command:

[powershell]
Get-AppxPackage | select Name | sort
[/powershell]

There it was the __Microsoft.BioEnrollment_cw5n1h2txyewy__ AppX which looked like the app I was searching for. I reset my registry changes with a Group Policy update and added the AppX name to the value of:

__HKLM:\Software\Policies\Microsoft\Windows\AppPrivacy!LetAppsAccessCamera_UserInControlOfTheseApps__

![Registry privacy camera]({{ "/assets/images/2018/08/2018-07-23-18_37_28-Clipboard.png" | relative_url}})

After that I tested again and it still worked to setup the facial recognition.

![Camera working]({{ "/assets/images/2018/08/2018-07-23-18_18_47-.jpg" | relative_url}})

## Solution

Adding the AppX __Microsoft.BioEnrollment_cw5n1h2txyewy__ to the *Put user in control of these specific apps* or the *Force allow these specific apps* fields of the __Let Windows apps access the camera__ setting in the GPO under __Computer Settings\Administrative Templates\Windows Components\App Privacy__ resolved the issue and users are able to use their face to authenticate on Windows.

![GPO settings camera privacy]({{ "/assets/images/2018/08/2018-07-23-18_32_34-RDP-Manager.jpg" | relative_url}})
