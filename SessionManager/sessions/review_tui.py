"""Minimal HITL review TUI.

v1: plain stdin/stdout — stays dependency-free (no Textual).
v2: promote to Textual TUI that matches sm-tui.py styling.

Iterates pending items in ~/.sessionskills/review_queue.json.
For each: prints context, asks y/n/e/s/q; persists decision.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

from . import config as cfgmod
from .store import SessionStore


def _atomic_write(path: Path, data: dict) -> None:
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".review-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp, path)
    except Exception:
        os.unlink(tmp)
        raise


def _show_item(item: dict, store: SessionStore) -> None:
    print("=" * 70)
    print(f"Kind:       {item.get('kind')}")
    print(f"Confidence: {item.get('confidence')}")
    print(f"Proposal:   {json.dumps(item.get('proposal', {}), indent=2)}")
    for rid in item.get("record_ids", []):
        source, sid = rid.split(":", 1)
        rec = store.get(source, sid)
        if rec:
            print(f"\n{rid}  agent={rec.agent} project={rec.project} state={rec.state}")
            print(f"  started: {rec.started_at} model: {rec.model} turns: {rec.turn_count}")
            if "raw_jsonl" in rec.paths:
                print(f"  raw: {rec.paths['raw_jsonl']}")
            if "analyzed_md" in rec.paths:
                print(f"  analyzed: {rec.paths['analyzed_md']}")
    print("-" * 70)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="sm-review")
    ap.add_argument("--config", default=None)
    ap.add_argument("--notify", action="store_true",
                    help="Only report pending count (for launchd reminder)")
    args = ap.parse_args(argv)

    cfg = cfgmod.load(args.config)
    queue_path = Path(cfgmod.expand(cfg["store"]["review_queue"]))
    store = SessionStore(cfgmod.expand(cfg["store"]["path"]))

    if not queue_path.exists():
        print("no review queue — nothing to do")
        return 0

    with open(queue_path) as f:
        queue = json.load(f)

    pending = [it for it in queue["items"] if it.get("status") == "pending"]
    total = len(pending)
    if total == 0:
        print("no pending review items")
        return 0

    if args.notify:
        print(f"{total} items pending review — run `sm-review` to process")
        return 0

    print(f"{total} pending items. Commands: [y]accept [n]reject [e]dit [s]kip [q]uit")
    done = 0
    for item in pending:
        print(f"\n[{done+1}/{total}]")
        _show_item(item, store)
        while True:
            try:
                ans = input("> ").strip().lower()
            except EOFError:
                ans = "q"
            if ans in ("y", "n", "e", "s", "q"):
                break
            print("(y/n/e/s/q)")

        if ans == "q":
            break
        if ans == "s":
            done += 1
            continue
        if ans == "y":
            item["status"] = "accepted"
            item["decision_at"] = os.popen("date -u +%Y-%m-%dT%H:%M:%SZ").read().strip()
        elif ans == "n":
            item["status"] = "rejected"
            item["decision_at"] = os.popen("date -u +%Y-%m-%dT%H:%M:%SZ").read().strip()
        elif ans == "e":
            print(f"current proposal: {json.dumps(item.get('proposal', {}))}")
            edited = input("paste new proposal JSON (empty=cancel): ").strip()
            if edited:
                try:
                    item["proposal"] = json.loads(edited)
                    item["status"] = "edited"
                except json.JSONDecodeError as e:
                    print(f"bad JSON: {e}; keeping pending")
                    continue

        _atomic_write(queue_path, queue)
        done += 1

    print(f"\nprocessed {done} items")
    return 0


if __name__ == "__main__":
    sys.exit(main())
