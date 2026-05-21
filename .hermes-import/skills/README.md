# `~/A/.hermes-import/skills/` — Karelin → Hermes skill curation tree

This directory is the **chokepoint** through which Karelin skills (`~/A/plugins/*/skills/*`) reach the Hermes Agent skill loader.

Refs: parent umbrella `t_853bdb93`, this card `t_3b6c0f9b`. Design doc: `~/RAN/AI/hermes/decisions/t_9af0bec9-integration-design.md` §1. Loading strategy ADR: `~/RAN/AI/hermes/decisions/t_26a83f64-skill-loading-strategy.md`. Conflict policy: `~/RAN/AI/hermes/decisions/t_ab59140b-conflict-policy.md`.

## Contract

Each entry in this directory is a **symlink** pointing at a single skill directory under `~/A/plugins/<plugin>/skills/<skill>/`. Example:

```
~/A/.hermes-import/skills/
├── README.md           ← this file
├── CURATED.md          ← per-pair audit record (card t_e75288ef)
├── admin-m365 -> /Users/alex/A/plugins/administer/skills/admin-m365
├── admin-portainer -> /Users/alex/A/plugins/administer/skills/admin-portainer
└── …
```

Hermes is configured to discover skills from here via:

```yaml
# ~/.hermes/config.yaml
skills:
  external_dirs:
    - ~/A/.hermes-import/skills
```

The Hermes loader walks this tree, follows the symlinks, and treats each linked directory as a skill source (looks for `SKILL.md` per directory). **Live edits to the linked source files flow through immediately** — no copy, no sync step. The symlink target is the source of truth; this tree is just the visibility filter.

## Rationale — why a curated tree, not direct imports

Three options were considered and rejected before settling on this layout (ADR `t_26a83f64`):

1. **Symlink each skill into `~/.hermes/skills/karelin-<plugin>/`** — disqualified by the silent `Path.rglob("SKILL.md", recurse_symlinks=False)` default on Python 3.13+: 15+ callsites in Hermes default to non-recursive symlink resolution and silently drop symlinked category dirs. Half the system would see Karelin skills, half wouldn't.

2. **Point `external_dirs` straight at `~/A/plugins/*/skills`** — disqualified by the content audit (`t_583daa89`): wholesale import would drag in skills with destructive-git recipes (`git reset --hard`, `git push --force` — both forbidden per `~/RAN/AGENTS.md`), Windows-only paths in `organize/*`, and `${CLAUDE_PLUGIN_ROOT}` / `mnt/.remote-plugins/` references that don't resolve on the Hermes host.

3. **Custom sync tool that copies SKILL.md files** — rejected because the Hermes loader already implements "watch this dir for new SKILL.md" semantics; reinventing it adds drift between source and copy.

A curated symlink tree at this path is the chokepoint that gives us:

- **Explicit allowlist** — only what someone deliberately symlinked here reaches Hermes. No accidental wholesale imports.
- **Human-auditable** — `ls -la` (or `CURATED.md` per-pair record) is the full inventory.
- **Live editability** — edits to the source under `~/A/plugins/…` are picked up on the next loader pass with no sync step.
- **Reversible** — `rm <symlink>` removes a skill from Hermes' view; the source is untouched.
- **Conflict-policy-enforceable** — per `t_ab59140b` option (b), Hermes built-ins win on overlap; a curator adds a symlink only after confirming it isn't a duplicate (e.g. `work-google`, `work-ticktick` were excluded as overlaps with Hermes-native skills).

## Curation procedure (humans)

To **add** a Karelin skill to the Hermes view:

```bash
cd ~/A/.hermes-import/skills
ln -s ~/A/plugins/<plugin>/skills/<skill> <skill>
# Update CURATED.md with the per-pair record (see card t_e75288ef).
git add -A && git commit -m "skills/import: curate <skill> from <plugin> (Refs: t_e75288ef)"
```

To **remove**:

```bash
cd ~/A/.hermes-import/skills
rm <skill>
# Update CURATED.md noting the removal + reason.
git add -A && git commit -m "skills/import: drop <skill> (reason: …)"
```

Symlink names should match the source skill's directory name. Don't rename — the loader's skill identity is derived from the SKILL.md frontmatter `name:` field plus the directory name; renaming the symlink causes inconsistent display in `hermes skills list`.

## What does NOT belong here

- **`~/SD.agents/skills/`** — per scope decision `t_14d52142` / `t_88bd0502`, only `~/A` is surfaced; `~/SD.agents/skills/` is the WIP overflow store and stays internal.
- **Skills duplicating Hermes built-ins** — per conflict policy `t_ab59140b` option (b), Hermes wins. Verified overlaps to exclude as of 2026-05-20: `work-google`, `work-ticktick`.
- **Skills with destructive-git recipes** (`git reset --hard`, `git push --force`, equivalents) — forbidden by `~/RAN/AGENTS.md`.
- **Skills referencing `${CLAUDE_PLUGIN_ROOT}` or `mnt/.remote-plugins/`** — Claude-Code-shaped, paths don't exist on the Hermes host.
- **Skills with Windows-only paths** — Hermes runs on `alex-mac`.

The per-skill audit lives in `CURATED.md` (created by card `t_e75288ef`); consult it before adding new entries.

## Related cards

- `t_853bdb93` — umbrella (Karelin skills + MCP integration)
- `t_3b6c0f9b` — this card (create the tree + README)
- `t_e75288ef` — produce initial `CURATED.md` per-pair record
- `t_764e8127` — first batch of symlinks (Phase 1)
- `t_645780b9` — wire `skills.external_dirs` in `~/.hermes/config.yaml`
