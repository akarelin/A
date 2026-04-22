"""Write_to_memory stage — write analyzed session summaries into
~/.openclaw/memory/<agent>.sqlite so OpenClaw agents' memory search can
find them.

v1 strategy (FTS-only):
  - INSERT into `files` with source='session-intel', content sha256 hash.
  - Chunk the analyzed markdown by `## ` headings (fallback: whole file).
  - INSERT each chunk into `chunks` (embedding = JSON "[]" placeholder) and
    `chunks_fts` (keyword search populated).
  - SKIP `chunks_vec` — OpenClaw memory-core uses 1536-dim OpenAI embeddings;
    local `nomic-embed-text` is 768-dim. v2 will either add an OpenAI embed
    call or a 1536-dim local model.

Chunk ID follows memory-core's convention:
  sha256(f"{source}:{path}:{start}:{end}:{hash}:{model}")

Idempotent: files.path is PRIMARY KEY; re-running on same file updates
the row but avoids duplicate chunks via the same ID formula.
"""
from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import time
from pathlib import Path

from ..orchestrator import StageResult
from ..store import SessionStore


SOURCE_TAG = "session-intel"
CHUNK_MODEL = "session-intel-markdown"  # logical marker; not a real embed model


def _chunk_by_heading(markdown: str) -> list[tuple[int, int, str]]:
    """Return [(start_line, end_line, text), ...] split at `## ` headings.

    Line numbers are 1-indexed, matching memory-core's convention.
    """
    lines = markdown.splitlines()
    heading_indices = [i for i, ln in enumerate(lines) if ln.startswith("## ")]
    if not heading_indices:
        # No headings → one chunk of the whole file
        return [(1, len(lines), markdown)]
    chunks: list[tuple[int, int, str]] = []
    # Optional preamble before the first heading (frontmatter + title)
    if heading_indices[0] > 0:
        pre = "\n".join(lines[: heading_indices[0]])
        chunks.append((1, heading_indices[0], pre))
    for idx, start in enumerate(heading_indices):
        end = heading_indices[idx + 1] if idx + 1 < len(heading_indices) else len(lines)
        text = "\n".join(lines[start:end])
        chunks.append((start + 1, end, text))
    return chunks


def _hash_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _chunk_id(path: str, start: int, end: int, chunk_hash: str) -> str:
    return _hash_text(f"{SOURCE_TAG}:{path}:{start}:{end}:{chunk_hash}:{CHUNK_MODEL}")


def _write_to_db(db_path: Path, rec_id: str, analyzed_path: str, markdown: str) -> int:
    """Insert file + chunks rows. Returns chunk count."""
    file_hash = _hash_text(markdown)
    mtime_ms = int(time.time() * 1000)
    size = len(markdown)

    chunks = _chunk_by_heading(markdown)

    con = sqlite3.connect(str(db_path))
    try:
        cur = con.cursor()
        cur.execute("PRAGMA foreign_keys=OFF")

        # files row (upsert on path PK)
        cur.execute(
            "INSERT INTO files (path, source, hash, mtime, size) "
            "VALUES (?, ?, ?, ?, ?) "
            "ON CONFLICT(path) DO UPDATE SET "
            "  source=excluded.source, hash=excluded.hash, "
            "  mtime=excluded.mtime, size=excluded.size",
            (analyzed_path, SOURCE_TAG, file_hash, mtime_ms, size),
        )

        # chunks + chunks_fts
        count = 0
        for start, end, text in chunks:
            if not text.strip():
                continue
            chash = _hash_text(text)
            cid = _chunk_id(analyzed_path, start, end, chash)
            cur.execute(
                "INSERT INTO chunks (id, path, source, start_line, end_line, "
                " hash, model, text, embedding, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET "
                "  hash=excluded.hash, model=excluded.model, "
                "  text=excluded.text, embedding=excluded.embedding, "
                "  updated_at=excluded.updated_at",
                (cid, analyzed_path, SOURCE_TAG, start, end, chash, CHUNK_MODEL,
                 text, "[]", mtime_ms),
            )
            # FTS insert — delete-then-insert pattern to keep it idempotent
            cur.execute("DELETE FROM chunks_fts WHERE id = ?", (cid,))
            cur.execute(
                "INSERT INTO chunks_fts (text, id, path, source, model, start_line, end_line) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (text, cid, analyzed_path, SOURCE_TAG, CHUNK_MODEL, start, end),
            )
            count += 1

        con.commit()
        return count
    finally:
        con.close()


def run(store: SessionStore, cfg: dict, *,
        limit: int | None = None,
        dry_run: bool = False,
        force: bool = False,
        source: str | None = None,
        source_id: str | None = None,
        **_: object) -> StageResult:
    result = StageResult(stage="write_to_memory")

    eligible = ["analyzed"] if not force else ["analyzed", "memorized"]
    records = store.select_by_state(eligible, limit=limit, source=source)

    for rec in records:
        if source_id is not None and rec.source_id != source_id:
            continue
        # Only OpenClaw sessions have an agent memory SQLite to write to
        if rec.source != "openclaw" or not rec.agent:
            result.skipped += 1
            continue

        analyzed = rec.paths.get("analyzed_md")
        if not analyzed:
            # no analyzed content — nothing to write
            rec.transition("memorized", stage="write_to_memory", notes="no-analyzed")
            store.upsert(rec)
            result.skipped += 1
            continue

        analyzed_path = Path(analyzed)
        if not analyzed_path.exists():
            result.errors += 1
            continue

        db_path = Path.home() / ".openclaw" / "memory" / f"{rec.agent}.sqlite"
        if not db_path.exists():
            # agent memory DB not initialized — don't create one; log and skip
            print(f"[write_to_memory] no memory DB for agent={rec.agent}; skipping")
            result.skipped += 1
            continue

        if dry_run:
            print(f"[write_to_memory] would write {rec.source_id[:8]} → {db_path.name}")
            result.processed += 1
            continue

        try:
            markdown = analyzed_path.read_text()
            n_chunks = _write_to_db(db_path, rec.id, str(analyzed_path), markdown)
            rec.paths["memory_db"] = str(db_path)
            rec.paths["memory_chunk_count"] = n_chunks
            rec.transition("memorized", stage="write_to_memory",
                           notes=f"chunks={n_chunks}")
            store.upsert(rec)
            result.processed += 1
        except Exception as e:
            print(f"[write_to_memory] ERROR on {rec.source_id[:8]}: {e}")
            result.errors += 1

    return result
