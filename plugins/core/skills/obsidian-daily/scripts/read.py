#!/usr/bin/env python3
"""
obsidian-daily read — read today's (or a specific) Chmo daily note.

Usage:
  python3 read.py [date]           # Read Chmo note (default: today)
  python3 read.py --daily [date]   # Read main Daily Note instead
  python3 read.py --tail N [date]  # Last N lines only

Output: raw markdown content to stdout.
"""
import sys
from _common import read_file, chmo_note_path, daily_note_path, today

def main():
    args = sys.argv[1:]
    use_daily = "--daily" in args
    if use_daily:
        args.remove("--daily")

    tail = None
    if "--tail" in args:
        i = args.index("--tail")
        tail = int(args[i + 1])
        args = args[:i] + args[i + 2:]

    date = args[0] if args else today()
    path = daily_note_path(date) if use_daily else chmo_note_path(date)

    exists, content = read_file(path)
    if not exists:
        print(f"Note not found: {path}", file=sys.stderr)
        sys.exit(1)

    if tail:
        lines = content.splitlines()
        content = "\n".join(lines[-tail:])

    print(content)

if __name__ == "__main__":
    main()
