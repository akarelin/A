# Karelin Plugin Marketplace

Version 2.0.0. Personal plugins for ChatGPT, Codex, and Claude.

## Installation

```bash
# Add the Claude marketplace
claude plugin marketplace add akarelin/A

# Browse available plugins
claude plugin marketplace list karelin

# Install individual plugins
claude plugin install core@karelin --scope user
claude plugin install research@karelin --scope user
claude plugin install work@karelin --scope user
claude plugin install organize@karelin --scope user
claude plugin install develop@karelin --scope user
claude plugin install manage@karelin --scope user
claude plugin install administer@karelin --scope user
claude plugin install mcp-united@karelin --scope user

# Add MCP United to Codex
codex plugin marketplace add akarelin/A
codex plugin add mcp-united@karelin
```

ChatGPT and Claude web/desktop users add `akarelin/A` as a personal
marketplace, install MCP United, start a new chat, and complete Entra
authentication.

## Available Plugins (8)

| Plugin | Skills | Description |
|--------|--------|-------------|
| **core** | secrets, memory, session, skill, compose-agent, learn | Agent primitives: secrets (Key Vault), memory, sessions, skill management, agent composition |
| **research** | search, data (data-neo4j) | Search + data exploration: knowledge search, Neo4j |
| **work** | work-m365, work-ticktick | Workplace: M365, TickTick |
| **organize** | organize-arxiv, organize-scan-medical | File organizer (arxiv papers, medical scans) |
| **manage** | session, skill | Session and skill management |
| **develop** | gppu, rewrite-history | Developer tooling |
| **administer** | admin-m365, admin-portainer | Read-only Entra directory inspection + Portainer stack deploys |
| **mcp-united** | mcp-united | Entra-authenticated unified MCP connection and canonical tool guidance |

## Plugin Details

### core
- **secrets** — Azure Key Vault (`karelin`) via MCP United canonical Key Vault tools
- **memory** — Persist and recall facts, state across sessions
- **session** — Claude Code sessions: sync, list, resume, rename, cleanup
- **skill** — Plugin skills: review feedback, patch, test, rebuild, deploy
- **compose-agent** — Create managed agents from multiple agents/skills (local + cloud)

### research
- **search** — Multi-provider search (Obsidian, Microsoft 365, Everything, OpenViking) scoped by ownership
- **data** — Interactive data exploration
  - **data-neo4j** — Neo4j graph via Neo4j MCP: schema, Cypher queries, auto-discovers servers from Key Vault

(`data-sql`, and the search skill's Slack/Atlassian providers, retired 2026-07-05 — not in use.)

### work
- **work-m365** — M365 via MCP United: Mail, Calendar, Teams, Files, Tasks, Contacts, Presence
- **work-ticktick** — TickTick via MCP United: tasks, projects, focus sessions

(`work-slack`, `work-atlassian` retired 2026-07-05, `work-google` retired 2026-07-06 — none in use.)

### organize
- **organize-arxiv** — arxiv PDFs: identify, fetch metadata, rename, move to library
- **organize-scan-medical** — medical scans → bilingual EN/RU Obsidian vault

### manage
- **session** — Claude Code sessions: sync, list, resume, rename, cleanup
- **skill** — Plugin skills: review feedback, patch, test, rebuild, deploy

### administer
- **admin-m365** — Read-only Entra users, groups, licenses, devices, roles, domains, and organization details
- **admin-portainer** — Portainer Docker stack deploys for the karel.in fleet

(`admin-gcp` retired 2026-07-06 — GCP not in use.)

### mcp-united
- **mcp-united** — Canonical workflows for the 2.0.0 MCP United catalog

After installation, start a new task or session and verify OAuth plus tool
loading with one real read-only call such as `openviking_health`.

The `core` and `research` bundles contain pre-2.0 direct `.mcp.json`
connector definitions. They are not part of the MCP United plugin and may
expose duplicate native-name tools when installed alongside it.
