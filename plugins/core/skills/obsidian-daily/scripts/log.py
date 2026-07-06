#!/usr/bin/env python3
"""
obsidian-daily log — append a block to today's Chmo daily note.

Usage:
  python3 log.py <type> <content> [title]

Types:
  from-llm   LLM → Alex (dark gray, timestamped)
  response   LLM response (light gray, timestamped)
  prompt     Human prompt to LLM (no timestamp)
  msg        Human message (no timestamp)
  info       Info/status (timestamped)
  question   Question for Alex (timestamped)
  summary    Summary/lesson (timestamped)
  warning    Warning (timestamped)

Environment:
  OBSIDIAN_KEY   API key (auto-detected from plugin data.json if unset)
  OBSIDIAN_API   Base URL (default: http://localhost:27123)
  OBSIDIAN_VAULT Vault root (default: /Users/alex/_)
  OBSIDIAN_AGENT Agent display name (default: System)
"""
import sys
from _common import (
    ensure_chmo_note, append_file, chmo_note_path,
    block_from_llm, block_response, block_prompt, block_msg_alex,
    block_info, block_question, block_summary, block_warning,
    today,
)

BUILDERS = {
    "from-llm": block_from_llm,
    "response":  block_response,
    "prompt":    lambda c, t=None: block_prompt(c),
    "msg":       lambda c, t=None: block_msg_alex(c),
    "info":      block_info,
    "question":  block_question,
    "summary":   block_summary,
    "warning":   block_warning,
}

def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    kind    = sys.argv[1]
    content = sys.argv[2]
    title   = sys.argv[3] if len(sys.argv) > 3 else None

    if kind not in BUILDERS:
        print(f"Unknown type '{kind}'. Valid: {', '.join(BUILDERS)}", file=sys.stderr)
        sys.exit(1)

    path = ensure_chmo_note()
    block = BUILDERS[kind](content, title) if title else BUILDERS[kind](content)
    ok = append_file(path, "\n" + block)

    if ok:
        print(f"✅ Logged [{kind}] to {path}")
    else:
        print(f"❌ Failed to append to {path}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
