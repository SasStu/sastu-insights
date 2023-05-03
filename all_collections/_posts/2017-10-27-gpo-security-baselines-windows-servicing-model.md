---
title: 'Group Policy Security Baselines and Windows as a Service a Layered Approach'
date: '2017-10-27T04:00:03+01:00'
author: 'Sascha Stumpler'
layout: post
categories:
    - 'Group Policy'
tags:
    - GPO
    - 'Group Policy'
    - Security
    - 'Windows 10'
---

How to align the rollout of the Microsoft Security Baselines Group Policies with the Windows 10 servicing model

__Update:__ Added WMI-Filter for Windows 10/11 21H2

# The Problem

Microsoft released security baselines in form of a Group Policy backup set for its operating systems in the recent years. Many enterprises are using these baselines as a security foundation. Enterprises have to adopt new settings on a lot higher frequency with the change of the servicing model and the additional release speed of Windows 10. New security baselines are now available with every release of Windows 10 every 6 months.

_Note: If you want to learn more about Windows as a Service look [here](https://docs.microsoft.com/windows/deployment/update/waas-overview)_

The nature of Group Policies where small changes can have a huge impact on your client landscape made it necessary for enterprises to build solid change processes around them to document and verify any change. These processes are normally slow and inflexible which makes it very hard to combine them with the fast speed of new security baselines.

Another challenge for enterprises is the complexity of testing each baseline setting against a variety of several hundred applications. The traditional way was to do this in an OS upgrade project.
First, the complete baseline was activated and then redefined them during application testing. But with Windows 10 branch upgrades there are no upgrade projects and to validate a baseline with over 50 changed settings against your client landscape on a regular basis is not a feasible scenario for many companies.

# Solution

In order to help the security settings keeping track with the speed of the baseline releases I am using a layered approach.

## What does "layered" mean?

I distinguish between two sorts of Group Policies, the Baseline-GPOs and Custom-GPOs. The main difference between these two are that Baseline-GPOs are not changed by me at all. Every setting which differs from the baselines is made in a Custom-GPO.

Another difference between the Baseline-GPOs and the Custom-GPOs is that the baselines are filtered via WMI-Filter to the corresponding Build version of Windows 10. In contrast the Custom-GPOs are filtered to apply on all Windows 10 clients.

## The WMI-Filters

We need a WMI Filter for Windows 10 and for every active Build currently used. Microsoft supports the last three Build versions so you should have a maximum of three (maybe four) active builds and WMI-Filters.

![WMI Filter for Windows 10 1709]({{ "/assets/images/2017/10/WMI-Filter2.png" | relative_url}})

Windows 10
`Select * from Win32_OperatingSystem WHERE Version LIKE "10.0%" and ProductType = "1"`

Windows 10 1607
`Select * from Win32_OperatingSystem WHERE Version LIKE "10.0.14393%" and ProductType = "1"`

Windows 10 1703
`Select * from Win32_OperatingSystem WHERE Version LIKE "10.0.15063%" and ProductType = "1"`

Windows 10 1709
`Select * from Win32_OperatingSystem WHERE Version LIKE "10.0.16299%" and ProductType = "1"`

Windows 10 1803
`Select * from Win32_OperatingSystem WHERE Version LIKE "10.0.17134%" and ProductType = "1"`

Windows 10 1809
`Select * from Win32_OperatingSystem WHERE Version LIKE "10.0.17763%" and ProductType = "1"`

Windows 10 1903
`Select * from Win32_OperatingSystem WHERE Version LIKE "10.0.18362%" and ProductType = "1"`

Windows 10 1909
`Select * from Win32_OperatingSystem WHERE Version LIKE "10.0.18363%" and ProductType = "1"`

Windows 10 2004
`Select Version,ProductType from Win32_OperatingSystem WHERE Version LIKE "10.0.19041%" and ProductType = "1"`

Windows 10 20H2
`Select Version,ProductType from Win32_OperatingSystem WHERE Version LIKE "10.0.19042%" and ProductType = "1"`

Windows 10 21H1
`Select Version,ProductType from Win32_OperatingSystem WHERE Version LIKE "10.0.19043%" and ProductType = "1"`

Windows 10 21H2
`Select Version,ProductType from Win32_OperatingSystem WHERE Version LIKE "10.0.19044%" and ProductType = "1"`

Windows 10 22H2
`Select Version,ProductType from Win32_OperatingSystem WHERE Version LIKE "10.0.19045%" and ProductType = "1"`

Windows 11 21H2
`Select Version,ProductType from Win32_OperatingSystem WHERE Version LIKE "10.0.22000%" and ProductType = "1"`

Windows 11 22H2
`Select Version,ProductType from Win32_OperatingSystem WHERE Version LIKE "10.0.22621%" and ProductType = "1"`

The WMI-Filters contain a query about the Windows Version and the ProductType. The latter is defined as follows

* 1 - Client Computer
* 2 - Domain Controller
* 3 - Member Server

With these filters we make sure that the Windows 10 GPOs will only apply on Windows 10 client devices (of the defined Build Version).

## The Baseline-GPOs

You can download the Baseline-GPOs from [here](https://www.microsoft.com/download/confirmation.aspx?id=55319).

I have written a short PowerShell function to import all baselines at once. You just have to export them in one folder and add '-Version' (e.g. '-1709') to the folder name.

![extracted baseline]({{ "/assets/images/2017/10/BaselineFolder.png" | relative_url}})

Then change the __ExportPath__ to your folder path in the following script and execute it. You will need to import the [__Group Policy WMI filter cmdlet module__](https://gallery.technet.microsoft.com/scriptcenter/Group-Policy-WMI-filter-38a188f3) prior to successfully running the script.

{% gist 103f5affd6bee2be72a1018f0f33da05 %}

The script will create or update the GPOs and name them as you can see in the picture below. Additionally it will set the corresponding WMI-Filter if it includes the Build number (e.g. 1709)

![Imported Windows security baselines]({{ "/assets/images/2017/10/BaselineImported.png" | relative_url}})

## Create the Custom-GPOs

You can create a Custom-GPO for each corresponding type of baseline (Defender, Computer, ...) or as I did in the example below just one Custom-GPO for all baselines.

![Custom GPO]({{ "/assets/images/2017/10/custom-gpos.png" | relative_url}})

## Linking the GPOs {#LinkGPOs}

After having everything in place we can now link the GPOs to the OU(s). In the next picture, you can see the GPO Link order of my Windows 10 OU.

![Linked Group Policies]({{ "/assets/images/2017/10/linkedGPOs-1.png" | relative_url}})

The Custom-GPOs have to be linked with a lower order number or to a Sub-OU to apply at last and overwrite the Baseline-GPO if needed.

## Example

A common baseline setting which many of my customers perceive as too strict is the UAC configuration in the baseline for Standard Users which is set to __Automatically deny elevation requests__.

![UAC Baseline]({{ "/assets/images/2017/10/UAC-Baseline.png" | relative_url}})

In the Custom-GPO I changed that setting to __Prompt for credentials on the Secure Desktop__

![UAC custom setting]({{ "/assets/images/2017/10/UAC-custom.png" | relative_url}})

As you can see in the screenshot of a Group Policy Result of a Windows 10 1709 client the baselines are applied as described and the UAC setting is overwritten by the Custom-GPO.

![Group Policiy Result]({{ "/assets/images/2017/10/UAC-Result.png" | relative_url}})

# What is the advantage?

Instead of integrating and validating every single new baseline setting you only have to import the new Baseline-GPOs and the corresponding WMI-Filter.

Microsoft released the baselines when the Windows 10 Build became available in the Semi-Annual-Channel (formerly known as Current Branch for Business). With the release of the Fall Creators Update the final version of baselines even became available with the release to the Semi-Annual-Channel(targeted) (formerly known as Current Branch). So, it is very unlikely that you have deployed a large number of clients with the newest build before the baselines are available.

Therefore, when you start to upgrade your clients to the newest build you will automatically test the new baselines along with the new OS Version without an effect on your productive clients.

If you have to change a setting in your Custom-GPOs because of the new baselines it is very unlikely that this setting will have a negative effect on your existing clients. Because it is either a new setting which isn’t applicable for the old builds or it isn't set in the old baselines. If the latter is the case you will set it back to the default value in most cases which already worked.

It also makes it easier to find out which of your settings differ from the baselines. You do not have to compare different GPOs with the baselines. You only have to look at your Custom-GPOs or in a Group Policy Result Report which of the settings are applied from a Custom-GPO.
