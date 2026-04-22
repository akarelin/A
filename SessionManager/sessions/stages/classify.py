"""Classify stage — wrap work-atoms/classify.py with the local Ollama
backend (via SESSION_INFER_BACKEND=ollama env flag).

work-atoms/classify.py reads analyzed session-intel files, uses
_common.infer_text() to classify into a project, then updates the
appropriate atoms file and state.json. We just set the env flag and
invoke.

After the batch run, read classification/state.json to attach
work_atom_project to each record.
"""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

from ..orchestrator import StageResult
from ..store import SessionStore


CLASSIFY = "/Users/alex/_/{internals}/Skills/work-atoms/classify.py"
STATE_FILE = Path("/Users/alex/_/{internals}/classification/state.json")


def _run_classify(force: bool, dry_run: bool, host: str, model: str) -> int:
    cmd = ["python3", CLASSIFY]
    if force:
        cmd.append("--force")
    if dry_run:
        cmd.append("--dry-run")
    env = os.environ.copy()
    env["SESSION_INFER_BACKEND"] = "ollama"
    env.setdefault("OLLAMA_HOST", host)
    env.setdefault("OLLAMA_MODEL", model)
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=14400, env=env)
    if proc.returncode != 0:
        print(f"[classify] work-atoms rc={proc.returncode}\n{proc.stderr[-500:]}")
    return proc.returncode


def _load_state() -> dict:
    if not STATE_FILE.exists():
        return {}
    try:
        return json.loads(STATE_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


def run(store: SessionStore, cfg: dict, *,
        limit: int | None = None,
        dry_run: bool = False,
        force: bool = False,
        source: str | None = None,
        source_id: str | None = None,
        **_: object) -> StageResult:
    result = StageResult(stage="classify")

    host = cfg["llm"]["host"]
    model = cfg["llm"]["model_chat"]

    rc = _run_classify(force=force, dry_run=dry_run, host=host, model=model)
    if rc != 0:
        result.errors = 1
        return result

    if dry_run:
        return result

    # state.json schema (from work-atoms/classify.py):
    # { "processed": { "<session_id>": { "project": "Agents", ... } } }
    state = _load_state()
    processed_map = state.get("processed", {}) if isinstance(state, dict) else {}

    eligible = ["clustered", "analyzed", "memorized"] if not force \
        else ["clustered", "analyzed", "memorized", "classified"]
    for rec in store.select_by_state(eligible, limit=limit, source=source):
        if source_id is not None and rec.source_id != source_id:
            continue
        info = processed_map.get(rec.source_id)
        if isinstance(info, dict):
            project = info.get("project")
            if project:
                rec.classification["work_atom_project"] = project
            for key in ("importance", "tags", "confidence"):
                if key in info:
                    rec.classification[key] = info[key]
            rec.transition("classified", stage="classify", notes=project or "")
            store.upsert(rec)
            result.processed += 1
        else:
            rec.transition("classified", stage="classify", notes="no-state-entry")
            store.upsert(rec)
            result.skipped += 1

    return result
