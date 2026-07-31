# MCP United 2.0.0 tool catalog

The unified endpoint's privileged catalog exposes 82 canonical tool names.
An Entra user without `MCP.Privileged` receives the 31 Microsoft 365 tools.

| System | Canonical tools |
|---|---|
| Key Vault | `keyvault_secret_get`, `keyvault_secret_list`, `keyvault_secret_create`, `keyvault_secret_update` |
| Microsoft 365 mail | `m365_mail_list`, `m365_mail_read`, `m365_mail_search`, `m365_mail_send`, `m365_mail_draft`, `m365_mail_reply`, `m365_mail_folder_list` |
| Microsoft 365 calendar | `m365_calendar_list`, `m365_calendar_today`, `m365_calendar_search`, `m365_calendar_create`, `m365_calendar_delete` |
| Microsoft 365 chat | `m365_chat_list`, `m365_chat_message_list`, `m365_chat_send`, `m365_chat_search` |
| Microsoft 365 channels | `m365_channel_list`, `m365_channel_message_list`, `m365_channel_send` |
| Microsoft 365 files | `m365_file_list`, `m365_file_search` |
| Microsoft 365 tasks | `m365_tasklist_list`, `m365_task_list`, `m365_task_create`, `m365_task_complete` |
| Microsoft 365 contacts | `m365_contact_list`, `m365_contact_search` |
| Microsoft 365 other | `m365_notebook_list`, `m365_presence_get`, `m365_presence_set`, `m365_search` |
| Entra | `entra_user_list`, `entra_user_get`, `entra_user_search`, `entra_group_list`, `entra_group_get`, `entra_group_member_list`, `entra_domain_list`, `entra_license_list`, `entra_user_license_list`, `entra_device_list`, `entra_role_list`, `entra_role_member_list`, `entra_organization_get` |
| Obsidian notes | `obsidian_note_create`, `obsidian_note_delete`, `obsidian_note_insert`, `obsidian_note_inspect`, `obsidian_note_move`, `obsidian_note_patch`, `obsidian_note_read`, `obsidian_note_write` |
| Obsidian search and metadata | `obsidian_frontmatter`, `obsidian_periodic`, `obsidian_search_metadata`, `obsidian_search_regex`, `obsidian_search_semantic`, `obsidian_search_text`, `obsidian_wikilinks` |
| TickTick tasks | `ticktick_project_list`, `ticktick_task_list`, `ticktick_task_create`, `ticktick_task_update`, `ticktick_task_complete`, `ticktick_task_abandon` |
| TickTick focus | `ticktick_focus_list`, `ticktick_focus_get`, `ticktick_focus_delete` |
| OpenViking | `openviking_code_expand`, `openviking_code_outline`, `openviking_code_search`, `openviking_find`, `openviking_glob`, `openviking_grep`, `openviking_health`, `openviking_list`, `openviking_read`, `openviking_search` |
