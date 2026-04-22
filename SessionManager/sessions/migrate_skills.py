"""One-button vault-skills → SD.agents/skills/ migration.

Handles the legacy layout under ~/_/{internals}/Skills/ → canonical
/Users/alex/SD.agents/skills/. Safety-first:

  * Phase 1 — SCAN: walk both roots, classify each skill as
      [new] (vault only, safe to mv),
      [dup] (in both; size/mtime diff decides action),
      [sd-only] (already canonical, nothing to do),
      [conflict] (both sides have content with mismatched trees).
  * Phase 2 — DRY-RUN: print every planned action + reference-sweep targets.
  * Phase 3 — APPLY (only with --apply): execute moves, leave compat
      symlinks at old locations, write a manifest to
      ~/.sessionskills/migrations/skills-<iso>.json so every action is
      reversible.
  * Phase 4 — SED SWEEP (only with --apply --rewrite-refs): update known
      hardcoded `_/{internals}/Skills` references in
      openclaw.json and .lobster/workflows/*.lobster.

Nothing destructive without both --apply and explicit user intent.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path


VAULT_ROOT = Path("/Users/alex/_/{internals}/Skills")
SD_ROOT = Path("/Users/alex/SD.agents/skills")
MANIFEST_DIR = Path.home() / ".sessionskills" / "migrations"

# Files in external systems that hardcode the old path
REF_TARGETS = [
    Path("/Users/alex/RAN/AI/chmo/openclaw.json"),
    # glob expanded at run-time
    Path("/Users/alex/SD.agents/.lobster/workflows"),
]


@dataclass
class SkillPlan:
    name: str
    action: str  # new | dup-prefer-vault | dup-prefer-sd | sd-only | conflict
    reason: str = ""
    vault_size: int = 0
    sd_size: int = 0


def _dir_stats(p: Path) -> tuple[int, int]:
    """Return (file_count, total_size_bytes) excluding __pycache__."""
    count = 0
    size = 0
    if not p.is_dir():
        return (0, 0)
    for f in p.rglob("*"):
        if "__pycache__" in f.parts:
            continue
        if f.is_file():
            count += 1
            try:
                size += f.stat().st_size
            except OSError:
                pass
    return count, size


def _compare_dirs(a: Path, b: Path) -> str:
    """Return 'identical' | 'vault-newer' | 'sd-newer' | 'disjoint'."""
    proc = subprocess.run(
        ["diff", "-r", "-q", "--exclude=__pycache__", str(a), str(b)],
        capture_output=True, text=True,
    )
    if proc.returncode == 0:
        return "identical"
    # Compare newest mtime in each
    def newest(p: Path) -> float:
        m = 0.0
        for f in p.rglob("*"):
            if f.is_file() and "__pycache__" not in f.parts:
                try:
                    m = max(m, f.stat().st_mtime)
                except OSError:
                    pass
        return m
    ma, mb = newest(a), newest(b)
    if abs(ma - mb) < 1.0:
        return "disjoint"
    return "vault-newer" if ma > mb else "sd-newer"


def scan() -> list[SkillPlan]:
    """Phase 1: classify every vault skill + every SD-only skill."""
    plans: list[SkillPlan] = []
    vault_names: set[str] = set()
    if VAULT_ROOT.exists():
        for d in VAULT_ROOT.iterdir():
            if not d.is_dir():
                continue
            # Follow symlinks: if it's a compat symlink pointing to SD, skip
            if d.is_symlink() and SD_ROOT in d.resolve().parents:
                continue
            vault_names.add(d.name)

    for name in sorted(vault_names):
        vault_path = VAULT_ROOT / name
        sd_path = SD_ROOT / name
        vc, vs = _dir_stats(vault_path)
        if not sd_path.exists():
            plans.append(SkillPlan(name=name, action="new",
                                   reason=f"{vc} files, {vs//1024} KB",
                                   vault_size=vs))
            continue
        sc, ss = _dir_stats(sd_path)
        cmp = _compare_dirs(vault_path, sd_path)
        if cmp == "identical":
            plans.append(SkillPlan(name=name, action="sd-only",
                                   reason="identical — just delete vault copy",
                                   vault_size=vs, sd_size=ss))
        elif cmp == "vault-newer":
            plans.append(SkillPlan(name=name, action="dup-prefer-vault",
                                   reason=f"vault newer; vault={vc}f/{vs//1024}KB  sd={sc}f/{ss//1024}KB",
                                   vault_size=vs, sd_size=ss))
        elif cmp == "sd-newer":
            plans.append(SkillPlan(name=name, action="dup-prefer-sd",
                                   reason=f"sd newer; vault={vc}f/{vs//1024}KB  sd={sc}f/{ss//1024}KB",
                                   vault_size=vs, sd_size=ss))
        else:
            plans.append(SkillPlan(name=name, action="conflict",
                                   reason=f"disjoint content; vault={vc}f sd={sc}f — needs manual review",
                                   vault_size=vs, sd_size=ss))
    return plans


def print_scan(plans: list[SkillPlan]) -> None:
    buckets: dict[str, list[SkillPlan]] = {}
    for p in plans:
        buckets.setdefault(p.action, []).append(p)
    order = ["new", "dup-prefer-vault", "dup-prefer-sd", "sd-only", "conflict"]
    print(f"\n{'=' * 72}\nVault skills migration scan\n{'=' * 72}\n")
    print(f"vault: {VAULT_ROOT}")
    print(f"sd:    {SD_ROOT}\n")
    for action in order:
        items = buckets.get(action, [])
        if not items:
            continue
        print(f"[{action}] ({len(items)}):")
        for p in items:
            print(f"  {p.name:<28s}  {p.reason}")
        print()


def _apply_one(p: SkillPlan, manifest_items: list) -> None:
    """Execute one move. Records reversible metadata into manifest_items."""
    vault = VAULT_ROOT / p.name
    sd = SD_ROOT / p.name
    if p.action == "new":
        shutil.move(str(vault), str(sd))
        os.symlink(str(sd), str(vault))
        manifest_items.append({
            "name": p.name, "action": p.action,
            "moved_from": str(vault), "moved_to": str(sd),
            "compat_symlink": str(vault),
        })
    elif p.action == "dup-prefer-vault":
        # Back up existing SD copy, then replace
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
        backup = sd.with_name(f"{p.name}.sd-backup.{stamp}")
        shutil.move(str(sd), str(backup))
        shutil.move(str(vault), str(sd))
        os.symlink(str(sd), str(vault))
        manifest_items.append({
            "name": p.name, "action": p.action,
            "moved_from": str(vault), "moved_to": str(sd),
            "sd_backup": str(backup),
            "compat_symlink": str(vault),
        })
    elif p.action == "dup-prefer-sd":
        # SD already canonical; back up vault copy for safety, leave compat link
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
        backup_dir = VAULT_ROOT.parent / "_skills-backup" / stamp
        backup_dir.mkdir(parents=True, exist_ok=True)
        backup = backup_dir / p.name
        shutil.move(str(vault), str(backup))
        os.symlink(str(sd), str(vault))
        manifest_items.append({
            "name": p.name, "action": p.action,
            "vault_backup": str(backup),
            "compat_symlink": str(vault),
        })
    elif p.action == "sd-only":
        # Identical: remove vault duplicate, compat symlink
        shutil.rmtree(vault)
        os.symlink(str(sd), str(vault))
        manifest_items.append({
            "name": p.name, "action": p.action,
            "removed_duplicate": str(vault),
            "compat_symlink": str(vault),
        })
    elif p.action == "conflict":
        # Never auto-resolve; skip and record
        manifest_items.append({
            "name": p.name, "action": "skipped-conflict",
            "reason": p.reason,
        })


def rewrite_refs(dry_run: bool = True) -> list[tuple[Path, int]]:
    """Find and (optionally) rewrite hardcoded _/{internals}/Skills paths.

    On apply: write alongside a one-time `.pre-migrate-bak` copy of the
    original. Safe to run multiple times (backup only created if missing)."""
    targets: list[Path] = []
    for t in REF_TARGETS:
        if t.is_dir():
            targets.extend(t.rglob("*.lobster"))
            targets.extend(t.rglob("*.json"))
            targets.extend(t.rglob("*.yaml"))
        elif t.is_file():
            targets.append(t)
    results: list[tuple[Path, int]] = []
    for f in targets:
        try:
            text = f.read_text()
        except (OSError, UnicodeDecodeError):
            continue
        if "_/{internals}/Skills" not in text:
            continue
        count = text.count("_/{internals}/Skills")
        new_text = text.replace("_/{internals}/Skills", "SD.agents/skills")
        results.append((f, count))
        if not dry_run:
            backup = Path(str(f) + ".pre-migrate-bak")
            if not backup.exists():
                backup.write_text(text)  # one-time backup
            f.write_text(new_text)
    return results


def cmd_migrate_skills(*, apply: bool, rewrite: bool) -> int:
    plans = scan()
    print_scan(plans)
    counts = {a: 0 for a in ("new", "dup-prefer-vault", "dup-prefer-sd",
                             "sd-only", "conflict")}
    for p in plans:
        counts[p.action] = counts.get(p.action, 0) + 1
    print("summary:", counts)

    # Show ref-rewrite candidates
    print(f"\n{'=' * 72}\nReference sweep ({('rewrite' if rewrite else 'dry')})\n{'=' * 72}")
    refs = rewrite_refs(dry_run=not (apply and rewrite))
    if refs:
        for f, n in refs:
            print(f"  {f}  ({n} occurrence(s))")
    else:
        print("  (no files contain the old path)")

    if not apply:
        print("\n(dry-run only — re-run with --apply to move skills; "
              "add --rewrite-refs to also rewrite hardcoded paths)")
        return 0

    # Execute moves
    print(f"\n{'=' * 72}\nApplying moves\n{'=' * 72}")
    MANIFEST_DIR.mkdir(parents=True, exist_ok=True)
    items: list = []
    for p in plans:
        try:
            _apply_one(p, items)
            print(f"  ✓ {p.action:<18s} {p.name}")
        except Exception as e:
            print(f"  ✗ {p.action:<18s} {p.name}  ERROR: {e}")
            items.append({"name": p.name, "action": p.action,
                          "error": str(e)})
    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "apply": True,
        "rewrite_refs": rewrite,
        "items": items,
    }
    mpath = MANIFEST_DIR / f"skills-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}.json"
    mpath.write_text(json.dumps(manifest, indent=2))
    print(f"\nmanifest: {mpath}")
    return 0
