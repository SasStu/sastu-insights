---
title: 'Create LAPS managed user with SCCM Configuration Item'
date: '2017-07-24T02:00:42+01:00'
author: 'Sascha Stumpler'
layout: post
categories:
    - SCCM
tags:
    - ConfigMgr
    - 'Configuration Item'
    - 'Configuration Manager'
    - 'Current Branch'
    - SCCM
---

Microsoft has released LAPS (Local Administrator Password Solution) to easily allow different complex passwords for the local Administrator account on every client. It also allows to manage another user than the Built-in Administrator with the Well-Known SID (-500). But it does not create such a user.

In this article, I show you how to configure a SCCM Configuration Item to create such a user with a dynamic password.

__Update:__ I removed an issue in the remediation script which did not always delete the password expiration time in a multi domain environment.

I won't go into the details of configuring LAPS in your environment, there are already some really good articles about that topic.

## The validation script

The validation script checks the following:

- is LAPS enabled?
- is LAPS installed?
- is an Admin Account Name specified in the GPO?
- Does the Admin Account exist?

## The remediation script

The remediation script creates a local user with the name specified in the Group Policy and sets a random complex password. After that it deletes the expiration time attribute (*ms-Mcs-AdmPwdExpirationTime*) from the Active Directory computer object so that LAPS will set a new password on the next policy update. Finally, it triggers a policy update.

It does __not add the user to the Administrator group__. I recommend to do this with Group Policy.

## Group Policy setting

If you want to manage another local user than the Built-in Administrator you have to configure the following policy setting in your Group Policies:

*Computer Configuration\Policies\Administrative Templates\LAPS\\*___Name of the administrator account to manage___

Set it to __enabled__ and enter the __name__ of the local account you want to create.

![LAPS GPO setting]({{ "/assets/images/2017/07/gpo.png" | relative_url}})

## Configuration Manager

### Create Configuration Item

In the SCCM console go to *Assets and Compliance \- Compliance Settings \- Configuration Items* and click on the __Create Configuration Item__ .

![]({{ "/assets/images/2017/07/createCI.png" | relative_url}})

Specify a __name__ and select __Windows Desktops and Servers (custom)__ as type.

![]({{ "/assets/images/2017/07/CI1.png" | relative_url}})

Select the Operating system versions you want to support (requires PowerShell).

![]({{ "/assets/images/2017/07/CI2.png" | relative_url}})

Click on the __New...__ button.

![]({{ "/assets/images/2017/07/ci3.png" | relative_url}})

Specify a name for the setting and select as Setting type __Script__ and as Data type __String__.

![]({{ "/assets/images/2017/07/CI4.png" | relative_url}})

Click on the upper __Edit Script...__ button in the *Discovery script* area. Then select __PowerShell__, and  copy paste the following script to the script area.

{% gist 3eca866d420cf745ac7650e267d7240f %}

Do the same with the lower  __Edit Script...__ button in the *Remediation Script* area with the following script.

{% gist 211edec9e1d8d129da033587b061a13a %}

Change to the *Compliance Rules* Tab and click on the __New...__ button.

![]({{ "/assets/images/2017/07/ci5.png" | relative_url}})

Define a __Name__ for the rule select *Rule type* __Value__. *The value returned by the specified script* should be __Equals__ the following values __True__.

Make sure you __select__ the __Run the specified remediation script when this setting is noncompliant__ checkbox.

You can choose the severity of this rule. For me __Warning__ is high enough.

![]({{ "/assets/images/2017/07/ci6.png" | relative_url}})

After that you can __complete the creation of the Configuration Item__.

![]({{ "/assets/images/2017/07/ci7.png" | relative_url}})

### Create Configuration Baseline

Now you have to __create a Configuration Baseline__ in *Assets and Compliance \- Compliance Settings \- Configuration Baselines* .

![]({{ "/assets/images/2017/07/createcb.png" | relative_url}})

Choose a __Name__ for the baseline and __Add__ the configuration item you have created earlier.

![]({{ "/assets/images/2017/07/cb1.png" | relative_url}})

### Deploy Configuration Baseline

After that you can __Deploy__ the Configuration Baseline to a collection.

![]({{ "/assets/images/2017/07/deploycb1.png" | relative_url}})

Please make sure to select the __Remediate noncompliant rules when supported__ and the __Allow remediation outside maintenance window__ check boxes.

Besides,you have to select how often this rule will be checked. I selected once per day.

![]({{ "/assets/images/2017/07/deploycb2.png" | relative_url}})

### Test the Configuration Baseline

After successfully deploying the baseline you should check the *Configurations* Tab in the *Configuration Manager Properties* Control Panel on one of your clients.

![]({{ "/assets/images/2017/07/agent1.png" | relative_url}})

If the rule was not already evaluated press the __Evaluate__ button.

After successfully evaluating the rule it will be shown as *Compliant* and the user was created.

![]({{ "/assets/images/2017/07/compliant.png" | relative_url}})

The LAPS agent now has a target user and will soon change the password of the user and save this new password to the Active Directory object of the computer.

## Hints

- Check the __DcmWmiProvider.log__ if you get any errors executing the baseline. There you can see the real PowerShell error.
- If you see a message there like the one in the screenshot below you have to configure  *PowerShell execution policy* to __Bypass__ in the *Computer Agent* section in the *Client settings* or you have to sign the scripts with a Code-Signing-Certificate.

![]({{ "/assets/images/2017/07/log.png" | relative_url}})
![]({{ "/assets/images/2017/07/hint.png" | relative_url}})
