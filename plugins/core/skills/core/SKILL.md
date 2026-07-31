---
name: core
description: >
  Core agent primitives. Use when the agent needs to manage secrets,
  memorize/recall facts, manage sessions, manage skills, coordinate agents,
  or learn from feedback.
metadata:
  id: core
  mcp-united-version: "2.0.0"
---

# Core

Foundational tools for agent self-management. These are primitives consumed by other plugins.

## Tools

| Tool | Scope | Description |
|------|-------|-------------|
| secrets | Azure Key Vault (`karelin`) | get, list, save, update — API keys, tokens, credentials |
| memory | my/team/project/company | Get, set, save — persist and recall facts, state |
| session | — | Sync, list, resume, rename, delete Claude Code sessions |
| skill | — | Patch, test, deploy skills |
| compose-agent | — | Create a managed agent from multiple existing agents/skills |
| learn | — | Learn from feedback and mistakes (stub) |

## Secrets

Secrets live in the `karelin` Azure Key Vault and are accessed through MCP
United. Use only canonical tool names:

| MCP tool | Use when |
|----------|----------|
| `keyvault_secret_get` | Read a named credential required by the authorized task. |
| `keyvault_secret_list` | List secret names only when the user explicitly requests the inventory. |
| `keyvault_secret_create` | Store a new credential under a user-approved name. |
| `keyvault_secret_update` | Change an existing named credential when the user explicitly requests it. |

Never list secrets for exploratory discovery. Never echo returned values into
notes, chat, logs, examples, or source files. Do not rotate, rename, duplicate,
delete, or migrate credentials unless the user explicitly requests that
action. Resolve an approved secret name from the consuming configuration or
ask when it cannot be determined.

## Routing

- **"get/set secret", API keys, tokens, credentials** → secrets
- **"remember this", "save this", "where does X go"** → memory
- **"list sessions", "resume session", "sync"** → session
- **"fix skill", "deploy plugin", "patch"** → skill
- **"create agent", "combine agents", "compose agent"** → compose-agent
- **"I corrected you", mistakes, feedback** → learn
