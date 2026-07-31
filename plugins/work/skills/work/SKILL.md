---
name: work
description: >
  This skill should be used when the user asks to "check my email",
  "schedule a meeting", "check my calendar", "send a Teams message",
  "search OneDrive", manage TickTick tasks or projects, inspect focus
  sessions, or perform another workplace productivity task.
metadata:
  id: work
  mcp-united-version: "2.0.0"
---

# Work

Meta-skill that routes to the appropriate workplace sub-skill.

## Sub-skills

| Sub-skill | Scope | Connector |
|-----------|-------|-----------|
| work-m365 | Microsoft 365: Mail, Calendar, Teams, Files, Tasks, Contacts, OneNote, Presence | MCP United |
| work-ticktick | TickTick tasks, projects, and focus sessions | MCP United |

## Routing

- **M365 email, calendar, Teams, OneDrive, To Do, contacts, presence** → `work-m365`
- **TickTick tasks, projects, focus sessions** → `work-ticktick`

Google (Gmail/Drive) is not in use — `work-google` was archived (see `plugins/_archived/README.md`).
