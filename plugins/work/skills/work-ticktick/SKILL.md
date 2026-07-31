---
name: work-ticktick
description: >
  Use TickTick through MCP United to list projects and tasks, create or update
  tasks, complete or abandon tasks, and inspect or delete focus records.
  Invoke for TickTick, to-do, project, task, due-date, priority, or focus-time
  requests.
metadata:
  id: work-ticktick
  mcp-united-version: "2.0.0"
---

# TickTick through MCP United

Requires the MCP United 2.0.0 plugin. Do not retrieve TickTick OAuth
credentials or run the bundled direct API script.

## Tool map

| Area | Canonical tools |
|---|---|
| Projects and tasks | `ticktick_project_list`, `ticktick_task_list`, `ticktick_task_create`, `ticktick_task_update`, `ticktick_task_complete`, `ticktick_task_abandon` |
| Focus records | `ticktick_focus_list`, `ticktick_focus_get`, `ticktick_focus_delete` |

## Workflow

1. Call `ticktick_project_list` to resolve the project name or ID.
2. Call `ticktick_task_list` with a project and, when requested, `pending` or
   `completed` status.
3. When task titles collide, use the returned task ID for changes.
4. For create or update, preserve the user's title, content, priority, due
   expression, and tags exactly as requested. Supported priorities are
   `none`, `low`, `medium`, and `high`.
5. Treat create, update, complete, abandon, and focus-delete as changes. Do not
   perform one unless the user asked for that operation.
6. List or read the affected task or focus record after a change when possible.

`ticktick_focus_list` accepts a date range of at most 30 days and a type of
`pomo`, `timing`, or `all`. `ticktick_focus_get` and
`ticktick_focus_delete` require both the focus ID and its type.

## Observed successful patterns

Recent logs successfully called `ticktick_project_list` and filtered
`ticktick_task_list`. They contain no successful create, update, complete,
abandon, or focus-delete call. Do not present mutation examples as tested and
never use production tasks to validate installation.
