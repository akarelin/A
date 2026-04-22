# ADR: SessionSkills — Unified Local-LLM Session Pipeline

**Status:** Implemented (2026-04-21). 10 stages code-complete; v1 feature set.
**Authors:** Alex Karelin; Claude Opus 4.7.

## Context

Alex runs a multi-agent stack on macOS — OpenClaw/chmo (16+ agents), Claude Code across many worktrees, self-hosted Langfuse at `langfuse.karelin.ai`. Every LLM interaction produces session artifacts in heterogeneous shapes and locations (`.jsonl`, `.md`, `.reset.*`, `-topic-*`, per-agent SQLite memory, `sessions.json` indexes, Obsidian vault notes). Several skills touch this surface — overlapping, diverging, each doing part of the job — and every classification/summarization step calls the cloud.

Prior-art inventory:
- `SessionManager/` — Langfuse deposit hook + TUI (github.com/akarelin/SessionManager)
- `qmd-sessions-rename` — heuristic renamer with an `--llm` stub never filled
- `session-intel` — deep cloud-LLM analyzer
- `claude-sessions` — 3-step index/analyze/cleanup
- `theme-tracker`, `work-atoms`, `obsidian-ops` — supporting skills

No orchestration glue. No canonical record. No local LLM.

## Decision

Grow `/Users/alex/A/SessionManager/` (umbrella `akarelin/AGENTS.md` repo) into **SessionSkills** — an orchestration + local-LLM layer that **wraps** existing skills via subprocess rather than rewriting them. Introduce one canonical SQLite record store keyed by `(source, source_id)` and a state-machine-driven pipeline.

### Key choices

1. **Wrap, don't rewrite.** Existing skills keep their SKILL.md so Claude Code / chmo auto-discover them. SessionSkills owns no end-user logic — just orchestration.
2. **One canonical store.** `~/.sessionskills/store.sqlite`, single `records` table, state machine, JSON column for flex fields. Indexed by source/state/agent/project/started_at/session_group. Not a replacement for `docs/schema.sql` (future Postgres multi-user design).
3. **Ollama + Qwen3-8B + nomic-embed-text.** Local, no data egress, HTTP client via `urllib` (no new deps). Qwen3 reasoning disabled per-request (`think: false`) because default reasoning tokens drain `num_predict` before any response is emitted.
4. **Fallback chain.** `LocalLLM.available()` → `CloudLLM` (Vertex/Anthropic) → heuristic or skip-and-retry-later. No stage silently fails.
5. **Never destructive.** Rename = symlink. Prune = move to `.trash/<ts>/` with recovery manifest. Archive = `tar.gz` + side JSON. Symlinks in parallel directories preserve every owning tool's UUID-based lookup.
6. **Idempotent stages.** Work-claim by `(source, source_id)`. Re-run = no-op. `WHERE state IN (…)` everywhere. Content hash guards mid-write files.

### Stage contract

```python
def run(store, cfg, *, limit=None, dry_run=False, force=False,
        source=None, source_id=None) -> StageResult
```

`StageResult = {processed, skipped, errors, to_review}`.

### Patches to existing skills

All three patches are additive + env-gated. Default cloud behavior unchanged when no env flag is set.

- `rename_sessions.py` — `--llm` flag + `_llm_slug()` via urllib + `think: false`.
- `session-intel/llm-analyze.py` — `--backend=ollama` + lazy Gemini import + `analyze_with_ollama()`.
- `obsidian-ops/_common.py` — `SESSION_INFER_BACKEND=ollama` env route + `call_ollama()`.

## Consequences

**Positive:**
- Single source of truth for "what LLM sessions does Alex have" across all tools.
- Zero cloud LLM spend for routine classification/summarization.
- Every session discoverable via semantic symlinks rather than UUIDs.
- OpenClaw agents can find their own prior conversations via FTS in per-agent memory SQLite.
- Full lifecycle owned: ingest → prune/archive with audit trail.

**Negative / followups:**
- **1536 vs 768 embedding dim mismatch** — OpenClaw memory-core vector index is OpenAI 1536-dim; local nomic is 768-dim. v1 write_to_memory skips `chunks_vec` (FTS only). v2 needs either opt-in OpenAI embed call or a 1536-dim local model.
- **Two SessionManager copies diverge** — A/SessionManager has an older `session-to-langfuse.py` than RAN/AI. One-time sync pending.
- **Venv duplication** — `bin/sm-pipeline` currently shells into `RAN/AI/SessionManager/.venv/`. Long-term: A-local venv.
- **Qwen3-8B quality < Gemini-2.5-flash** on structured analysis. Good enough for v1; a 14B model would close the gap at 2× runtime.

## Alternatives considered

- **Grow RAN/AI/SessionManager instead** — it's the canonical copy with the most recent Langfuse work. Rejected because user explicitly chose A as the long-term home (umbrella AGENTS.md repo).
- **New top-level `SessionSkills/` project** — rejected: duplicates the venv/config surface SessionManager already has.
- **llama.cpp / MLX instead of Ollama** — Ollama won on install simplicity (`brew install`) and HTTP API ubiquity. MLX is a v2 option if throughput matters more.
- **Postgres operational store** — overkill for a single-user local workflow; `docs/schema.sql` kept as the future-multi-user design but not implemented.

## Verification (end-to-end)

```bash
sm-pipeline doctor           # verify ollama + store
sm-pipeline run ingest       # scan filesystem, populate records
sm-pipeline run merge        # detect session groups
sm-pipeline run name         # LLM slug + parallel symlink
sm-pipeline run analyze      # session-intel → local LLM summary
sm-pipeline run write_to_memory  # chunks → OpenClaw agent SQLite
sm-pipeline run cluster      # sentence-transformers theme extraction
sm-pipeline run classify     # work-atoms project assignment
sm-pipeline run review       # collect HITL items
sm-pipeline stats            # final per-state counts
```

Idempotence: running `sm-pipeline run all` a second time yields `processed=0 skipped=N` per stage.
