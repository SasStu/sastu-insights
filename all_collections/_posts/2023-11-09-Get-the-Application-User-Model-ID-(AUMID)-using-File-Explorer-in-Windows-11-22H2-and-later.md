---
title: 'Get the Application User Model ID (AUMID) using File Explorer in Windows 11 22H2 and later'
date: '2023 11-09T10:22:54+01:00'
author: 'Sascha Stumpler'
layout: post
categories:
    - Intune
tags:
    - 'Windows 11'
---
## Problem

The Application User Model ID (AUMID) of an application is needed in some cases when you are configuring Windows, e.g. for Kiosk configurations or the customization of the start menu and taskbar. A [Microsoft Learn article](https://learn.microsoft.com/en-us/windows/configuration/find-the-application-user-model-id-of-an-installed-app#to-find-the-aumid-by-using-file-explorer) describes different ways of getting the AUMIDs for the installed applications.
Windows 11 22H2 introduced a new File Explorer in which it is no longer possible to extend the view as described by Microsoft by pressing the __Alt-Key__ and it is therefore no longer possible to show the AUMIDs as described.

## Solution

It is possible to use the __Group by__ feature of the File Explorer to make the AUMIDs visible.

1. Open __Run__ (Win+R), enter __shell:Appsfolder__, and select __OK__.
2. Click **Sort > Group by > AppUserModelId**

![File Explorer 22H2 AUMID]({{ "/assets/images/2023/11/file-explorer-aumid.png" | relative_url}})
