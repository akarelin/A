# work

Workplace productivity tools with sub-skills for M365 and Google.

## Installation

```
/plugin install work@akarelin-skills
```

## Sub-skills

### work-m365
User-level Microsoft 365 operations via Graph beta API. Mail, Calendar, Teams Chat/Channels, OneDrive Files, To Do Tasks, Contacts, OneNote, Meetings, Presence. Requires `pip install msal requests`.

### work-google
Personal Google account operations (Gmail, Drive).

### work-ticktick
TickTick tasks and projects via MCP United.

## MCP Connectors

Installing this plugin registers the MCP United connector (`mcp.karelin.ai/mcp`).

Slack and Jira/Confluence sub-skills were retired 2026-07-05 — see `plugins/_archived/`.
