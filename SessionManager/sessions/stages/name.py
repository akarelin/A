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


def _reconcile_target(store: SessionStore, src_kind: str, target: str,
                      index: dict[tuple[str, str], str],
                      result: StageResult) -> None:
    """Update store records for one agent/project based on on-disk symlinks.
    Called after rename_sessions.py finishes a target; also usable standalone
    for a pure reconcile-from-filesystem run (no subprocess)."""
    eligible = ["merged", "ingested", "orphan_snapshot", "named"]
    records = store.select_by_state(eligible, source=src_kind)
    for rec in records:
        target_field = rec.agent if src_kind == "openclaw" else rec.project
        if target_field != target:
            continue
        uuid8 = rec.source_id[:8]
        symlink = index.get((target, uuid8))
        if symlink:
            rec.paths["symlink_name"] = symlink
            m = re.match(
                r"(?P<date>\d{4}-\d{2}-\d{2})_(?P<cat>[^_]+)_(?P<slug>.+)__[0-9a-f]{8}\.",
                Path(symlink).name,
            )
            if m:
                rec.classification.setdefault("category", m.group("cat"))
                rec.classification.setdefault("topic_slug", m.group("slug"))
            if rec.state != "named":
                rec.transition("named", stage="name", notes=os.path.basename(symlink))
            store.upsert(rec)
            result.processed += 1
        elif rec.state != "named":
            rec.transition("named", stage="name", notes="skipped-by-rename")
            store.upsert(rec)
            result.skipped += 1


def _enumerate_targets(store: SessionStore, src_kind: str,
                       eligible_states: list[str]) -> list[str]:
    """Unique agents (for openclaw) or projects (for claude-code) from store."""
    out: set[str] = set()
    for rec in store.select_by_state(eligible_states, source=src_kind):
        tgt = rec.agent if src_kind == "openclaw" else rec.project
        if tgt:
            out.add(tgt)
    return sorted(out)


def run(store: SessionStore, cfg: dict, *,
        limit: int | None = None,
        dry_run: bool = False,
        force: bool = False,
        source: str | None = None,
        source_id: str | None = None,
        reconcile_only: bool = False,
        **_: object) -> StageResult:
    """Per-target invocation + checkpoint. A failure or timeout in one target
    only loses that target's progress; already-completed targets stay `named`.

    Additional flag `reconcile_only`: skip subprocess invocation entirely and
    just scan on-disk symlinks to catch up the store (useful after an
    interrupted external run).
    """
    result = StageResult(stage="name")
    host = cfg["llm"]["host"]
    model = cfg["llm"]["model_chat"]
    eligible = ["merged", "orphan_snapshot"] if not force \
        else ["merged", "orphan_snapshot", "named"]

    for src_kind, rs_source in (("openclaw", "openclaw-jsonl"),
                                ("claude-code", "claude-code")):
        if source is not None and source != src_kind:
            continue

        targets = _enumerate_targets(store, src_kind, eligible)
        if not targets:
            continue

        for target in targets:
            if dry_run:
                print(f"[name] would invoke rename for {src_kind}/{target}")
                continue

            if not reconcile_only:
                rc, _out, err = _invoke_rename(
                    rs_source, target, llm=True,
                    host=host, model=model, dry_run=False,
                )
                if rc != 0 and "No source dirs" not in err and \
                        "not found under" not in err:
                    print(f"[name] {src_kind}/{target} rc={rc}: {err[-300:]}")
                    result.errors += 1
                    # Still try to reconcile partial progress before moving on
            # Reconcile this target right away so progress survives interruption
            if src_kind == "openclaw":
                idx = _collect_named_openclaw()
            else:
                idx = _collect_named_claude_code()
            before = result.processed + result.skipped
            _reconcile_target(store, src_kind, target, idx, result)
            delta = result.processed + result.skipped - before
            print(f"[name] {src_kind}/{target}: +{delta} records reconciled")

            if limit is not None and result.processed >= limit:
                return result

    return result


# Legacy single-uuid fast path kept for --source-id use (only reconciles one rec)
def _legacy_single(store: SessionStore, cfg: dict, source: str, source_id: str,
                   result: StageResult) -> None:
    if source == "openclaw":
        idx = _collect_named_openclaw()
    else:
        idx = _collect_named_claude_code()
    rec = store.get(source, source_id)
    if rec is None:
        return
    tgt = rec.agent if source == "openclaw" else rec.project
    if tgt:
        _reconcile_target(store, source, tgt, idx, result)
