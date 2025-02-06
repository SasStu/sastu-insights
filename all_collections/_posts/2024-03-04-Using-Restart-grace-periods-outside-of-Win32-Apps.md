---
title: 'Using restart with grace period outside of Win32 Apps'
date: '2024-03-04T10:20:15+01:00'
author: 'Sascha Stumpler'
layout: post
categories:
    - Intune
tags:
    - 'Windows 11'
    - 'Windows 10'
    - 'Remediation'
    - 'Application'
    - 'PowerShell'
---
## Problem

I recently ran into the problem that I had to trigger a reboot with user interaction from an Intune Remediation running in the system context. And I don't wanted to use any third party UIs or the serviceui.exe.

## Solution

The solution I came up with is to install a PowerShell script as Win32 application assigned with a [restart grace period](https://learn.microsoft.com/en-us/mem/intune/apps/apps-win32-app-management#set-win32-app-availability-and-notifications) which is detected by a registry value. The installation is repeated by changing the registry value through which the application will trigger a "Hard reboot" which will trigger the grace period UI of Intune.

### The script

1. The script will check if the __registry__ path and __value__ provided as parameter __exists__. If __not__ it will create them both and a scheduled task which will reset the trigger value during a manual restart before the app detection kicks in. The run is __detected as installation__ and will therefore __exit with 0__ (no restart).
2. If the __registry value exists but is different from the target state__ defined as a parameter the script will __set the target value and exit with 1641__ (hard reboot).

### The Win32 application

To create the Win32 application the following steps are necessary:

1.