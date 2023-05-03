---
title: 'Task sequences are not showing up in SCCM Software Center when multiple users are logged on'
date: '2017-07-13T16:22:54+01:00'
author: 'Sascha Stumpler'
layout: post
categories:
    - SCCM
tags:
    - ConfigMgr
    - 'Configuration Manager'
    - SCCM
    - 'Task Sequence'
---

## Problem

I recently ran into the problem that the task sequence I wanted to test won't show up in the SCCM Software Center. I checked for a common misconfiguration like

- Deployment schedule
- Configuration Manager Client active
- Client in the correct collection
- Deployment deployed to the correct collection
- Client in a boundary with a distribution point
- Packages deployed to the Distribution Point
- Check the \_SCCLient_%USER%.log, LocationServices.log, PolicyAgent.log, PolicyEvaluator.log,...
- etc.

But all this was configured correct or did not show any errors.

## Solution

I found out after some time that my colleague was still logged on to this computer. After logging him off the Deployments appeared as expected in the Software Center.

Knowing what to look for I found this thread:

[Technet: Applications but not Programs showing in Software Centre](https://social.technet.microsoft.com/Forums/en-US/a3c20fe1-226d-4667-afeb-74879ee93c6a/applications-but-not-programs-showing-in-software-centre?forum=configmanagerapps)

What have I learned:
**Check if you have the lowest session ID when multiple sessions exist!**
