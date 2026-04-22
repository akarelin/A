"""sessionskills.yaml loader."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError as e:
    raise ImportError("PyYAML required: pip install pyyaml") from e


DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent.parent / "sessionskills.yaml"


def load(path: str | Path | None = None) -> dict[str, Any]:
    p = Path(path or os.environ.get("SESSIONSKILLS_CONFIG") or DEFAULT_CONFIG_PATH)
    if not p.exists():
        raise FileNotFoundError(f"config not found: {p}")
    with open(p) as f:
        cfg = yaml.safe_load(f)
    cfg["_path"] = str(p)
    cfg.setdefault("store", {})
    cfg["store"].setdefault("path", "~/.sessionskills/store.sqlite")
    cfg["store"].setdefault("review_queue", "~/.sessionskills/review_queue.json")
    cfg.setdefault("llm", {})
    cfg["llm"].setdefault("host", "http://127.0.0.1:11434")
    cfg["llm"].setdefault("model_chat", "qwen3:8b")
    cfg["llm"].setdefault("model_embed", "nomic-embed-text")
    cfg["llm"].setdefault("fallback", "cloud")
    return cfg


def expand(p: str) -> str:
    return os.path.expanduser(os.path.expandvars(p))
