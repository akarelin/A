# Session Manager

Local Claude Code skill for managing session folders across repos and hosts.

## Commands

```bash
python3 claude_session_manager.py sync
python3 claude_session_manager.py sync-all -m "checkpoint"
python3 claude_session_manager.py pull-latest --all
python3 claude_session_manager.py pull-latest D--Dev-CRAP
python3 claude_session_manager.py list
python3 claude_session_manager.py list --current
python3 claude_session_manager.py resume -home-alex-RAN
python3 claude_session_manager.py resume -home-alex-RAN --exec claude
python3 claude_session_manager.py delete-empty
python3 claude_session_manager.py delete-empty --apply
python3 claude_session_manager.py rename D--Dev-gppu-w11 D--Dev-gppu
python3 claude_session_manager.py rename D--Dev-gppu-w11 D--Dev-gppu --apply
```

## Notes

- Each mapped session is stored under `<repo>/.claude/<session-name>`.
- Global links are created under `~/.claude/projects/<session-name>`.
- `rename` and `delete-empty` are dry-run unless `--apply` is passed.
- `resume` prints the owning repo path, or `exec`s a command there.
