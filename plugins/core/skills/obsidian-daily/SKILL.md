---
name: obsidian-daily
description: "Read and write Alex's Obsidian daily note using the admonition convention. Use to: log agent activity, ask Alex questions, read today's context, record summaries, warnings, or decisions. All LLM-authored content uses gray admonitions (from-llm, response, by-llm); human content uses colored admonitions (prompt, msg, question, info)."
argument-hint: "<action> [args]"
allowed-tools:
  - Bash
---

# obsidian-daily — Obsidian Daily Note Integration

Read and write Alex's Obsidian vault daily notes using the established admonition convention.
Used for async communication with Alex, logging agent activity, and persisting context across sessions.

## Admonition Convention

### LLM-authored (gray family — reserved for agent output)

| Admonition | Color | When to use |
|-----------|-------|-------------|
| `ad-from-llm` | Dark gray | Agent → Alex: messages, findings, notifications |
| `ad-response` | Light gray | LLM reply to a specific prompt |
| `ad-by-llm` | Medium gray | LLM-generated knowledge (facts, summaries) |

### Human-authored (colored)

| Admonition | Color | When to use |
|-----------|-------|-------------|
| `ad-prompt` | — | Human prompt sent to LLM (log what was asked) |
| `ad-msg-alex` | — | Alex's own message |
| `ad-question` | — | Agent asking Alex for input |
| `ad-info` | Blue | Informational status update |
| `ad-summary` | Green | Lesson learned, summary |
| `ad-warning` | Orange | Warning requiring attention |

## Note Locations

- **Chmo notes** (agent-specific): `_/Agents/Chmo/Alex/YYYY-MM-DD.md` — preferred for agent interactions
- **Daily notes** (general): `_/Daily Notes/YYYY-MM-DD.md` — for broader daily context

## Setup

```bash
SKILL_DIR="${CLAUDE_PLUGIN_ROOT}/skills/obsidian-daily/scripts"
export OBSIDIAN_VAULT="/Users/alex/_"
export OBSIDIAN_AGENT="System"
# OBSIDIAN_KEY is auto-detected from plugin data.json
```

## Commands

### Log to today's note

```bash
# Agent sends a message to Alex (from-llm — dark gray, timestamped)
python3 $SKILL_DIR/log.py from-llm "Here is what I found..." "System Agent"

# Log an LLM response (light gray)
python3 $SKILL_DIR/log.py response "The answer is..."

# Log a prompt (what was asked of the LLM)
python3 $SKILL_DIR/log.py prompt "What are the top 3 risks?"

# Info update (blue, timestamped)
python3 $SKILL_DIR/log.py info "QMD embedding complete: 4207/4207 chunks" "Embedding done"

# Summary/lesson
python3 $SKILL_DIR/log.py summary "Metal GPU crashes on M4 Pro with Qwen3-4B — use QMD_LLAMA_GPU=false" "M4 Metal bug"

# Warning
python3 $SKILL_DIR/log.py warning "Netdata alarms are false positives from mounted DMGs"

# Question for Alex
python3 $SKILL_DIR/ask.py "Should port 18789 be forwarded externally or routed through /gateway?"
```

### Read today's note

```bash
# Read Chmo note (agent interactions)
python3 $SKILL_DIR/read.py

# Read main daily note
python3 $SKILL_DIR/read.py --daily

# Last 50 lines for context
python3 $SKILL_DIR/read.py --tail 50

# Specific date
python3 $SKILL_DIR/read.py 2026-05-01
```

## Typical Agent Patterns

### Pattern 1: Log completion and findings

```bash
SKILL_DIR="${CLAUDE_PLUGIN_ROOT}/skills/obsidian-daily/scripts"
python3 $SKILL_DIR/log.py from-llm \
  "Task complete. Found 55 easy migrations, 40 medium, 30 keep-local. CRUFT_MIGRATION.md written." \
  "Cruft migration analysis"
```

### Pattern 2: Read context before responding

```bash
SKILL_DIR="${CLAUDE_PLUGIN_ROOT}/skills/obsidian-daily/scripts"
# Get last 100 lines of today's Chmo note for context
CONTEXT=$(python3 $SKILL_DIR/read.py --tail 100)
echo "Context from today's note:"
echo "$CONTEXT"
```

### Pattern 3: Ask Alex a question and wait

```bash
SKILL_DIR="${CLAUDE_PLUGIN_ROOT}/skills/obsidian-daily/scripts"
python3 $SKILL_DIR/ask.py \
  "Should I migrate the Airflow factory DAG system to Windmill, or just the individual pipelines?\n\nOptions:\n- A) Migrate factory (complex, 2-3 weeks)\n- B) Migrate individual pipelines only (simpler, 1 week)\n- C) Defer Airflow migration entirely" \
  "❓ Cruft migration — Airflow factory decision"
```

### Pattern 4: Log prompt + response pair

```bash
SKILL_DIR="${CLAUDE_PLUGIN_ROOT}/skills/obsidian-daily/scripts"
python3 $SKILL_DIR/log.py prompt "What does the OpenClaw diagnostics-otel plugin drop before exporting?"
python3 $SKILL_DIR/log.py response \
  "It drops: openclaw.callId, openclaw.parentSpanId, openclaw.runId, openclaw.sessionId, openclaw.sessionKey, openclaw.spanId, openclaw.toolCallId, openclaw.traceId — hardcoded in DROPPED_OTEL_ATTRIBUTE_KEYS."
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OBSIDIAN_API` | `http://localhost:27123` | REST API base URL |
| `OBSIDIAN_KEY` | auto-detected | API key (from plugin data.json) |
| `OBSIDIAN_VAULT` | `/Users/alex/_` | Vault root path |
| `OBSIDIAN_CHMO_DIR` | `Agents/Chmo/Alex` | Chmo notes subfolder |
| `OBSIDIAN_DAILY_DIR` | `Daily Notes` | Main daily notes subfolder |
| `OBSIDIAN_AGENT` | `System` | Agent display name in admonitions |

## Notes

- The Obsidian Local REST API runs at `http://localhost:27123` (insecure) when Obsidian is open
- If Obsidian is closed, all writes fail gracefully (non-fatal for most agent tasks)
- Timestamps use local time (HH:MM format in admonition titles)
- Notes are created automatically if they don't exist (with correct frontmatter)
- All content visible immediately in Obsidian without reload
