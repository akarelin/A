"""Shared helpers for obsidian-daily skill scripts."""
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
OBSIDIAN_API = os.environ.get("OBSIDIAN_API", "http://localhost:27123")
OBSIDIAN_KEY = os.environ.get("OBSIDIAN_KEY", "")

VAULT_ROOT = Path(os.environ.get("OBSIDIAN_VAULT", "/Users/alex/_"))
CHMO_DIR   = os.environ.get("OBSIDIAN_CHMO_DIR", "Agents/Chmo/Alex")   # relative to vault
DAILY_DIR  = os.environ.get("OBSIDIAN_DAILY_DIR", "Daily Notes") # relative to vault
AGENT_NAME = os.environ.get("OBSIDIAN_AGENT", "System")

# ── API key loading ───────────────────────────────────────────────────────────
if not OBSIDIAN_KEY:
    _plugin_data = VAULT_ROOT / ".obsidian/plugins/obsidian-local-rest-api/data.json"
    try:
        OBSIDIAN_KEY = json.loads(_plugin_data.read_text()).get("apiKey", "")
    except Exception:
        pass

# ── Date helpers ─────────────────────────────────────────────────────────────
def today() -> str:
    return datetime.now().strftime("%Y-%m-%d")

def now_time() -> str:
    return datetime.now().strftime("%H:%M")

def now_iso() -> str:
    return datetime.now().strftime("%Y-%m-%dT%H:%M")

# ── Obsidian REST API ─────────────────────────────────────────────────────────
def _headers(extra: dict | None = None) -> dict:
    h = {"Authorization": f"Bearer {OBSIDIAN_KEY}", "Content-Type": "text/markdown"}
    if extra:
        h.update(extra)
    return h

def _req(method: str, path: str, body: str | None = None, extra_headers: dict | None = None) -> tuple[int, str]:
    url = f"{OBSIDIAN_API}/vault/{path.lstrip('/')}"
    data = body.encode() if body else None
    req = urllib.request.Request(url, data=data, headers=_headers(extra_headers), method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")
    except Exception as e:
        return 0, str(e)

def read_file(vault_path: str) -> tuple[bool, str]:
    """Read a vault file. Returns (exists, content)."""
    status, body = _req("GET", vault_path)
    return status == 200, body

def write_file(vault_path: str, content: str) -> bool:
    """Create or overwrite a vault file."""
    status, _ = _req("PUT", vault_path, content)
    return status in (200, 201, 204)

def append_file(vault_path: str, content: str) -> bool:
    """Append content to a vault file (REST API append)."""
    status, _ = _req("POST", vault_path, content,
                     extra_headers={"Content-Insertion-Position": "end"})
    return status in (200, 201, 204)

# ── Note path helpers ─────────────────────────────────────────────────────────
def chmo_note_path(date: str | None = None) -> str:
    """Vault-relative path for today's Chmo/Alex daily note."""
    return f"{CHMO_DIR}/{date or today()}.md"

def daily_note_path(date: str | None = None) -> str:
    """Vault-relative path for today's main daily note."""
    return f"{DAILY_DIR}/{date or today()}.md"

# ── Note creation ─────────────────────────────────────────────────────────────
def ensure_chmo_note(date: str | None = None) -> str:
    """Create today's Chmo note if it doesn't exist. Returns vault path."""
    d = date or today()
    path = chmo_note_path(d)
    exists, _ = read_file(path)
    if not exists:
        frontmatter = f"""---
type: DailyNote
date: {d}
created: {now_iso()}
updated: {now_iso()}
tags:
  - Alex/diary
  - daily-note
  - chmo
---

# {d}

"""
        write_file(path, frontmatter)
    return path

# ── Admonition builders ───────────────────────────────────────────────────────
def _admonition(kind: str, content: str, title: str | None = None, timestamp: bool = True) -> str:
    """Build a markdown admonition block."""
    lines = []
    ts = f" — {now_time()}" if timestamp else ""
    title_str = f" {title}" if title else ""
    if title_str or ts:
        lines.append(f"```ad-{kind}")
        lines.append(f"title:{title_str}{ts}")
        lines.append("")
    else:
        lines.append(f"```ad-{kind}")
    lines.append(content.strip())
    lines.append("```")
    lines.append("")
    return "\n".join(lines) + "\n"

def block_from_llm(content: str, title: str | None = None) -> str:
    """LLM → human: dark gray, ad-from-llm."""
    return _admonition("from-llm", content, title or AGENT_NAME)

def block_response(content: str, title: str | None = None) -> str:
    """LLM response: light gray, ad-response."""
    return _admonition("response", content, title)

def block_prompt(content: str) -> str:
    """Human prompt to LLM: ad-prompt."""
    return _admonition("prompt", content, timestamp=False)

def block_msg_alex(content: str) -> str:
    """Human message (Alex): ad-msg-alex."""
    return _admonition("msg-alex", content, timestamp=False)

def block_info(content: str, title: str | None = None) -> str:
    """Info/status block: ad-info."""
    return _admonition("info", content, title)

def block_question(content: str, title: str | None = None) -> str:
    """Question for Alex: ad-question."""
    return _admonition("question", content, title)

def block_summary(content: str, title: str | None = None) -> str:
    """Summary/lesson: ad-summary."""
    return _admonition("summary", content, title)

def block_warning(content: str, title: str | None = None) -> str:
    """Warning: ad-warning."""
    return _admonition("warning", content, title)
