"""Name stage — wrap qmd-sessions-rename with --llm so each session gets a
descriptive parallel symlink.

Per source:
  claude-code   → ~/.claude/projects/<slug>/sessions-named/<rename>.jsonl
  openclaw      → ~/.openclaw/agents/<agent>/sessions-named/<rename>.jsonl

After invocation, scan the sessions-named/ dirs and write the resulting
filename back to each record as `paths.symlink_name`, then transition to
state='named'.

Idempotent: rename_sessions.py handles existing symlinks gracefully; this
stage just re-reads the landing pad.
"""
from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

from ..orchestrator import StageResult
from ..store import SessionStore


RENAME_SCRIPT = "/Users/alex/SD.agents/skills/qmd-sessions-rename/scripts/rename_sessions.py"
UUID8_RE = re.compile(r"__([0-9a-f]{8})(?=\.[^.]+$)")


def _invoke_rename(source: str, target: str | None, llm: bool,
                   host: str, model: str, dry_run: bool,
                   timeout: int = 21600) -> tuple[int, str, str]:
    """Invoke rename_sessions.py. 6-hour default timeout tolerates a full
    LLM run over thousands of sessions. On TimeoutExpired, returns rc=-1 and
    whatever output accumulated."""
    cmd = ["python3", RENAME_SCRIPT, "--source", source]
    if target is None:
        cmd.append("--all")
    else:
        cmd.append(f"--target={target}")
    if llm:
        cmd.extend(["--llm", "--ollama-host", host, "--ollama-model", model])
    if dry_run:
        cmd.append("--dry-run")
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired as e:
        return -1, e.stdout or "", (e.stderr or "") + f"\n[timeout after {timeout}s]"


def _index_symlinks(root: Path) -> dict[str, str]:
    """Scan `sessions-named/` under root and map uuid8 → full filename."""
    out: dict[str, str] = {}
    if not root.is_dir():
        return out
    for child in root.iterdir():
        if not child.is_symlink():
            continue
        m = UUID8_RE.search(child.name)
        if m:
            out[m.group(1)] = str(child)
    return out


def _collect_named_openclaw() -> dict[tuple[str, str], str]:
    """Map (agent, uuid8) → symlink path for every OpenClaw agent."""
    result: dict[tuple[str, str], str] = {}
    base = Path.home() / ".openclaw" / "agents"
    if not base.is_dir():
        return result
    for agent_dir in base.iterdir():
        if not agent_dir.is_dir():
            continue
        for uuid8, path in _index_symlinks(agent_dir / "sessions-named").items():
            result[(agent_dir.name, uuid8)] = path
    return result


def _collect_named_claude_code() -> dict[tuple[str, str], str]:
    """Map (project_slug, uuid8) → symlink path for every Claude Code project."""
    result: dict[tuple[str, str], str] = {}
    base = Path.home() / ".claude" / "projects"
    if not base.is_dir():
        return result
    for slug_dir in base.iterdir():
        if not slug_dir.is_dir():
            continue
        for uuid8, path in _index_symlinks(slug_dir / "sessions-named").items():
            result[(slug_dir.name, uuid8)] = path
    return result


def run(store: SessionStore, cfg: dict, *,
        limit: int | None = None,
        dry_run: bool = False,
        force: bool = False,
        source: str | None = None,
        source_id: str | None = None,
        **_: object) -> StageResult:
    result = StageResult(stage="name")

    host = cfg["llm"]["host"]
    model = cfg["llm"]["model_chat"]

    # Invoke rename_sessions.py once per source kind (covers all agents/projects)
    for src_kind, rs_source in (("openclaw", "openclaw-jsonl"), ("claude-code", "claude-code")):
        if source is not None and source != src_kind:
            continue
        rc, out, err = _invoke_rename(rs_source, None, llm=True,
                                      host=host, model=model, dry_run=dry_run)
        # rename_sessions.py writes summary to stderr; stdout carries per-file lines
        if rc != 0 and "No source dirs" not in err:
            print(f"[name] rename_sessions rc={rc} stderr tail:\n{err[-500:]}")
            result.errors += 1

    if dry_run:
        # In dry-run we didn't actually create symlinks; just count candidates
        result.processed = sum(1 for r in store.select_by_state(["merged"])
                               if r.source in ("openclaw", "claude-code"))
        return result

    # Build uuid-prefix indexes of what rename_sessions.py produced
    oc_index = _collect_named_openclaw()
    cc_index = _collect_named_claude_code()

    # Update records
    eligible = ["merged"] if not force else ["merged", "named"]
    records = store.select_by_state(eligible, limit=limit, source=source)
    for rec in records:
        if source_id is not None and rec.source_id != source_id:
            continue

        uuid8 = rec.source_id[:8]
        symlink = None
        if rec.source == "openclaw" and rec.agent:
            symlink = oc_index.get((rec.agent, uuid8))
        elif rec.source == "claude-code" and rec.project:
            symlink = cc_index.get((rec.project, uuid8))

        if symlink:
            rec.paths["symlink_name"] = symlink
            # Extract slug + category from the filename:
            # <YYYY-MM-DD>_<category>_<slug>__<uuid8>.<ext>
            m = re.match(
                r"(?P<date>\d{4}-\d{2}-\d{2})_(?P<cat>[^_]+)_(?P<slug>.+)__[0-9a-f]{8}\.",
                Path(symlink).name,
            )
            if m:
                rec.classification.setdefault("category", m.group("cat"))
                rec.classification.setdefault("topic_slug", m.group("slug"))
            rec.transition("named", stage="name", notes=os.path.basename(symlink))
            store.upsert(rec)
            result.processed += 1
        else:
            # Session was skipped by rename_sessions (too short, no title, etc.)
            # Still transition so downstream stages can see it; leave no symlink.
            rec.transition("named", stage="name", notes="skipped-by-rename")
            store.upsert(rec)
            result.skipped += 1

    return result
