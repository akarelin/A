#!/usr/bin/env python3
"""
obsidian-daily ask — log a question for Alex and wait for Obsidian to show it.

Appends an ad-question block to today's Chmo note. Used when an agent
needs user input but can't get it synchronously.

Usage:
  python3 ask.py "Your question here" [optional title]

The question will appear in the daily note with the admonition style.
Alex can answer inline or via the next chat turn.
"""
import sys
from _common import ensure_chmo_note, append_file, block_question, AGENT_NAME

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    question = sys.argv[1]
    title = sys.argv[2] if len(sys.argv) > 2 else f"❓ {AGENT_NAME} asks"

    path = ensure_chmo_note()
    block = block_question(question, title)
    ok = append_file(path, "\n" + block)

    if ok:
        print(f"✅ Question logged to {path}")
        print("Waiting for Alex to respond in Obsidian or next chat turn.")
    else:
        print(f"❌ Failed to log question", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
