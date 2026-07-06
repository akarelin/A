---
name: search
description: >
  Search across knowledge sources scoped by ownership level.
  Use when the user says "search for", "find", "look up", "where is",
  "search my email", "search my notes", "search files", or any
  retrieval from connected systems.
allowed-tools: [Read, Bash, Grep, Glob, AskUserQuestion]
---

# Search Knowledge

Single tool for searching across providers, parameterized by scope and provider.

## Scopes and Providers

| Scope | Providers | What's searched |
|-------|-----------|-----------------|
| my | Obsidian, m365, Everything, Neo4j | Personal vault, personal email/OneDrive/calendar, local files, knowledge graph |
| team | m365, Neo4j | Teams channels, shared drives, knowledge graph |
| company | m365 | Company-wide M365 (mail, files, sites) |

## Scope Detection

Detect scope from context:
- "my notes", "my email", "my files" → my
- "our team", "team channel" → team
- "company docs", "company wiki" → company
- Ambiguous → ask user

## Provider Routing

| Provider | How |
|----------|-----|
| Obsidian | MCP United `note_search` / `note_search_dql` (my scope only) |
| m365 | Graph API search via work-m365 script, or MCP United's `search`/`files_search` tools |
| Everything | MCP server `mcp-everything-search` (my scope only) |
| Neo4j | MCP United — Cypher queries on knowledge graph (my, team scopes) |

## Workflow

1. Detect or ask for scope
2. Select providers available for that scope
3. Search in parallel across selected providers
4. Synthesize results with source attribution
5. Provide citations and links

## Absorbed Skills
This tool replaces:
- search-everything → search-knowledge scope:my provider:Everything
- search-m365 → search-knowledge scope:my provider:m365

Slack and Atlassian/Confluence search are no longer supported providers —
those MCP integrations were retired 2026-07-05 (see `plugins/_archived/`).
