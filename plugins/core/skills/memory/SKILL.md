---
name: memory
description: >
  Persist and recall facts, config, and project state.
  Use when the user says "remember this", "save this", "where does X go",
  "archive this project", "add this to daily notes", or any operation involving
  storing or retrieving persistent state. For credentials (API keys, tokens,
  passwords), route to the secrets section of the parent `core` skill instead.
metadata:
  id: memory
  mcp-united-version: "2.0.0"
---

# Memory

Get, set, and save operations on persistent state. All operations happen within a scope.

Each platform's native memory remains authoritative. OpenViking is a secondary
read-only recall layer and does not replace or relocate native memory.

Secrets and credentials are not handled here. Route a named, authorized
credential request to the parent `core` skill and its canonical
`keyvault_secret_*` tools.

## Scopes

| Scope | Storage backends | Examples |
|-------|-----------------|----------|
| my | Native platform memory, OpenViking projection, Obsidian vault | recalled facts, daily notes, personal config |
| team | shared repos, shared drives | team config |
| project | project repo, project docs | project state, project config |
| company | company systems | company-wide config |

Scope is detected from context or elicited from the user.

## Operations

### get
Recall a fact or piece of state.
- Native facts: use the current platform's native memory first.
- Secondary recall: use `openviking_find` or `openviking_search`, then read only
  canonical `viking://` URIs returned by those tools.
- Vault facts: use `obsidian_search_text`, `obsidian_search_metadata`,
  `obsidian_search_regex`, or `obsidian_search_semantic`, followed by
  `obsidian_note_read`.
- Config: project files, AGENTS.md locations

### set
Persist a fact or piece of state to the correct location.
1. Identify the entity type (location, config, fact, mistake, etc.)
2. Determine scope (my/team/project/company)
3. Route to the correct backend based on entity type + scope
4. Persist

Known entity → backend mappings:
- Locations → AGENTS.md Locations section
- Recalled facts, mistakes, and mental models → native platform memory
- Daily notes → `obsidian_periodic` plus `obsidian_note_insert` or
  `obsidian_note_patch`
- Project facts → project docs or AGENTS.md
- Skill metadata → SKILL.md frontmatter

MCP United exposes OpenViking as read-only. Do not attempt to retain, upload,
promote, or edit memory through it. Released client integrations own capture,
and a local-resource upload is a snapshot rather than a live filesystem mount.

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
