# AKG — Alex Knowledge Graph for Obsidian

Source for Alex's Obsidian plugins, published from the `akarelin/AGENTS.md` repo (locally cloned at `~/A`).

## Layout

```
~/A/obsidian/AKG/
  README.md
  brat-glob-patch/             # patch script — adds glob-version support to BRAT
  page-status-bar/             # primary plugin (TS + esbuild + release pipeline)
  chmo-chat/                   # TS + esbuild, no release wiring yet
  obsidian-auto-move-recordings/  # plain JS, no release wiring yet
  voice-transcript-converter/  # plain JS, no release wiring yet
  claude-agent-launcher/       # plain JS, no release wiring yet
```

Only `page-status-bar` is wired into the release workflow. The other four were copied from existing locations and ship as-is until each is validated and earns its own pipeline.

## Plugins

| ID | Build | Release | Source origin |
|---|---|---|---|
| `page-status-bar` | TS + esbuild | `akg-release.yml` | Authored in this repo |
| `chmo-chat` | TS + esbuild | none | Migrated from `~/RAN/AI/chmo/obsidian-plugin/` |
| `obsidian-auto-move-recordings` | none (plain JS) | none | Migrated from `~/CRAP/ETLs/Autome/obsidian-auto-move-recordings/` |
| `voice-transcript-converter` | none (plain JS) | none | Migrated from in-vault `.obsidian/plugins/voice-transcript-converter/` |
| `claude-agent-launcher` | none (plain JS) | none | Migrated from in-vault `.obsidian/plugins/claude-agent-launcher/` |

## Local development (page-status-bar)

```bash
cd ~/A/obsidian/AKG/page-status-bar
npm install --legacy-peer-deps
npm run dev                  # esbuild watch — writes main.js in place
VAULT=~/_ npm run deploy     # copy main.js + manifest.json + styles.css into $VAULT/.obsidian/plugins/<id>/
VAULT=~/_ npm run build      # production build + deploy
npm run typecheck            # tsc --noEmit
```

`VAULT` points to the Obsidian vault that should receive the build. Without it, `deploy` skips silently (so CI builds work without a vault).

## BRAT autoupdate

[`brat-glob-patch/`](./brat-glob-patch/) patches BRAT to accept glob patterns in its `version` field, letting one repo host multiple plugins under prefixed tags:

```
Repository: akarelin/AGENTS.md
Version:    akg/page-status-bar/v*
```

See [`brat-glob-patch/README.md`](./brat-glob-patch/README.md) for setup and the private-repo PAT requirement.

## Release flow

The **AKG Release** workflow at `.github/workflows/akg-release.yml` (manual-only `workflow_dispatch`) handles `page-status-bar`. Inputs:

| Input | Options | Effect |
|---|---|---|
| `plugin` | `page-status-bar` | which plugin to release |
| `bump` | `none` · `patch` · `minor` | version policy (major bumps are manual) |

Tags: `akg/<plugin>/v<semver>`. Releases attach `main.js`, `manifest.json`, `styles.css`, and a flat zip (BRAT-compatible).

## Adding the other plugins to the release flow

When `chmo-chat` / `voice-transcript-converter` / `obsidian-auto-move-recordings` / `claude-agent-launcher` are ready to be released:

1. Add `<id>` to the `plugin:` dropdown in `.github/workflows/akg-release.yml`.
2. If the plugin uses esbuild, ensure `npm run build:only` works.
3. If the plugin is plain JS, replace the workflow's `npm install + build` step with a no-op for that plugin.
4. Add a `brat-glob-patch` entry pattern for the new tag prefix.
