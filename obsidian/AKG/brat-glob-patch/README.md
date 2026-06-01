# BRAT glob patch

Adds glob-pattern support to [obsidian42-brat](https://github.com/TfTHacker/obsidian42-brat)'s release version field, so a single repo (like `akarelin/_`) can host releases for multiple plugins under prefixed tags (e.g. `akg/page-status-bar/v0.1.0`, `akg/other-plugin/v0.3.0`) and BRAT can autoupdate the correct one.

## Why

BRAT's stock `version` field only supports two values:

| Value | Behaviour |
|---|---|
| `latest` | fetch `/releases`, pick the newest by semver — wrong for multi-plugin repos because it picks whichever plugin released last |
| `vX.Y.Z` | fetch `/releases/tags/vX.Y.Z` — pinned, no auto-update |

After this patch, a third mode is recognised:

| Value | Behaviour |
|---|---|
| `<pattern with *>` | fetch `/releases`, filter `tag_name` by the glob, pick the newest match — auto-updates within the prefix |

Example: `akg/page-status-bar/v*` matches `akg/page-status-bar/v0.1.0`, `akg/page-status-bar/v1.0.0-beta.1`, etc., but skips `akg/other-plugin/*` and `20260527` archive tags.

## Apply

```bash
VAULT=~/_ node obsidian/AKG/brat-glob-patch/apply.mjs
```

`VAULT` is the path to the Obsidian vault to patch (the script writes to `$VAULT/.obsidian/plugins/obsidian42-brat/main.js`).

Idempotent. Leaves a marker (`/* AKG-GLOB-PATCH-v1 */`) so re-runs are safe.

BRAT's own auto-update will overwrite `main.js` periodically. **Re-run `apply.mjs` after every BRAT version bump.** A backup of the unpatched file is at `main.js.bak` for emergency revert.

## Configure BRAT to track `akarelin/AGENTS.md`

Once patched:

1. Obsidian → Settings → BRAT → **Add beta plugin with frozen version**
   - **Repository:** `akarelin/AGENTS.md`
   - **Version:** `akg/page-status-bar/v*`
2. Because `akarelin/AGENTS.md` is **private**, BRAT needs a GitHub PAT:
   - Generate at https://github.com/settings/tokens with `repo` scope
   - Paste into BRAT → Settings → **Personal access token** (or per-plugin token)
3. With `Update at startup` enabled (the default), BRAT will fetch the newest matching release each launch.

## Manual revert

```bash
cp obsidian/AKG/brat-glob-patch/main.js.bak $VAULT/.obsidian/plugins/obsidian42-brat/main.js
```
