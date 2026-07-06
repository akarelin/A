---
name: work
description: >
  This skill should be used when the user asks to "check my email",
  "schedule a meeting", "check my calendar", "send a Teams message",
  "search OneDrive", or any workplace productivity task involving M365.
---

# Work

Meta-skill that routes to the appropriate workplace sub-skill.

## Sub-skills

| Sub-skill | Scope | Connector |
|-----------|-------|-----------|
| work-m365 | Microsoft 365: Mail, Calendar, Teams, Files, Tasks, Contacts, OneNote, Presence | CLI (Graph API) |
| work-ticktick | TickTick tasks and projects | CLI (TickTick Open API) |

## Routing

- **M365 email, calendar, Teams, OneDrive, To Do, contacts, presence** → `work-m365`
- **TickTick tasks, projects, focus sessions** → `work-ticktick`

Google (Gmail/Drive) is not in use — `work-google` was archived (see `plugins/_archived/README.md`).
