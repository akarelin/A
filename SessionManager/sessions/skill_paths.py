"""Resolve skill paths canonically from SD.agents/skills/ with fallback
to the legacy vault location during the one-way migration.

SD.agents/skills/ is the single source of truth. ~/_/{internals}/Skills/
is legacy and may contain the same skills (possibly as compat symlinks
pointing back at SD.agents). Every resolver here checks SD.agents first,
then falls back to the vault path, then raises.
"""
from __future__ import annotations

from pathlib import Path


CANONICAL_ROOT = Path("/Users/alex/SD.agents/skills")
LEGACY_ROOT = Path("/Users/alex/_/{internals}/Skills")


def skill_dir(name: str) -> Path:
    """Return the directory for a skill. Prefers SD.agents/skills/<name>."""
    canonical = CANONICAL_ROOT / name
    if canonical.is_dir():
        return canonical
    legacy = LEGACY_ROOT / name
    if legacy.is_dir():
        return legacy
    raise FileNotFoundError(
        f"skill '{name}' not found under {CANONICAL_ROOT} or {LEGACY_ROOT}"
    )


def script(name: str, *parts: str) -> Path:
    """Return a script path inside a skill, e.g. script('theme-tracker', 'extract_themes.py')."""
    return skill_dir(name).joinpath(*parts)
