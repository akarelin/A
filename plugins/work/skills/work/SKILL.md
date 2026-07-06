---
name: work
description: >
  This skill should be used when the user asks to "check my email",
  "schedule a meeting", "check my calendar", "send a Teams message",
  "search OneDrive", "check gmail", "search google drive",
  "send personal email", or any workplace productivity task involving
  M365 or Google.
---

# Work

Meta-skill that routes to the appropriate workplace sub-skill.

## Sub-skills

| Sub-skill | Scope | Connector |
|-----------|-------|-----------|
| work-m365 | Microsoft 365: Mail, Calendar, Teams, Files, Tasks, Contacts, OneNote, Presence | CLI (Graph API) |
| work-google | Personal Google: Gmail, Drive | CLI (Google API, OAuth2) |

## Routing

- **M365 email, calendar, Teams, OneDrive, To Do, contacts, presence** → `work-m365`
- **Gmail, Google Drive, personal email** → `work-google`
- **Ambiguous "email"** → ask the user whether they mean M365 (work) or Gmail (personal)
