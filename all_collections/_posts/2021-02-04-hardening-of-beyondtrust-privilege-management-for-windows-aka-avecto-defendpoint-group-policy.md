---
title: 'Hardening of BeyondTrust Privilege Management for Windows (aka Avecto Defendpoint) Group Policies'
date: '2021-02-04T21:38:20+01:00'
author: 'Sascha Stumpler'
excerpt: 'Modifying the Security Filtering of GPOs to prevent readable access to the BeyondTrust Privilege Management for Windows aka Avecto Defendpoint configuration'
layout: post
categories: ["Group Policy","Security"]
---

Hey folks, in the last 8 years I have been helpimg a lot of companies to deploy what is now known as BeyondTrust Privilege Management for Windows (PMfW) and was formerly known as Avecto Defendpoint or Privilege Guard. In this post I want to show you how to harden your Group Policy based configurations against unwanted access.

# Problem {#Problem}

The PMfW Agent uses a human readable XML configuration file which in most cases is deployed via Group Policy. The locally cached configuration is protected against unelevated access with NTFS permissions, but this does not apply to the default configuration of the Group Policy. The XML configuration file stored in the policy directory in the SYSVOL-Share of the Domain is readable for every authenticated user. A clever user or an attacker could use the read-only access to find a loophole in the configuration to elevate processes he is not allowed to or to gain full admin access to the computer. It is very unlikely, due to the Anti-Tampering mechanisms implemented into the Agent, but not impossible.

![Window]({{ site.url }}/assets/images/2021/02/2021-02-04-14_55_20-Window.png)

As you can see in the picture above the access to the local policy cache in %ProgramData%\Avecto is prohibited <span style="color:purple">(1)</span>. But the user can load the XML configuration file from the GPO folder in the SYSVOL-Share and for example look up the application definitions of an Application Group <span style="color:green">(2)</span>.

# Solution {#Solution}

If you are only using computer policies for PMfW, which is quite common, the solution is easy. Just replace the __Authenticated Users__ entry in the __Security Filtering__ of the relevant Group Policies with the __Domain Computers__ group.

<img src="https://master-client.com/wp-content/uploads/2021/02/2021-02-04-20_19_58-Window.png" alt="" width="417" height="348" class="alignnone size-full wp-image-1214" />

Changing the Security Filtering of a GPO is the same as setting NTFS permissions on the folder of the policy in the SYSVOL-Share. As you can see in the picture below accessing the GPO from the network is no longer possible for the user. However, the System Account of the device, which is automatically part of the Domain Computers group of the Active Directory Domain, is still able to access it during policy updates.

<img src="https://master-client.com/wp-content/uploads/2021/02/2021-02-04-15_32_49-Window.png" alt="" width="842" height="313" class="alignnone size-full wp-image-1213" />