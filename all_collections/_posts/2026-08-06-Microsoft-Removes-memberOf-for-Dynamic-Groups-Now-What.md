---
title: "Microsoft Removes memberOf for Dynamic Groups - Now What?"
date: "2026-08-06T10:00:00+01:00"
author: "Sascha Stumpler"
layout: post
categories:
  - Entra ID
tags:
  - "Entra ID"
  - "Groups"
  - "Administrative Units"
  - "Entitlement Management"
  - "Microsoft Graph"
  - "PowerShell"
image: /assets/images/2026/08/memberof-retirement-header.png
---

Microsoft published [MC1448379](https://mc.merill.net/message/MC1448379): the `memberOf` rule operator in Microsoft Entra ID is being retired on **November 3, 2026**. If you've used `memberOf` to build dynamic groups whose membership depends on nested group membership - `user.memberOf -any (group.objectId -eq '...')` - those rules stop being evaluated once the deadline hits. Membership freezes at its last known state instead of erroring out, which is the annoying part: nothing breaks loudly, access and licensing just quietly go stale.

The same operator is used in two other places most people don't immediately think to check: dynamic administrative units, and entitlement management automatic assignment policies (where a `memberOf` rule can be nested inside an access package's attribute-based targeting). Both are affected by the same retirement and the same deadline.

Rather than clicking through Groups, Administrative Units, and Entitlement Management one at a time, I wrote [`Find-DynamicGroupsWithMemberOfRule.ps1`](https://github.com/SasStu/Intune-Misc/blob/main/Scripts/Find-DynamicGroupsWithMemberOfRule.ps1) to scan all three surfaces via Microsoft Graph and report everything that needs to be rebuilt before November.

## What's Actually Being Retired

**What and why:** the `memberOf` operator has been in public preview, and Microsoft found that even a single `memberOf` rule in a tenant can affect dynamic membership processing performance tenant-wide. It's not recommended for production and is being pulled.

**Rollout:** retirement begins worldwide in early November 2026; action is required by **November 3, 2026**.

**If nothing is done:** configurations using `memberOf` stop updating after the deadline. Membership and assignments stay frozen in their last known state, which can lead to:

- Stale dynamic group membership (and anything scoped off it - Conditional Access, group-based licensing, app assignments)
- Dynamic administrative units that stop picking up new/removed members
- Entitlement management access packages that stop auto-assigning or auto-removing access for the affected policy

None of this throws an error. It just stops updating, so it's easy to miss until someone notices access is wrong.

---

## What the Script Does

`Find-DynamicGroupsWithMemberOfRule.ps1` scans the three affected surfaces for any rule containing `memberOf`:

- **Dynamic membership groups** - `groupTypes` contains `DynamicMembership`
- **Dynamic administrative units** - `membershipType` is `Dynamic`
- **Entitlement management automatic assignment policies** - access package policies with `automaticRequestSettings`, where a `specificAllowedTargets` entry is an `attributeRuleMembers` target whose `membershipRule` contains `memberOf`

Every match across all three surfaces lands in one unified list with a `Type` column, so you can triage everything together. It also writes a separate CSV per surface (only for surfaces with at least one match, unless you pass `-AlwaysWriteCsv`), which is the more useful artifact if you're handing this off to someone else to remediate.

It's read-only - `Group.Read.All`, `AdministrativeUnit.Read.All`, and `EntitlementManagement.Read.All`. It only reports; it doesn't touch anything.

## Usage

Default run - signs in interactively with the Microsoft Graph PowerShell client, writes CSVs to the current directory:

```powershell
.\Find-DynamicGroupsWithMemberOfRule.ps1
```

Include paused dynamic groups/AUs (skipped by default) and write reports somewhere specific:

```powershell
.\Find-DynamicGroupsWithMemberOfRule.ps1 -IncludeDisabled -OutputFolder C:\Reports
```

Sign in as a custom app registration instead of the default Graph PowerShell client - useful if your tenant restricts consent on the built-in client ID:

```powershell
.\Find-DynamicGroupsWithMemberOfRule.ps1 -ClientId '11111111-2222-3333-4444-555555555555' -TenantId 'contoso.onmicrosoft.com'
```

Or app-only, via a certificate, for unattended/scheduled runs:

```powershell
.\Find-DynamicGroupsWithMemberOfRule.ps1 -ClientId '11111111-2222-3333-4444-555555555555' -TenantId 'contoso.onmicrosoft.com' -CertificateThumbprint 'ABCDEF0123456789ABCDEF0123456789ABCDEF01'
```

## Sample Output

```text
--- Dynamic membership groups ---
Found 42 dynamic membership group(s).
3 dynamic group(s) use the memberOf rule operator.
  Report written to .\memberof-dynamic-groups.csv
--- Dynamic administrative units ---
Found 6 dynamic administrative unit(s).
1 dynamic administrative unit(s) use the memberOf rule operator.
  Report written to .\memberof-dynamic-administrative-units.csv
--- Entitlement management automatic assignment policies ---
Found 5 automatic assignment policy(ies) out of 18 total assignment policy(ies).
2 automatic assignment policy(ies) use the memberOf rule operator.
  Report written to .\memberof-entitlement-management-policies.csv
--- Summary ---
6 object(s) across the tenant use the memberOf rule operator (see per-surface reports above for details):

Type                          DisplayName                 Id       ProcessingState MembershipRule
----                          -----------                 --       --------------- --------------
Group                         MDM-Nested-FinanceGroup      3f2a...  On              (user.memberOf -any (group.obj...
AdministrativeUnit             AU-Regional-EMEA             9c11...  On              (user.memberOf -any (group.obj...
AccessPackageAssignmentPolicy  Finance App Access - Auto    7d40...  n/a             (user.memberOf -any (group.obj...
```

---

## Notes

- **Required Graph permissions:** `Group.Read.All`, `AdministrativeUnit.Read.All`, `EntitlementManagement.Read.All` (delegated or application). The script checks the current `Get-MgContext` scopes and only re-prompts for sign-in if something's missing.
- **The entitlement management match is nested, not top-level.** A `memberOf` rule there doesn't live directly on the assignment policy - it's inside `specificAllowedTargets`, on an entry whose `@odata.type` is `attributeRuleMembers`. The script filters for that type first, then checks the nested `membershipRule` for `memberOf`. If Microsoft ever adds another target type with its own `membershipRule`, this is the code path to revisit.
- **`-IncludeDisabled` only affects groups and AUs.** Entitlement management policies have no equivalent "paused" state, so the switch is a no-op for that surface.
- **This is a reporting tool, not a fix.** It tells you what needs to be rebuilt - a plain attribute-based rule for groups/AUs, or a different targeting method for entitlement management - but rewriting each rule is still a manual, per-object decision since there's no generic way to translate a `memberOf` nested-group rule into an equivalent attribute rule.

---

## The Complete Script

Latest version always lives at [github.com/SasStu/Intune-Misc](https://github.com/SasStu/Intune-Misc/blob/main/Scripts/Find-DynamicGroupsWithMemberOfRule.ps1).

```powershell
#Requires -Version 7.2
#Requires -Modules Microsoft.Graph.Authentication

<#
.SYNOPSIS
    Finds every Entra ID object affected by the memberOf rule operator
    retirement (MC1448379): dynamic groups, dynamic administrative units,
    and entitlement management automatic assignment policies.

.DESCRIPTION
    Per https://mc.merill.net/message/MC1448379, the memberOf rule operator
    is retiring on November 3, 2026. After that date, any rule that uses it
    stops being evaluated (dynamic groups/administrative units) or is
    quarantined (entitlement management automatic assignment policies),
    which can cause stale group/AU membership, incorrect Conditional Access
    scoping, broken group-based licensing, and dropped access package
    assignments.

    This script scans all three affected surfaces for rules containing the
    memberOf operator:

      - Dynamic membership groups (groupTypes contains 'DynamicMembership')
      - Dynamic administrative units (membershipType eq 'Dynamic')
      - Entitlement management automatic assignment policies
        (accessPackageAssignmentPolicies with automaticRequestSettings,
        whose specificAllowedTargets attributeRuleMembers membershipRule
        contains memberOf)

    Output is a single unified list with a Type column so every match can be
    triaged together, plus separate CSV exports per surface for easier
    follow-up.

.PARAMETER IncludeDisabled
    Also report dynamic groups/administrative units whose
    membershipRuleProcessingState is 'Paused'. Without this switch, only
    actively processed ones are checked. Has no effect on entitlement
    management policies (they have no equivalent paused state).

.PARAMETER OutputFolder
    Folder to write the per-surface CSV reports to. Defaults to the current
    directory. Files are only created for surfaces that returned at least
    one match, unless -AlwaysWriteCsv is specified.

.PARAMETER AlwaysWriteCsv
    Write a CSV (with headers only) for every surface even when no matches
    were found, so a scan run always leaves a record behind.

.PARAMETER ClientId
    Application (client) ID of a custom Entra ID app registration to sign in
    with, instead of the default Microsoft Graph PowerShell client. Requires
    -TenantId. The app must have the required delegated (or application)
    permissions granted (Group.Read.All, AdministrativeUnit.Read.All,
    EntitlementManagement.Read.All).

.PARAMETER TenantId
    Tenant ID or verified domain to sign in against. Required when -ClientId
    is used; optional otherwise (falls back to the default/common tenant).

.PARAMETER CertificateThumbprint
    Thumbprint of a certificate installed in the local certificate store to
    use for app-only (application permission) authentication with -ClientId.
    Without this, -ClientId alone signs in interactively (delegated
    permissions) as that app.

.EXAMPLE
    .\Find-DynamicGroupsWithMemberOfRule.ps1

.EXAMPLE
    .\Find-DynamicGroupsWithMemberOfRule.ps1 -IncludeDisabled -OutputFolder C:\Reports

.EXAMPLE
    # Sign in interactively as a custom app registration
    .\Find-DynamicGroupsWithMemberOfRule.ps1 -ClientId '11111111-2222-3333-4444-555555555555' -TenantId 'contoso.onmicrosoft.com'

.EXAMPLE
    # App-only auth via a certificate
    .\Find-DynamicGroupsWithMemberOfRule.ps1 -ClientId '11111111-2222-3333-4444-555555555555' -TenantId 'contoso.onmicrosoft.com' -CertificateThumbprint 'ABCDEF0123456789ABCDEF0123456789ABCDEF01'
#>

[CmdletBinding()]
param(
    [switch]$IncludeDisabled,

    [string]$OutputFolder = '.',

    [switch]$AlwaysWriteCsv,

    [string]$ClientId,

    [string]$TenantId,

    [string]$CertificateThumbprint
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($ClientId -and -not $TenantId) {
    throw '-TenantId is required when -ClientId is specified.'
}
if ($CertificateThumbprint -and -not $ClientId) {
    throw '-CertificateThumbprint can only be used together with -ClientId.'
}

function Get-GraphAll {
    param([string]$Uri)
    $results = [System.Collections.Generic.List[object]]::new()
    do {
        $page = Invoke-MgGraphRequest -Method GET -Uri $Uri -OutputType PSObject
        foreach ($item in $page.value) { $results.Add($item) }
        $Uri = $page.PSObject.Properties['@odata.nextLink']?.Value
    } while ($Uri)
    return $results
}

function Export-MatchCsv {
    param(
        [string]$Name,
        [array]$Rows,
        [string]$Folder,
        [string[]]$Columns
    )
    if ($Rows.Count -eq 0 -and -not $AlwaysWriteCsv) { return }
    $path = Join-Path $Folder "$Name.csv"
    if ($Rows.Count -eq 0) {
        $Columns -join ',' | Set-Content -Path $path -Encoding UTF8
    }
    else {
        $Rows | Select-Object $Columns | Export-Csv -Path $path -NoTypeInformation -Encoding UTF8
    }
    Write-Output "  Report written to $path"
}

# --- Auth --------------------------------------------------------------

$requiredScopes = @('Group.Read.All', 'AdministrativeUnit.Read.All', 'EntitlementManagement.Read.All')
$context = Get-MgContext

if ($ClientId) {
    $sameApp = $context -and $context.ClientId -eq $ClientId -and (-not $TenantId -or $context.TenantId -eq $TenantId)
    $hasScopes = $context -and @($requiredScopes | Where-Object { $_ -notin $context.Scopes }).Count -eq 0
    if (-not $sameApp -or ($CertificateThumbprint -and -not $hasScopes)) {
        if ($CertificateThumbprint) {
            Connect-MgGraph -ClientId $ClientId -TenantId $TenantId -CertificateThumbprint $CertificateThumbprint -NoWelcome
        }
        else {
            Connect-MgGraph -ClientId $ClientId -TenantId $TenantId -Scopes $requiredScopes -NoWelcome
        }
    }
}
elseif (-not $context -or @($requiredScopes | Where-Object { $_ -notin $context.Scopes }).Count -gt 0) {
    Connect-MgGraph -Scopes $requiredScopes -NoWelcome
}

if (-not (Test-Path $OutputFolder)) {
    New-Item -ItemType Directory -Path $OutputFolder -Force | Out-Null
}

$allMatches = [System.Collections.Generic.List[object]]::new()

# --- Dynamic groups ------------------------------------------------------

Write-Output '--- Dynamic membership groups ---'
$groupRows = @()
try {
    $groupFilter = "groupTypes/any(c:c eq 'DynamicMembership')"
    $groupSelect = 'id,displayName,membershipRule,membershipRuleProcessingState'
    $groups = Get-GraphAll -Uri "v1.0/groups?`$filter=$([System.Uri]::EscapeDataString($groupFilter))&`$select=$groupSelect"
    Write-Output "Found $($groups.Count) dynamic membership group(s)."

    $groupCandidates = $groups | Where-Object { $IncludeDisabled -or $_.membershipRuleProcessingState -eq 'On' }
    $groupMatches = $groupCandidates | Where-Object { $_.membershipRule -and $_.membershipRule -match '(?i)\bmemberOf\b' }

    $groupRows = $groupMatches | ForEach-Object {
        [PSCustomObject]@{
            Type            = 'Group'
            DisplayName     = $_.displayName
            Id              = $_.id
            ProcessingState = $_.membershipRuleProcessingState
            MembershipRule  = $_.membershipRule
        }
    }
    foreach ($row in $groupRows) { $allMatches.Add($row) }
    Write-Output "$($groupRows.Count) dynamic group(s) use the memberOf rule operator."
    Export-MatchCsv -Name 'memberof-dynamic-groups' -Rows $groupRows -Folder $OutputFolder -Columns @('DisplayName', 'Id', 'ProcessingState', 'MembershipRule')
}
catch {
    Write-Warning "  Skipped dynamic groups - $($_.Exception.Message)"
}

# --- Dynamic administrative units -----------------------------------------

Write-Output '--- Dynamic administrative units ---'
$auRows = @()
try {
    $auSelect = 'id,displayName,membershipRule,membershipRuleProcessingState,membershipType'
    $aus = Get-GraphAll -Uri "v1.0/directory/administrativeUnits?`$select=$auSelect"
    $aus = @($aus | Where-Object { $_.membershipType -eq 'Dynamic' })
    Write-Output "Found $($aus.Count) dynamic administrative unit(s)."

    $auCandidates = $aus | Where-Object { $IncludeDisabled -or $_.membershipRuleProcessingState -eq 'On' }
    $auMatches = $auCandidates | Where-Object { $_.membershipRule -and $_.membershipRule -match '(?i)\bmemberOf\b' }

    $auRows = $auMatches | ForEach-Object {
        [PSCustomObject]@{
            Type            = 'AdministrativeUnit'
            DisplayName     = $_.displayName
            Id              = $_.id
            ProcessingState = $_.membershipRuleProcessingState
            MembershipRule  = $_.membershipRule
        }
    }
    foreach ($row in $auRows) { $allMatches.Add($row) }
    Write-Output "$($auRows.Count) dynamic administrative unit(s) use the memberOf rule operator."
    Export-MatchCsv -Name 'memberof-dynamic-administrative-units' -Rows $auRows -Folder $OutputFolder -Columns @('DisplayName', 'Id', 'ProcessingState', 'MembershipRule')
}
catch {
    Write-Warning "  Skipped dynamic administrative units - $($_.Exception.Message)"
}

# --- Entitlement management automatic assignment policies -----------------

Write-Output '--- Entitlement management automatic assignment policies ---'
$policyRows = [System.Collections.Generic.List[object]]::new()
try {
    $policies = Get-GraphAll -Uri 'v1.0/identityGovernance/entitlementManagement/assignmentPolicies?$expand=accessPackage&$top=50'
    $autoPolicies = @($policies | Where-Object { $_.automaticRequestSettings })
    Write-Output "Found $($autoPolicies.Count) automatic assignment policy(ies) out of $($policies.Count) total assignment policy(ies)."

    foreach ($policy in $autoPolicies) {
        foreach ($target in @($policy.specificAllowedTargets)) {
            if ([string]$target.'@odata.type' -notlike '*attributeRuleMembers*') { continue }
            $rule = [string]$target.membershipRule
            if ($rule -match '(?i)\bmemberOf\b') {
                $policyRows.Add([PSCustomObject]@{
                        Type              = 'AccessPackageAssignmentPolicy'
                        DisplayName       = $policy.displayName
                        Id                = $policy.id
                        AccessPackageName = $policy.accessPackage.displayName
                        AccessPackageId   = $policy.accessPackage.id
                        ProcessingState   = 'n/a'
                        MembershipRule    = $rule
                    })
            }
        }
    }
    foreach ($row in $policyRows) { $allMatches.Add($row) }
}
catch {
    Write-Warning "  Skipped entitlement management policies - $($_.Exception.Message)"
}
Write-Output "$($policyRows.Count) automatic assignment policy(ies) use the memberOf rule operator."
Export-MatchCsv -Name 'memberof-entitlement-management-policies' -Rows $policyRows -Folder $OutputFolder -Columns @('AccessPackageName', 'AccessPackageId', 'DisplayName', 'Id', 'MembershipRule')

# --- Summary ---------------------------------------------------------------

Write-Output '--- Summary ---'
if ($allMatches.Count -eq 0) {
    Write-Output 'No objects using the memberOf rule operator were found across groups, administrative units, or entitlement management policies.'
}
else {
    Write-Output "$($allMatches.Count) object(s) across the tenant use the memberOf rule operator (see per-surface reports above for details):"
    $allMatches | Select-Object Type, DisplayName, Id, ProcessingState, MembershipRule
}
```
