# MCP United 2.0.1 tool catalog

The unified endpoint's privileged catalog exposes 199 canonical tool names.
An Entra user without `MCP.Privileged` receives the 118 Microsoft 365 tools.

| System | Canonical tools |
|---|---|
| Key Vault | `keyvault_secret_get`, `keyvault_secret_list`, `keyvault_secret_create`, `keyvault_secret_update`, `keyvault_secret_version_list`, `keyvault_secret_version_get`, `keyvault_secret_delete`, `keyvault_secret_recover` |
| Microsoft 365 mail | `m365_mail_list`, `m365_mail_read`, `m365_mail_search`, `m365_mail_send`, `m365_mail_draft`, `m365_mail_reply`, `m365_mail_folder_list`, `m365_mail_update`, `m365_mail_delete`, `m365_mail_copy`, `m365_mail_move`, `m365_mail_forward`, `m365_mail_reply_all`, `m365_mail_send_draft`, `m365_mail_attachment_list`, `m365_mail_attachment_get`, `m365_mail_attachment_add` |
| Microsoft 365 calendar | `m365_calendar_list`, `m365_calendar_today`, `m365_calendar_search`, `m365_calendar_create`, `m365_calendar_delete`, `m365_calendar_get`, `m365_calendar_update`, `m365_calendar_cancel`, `m365_calendar_accept`, `m365_calendar_tentatively_accept`, `m365_calendar_decline`, `m365_calendar_forward` |
| Microsoft 365 teams | `m365_team_list`, `m365_team_get` |
| Microsoft 365 chat | `m365_chat_list`, `m365_chat_message_list`, `m365_chat_send`, `m365_chat_search`, `m365_chat_get`, `m365_chat_create`, `m365_chat_update`, `m365_chat_delete`, `m365_chat_member_list`, `m365_chat_member_add`, `m365_chat_member_remove`, `m365_chat_message_get`, `m365_chat_message_update`, `m365_chat_message_delete` |
| Microsoft 365 channels | `m365_channel_list`, `m365_channel_message_list`, `m365_channel_send`, `m365_channel_get`, `m365_channel_create`, `m365_channel_update`, `m365_channel_delete`, `m365_channel_message_get`, `m365_channel_message_reply`, `m365_channel_message_update`, `m365_channel_message_delete`, `m365_channel_member_list`, `m365_channel_member_add`, `m365_channel_member_update`, `m365_channel_member_remove`, `m365_channel_files_folder_get` |
| Microsoft 365 files | `m365_file_list`, `m365_file_search`, `m365_drive_list`, `m365_drive_get`, `m365_site_search`, `m365_site_get`, `m365_site_drive_list`, `m365_file_get`, `m365_file_read`, `m365_file_create`, `m365_file_write`, `m365_file_update`, `m365_folder_create`, `m365_file_delete`, `m365_file_move`, `m365_file_copy`, `m365_file_upload_session_create`, `m365_file_permission_list`, `m365_file_share_link_create` |
| Microsoft 365 tasks | `m365_tasklist_list`, `m365_task_list`, `m365_task_create`, `m365_task_complete`, `m365_task_get`, `m365_task_update`, `m365_task_delete`, `m365_task_reopen`, `m365_tasklist_get`, `m365_tasklist_create`, `m365_tasklist_update`, `m365_tasklist_delete`, `m365_task_checklist_item_create`, `m365_task_checklist_item_update`, `m365_task_checklist_item_delete` |
| Microsoft 365 contacts | `m365_contact_list`, `m365_contact_search`, `m365_contact_get`, `m365_contact_create`, `m365_contact_update`, `m365_contact_delete` |
| Microsoft 365 OneNote | `m365_notebook_list`, `m365_notebook_get`, `m365_notebook_create`, `m365_section_list`, `m365_section_create`, `m365_section_group_list`, `m365_section_group_create`, `m365_page_list`, `m365_page_get`, `m365_page_read`, `m365_page_create`, `m365_page_update`, `m365_page_delete`, `m365_page_copy` |
| Microsoft 365 other | `m365_presence_get`, `m365_presence_set`, `m365_search` |
| Entra users | `entra_user_list`, `entra_user_get`, `entra_user_search`, `entra_user_create`, `entra_user_update`, `entra_user_delete`, `entra_user_license_assign`, `entra_user_license_remove` |
| Entra groups | `entra_group_list`, `entra_group_get`, `entra_group_member_list`, `entra_group_create`, `entra_group_update`, `entra_group_delete`, `entra_group_member_add`, `entra_group_member_remove`, `entra_group_owner_list`, `entra_group_owner_add`, `entra_group_owner_remove` |
| Entra directory | `entra_domain_list`, `entra_license_list`, `entra_user_license_list`, `entra_device_list`, `entra_device_get`, `entra_device_update`, `entra_device_delete`, `entra_role_list`, `entra_role_member_list`, `entra_role_get`, `entra_role_member_add`, `entra_role_member_remove`, `entra_organization_get` |
| Obsidian notes | `obsidian_note_create`, `obsidian_note_delete`, `obsidian_note_insert`, `obsidian_note_inspect`, `obsidian_note_move`, `obsidian_note_patch`, `obsidian_note_read`, `obsidian_note_write` |
| Obsidian search and metadata | `obsidian_frontmatter`, `obsidian_periodic`, `obsidian_search_metadata`, `obsidian_search_regex`, `obsidian_search_semantic`, `obsidian_search_text`, `obsidian_wikilinks` |
| TickTick projects | `ticktick_project_list`, `ticktick_project_get`, `ticktick_project_create`, `ticktick_project_update`, `ticktick_project_delete` |
| TickTick tasks | `ticktick_task_list`, `ticktick_task_create`, `ticktick_task_update`, `ticktick_task_complete`, `ticktick_task_abandon`, `ticktick_task_get`, `ticktick_task_delete`, `ticktick_task_reopen` |
| TickTick focus | `ticktick_focus_list`, `ticktick_focus_get`, `ticktick_focus_delete` |
| OpenViking | `openviking_code_expand`, `openviking_code_outline`, `openviking_code_search`, `openviking_find`, `openviking_glob`, `openviking_grep`, `openviking_health`, `openviking_list`, `openviking_read`, `openviking_search` |
