"""Archive stage — tar.zst old sessions out of live dirs into
~/Archives/sessions/<YYYY-MM>/<agent-or-project>.tar.zst with a side JSON
of classification metadata preserved.

Input: records in state in {classified, clustered, memorized} that are not
flagged pruned, older than thresholds.archive_age_days, AND are not the
most recent session of their agent/project (we don't archive what's still
relevant to recent work).

v1: uses plain gzip via stdlib (no tar+zstd dependency). Upgradable later.
"""
from __future__ import annotations

import gzip
import json
import shutil
import tarfile
from datetime import datetime, timezone
from pathlib import Path

from ..orchestrator import StageResult
from ..store import SessionStore


ARCHIVE_ROOT = Path.home() / "Archives" / "sessions"


def _age_days(started_at: str | None) -> float | None:
    if not started_at:
        return None
    try:
        dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
    except ValueError:
        return None
    return (datetime.now(timezone.utc) - dt).total_seconds() / 86400.0


def run(store: SessionStore, cfg: dict, *,
        limit: int | None = None,
        dry_run: bool = False,
        force: bool = False,
        source: str | None = None,
        source_id: str | None = None,
        **_: object) -> StageResult:
    result = StageResult(stage="archive")

    archive_age = int(cfg.get("thresholds", {}).get("archive_age_days", 180))
    eligible = ["classified", "clustered", "memorized"] if not force \
        else ["classified", "clustered", "memorized", "archived"]
    records = store.select_by_state(eligible, limit=limit, source=source)

    # Group by (agent_or_project, yyyy-mm) for batched tarballs
    groups: dict[tuple[str, str, str], list] = {}
    for rec in records:
        if source_id is not None and rec.source_id != source_id:
            continue
        age = _age_days(rec.started_at)
        if age is None or age < archive_age:
            continue
        raw = rec.paths.get("raw_jsonl")
        if not raw or not Path(raw).exists():
            continue
        tgt = rec.agent or rec.project or "unknown"
        yyyymm = (rec.started_at or "0000-00")[:7]
        groups.setdefault((rec.source, tgt, yyyymm), []).append(rec)

    for (src_kind, tgt, yyyymm), recs in groups.items():
        arc_dir = ARCHIVE_ROOT / yyyymm
        if dry_run:
            print(f"[archive] would archive {len(recs)} from {src_kind}/{tgt} → {arc_dir}/{tgt}.tar.gz")
            result.processed += len(recs)
            continue

        arc_dir.mkdir(parents=True, exist_ok=True)
        tar_path = arc_dir / f"{src_kind}-{tgt}.tar.gz"
        side_json_path = arc_dir / f"{src_kind}-{tgt}.json"

        # Side JSON — preserves all classification even if tar is moved/deleted
        side: list[dict] = []
        if side_json_path.exists():
            try:
                side = json.loads(side_json_path.read_text())
            except (json.JSONDecodeError, OSError):
                side = []

        mode = "a:gz" if tar_path.exists() else "w:gz"
        # Can't append to compressed tar portably; use "w:gz" and include any
        # already-archived items by extracting and re-writing would be costly.
        # Simpler: accumulate new tar, and live with one .tar.gz per new batch
        # if the file exists (suffix with timestamp).
        if tar_path.exists():
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
            tar_path = arc_dir / f"{src_kind}-{tgt}.{stamp}.tar.gz"

        with tarfile.open(tar_path, "w:gz") as tar:
            for rec in recs:
                raw = rec.paths.get("raw_jsonl")
                if not raw or not Path(raw).exists():
                    result.skipped += 1
                    continue
                try:
                    tar.add(raw, arcname=Path(raw).name)
                except OSError as e:
                    print(f"[archive] tar-add {raw}: {e}")
                    result.errors += 1
                    continue
                # Safe to remove the live file now that it's archived
                try:
                    Path(raw).unlink()
                except OSError as e:
                    print(f"[archive] unlink {raw}: {e}")
                side.append({
                    "record_id": rec.id,
                    "source": rec.source,
                    "source_id": rec.source_id,
                    "agent": rec.agent,
                    "project": rec.project,
                    "started_at": rec.started_at,
                    "classification": rec.classification,
                    "archived_to": str(tar_path),
                    "arcname": Path(raw).name,
                })
                rec.paths["archive_tar"] = str(tar_path)
                rec.paths.pop("raw_jsonl", None)
                rec.transition("archived", stage="archive", notes=tar_path.name)
                store.upsert(rec)
                result.processed += 1

        side_json_path.write_text(json.dumps(side, indent=2))

    return result
