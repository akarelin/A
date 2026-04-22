"""Review stage — collect low-confidence / ambiguous / borderline decisions
from other stages into ~/.sessionskills/review_queue.json for HITL handling.

Sources of review items:
  1. `name` stage: classification.confidence below threshold (not currently
     written by name; LLM slug returns are all-or-nothing, so confidence is
     implicit). v1 leaves this empty.
  2. `merge` stage: ambiguous merges (e.g., topic-suffix chains without
     strong similarity). v1 flags nothing here.
  3. `classify` stage: classification.confidence < threshold.
  4. `prune` stage: borderline prunes where age > prune_age_days but
     importance == 1 (marginal call).

v1 scans current store state and appends missing items. Resumable: items
with status='pending' persist until the user processes them.
"""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

from .. import config as cfgmod
from ..orchestrator import StageResult
from ..store import SessionStore


def _atomic_write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".review-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def _load_queue(path: Path) -> dict:
    if not path.exists():
        return {"version": 1, "items": []}
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return {"version": 1, "items": []}


def run(store: SessionStore, cfg: dict, *,
        limit: int | None = None,
        dry_run: bool = False,
        force: bool = False,
        source: str | None = None,
        source_id: str | None = None,
        **_: object) -> StageResult:
    result = StageResult(stage="review")

    queue_path = Path(cfgmod.expand(cfg["store"]["review_queue"]))
    queue = _load_queue(queue_path)
    existing_keys = {
        (it.get("kind"), tuple(it.get("record_ids", [])))
        for it in queue["items"]
        if it.get("status") == "pending"
    }

    thresh_classify = cfg.get("thresholds", {}).get("classify_min_confidence", 0.65)

    # Scan 'classified' records for low classify confidence
    for rec in store.select_by_state(["classified"], limit=limit, source=source):
        if source_id is not None and rec.source_id != source_id:
            continue
        conf = rec.classification.get("confidence")
        if isinstance(conf, (int, float)) and conf < thresh_classify:
            key = ("low_confidence_classification", (f"{rec.source}:{rec.source_id}",))
            if key in existing_keys:
                continue
            queue["items"].append({
                "kind": "low_confidence_classification",
                "record_ids": [f"{rec.source}:{rec.source_id}"],
                "proposal": {
                    "project": rec.classification.get("work_atom_project"),
                    "topic_slug": rec.classification.get("topic_slug"),
                    "category": rec.classification.get("category"),
                },
                "confidence": conf,
                "status": "pending",
                "created_at": rec.last_updated,
            })
            result.to_review += 1

    if dry_run:
        return result

    _atomic_write(queue_path, queue)
    pending = sum(1 for it in queue["items"] if it.get("status") == "pending")
    print(f"[review] pending items: {pending} (new: {result.to_review})")
    return result
