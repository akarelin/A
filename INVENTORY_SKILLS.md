# `~/A` Skills Inventory

_Generated 2026-05-20 for kanban task t_1cba250b._

**Total skills:** 32 across 7 plugin dirs (7 dirs; 6 published to `akarelin/A` marketplace, 1 unpublished).
- Published to marketplace: **31** skills (22 prod / 5 WIP / 4 stub)
- Unpublished (in repo but absent from `marketplace.json`): **1** skill(s)
- Completeness mix: 23 prod / 5 WIP-or-light / 4 stub

Marketplace source-of-truth: `.claude-plugin/marketplace.json` (6 plugins: `core`, `manage`, `organize`, `work`, `administer`, `research`).

## Skills table

| # | Skill | Plugin | Published | Completeness | Words | External deps | Purpose |
|---|-------|--------|-----------|--------------|-------|---------------|---------|
| 1 | `admin-gcp` | administer | ✅ | prod | 173 | MCP:M365 Admin | Google Cloud Platform administration |
| 2 | `admin-m365` | administer | ✅ | prod | 472 | MCP:M365 Admin | Microsoft 365 tenant administration via Graph beta API |
| 3 | `admin-portainer` | administer | ✅ | prod | 669 | MCP:M365 Admin | Portainer-based Docker stack deployments |
| 4 | `administer` | administer | ✅ | WIP/light | 95 | MCP:M365 Admin | Cloud and tenant administration router |
| 5 | `agent` | core | ✅ | stub | 11 | MCP:Karelin Keys | Agent coordination and management |
| 6 | `compose-agent` | core | ✅ | prod | 1178 | MCP:Karelin Keys | Create an agent from multiple existing agents or skills |
| 7 | `core` | core | ✅ | stub | 333 | MCP:Karelin Keys | Core agent primitives |
| 8 | `learn` | core | ✅ | stub | 13 | MCP:Karelin Keys | Learn from feedback, corrections, and mistakes |
| 9 | `memory` | core | ✅ | prod | 281 | MCP:Karelin Keys | Persist and recall facts, config, and project state |
| 10 | `session` | core | ✅ | WIP/light | 110 | MCP:Karelin Keys | This skill should be used when the user asks to "manage sessions", "sync sessions", "li... |
| 11 | `skill` | core | ✅ | prod | 565 | MCP:Karelin Keys | Manage and improve Cowork plugin skills end-to-end |
| 12 | `rewrite-history` | develop | ❌ | prod | 866 | — | Rewrite git history across one or many repos: collapse author/committer identities via ... |
| 13 | `manage` | manage | ✅ | WIP/light | 66 | — | This skill should be used when the user asks to manage Claude Code sessions (list, resu... |
| 14 | `organize` | organize | ✅ | prod | 248 | — | This skill should be used when the user asks to "organize files", "triage a folder", "c... |
| 15 | `organize-arxiv` | organize | ✅ | prod | 259 | — | This skill should be used when the user asks to "organize arxiv papers", "rename PDFs",... |
| 16 | `organize-scan` | organize | ✅ | stub | 27 | — | Route scan-type organization tasks to the appropriate sub-skill |
| 17 | `organize-scan-medical` | organize | ✅ | prod | 385 | — | Process medical scan images into a structured, bilingual Obsidian vault |
| 18 | `data` | research | ✅ | WIP/light | 80 | MCP:Neo4j+Obsidian+M365+atlassian+search-everything | Data exploration across databases |
| 19 | `data-neo4j` | research | ✅ | prod | 180 | MCP:Neo4j+Obsidian+M365+atlassian+search-everything | Neo4j graph database exploration via Cypher |
| 20 | `data-sql` | research | ✅ | prod | 183 | MCP:Neo4j+Obsidian+M365+atlassian+search-everything | Relational database exploration via SQL |
| 21 | `research` | research | ✅ | WIP/light | 65 | MCP:Neo4j+Obsidian+M365+atlassian+search-everything | Research router |
| 22 | `search` | research | ✅ | prod | 267 | MCP:Neo4j+Obsidian+M365+atlassian+search-everything | Search across knowledge sources scoped by ownership level |
| 23 | `work` | work | ✅ | prod | 143 | MCP:M365+slack+atlassian | This skill should be used when the user asks to "check my email", "send a message on Sl... |
| 24 | `work-atlassian` | work | ✅ | prod | 124 | MCP:M365+slack+atlassian | This skill should be used when the user mentions Jira, Confluence, Atlassian, asks to "... |
| 25 | `work-atlassian-capture` | work | ✅ | prod | 2253 | MCP:M365+slack+atlassian | Analyze meeting notes to find action items and create Jira tasks for assigned work |
| 26 | `work-atlassian-spec` | work | ✅ | prod | 2402 | MCP:M365+slack+atlassian | Automatically convert Confluence specification documents into structured Jira backlogs ... |
| 27 | `work-atlassian-status` | work | ✅ | prod | 1547 | MCP:M365+slack+atlassian | Generate project status reports from Jira issues and publish to Confluence |
| 28 | `work-atlassian-triage` | work | ✅ | prod | 2672 | MCP:M365+slack+atlassian | Intelligently triage bug reports and error messages by searching for duplicates in Jira... |
| 29 | `work-google` | work | ✅ | prod | 280 | MCP:M365+slack+atlassian | Personal Google account operations |
| 30 | `work-m365` | work | ✅ | prod | 686 | MCP:M365+slack+atlassian | User-level Microsoft 365 operations via Graph beta API |
| 31 | `work-slack` | work | ✅ | prod | 158 | MCP:M365+slack+atlassian | This skill should be used when the user mentions Slack, asks to "send a Slack message",... |
| 32 | `work-ticktick` | work | ✅ | prod | 245 | MCP:M365+slack+atlassian | Manage TickTick tasks and projects |

## Per-plugin notes

### Published (marketplace)

- **`core`** (11 skills under core/) — Core agent primitives — memory, session, skill management, agent composition, learn-from-corrections. **Mixed completeness: 4 stubs (`agent`, `core`, `learn`, and arguably `session`) sit next to substantial skills (`compose-agent` 1178w, `skill` 565w).** Stubs would mislead Claude if surfaced as-is. MCP dep: `Karelin Keys` (private to alex).
- **`manage`** (1 skill) — Single `manage` router skill (66w). Light but coherent — points at session/skill subcommands. No external deps.
- **`organize`** (4 skills) — Router + arxiv + scan + scan-medical. All prod-grade and self-contained. No MCP deps; bundles its own scripts/commands. **Most marketplace-ready cluster.**
- **`work`** (9 skills) — Largest cluster. Atlassian sub-skills are exceptionally detailed (1.5k–2.7k words each). MCP deps: `M365`, `slack`, `atlassian` — all hosted at `mcp.karelin.ai` (private) or 3rd-party OAuth. **Public usability blocked by private MCP endpoints.**
- **`administer`** (4 skills) — M365 admin + GCP + Portainer + router. Prod-grade. MCP dep: `M365 Admin` (private at `mcp.karelin.ai`).
- **`research`** (6 skills (nested)) — Search + data router with nested `data-neo4j`, `data-sql` sub-skills. Prod-grade. MCP deps: `Neo4j`, `Obsidian`, `M365`, `atlassian` (mostly private).

### Unpublished

- **`develop`** (1 skill: `rewrite-history`, 866w prod-grade) — sits under `plugins/develop/` but is NOT listed in `marketplace.json` and lacks `.claude-plugin/plugin.json`. Either intentionally private (dangerous-by-design git history rewriter) or simply forgotten. **Decision needed: publish, gate, or move out of `plugins/`.**

## Summary — marketplace readiness

Of 32 skills in 7 plugin dirs, 31 are published to the `akarelin/A` marketplace via 6 plugins; one (`rewrite-history`) is in-tree but unpublished. Quality is bimodal: ~22 are production-grade (≥120 words, structured workflows, especially the `work-atlassian-*` family at 1.5k–2.7k words each), while `core` carries **4 visible stubs** (`agent`, `core`, `learn`, and 11-word `agent`) that would mislead Claude if invoked. Public usability is further constrained by **private MCP endpoints** (`mcp.karelin.ai/*` requiring `MCP_KARELIN_TOKEN`) wired into `core`, `administer`, `research`, and `work` — external users installing these plugins would hit auth failures unless they swap in their own MCP hosts. Net assessment: **the `organize` plugin is ship-ready as-is; `work`/`administer`/`research`/`core` need MCP-endpoint genericization and stub-skill remediation before surfacing publicly.**
