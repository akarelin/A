"""Merge stage — detect session groups across `.reset.*` / `.deleted.*`
snapshots, topic-suffix variants (`<uuid>-topic-<ts>.jsonl`), and (v2)
subagent trees.

v1 scope:
  - OpenClaw: find sibling `<uuid>.jsonl.reset.<iso>` / `.deleted.<iso>` files
    for each live record and record them under `paths.snapshots`.
  - Topic-suffix grouping: ingest already sets `session_group` for
    `-topic-<ts>` files; merge verifies and ensures the base record also
    carries the same `session_group`.
  - Subagent detection: scan first few lines for `[Subagent Task]` wrapper;
    if present, mark classification.is_subagent=True. Linking subagent
    children to their parent is v2 (requires walking OpenClaw's subagents
    runs.json).

Transitions: state ingested → merged (even if no group found).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from .. import config as cfgmod
from ..orchestrator import StageResult
from ..record import SessionRecord
from ..store import SessionStore


RESET_SUFFIX_RE = re.compile(r"\.jsonl\.(reset|deleted)\.(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(?:\.\d+)?Z?)(?:\.md)?$")
SUBAGENT_MARKER_RE = re.compile(r"\[Subagent Task\]", re.IGNORECASE)


def _find_snapshots(base_jsonl: Path) -> list[str]:
    """Return paths to `.jsonl.reset.<ts>` / `.jsonl.deleted.<ts>` siblings."""
    if not base_jsonl.exists():
        return []
    parent = base_jsonl.parent
    stem = base_jsonl.stem  # e.g., 'f873a988-...' (no .jsonl extension)
    snapshots = []
    for sibling in parent.iterdir():
        if not sibling.is_file():
            continue
        name = sibling.name
        if not name.startswith(stem + ".jsonl."):
            continue
        m = RESET_SUFFIX_RE.search(name)
        if m:
            snapshots.append(str(sibling))
    return sorted(snapshots)


def _is_subagent(jsonl_path: Path) -> bool:
    """Sniff first few user-message lines for `[Subagent Task]` wrapper."""
    try:
        with open(jsonl_path, "rb") as f:
            for i, line in enumerate(f):
                if i > 30:
                    return False
                try:
                    entry = json.loads(line)
                except (json.JSONDecodeError, UnicodeDecodeError):
                    continue
                msg = entry.get("message") or {}
                content = msg.get("content") or ""
                if isinstance(content, list):
                    content = " ".join(
                        p.get("text", "") for p in content if isinstance(p, dict)
                    )
                if isinstance(content, str) and SUBAGENT_MARKER_RE.search(content):
                    return True
    except OSError:
        pass
    return False


def run(store: SessionStore, cfg: dict, *,
        limit: int | None = None,
        dry_run: bool = False,
        force: bool = False,
        source: str | None = None,
        source_id: str | None = None,
        **_: object) -> StageResult:
    result = StageResult(stage="merge")

    eligible_states = ["ingested", "orphan_snapshot"] if not force \
        else ["ingested", "orphan_snapshot", "merged"]
    records = store.select_by_state(eligible_states, limit=limit, source=source)

    for rec in records:
        if source_id is not None and rec.source_id != source_id:
            continue

        # Orphans use snapshot_jsonl; live records use raw_jsonl.
        raw = rec.paths.get("raw_jsonl") or rec.paths.get("snapshot_jsonl")
        if not raw:
            result.skipped += 1
            continue

        jsonl_path = Path(raw)
        changed = False

        # Snapshots (reset / deleted)
        snapshots = _find_snapshots(jsonl_path) if rec.source == "openclaw" else []
        if snapshots:
            rec.paths["snapshots"] = snapshots
            changed = True

        # Subagent detection
        if rec.source == "openclaw" and jsonl_path.exists() and jsonl_path.stat().st_size > 0:
            if _is_subagent(jsonl_path):
                rec.classification["is_subagent"] = True
                # Group all subagents under a meta group if not already grouped
                if rec.session_group is None:
                    rec.session_group = f"openclaw:subagent:{rec.agent}"
                changed = True

        if dry_run:
            if changed:
                print(f"[merge] would update {rec.source}:{rec.source_id[:8]} "
                      f"snapshots={len(snapshots)} subagent={rec.classification.get('is_subagent', False)}")
            rec.transition("merged", stage="merge", notes="dry-run")
            result.processed += 1
            continue

        rec.transition("merged", stage="merge",
                       notes=f"snapshots={len(snapshots)}")
        store.upsert(rec)
        result.processed += 1

    return result
