---
title: "Resetting Forced Edge PWAs: Quick Guide for IT Admins"
date: "2026-07-02T10:00:00+01:00"
author: "Sascha Stumpler"
layout: post
categories:
  - Intune
tags:
  - "Edge"
  - "PWA"
  - "Group Policy"
  - "Intune"
  - "Windows"
image: /assets/images/2026/07/edge-pwa-reset-header.png
---

Every now and then a ticket lands in our queue that reads something like: "The app won't start anymore." A quick look shows it is one of the web apps we push out through Edge, force-installed so that everyone has it ready to go. Normally that is convenient - but when the app breaks, the user is stuck. Because it is force-installed, there is no obvious way to remove and reinstall it: the usual "uninstall and try again" simply is not available to them, and the app keeps failing to launch.

That is where this quick reset comes in. Progressive Web Apps (PWAs) are force-installed in Microsoft Edge via group policies or Intune configuration profiles, which is great until one of them needs a fresh start. Here is a quick step-by-step guide to remove a forced PWA and refresh Edge policies so it can be reinstalled cleanly.

---

## Steps to Reset Forced Edge PWAs

### 1. Adjust the Registry

Open `regedit` as an `Administrator` and navigate to:

```
HKLM\Software\Policies\Microsoft\Edge
```

Delete the `WebAppInstallForceList` value - or, if other PWAs should stay untouched, edit its JSON and remove only the entry of the problematic app.

### 2. Reload Edge Policies

Open Edge as the user and go to:

```
edge://policy
```

Click "Reload" to apply the updated policies. Edge now sees the app as no longer force-installed and removes it.

### 3. Re-Apply the Managed Policies

This is what makes it a reset rather than just a removal: once the policy comes back, Edge force-installs the PWA fresh. On devices managed via Group Policy, open Command Prompt and run:

```
gpupdate /force
```

On Intune-managed devices, trigger a device sync instead (from the Company Portal app or via **Settings > Accounts > Access work or school > Info > Sync**) and reload `edge://policy` once more.

### 4. Test Functionality

Start the app and verify that it launches again. Since the policy has been re-applied, the PWA is force-installed once more - but this time as a fresh installation.

---

That is the whole trick: because the force-install policy re-applies itself, deleting the registry entry and reloading the policies gives the user a clean reinstall without ever touching the Intune or Group Policy configuration. The next time that ticket lands on your desk, this reset should have the app running again in a couple of minutes.
