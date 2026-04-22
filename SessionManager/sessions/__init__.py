"""SessionSkills — orchestration layer for LLM session lifecycle.

Owns: ingest → merge → name → analyze → write_to_memory → cluster → classify
      → review → prune → archive

Wraps existing skills (qmd-sessions-rename, session-intel, claude-sessions,
theme-tracker, work-atoms) via subprocess; maintains one canonical SQLite
record store at ~/.sessionskills/store.sqlite.
"""
