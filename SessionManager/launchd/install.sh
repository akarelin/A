#!/bin/bash
# Install SessionSkills launchd agents. User-approved step — not invoked by
# the orchestrator automatically.
set -euo pipefail

SRC="/Users/alex/A/SessionManager/launchd"
DEST="$HOME/Library/LaunchAgents"
mkdir -p "$DEST" "$HOME/Library/Logs"

for plist in "$SRC"/*.plist; do
    label=$(basename "$plist" .plist)
    target="$DEST/$label.plist"

    # Unload existing
    if launchctl list | grep -q "^-\?\t\?.*$label$"; then
        launchctl unload "$target" 2>/dev/null || true
    fi

    cp "$plist" "$target"
    launchctl load "$target"
    echo "loaded $label"
done

echo
launchctl list | grep sessionskills
