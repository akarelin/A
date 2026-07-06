---
name: memory
description: >
  Persist and recall facts, config, and project state.
  Use when the user says "remember this", "save this", "where does X go",
  "archive this project", "add this to daily notes", or any operation involving
  storing or retrieving persistent state. For credentials (API keys, tokens,
  passwords), route to the `secrets` tool in the parent `core` skill instead.
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion]
---

# Memory

Get, set, and save operations on persistent state. All operations happen within a scope.

Secrets/credentials are **not** handled here — see the `secrets` section of the parent `core` skill, which routes to the `secret_*` tools on the MCP United connector (Azure Key Vault).

## Scopes

| Scope | Storage backends | Examples |
|-------|-----------------|----------|
| my | Hindsight (agent memory), Obsidian vault | recalled facts/directives, daily notes, personal config |
| team | shared repos, shared drives | team config |
| project | project repo, project docs | project state, project config |
| company | company systems | company-wide config |

Scope is detected from context or elicited from the user.

## Operations

### get
Recall a fact or piece of state.
- Facts: `hindsight_recall` / `hindsight_reflect` (ranked recall / synthesized answer), Obsidian vault (`note_search` / `note_search_dql`), AGENTS.md, auto-memory
- Config: project files, AGENTS.md locations

### set
Persist a fact or piece of state to the correct location.
1. Identify the entity type (location, config, fact, mistake, etc.)
2. Determine scope (my/team/project/company)
3. Route to the correct backend based on entity type + scope
4. Persist

Known entity → backend mappings:
- Locations → AGENTS.md Locations section
- Recalled facts / mistakes / mental models → `hindsight_retain` / `hindsight_sync_retain` (per-bank via `bank_id`)
- Daily notes → Obsidian vault daily notes (`note_daily_append`)
- Project facts → project docs or AGENTS.md
- Skill metadata → SKILL.md frontmatter

Hindsight tools (`hindsight_bank_list`, `hindsight_directive_list`, `hindsight_mental_model_list`, `hindsight_memory_list`, `hindsight_health`) are reached via the same MCP United connector as everything else in this skill — no separate server.

### save (export/archive)
Bundle a project folder's complete state for handover or archival:
1. Extract git diff history for the folder
2. Find related .claude conversation logs
3. Copy current source snapshot
4. Generate README summary
5. Create .tar.gz archive
6. Optionally push to a target repo

Uses: `scripts/extract-claude-history.py`

## Entity Recognition
Before executing any operation, identify all referenced entities. If any are ambiguous or unrecognized, collect all uncertainties and ask in one batch before proceeding.
