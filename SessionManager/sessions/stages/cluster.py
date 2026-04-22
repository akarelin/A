"""Cluster stage — run theme-tracker/extract_themes.py over analyzed
session-intel, then read back themes.json and attach theme_id to each
record in classification.theme_id.

extract_themes.py uses local sentence-transformers (all-MiniLM-L6-v2),
so no cloud LLM is needed for this stage. It also does not need Ollama.

Idempotent: extract_themes.py refuses to overwrite themes.json without
--force; we pass --force when the caller passes force=True, otherwise
just re-read the existing themes.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from ..orchestrator import StageResult
from ..store import SessionStore


EXTRACT_THEMES = "/Users/alex/_/{internals}/Skills/theme-tracker/extract_themes.py"
THEMES_JSON = Path("/Users/alex/_/{internals}/Skills/theme-tracker/themes.json")


def _run_extract(force: bool, dry_run: bool) -> int:
    cmd = ["python3", EXTRACT_THEMES]
    if force:
        cmd.append("--force")
    if dry_run:
        cmd.append("--dry-run")
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    if proc.returncode != 0:
        print(f"[cluster] extract_themes rc={proc.returncode}\n{proc.stderr[-500:]}")
    return proc.returncode


def _build_session_to_theme() -> dict[str, str]:
    """Return a map of session_id → theme_id from themes.json."""
    if not THEMES_JSON.exists():
        return {}
    data = json.loads(THEMES_JSON.read_text())
    mapping: dict[str, str] = {}
    for theme in data:
        tid = theme.get("theme_id") or theme.get("id") or theme.get("name")
        if not tid:
            continue
        for s in theme.get("sessions", []):
            sid = s.get("session_id") if isinstance(s, dict) else s
            if sid:
                mapping[sid] = tid
    return mapping


def run(store: SessionStore, cfg: dict, *,
        limit: int | None = None,
        dry_run: bool = False,
        force: bool = False,
        source: str | None = None,
        source_id: str | None = None,
        **_: object) -> StageResult:
    result = StageResult(stage="cluster")

    # Run the clustering pipeline once (batch operation)
    rc = _run_extract(force=force, dry_run=dry_run)
    if rc != 0:
        result.errors = 1
        return result

    if dry_run:
        return result

    # Attach theme_id to records
    mapping = _build_session_to_theme()
    eligible = ["analyzed", "memorized"] if not force else ["analyzed", "memorized", "clustered"]
    for rec in store.select_by_state(eligible, limit=limit, source=source):
        if source_id is not None and rec.source_id != source_id:
            continue
        tid = mapping.get(rec.source_id)
        if tid:
            rec.classification["theme_id"] = tid
            rec.transition("clustered", stage="cluster", notes=tid)
            store.upsert(rec)
            result.processed += 1
        else:
            # No theme yet (e.g., too small cluster) — still advance
            rec.transition("clustered", stage="cluster", notes="no-theme")
            store.upsert(rec)
            result.skipped += 1

    return result
