# akarelin — Claude Code Plugin Marketplace

Personal productivity plugins for Claude Code.

## Installation

```bash
# Add the marketplace
/plugin marketplace add akarelin/AGENTS.md

# Browse available plugins
/plugin marketplace list akarelin

# Install individual plugins
/plugin install core@akarelin
/plugin install research@akarelin
/plugin install work@akarelin
/plugin install organize@akarelin
/plugin install manage@akarelin
/plugin install administer@akarelin
```

## Available Plugins (6)

| Plugin | Skills | Description |
|--------|--------|-------------|
| **core** | secrets, memory, session, skill, compose-agent, learn | Agent primitives: secrets (Key Vault), memory, sessions, skill management, agent composition |
| **research** | search, data (data-neo4j) | Search + data exploration: knowledge search, Neo4j |
| **work** | work-m365, work-ticktick | Workplace: M365, TickTick |
| **organize** | organize-arxiv, organize-scan-medical | File organizer (arxiv papers, medical scans) |
| **manage** | session, skill | Session and skill management |
| **administer** | admin-m365, admin-portainer | Cloud admin: M365 tenant + Portainer stack deploys |

## Plugin Details

### core
- **secrets** — Azure Key Vault (`karelin`) via Karelin Keys MCP: get/list/save/update credentials
- **memory** — Persist and recall facts, state across sessions
- **session** — Claude Code sessions: sync, list, resume, rename, cleanup
- **skill** — Plugin skills: review feedback, patch, test, rebuild, deploy
- **compose-agent** — Create managed agents from multiple agents/skills (local + cloud)

### research
- **search** — Multi-provider search (Obsidian, m365, Everything, Neo4j) scoped by ownership
- **data** — Interactive data exploration
  - **data-neo4j** — Neo4j graph via Neo4j MCP: schema, Cypher queries, auto-discovers servers from Key Vault

(`data-sql`, and the search skill's Slack/Atlassian providers, retired 2026-07-05 — not in use.)

### work
- **work-m365** — M365 via Graph API: Mail, Calendar, Teams, Files, Tasks, Contacts, Presence
- **work-ticktick** — TickTick via self-hosted MCP: tasks, projects, focus sessions

(`work-slack`, `work-atlassian` retired 2026-07-05, `work-google` retired 2026-07-06 — none in use.)

### organize
- **organize-arxiv** — arxiv PDFs: identify, fetch metadata, rename, move to library
- **organize-scan-medical** — medical scans → bilingual EN/RU Obsidian vault

### manage
- **session** — Claude Code sessions: sync, list, resume, rename, cleanup
- **skill** — Plugin skills: review feedback, patch, test, rebuild, deploy

### administer
- **admin-m365** — M365 tenant admin: Users, Groups, Teams, Licenses, Audit, Security
- **admin-portainer** — Portainer Docker stack deploys for the karel.in fleet

(`admin-gcp` retired 2026-07-06 — GCP not in use.)
