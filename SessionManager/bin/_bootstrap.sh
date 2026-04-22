# Shared bootstrap: resolve venv + scripts root for this host.
# Source this from each bin/sm* wrapper.
#
# Priority:
#   1. macOS canonical:   /Users/alex/RAN/AI/SessionManager/
#   2. Linux/WSL canon:   /home/alex/SessionManager/
#   3. A-local venv (future):  /Users/alex/A/SessionManager/.venv/
#
# On success, exports SM_PY and SM_REPO.

if [[ -x /Users/alex/RAN/AI/SessionManager/.venv/bin/python3 ]]; then
  export SM_PY=/Users/alex/RAN/AI/SessionManager/.venv/bin/python3
  export SM_REPO=/Users/alex/RAN/AI/SessionManager
elif [[ -x /home/alex/SessionManager/.venv/bin/python3 ]]; then
  export SM_PY=/home/alex/SessionManager/.venv/bin/python3
  export SM_REPO=/home/alex/SessionManager
elif [[ -x /Users/alex/A/SessionManager/.venv/bin/python3 ]]; then
  export SM_PY=/Users/alex/A/SessionManager/.venv/bin/python3
  export SM_REPO=/Users/alex/A/SessionManager
else
  echo "SessionManager venv not found on this host. Tried:" >&2
  echo "  /Users/alex/RAN/AI/SessionManager/.venv (macOS)" >&2
  echo "  /home/alex/SessionManager/.venv          (Linux/WSL)" >&2
  echo "  /Users/alex/A/SessionManager/.venv       (A-local)" >&2
  exit 1
fi
