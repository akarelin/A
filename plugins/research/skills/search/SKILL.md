---
name: search
description: >
  Search across knowledge sources scoped by ownership level.
  Use when the user says "search for", "find", "look up", "where is",
  "search my email", "search my notes", "search files", or any
  retrieval from connected systems.
metadata:
  id: search
  mcp-united-version: "2.0.0"
---

# Search Knowledge

Route searches across providers by scope.

## Scopes and Providers

| Scope | Providers | What's searched |
|-------|-----------|-----------------|
| my | Obsidian, Microsoft 365, Everything, OpenViking | Personal vault, delegated M365 data, local files, secondary memory |
| team | Microsoft 365 | Teams channels and shared files available to the signed-in user |

## Scope Detection

Detect scope from context:
- "my notes", "my email", "my files" → my
- "our team", "team channel" → team
- Ambiguous → ask user

## Provider Routing

| Provider | How |
|----------|-----|
| Obsidian | MCP United `obsidian_search_text`, `obsidian_search_metadata`, `obsidian_search_regex`, or `obsidian_search_semantic` |
| Microsoft 365 | MCP United `m365_search`, `m365_mail_search`, `m365_file_search`, `m365_chat_search`, or bounded list calls |
| Everything | MCP server `mcp-everything-search` (my scope only) |
| OpenViking | MCP United `openviking_find` or `openviking_search`, followed by `openviking_read` for returned `viking://` URIs |

## Workflow

1. Detect or ask for scope
2. Select providers available for that scope
3. Search only the providers needed for the request; run independent searches in parallel
4. Synthesize results with source attribution
5. Provide citations and links

Keep queries and result limits bounded. Use OpenViking as secondary recall,
not as a replacement for native platform memory. Do not use an M365 file
search merely because files may exist; the request must place that source in
scope. Neo4j data exploration belongs to the separate `data` skill and is not
an MCP United search provider.

## Absorbed Skills
This tool replaces:
- search-everything → `search` with scope `my` and provider `Everything`
- search-m365 → `search` with scope `my` and provider `Microsoft 365`

Slack and Atlassian/Confluence search are no longer supported providers —
those MCP integrations were retired 2026-07-05 (see `plugins/_archived/`).
