---
name: work-m365
description: >
  Use Microsoft 365 through MCP United for mail, calendar, Teams chats and
  channels, files, Microsoft To Do, contacts, OneNote notebooks, presence,
  and cross-entity search. Invoke for Outlook, Office 365, OneDrive, Teams,
  meetings, messages, contacts, tasks, or presence requests.
metadata:
  id: work-m365
  mcp-united-version: "2.0.0"
---

# Microsoft 365 through MCP United

Requires the MCP United 2.0.0 plugin. Calls run with the signed-in user's
delegated Entra permissions. Do not provide the compatibility `user` argument,
retrieve Graph client credentials, or run the bundled direct Graph script.

## Tool map

| Area | Canonical tools |
|---|---|
| Mail | `m365_mail_list`, `m365_mail_read`, `m365_mail_search`, `m365_mail_send`, `m365_mail_draft`, `m365_mail_reply`, `m365_mail_folder_list` |
| Calendar | `m365_calendar_list`, `m365_calendar_today`, `m365_calendar_search`, `m365_calendar_create`, `m365_calendar_delete` |
| Teams chats | `m365_chat_list`, `m365_chat_message_list`, `m365_chat_search`, `m365_chat_send` |
| Teams channels | `m365_channel_list`, `m365_channel_message_list`, `m365_channel_send` |
| Files | `m365_file_list`, `m365_file_search` |
| To Do | `m365_tasklist_list`, `m365_task_list`, `m365_task_create`, `m365_task_complete` |
| Contacts | `m365_contact_list`, `m365_contact_search` |
| Other | `m365_notebook_list`, `m365_presence_get`, `m365_presence_set`, `m365_search` |

## Workflow

1. Start with the narrowest relevant list or search tool and a bounded result
   count when the schema supports it.
2. Resolve stable IDs before reading, replying, sending to a chat or channel,
   deleting an event, or changing a task.
3. Keep file and communication searches directly relevant to the user's stated
   scope. Do not widen a request into speculative personal-data discovery.
4. Before mail or Teams delivery, verify recipient or destination and final
   content. A draft request does not authorize sending.
5. Before calendar creation, verify subject, start, end, timezone, attendees,
   and whether the meeting is online.
6. After a change, use an available read or list tool to verify the result.

## Observed successful patterns

Recent interaction logs successfully used bounded calendar, chat, contact,
mail, notebook, presence, task-list, and cross-entity searches. The reliable
pattern is collection or search first, then a narrower call using returned IDs.

The logs do not contain successful mail send/draft/reply, calendar
create/delete, Teams send, To Do create/complete, or presence-set calls. Treat
those as catalog capabilities, not proven examples, and never exercise them
only to test installation.
