---
title: 'Sherlock Intune and the case of the not applying filters'
date: '2025-02-06T10:22:54+01:00'
author: 'Sascha Stumpler'
layout: post
categories:
    - Intune
tags:
    - 'Windows 11'
    - 'Application'
---
## The issue

A colleague of mine has reported to me instances where filters on application deployments in Microsoft Intune did not apply as intended. This can cause problems if applications are deployed to a lot of endpoints where they are not needed.

## Cause

The reason filters may not apply as intended lies in the way Intune handles multiple assignments of the same application to a user or device. If a user or device has multiple assignments for the same application, with and without filters, Intune will ignore the filters. This behavior is by design.

### Example Scenario

Consider the following scenario:

- Assignment 1: Application A is assigned as available to User Group 1 without any filters.
- Assignment 2: Application A is assigned as required to User Group 2 with a filter that targets devices running Windows 10.

In this case, if a user belongs to both User Group 1 and User Group 2, and they have a device running Windows 10, the filter in Assignment 2 will be ignored. This is because the user already has a deployment of Application A from Assignment 1, which does not include any filters. Therefore, the application will be automatically installed on any Windows device of the user.

The behavior is documented here: [Filter reports and troubleshooting in Microsoft Intune](https://learn.microsoft.com/en-us/mem/intune/fundamentals/filters-reports-troubleshoot#managed-devices)

The article states:

“If a user or device is targeted with both __Available__ and __Required__ assignments, then it receives a merged intent called __Required and Available__. The device must evaluate filters used in both assignments. When it evaluates both filters, the device implements the same conflict resolution: [Filter mode](https://learn.microsoft.com/en-us/mem/intune/fundamentals/filters-reports-troubleshoot#filter-mode) and ["OR" logic when filter modes are the same](https://learn.microsoft.com/en-us/mem/intune/fundamentals/filters-reports-troubleshoot#use-or-logic-when-filter-modes-are-the-same).”

That means the [Filter mode](https://learn.microsoft.com/en-us/mem/intune/fundamentals/filters-reports-troubleshoot#filter-mode) is applied if there isn’t any filter on one of the deployments which is defined as:

1. __Exclude__ mode applies. __Exclude__ wins over __No filter__, and wins over __Include__ mode.
2. __No filter__ mode applies. __No filter__ wins over __Include__ mode.
3. __Include__ mode applies.

This implies that if you have overlapping deployments with __Include__ and __No filter__ your filter will be ignored. The issue won't arise if you are using __Exclude__ filters or filters with the __same intent__ in all deployments of an application.

## Managing Application Deployments with Filters

To ensure that filters are applied correctly in Intune, administrators should follow these best practices:

- Review Assignments: Regularly review application assignments to identify any overlapping deployments that could lead to filters being ignored.
- Consolidate Assignments: Where possible, consolidate application assignments to minimize multiple assignments of the same application to the same users or devices.
- If you have potential overlaps in your application assignments, use an Exclude filter or even better filters with the same intent in all assignments.

## Conclusion

The article is best summarized by a quote of Dr. Egon Spengler from 1984: __"Don’t cross the steams!"__

While it can be challenging to work around the design choice that causes Intune filters to be ignored under certain conditions, understanding the behavior can help mitigate the impact. By carefully managing application assignments you can ensure that the applications only will be installed on the intended devices.

Happy managing!
