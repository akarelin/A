"""Prune stage — move session files that meet prune criteria into a
timestamped trash dir alongside a recovery manifest.

Criteria (any single one triggers prune):
  - classification.duplicate_of is set
  - classification.is_trivial = true
  - (classification.importance <= 1) AND (age > thresholds.prune_age_days)
  - turn_count <= 1 AND age > thresholds.prune_age_days

Destinations:
  claude-code  → ~/SD/.claude/.trash/<YYYYMMDDTHHMMSS>/
  openclaw     → ~/.openclaw/agents/<agent>/.trash/<YYYYMMDDTHHMMSS>/

Each batch writes a `.trash-manifest.json` listing original paths, record
IDs, and the reason for pruning, so a recovery command can restore them.

Nothing is deleted permanently — user can `mv` files back.

Idempotent: records already in state='pruned' are skipped.
"""
from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from ..orchestrator import StageResult
from ..record import SessionRecord
from ..store import SessionStore


def _age_days(started_at: str | None) -> float | None:
    if not started_at:
        return None
    try:
        dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
    except ValueError:
        return None
    return (datetime.now(timezone.utc) - dt).total_seconds() / 86400.0


def _should_prune(rec: SessionRecord, prune_age_days: int) -> str | None:
    """Return a human-readable reason if the record should be pruned, else None."""
    cls = rec.classification or {}
    if cls.get("duplicate_of"):
        return f"duplicate_of={cls['duplicate_of']}"
    if cls.get("is_trivial"):
        return "is_trivial"
    age = _age_days(rec.started_at)
    if age is None:
        return None
    imp = cls.get("importance")
    if isinstance(imp, (int, float)) and imp <= 1 and age > prune_age_days:
        return f"low-importance(imp={imp},age={age:.0f}d)"
    if rec.turn_count is not None and rec.turn_count <= 1 and age > prune_age_days:
        return f"thin(turns={rec.turn_count},age={age:.0f}d)"
    return None


def _trash_root(rec: SessionRecord) -> Path | None:
    if rec.source == "claude-code":
        return Path.home() / "SD" / ".claude" / ".trash"
    if rec.source == "openclaw" and rec.agent:
        return Path.home() / ".openclaw" / "agents" / rec.agent / ".trash"
    return None


def run(store: SessionStore, cfg: dict, *,
        limit: int | None = None,
        dry_run: bool = False,
        force: bool = False,
        source: str | None = None,
        source_id: str | None = None,
        **_: object) -> StageResult:
    result = StageResult(stage="prune")

    prune_age = int(cfg.get("thresholds", {}).get("prune_age_days", 30))
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")

    eligible = ["classified", "clustered", "memorized", "analyzed", "named", "merged"] if not force \
        else ["classified", "pruned"]
    records = store.select_by_state(eligible, limit=limit, source=source)

    # Group by trash dir so we write one manifest per batch
    trash_batches: dict[str, list[tuple[SessionRecord, str]]] = {}
    for rec in records:
        if source_id is not None and rec.source_id != source_id:
            continue
        reason = _should_prune(rec, prune_age)
        if not reason:
            continue
        tr = _trash_root(rec)
        if tr is None:
            result.skipped += 1
            continue
        key = str(tr / stamp)
        trash_batches.setdefault(key, []).append((rec, reason))

    for trash_dir_str, batch in trash_batches.items():
        trash_dir = Path(trash_dir_str)
        if dry_run:
            print(f"[prune] would move {len(batch)} files to {trash_dir}")
            for rec, reason in batch[:5]:
                print(f"  {rec.source}:{rec.source_id[:8]} ({reason})")
            result.processed += len(batch)
            continue

        trash_dir.mkdir(parents=True, exist_ok=True)
        manifest = {
            "version": 1,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "items": [],
        }
        for rec, reason in batch:
            raw = rec.paths.get("raw_jsonl")
            if not raw or not Path(raw).exists():
                result.skipped += 1
                continue
            dest = trash_dir / Path(raw).name
            try:
                shutil.move(raw, dest)
            except OSError as e:
                print(f"[prune] failed to move {raw}: {e}")
                result.errors += 1
                continue
            # Also move the symlink if any
            symlink = rec.paths.get("symlink_name")
            if symlink and Path(symlink).is_symlink():
                try:
                    Path(symlink).unlink()
                except OSError:
                    pass
            manifest["items"].append({
                "record_id": rec.id,
                "source": rec.source,
                "source_id": rec.source_id,
                "agent": rec.agent,
                "project": rec.project,
                "original_path": raw,
                "trash_path": str(dest),
                "reason": reason,
                "classification": rec.classification,
            })
            rec.paths["trash_path"] = str(dest)
            rec.paths.pop("raw_jsonl", None)
            rec.transition("pruned", stage="prune", notes=reason)
            store.upsert(rec)
            result.processed += 1

        if manifest["items"]:
            manifest_path = trash_dir / ".trash-manifest.json"
            manifest_path.write_text(json.dumps(manifest, indent=2))

    return result
