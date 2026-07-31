---
name: obsidian-daily
description: >
  Read or update Alex's Obsidian daily note through MCP United while
  preserving the established admonition convention and user-authored text.
  Use for today's context, requested activity notes, summaries, warnings,
  decisions, or questions recorded in the daily note.
metadata:
  id: obsidian-daily
  mcp-united-version: "2.0.0"
---

# Obsidian Daily Note

Use MCP United's canonical Obsidian tools. Do not use localhost, a local vault
path, a plugin data file, or a bundled script.

## Admonition Convention

### LLM-authored

| Admonition | Color | When to use |
|-----------|-------|-------------|
| `ad-from-llm` | Dark gray | Agent → Alex: messages, findings, notifications |
| `ad-response` | Light gray | LLM reply to a specific prompt |
| `ad-by-llm` | Medium gray | LLM-generated knowledge (facts, summaries) |

### Human-authored

| Admonition | Color | When to use |
|-----------|-------|-------------|
| `ad-prompt` | — | Human prompt sent to LLM (log what was asked) |
| `ad-msg-alex` | — | Alex's own message |
| `ad-question` | — | Agent asking Alex for input |
| `ad-info` | Blue | Informational status update |
| `ad-summary` | Green | Lesson learned, summary |
| `ad-warning` | Orange | Warning requiring attention |

Do not relabel or rewrite existing human-authored admonitions.

## Read workflow

1. Call `obsidian_periodic` with `action="get"` and `period="daily"`.
2. Supply a date only when the user requested a date other than today.
3. Use the returned content for the requested answer or calculation.
4. Do not modify the note unless the user requested a write.

## Write workflow

1. Resolve today's note with `obsidian_periodic`.
2. Read it with `obsidian_note_read`.
3. If the insertion point is structural, call `obsidian_note_inspect` with
   `view="targets"`.
4. Use `obsidian_note_insert` or `obsidian_note_patch` for the smallest
   requested change. Use `obsidian_note_write` only when the user explicitly
   requested a full-note replacement.
5. Read the note again and verify the requested text is present once.

Preserve frontmatter, headings, links, formatting, and user-authored prose.
Do not duplicate a breadcrumb that already exists. Never expose credentials
or returned secret values in a daily note.

## Admonition shape

When the user requests an LLM-authored entry, preserve this form:

```text
> [!ad-from-llm] <title>
> <content>
```

The proven remote interaction sequence is read → patch or insert → read.
Creation, deletion, movement, and full overwrite are not installation tests.
