#!/usr/bin/env python3
"""
obsidian-daily section — append a block under a specific heading in today's note.

If the heading doesn't exist it is created. Useful for organizing agent
output under time-of-day sections (🌅 Morning, 🌆 Afternoon, 🌃 Night).

Usage:
  python3 section.py <heading> <type> <content> [title]

Examples:
  python3 section.py "🌃 Late Night" from-llm "Completed QMD embedding." "Embedding done"
  python3 section.py "## Tasks" info "Started Cruft migration analysis"
"""
import re
import sys
from _common import read_file, write_file, ensure_chmo_note, block_from_llm, block_info

# Heading → emoji shortcuts
SECTION_ALIASES = {
    "morning":    "## 🌅 Morning",
    "afternoon":  "## 🌆 Afternoon",
    "evening":    "## 🌆 Evening",
    "night":      "## 🌃 Night",
    "late":       "## 🌃 Late Night",
    "tasks":      "## Tasks",
    "notes":      "## Notes",
    "log":        "## Log",
}

def resolve_heading(raw: str) -> str:
    key = raw.lower().strip()
    if key in SECTION_ALIASES:
        return SECTION_ALIASES[key]
    if not raw.startswith("#"):
        return f"## {raw}"
    return raw


def append_under_section(content: str, heading: str, block: str) -> str:
    """Insert block under the given heading; create heading if absent."""
    lines = content.splitlines(keepends=True)
    heading_line = heading.strip() + "\n"

    # Find the heading
    for i, line in enumerate(lines):
        if line.strip() == heading.strip():
            # Find end of this section (next heading of same or higher level)
            level = len(heading.split()[0])  # number of #
            j = i + 1
            while j < len(lines):
                l = lines[j]
                if l.startswith("#"):
                    h_level = len(l.split()[0]) if l.split() else 0
                    if h_level <= level:
                        break
                j += 1
            # Insert before next heading (or at end of section)
            lines.insert(j, "\n" + block)
            return "".join(lines)

    # Heading not found — append it + block at end
    tail = "\n" + heading_line + "\n" + block
    return content.rstrip() + "\n" + tail + "\n"


BUILDERS = {
    "from-llm": block_from_llm,
    "info":      block_info,
}

def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)

    raw_heading = sys.argv[1]
    kind        = sys.argv[2]
    content_str = sys.argv[3]
    title       = sys.argv[4] if len(sys.argv) > 4 else None

    from _common import block_from_llm, block_response, block_prompt, block_msg_alex
    from _common import block_info, block_question, block_summary, block_warning

    all_builders = {
        "from-llm": block_from_llm,
        "response":  block_response,
        "prompt":    lambda c, t=None: block_prompt(c),
        "msg":       lambda c, t=None: block_msg_alex(c),
        "info":      block_info,
        "question":  block_question,
        "summary":   block_summary,
        "warning":   block_warning,
    }

    if kind not in all_builders:
        print(f"Unknown type '{kind}'", file=sys.stderr)
        sys.exit(1)

    heading = resolve_heading(raw_heading)
    block = all_builders[kind](content_str, title) if title else all_builders[kind](content_str)

    path = ensure_chmo_note()
    exists, current = read_file(path)
    if not exists:
        current = ""

    updated = append_under_section(current, heading, block)
    ok = write_file(path, updated)

    if ok:
        print(f"✅ Logged [{kind}] under '{heading}' in {path}")
    else:
        print(f"❌ Failed to write {path}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
