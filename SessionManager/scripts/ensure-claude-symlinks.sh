#!/bin/bash
# Ensure each expected Claude Code symlink under ~/.claude/ has an existing
# target directory. If a target is missing (common failure: Synology Drive
# sync conflict zapped the tree), recreate an empty dir so writes don't
# fail silently.
set -u
SYMLINKS=(
  "$HOME/.claude/projects"
  "$HOME/.claude/plans"
)
LOGDIR="$HOME/Library/Logs"
mkdir -p "$LOGDIR"
LOGFILE="$LOGDIR/claude-symlink-guard.log"
ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
fixes=0; warns=0; fails=0
for link in "${SYMLINKS[@]}"; do
  if [ ! -L "$link" ]; then
    echo "$(ts) WARN $link is not a symlink (skipping)" >> "$LOGFILE"
    warns=$((warns + 1))
    continue
  fi
  target=$(readlink "$link")
  if [ ! -d "$target" ]; then
    if mkdir -p "$target" 2>/dev/null; then
      echo "$(ts) FIX  recreated $target for $link" >> "$LOGFILE"
      fixes=$((fixes + 1))
    else
      echo "$(ts) FAIL could not recreate $target for $link" >> "$LOGFILE"
      fails=$((fails + 1))
    fi
  fi
done
# Heartbeat so `tail` of the log always shows recent activity.
echo "$(ts) OK   ran: fixes=$fixes warns=$warns fails=$fails" >> "$LOGFILE"
