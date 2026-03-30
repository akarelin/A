---
name: search
description: >
  This skill should be used when the user asks to "search for files",
  "find a file", "search emails", "search m365", "search OneDrive",
  "search SharePoint", "find in Microsoft 365", or wants to search
  across local files or Microsoft 365 entities.
version: 0.1.0
---

# Search

Meta-skill that routes to the appropriate search sub-skill.

## Sub-skills

| Sub-skill | Scope | How |
|-----------|-------|-----|
| search-everything | Local files (Windows) | MCP server via voidtools Everything |
| search-m365 | Microsoft 365 (emails, files, events, chat, SharePoint) | Graph `/search/query` API via work-m365 script |

## Routing

- **Local file search** → use the `search-everything` MCP tools directly (search_files, search_with_filters, search_regex, etc.)
- **Microsoft 365 search** → read the `search-m365` sub-skill SKILL.md and follow its CLI instructions
- **Ambiguous** → ask the user whether they mean local files or M365
