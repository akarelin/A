# Page Status Bar

Renders a metadata bar above body content on every page whose `type:` frontmatter resolves to a known class/type page. Supersedes the dataviewjs `_views/any` stub.

## What it shows

For each rendered page, in order:

1. **Type chain** — resolved class/type links, followed through `subClassOf:`
2. **Metadata fields** — all non-technical frontmatter fields; instance pages honor the class's `fieldsOrder` first and append the rest
3. **Children** — grouped by field (Sub-projects, Subclasses, Instances, Members, Aliases, ...)
4. **Files** — pages inside the co-located folder `{file.folder}/{file.name}/`
5. **Used by** — other incoming references not already covered

Type extensions render below the universal sections. The built-in `Project` (and alias `Ongoing`) extension adds **Phases** and **Decisions** tables.

## Triggers

A status bar is rendered when:

- The frontmatter `statusBar:` is not explicitly `false`, **and**
- The trigger rule allows the file:
  - With *Render only on pages with a known type:* **on** (default), `type:` must resolve to a known class/type page.
  - The file's folder is in the *Include folders* list (if non-empty) **and not** in the *Exclude folders* list.

Opt out per page:
```yaml
---
type: Project
statusBar: false
---
```

## Build

```bash
cd obsidian/AKG/page-status-bar
npm install
npm run build:only
```

The build emits `main.js` next to `manifest.json` and `styles.css`.

## Install (BRAT)

Publish the build artifacts (`main.js`, `manifest.json`, `styles.css`) to a GitHub release for this plugin and install the repository through BRAT.

For local testing only, deploy into a vault by setting `VAULT`:

```bash
VAULT=D:\_ npm run build
```

## Settings

- **Render mode** — Reading view only · Edit modes only · Both *(default)*
- **Render only on pages with a known type:** — toggle the known-type trigger
- **Defer to legacy dataview stub** — skip rendering on pages that still embed `dv.view("{internals}/Classes/_views/any")`. Useful during migration.
- **Hide native frontmatter properties** — body-level CSS toggle (default **on**)
- **Include / Exclude folders** — one path per line
- **Sections** — turn the universal sections off
- **Type extensions** — enable/disable each registered extension

## Adding a type extension

Each extension is a `TypeExtension` registered at plugin load. To add one in-vault, edit `src/main.ts` and push a new entry into `this.extensions`:

```ts
this.extensions.push({
  type: "Axis",
  async render(container, ctx) {
    // ctx.app, ctx.file, ctx.frontmatter, ctx.settings
    // build into `container` — runs BELOW the universal sections.
  },
});
```

## Migration plan

1. Install + enable the plugin.
2. Spot-check parity with `_views/any` on representative pages: `Entity`, `ProjectFile`, `Axis`, an instance like `UO/PROV/Thing`, and a Project like `Cruft`.
3. While *Defer to legacy dataview stub* is **on**, you can leave the old `dv.view(...)` codeblocks in place and migrate at your own pace.
4. When ready, strip the stub across the 49 pages under `{internals}/`:
   ```bash
   # dry-run first
   grep -rl 'dv.view("{internals}/Classes/_views/any")' "{internals}/"
   # then remove the codeblock
   ```
5. Keep `_views/any/view.js` around for ~30 days as a reference, then archive.

## Reactive updates

The plugin re-renders after `metadataCache.changed`, `metadataCache.resolved`, vault rename, or vault delete. Hot-edit a frontmatter field and the status bar follows.

## Caveats

- Frontmatter key casing — Obsidian preserves casing in `metadataCache.frontmatter`. Set comparisons are lowercase; display labels are capitalised.
- Basename collisions (`[[BFO/Entity]]`, `[[PROV/Entity]]`, `[[Entity]]`) — resolved through `metadataCache.getFirstLinkpathDest`, not raw basename matching.
- Class `fieldsOrder` is consulted only for *instance* pages (have `type:` and not `subClassOf`/`extends`). On class pages, fields are auto-discovered.
- Known types are discovered from class-definition metadata (`fieldsOrder`, `subClassOf`, `extends`, or `type: Class`).
