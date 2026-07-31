---
name: mcp-united
description: >
  Use MCP United for Key Vault, Microsoft 365, Entra, Obsidian, TickTick,
  or OpenViking work. Invoke for requests to read or change connected
  Karelin data, search across these systems, inspect service health, or
  coordinate a workflow that spans more than one connected system.
metadata:
  id: mcp-united
  version: "2.0.0"
---

# MCP United

Use the canonical tool names in
[the tool catalog](references/tool-catalog.md). Do not use the native names
exposed by direct diagnostic endpoints.

In ChatGPT and Codex, tools use the catalog names directly. In Claude Code,
plugin-provided tools are scoped as:

```text
mcp__plugin_mcp-united_mcp-united__<canonical-tool-name>
```

## Workflow

1. Identify the requested system and operation.
2. Confirm the needed tool is available in the current session.
3. For changes, resolve the target with a read, list, search, or inspect call.
4. Use the smallest tool that performs the requested operation.
5. Read the affected record back when the system exposes a read operation.
6. Report the tool result. Do not claim success from an unverified call.

The gateway uses the caller's Entra identity for delegated Microsoft 365
operations. Do not set the compatibility `user` argument. A signed-in Entra
user receives the Microsoft 365 subset. Key Vault, Entra directory, Obsidian,
TickTick, OpenViking, and configured proxy tools require the privileged role
assigned by the gateway.

## Change boundaries

- A request to send, create, update, complete, abandon, move, patch, overwrite,
  or delete authorizes that named action. Otherwise, stop after the read or
  draft stage.
- Before sending mail or Teams messages, verify recipients, destination, and
  final content.
- Before deleting or overwriting, read the exact target and obtain explicit
  authorization when the user did not already request that destructive action.
- Never run mutation calls only to test connectivity.
- Never put returned secret values into notes, messages, logs, examples, or
  source files.
- Do not bypass MCP United with local scripts, direct Graph credentials,
  localhost, or a separate public Obsidian/OpenViking connector.

## System guidance

### Key Vault

Use `keyvault_secret_get` only for a named secret required by an authorized
task. Do not list secrets as exploratory discovery. Use
`keyvault_secret_create` for a new name and `keyvault_secret_update` for an
existing name. Do not rotate, rename, duplicate, or delete credentials unless
explicitly requested.

### Microsoft 365

Use list or search tools to obtain stable message, event, chat, channel, task
list, task, and file IDs before follow-up calls. Keep queries and result limits
bounded to the user's request. Treat mail send/reply, calendar create/delete,
Teams send, task create/complete, and presence set as external changes.

### Entra

The exposed Entra set is read-only: users, groups and members, domains,
licenses, devices, roles and members, and organization details. If a requested
mutation is not in the catalog, report it as unavailable; do not fall back to
raw Graph calls.

### Obsidian

Use `obsidian_periodic` to find or read a daily, weekly, monthly, quarterly, or
yearly note. Before a targeted edit, use `obsidian_note_inspect` with
`view="targets"`. Prefer `obsidian_note_insert` or `obsidian_note_patch` over
full-note overwrite. Preserve existing frontmatter and user-authored prose,
then read the note back.

### TickTick

List projects or tasks before changing an ambiguous task. Prefer IDs returned
by the service when titles collide. Treat create, update, complete, abandon,
and focus-delete as changes.

### OpenViking

The MCP United OpenViking surface is read-only. Use `openviking_find` for fast
semantic retrieval and `openviking_search` when session context or deeper
intent analysis is needed. Stay within the authenticated user's URI scope and
read only canonical `viking://` URIs returned by search or list calls. Use the
code tools for symbols rather than reading an entire repository.

## Proven interaction patterns

- Service smoke test: call `openviking_health` and require a healthy result.
- M365 discovery: use a bounded collection or search call first, then use the
  returned ID for a narrower read or follow-up operation.
- Entra license inspection: call `entra_license_list`, then
  `entra_user_license_list` with the resolved user ID.
- TickTick inspection: call `ticktick_project_list`, then
  `ticktick_task_list` with a project or status filter.
- Daily-note lookup: call `obsidian_periodic` with `action="get"` and
  `period="daily"`; perform any requested calculation on the returned content.
- Obsidian edit: read the note, patch or insert once, then read it again.

The logs contain no successful mutation examples for Microsoft 365, TickTick,
Entra, or Key Vault. Do not describe untested mutations as proven workflows,
and do not run them against production data during installation testing.

## Reflect

- Do not use superseded tool names.
- Do not assume a tool loaded because the plugin is installed; verify discovery
  with one real read-only call.
- Do not assume OAuth completed on another client or device.
- Do not duplicate an operation through both MCP and a local fallback.
- Do not expose internal service credentials or returned secret values.
