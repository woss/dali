---
id: TASK-013
title: fix sync bug in migrations
status: Done
assignee: []
created_date: '2026-04-27 16:18'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

The \_\_migrations table has only 2 entries while journal has 7. Up() uses journal to determine pending, ignoring DB. Fix: add sync logic to reconcile both sources before determining pending.

<!-- SECTION:DESCRIPTION:END -->
