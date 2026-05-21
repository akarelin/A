# `~/A/.hermes-import/skills/CURATED.md` — Phase-1 per-skill audit

Card: `t_e75288ef`. Parent design: `~/RAN/AI/hermes/decisions/t_9af0bec9-integration-design.md` §6 card 2. Source survey: `~/RAN/AI/hermes/surveys/t_583daa89/REPORT.md` (commit `5d3285d19`; `inventory.csv` has 315-row per-skill classification). Conflict policy: `~/RAN/AI/hermes/decisions/t_ab59140b-conflict-policy.md`. Scope: ADR `t_14d52142` — `~/A` only; `~/SD.agents/skills/` is NOT surfaced.

## Scope of Phase 1

Per scope ADR `t_14d52142`, only `~/A/plugins/*/skills/*` candidates. That's exactly **32 skills**. This file is the explicit per-skill accept/reject record against the five Phase-1 filters from the task body:

1. Frontmatter-valid (a parseable YAML block with at least `name:` and `description:`).
2. No `${CLAUDE_PLUGIN_ROOT}` references.
3. No `mnt/.remote-plugins/` (or `mnt/.local-plugins/`, `mnt/.auto-memory`) paths.
4. No Windows-only paths (`C:\…`, `D:\…`, `OneDrive - Karelin`-style absolutes).
5. No destructive-git recipes (`git reset --hard`, `git push --force`, `git push -f`, `--force-with-lease`).

A skill enters Phase 1 iff it satisfies **all five** AND is not excluded by the `t_ab59140b` conflict-policy table.

## Decision table (32 entries, source: `~/A/plugins/*/skills/*/SKILL.md`)

Markers in the third column come from `~/RAN/AI/hermes/surveys/t_583daa89/inventory.csv`.

| # | Skill | Survey class / markers | Decision | One-line reason |
|---|---|---|---|---|
| 1  | `administer/skills/administer`                                   | hermes-compat | **accept** | Router prose; clean frontmatter; no CC affordances. |
| 2  | `administer/skills/admin-gcp`                                    | cc-shaped: `fm_allowed_tools` | reject | `allowed-tools:` frontmatter (Hermes ignores it; skill assumes a restricted tool set that doesn't apply). |
| 3  | `administer/skills/admin-m365`                                   | cc-shaped: `fm_allowed_tools`, `fm_argument_hint`, `claude_plugin_root` | reject | `${CLAUDE_PLUGIN_ROOT}/scripts` path resolves to empty on Hermes (filter #2). |
| 4  | `administer/skills/admin-portainer`                              | cc-shaped: `fm_allowed_tools` | reject | `allowed-tools:` frontmatter + CC slash-command shape. (Karelin already runs the canonical Portainer deploy out of `~/RAN/AGENTS.md` / `RAN/Services/deploy/portainer-deploy.sh`; loading a parallel skill text invites drift.) |
| 5  | `core/skills/agent`                                              | hermes-compat | reject | Stub: 11-line "interface to be defined" placeholder. No content to load. |
| 6  | `core/skills/compose-agent`                                      | cc-shaped: `fm_allowed_tools`, `askuserquestion`, `mnt_path`, `explicit_cc` | reject | `mnt/.remote-plugins/` paths (filter #3) + `AskUserQuestion` tool name-drop. |
| 7  | `core/skills/core`                                               | cc-shaped: `cc_sessions`, `explicit_cc` | reject | Built around `~/.claude/sessions/` semantics; Hermes uses its own session DB. |
| 8  | `core/skills/learn`                                              | hermes-compat | reject | Stub: 12-line "interface to be defined" placeholder. No content to load. |
| 9  | `core/skills/memory`                                             | cc-shaped: `fm_allowed_tools`, `askuserquestion` | reject | Overlap with Hermes built-in `memory` tool (`memory(action='add'|'replace'|'remove', target='memory'|'user')`); per conflict policy `t_ab59140b` option (b), Hermes wins. |
| 10 | `core/skills/session`                                            | cc-shaped: `claude_plugin_root`, `cc_sessions` | reject | `${CLAUDE_PLUGIN_ROOT}` (filter #2) + `~/.claude/sessions/` semantics. |
| 11 | `core/skills/skill`                                              | cc-shaped: `claude_plugin_root`, `mnt_plugins`, `mnt_automemory`, `slash_plugin`, `sessions_path`, `remote_plugins` | reject | `mnt/.remote-plugins/` + `mnt/.auto-memory/` paths (filter #3). Overlap with Hermes built-in `skill_manage` / `skill_view` / `skills_list`; Hermes wins per `t_ab59140b`. |
| 12 | `develop/skills/rewrite-history`                                 | hermes-compat | reject | Contains `git reset --hard origin/<branch>` (line 49) and `git push --force origin refs/tags/*:refs/tags/*` (line 108) — destructive-git recipes (filter #5) forbidden by `~/RAN/AGENTS.md` and `kanban-worker` skill. |
| 13 | `manage/skills/manage`                                           | cc-shaped: `cc_sessions`, `explicit_cc` | reject | Built around "Claude Code sessions" terminology; no Hermes analogue. |
| 14 | `organize/skills/organize`                                       | cc-shaped: `claude_plugin_root` | reject | `${CLAUDE_PLUGIN_ROOT}/skills` for sub-skill discovery (filter #2). |
| 15 | `organize/skills/organize-arxiv`                                 | cc-shaped: `claude_plugin_root` | reject | `${CLAUDE_PLUGIN_ROOT}` (filter #2). |
| 16 | `organize/skills/organize-scan`                                  | hermes-compat | accept-deferred | Pure-prose router but its only sub-skill (`organize-scan-medical`) is rejected; router with zero accepted children is dead weight. Re-evaluate when `organize-scan-medical` is cleaned up. |
| 17 | `organize/skills/organize-scan-medical`                          | cc-shaped: `claude_plugin_root` | reject | `${CLAUDE_PLUGIN_ROOT}` (filter #2). |
| 18 | `research/skills/research`                                       | hermes-compat | **accept** | Router prose; clean frontmatter; describes search/data sub-skills. |
| 19 | `research/skills/data`                                           | hermes-compat | **accept** | Router prose; clean frontmatter; describes neo4j/sql sub-skills. |
| 20 | `research/skills/data/skills/data-neo4j`                         | hermes-compat | **accept** | References `mcp.karelin.ai/neo4j` (live per t_524d1ec3 / t_2c22b80a, 82 tools verified). MCP wired via `native-mcp`; clean frontmatter; no path/CC breaks. |
| 21 | `research/skills/data/skills/data-sql`                           | hermes-compat | **accept** | References `dbhub` (`@bytebase/dbhub` via npx-stdio). Skill text is portable; if no dbhub MCP is wired the worker discovers tool-not-found, not a silent break. Clean frontmatter. |
| 22 | `research/skills/search`                                         | cc-shaped: `fm_allowed_tools`, `askuserquestion` | reject | `AskUserQuestion` tool name-drop is a CC affordance Hermes doesn't expose under that name; `allowed-tools:` frontmatter ignored. Skill text would mislead. |
| 23 | `work/skills/work`                                               | hermes-compat | **accept** | Router prose for the four work-* sub-skills; clean frontmatter. Note: routes to `work-google` even though that's excluded (see #28); router prose stays but routing entry is a soft pointer to a Hermes built-in (`productivity/google-workspace`). |
| 24 | `work/skills/work-atlassian`                                     | hermes-compat | **accept** | Per `t_ab59140b`: Karelin-unique (no Hermes equivalent for Jira/Confluence). Clean frontmatter; references `mcp.atlassian.com` MCP. |
| 25 | `work/skills/work-atlassian/work-atlassian-capture`              | hermes-compat | **accept** | Sub-skill of work-atlassian; meeting-notes → Jira tasks workflow. Karelin-unique. |
| 26 | `work/skills/work-atlassian/work-atlassian-spec`                 | hermes-compat | **accept** | Sub-skill of work-atlassian; Confluence spec → Jira backlog. Karelin-unique. |
| 27 | `work/skills/work-atlassian/work-atlassian-status`               | hermes-compat | **accept** | Sub-skill of work-atlassian; Jira → Confluence status report. Karelin-unique. |
| 28 | `work/skills/work-atlassian/work-atlassian-triage`               | hermes-compat | **accept** | Sub-skill of work-atlassian; bug-triage dup-search. Karelin-unique. |
| 29 | `work/skills/work-google`                                        | cc-shaped: `fm_allowed_tools`, `fm_argument_hint`, `claude_plugin_root` | reject | Per `t_ab59140b`: overlap with Hermes built-in `productivity/google-workspace` — Hermes wins. Also `${CLAUDE_PLUGIN_ROOT}` (filter #2). |
| 30 | `work/skills/work-m365`                                          | cc-shaped: `fm_allowed_tools`, `fm_argument_hint`, `claude_plugin_root` | rewrite-then-accept (defer) | Per `t_ab59140b`: Karelin-unique (no Hermes Graph-beta equivalent). But blocked by filter #2 (`${CLAUDE_PLUGIN_ROOT}/scripts/m365-*` shell invocations) and filter #1-adjacent (`allowed-tools:`/`argument-hint:`). Phase-1 reject; file a rewrite card. |
| 31 | `work/skills/work-slack`                                         | hermes-compat | **accept** | Per `t_ab59140b`: Karelin-unique (no Hermes first-party Slack skill; the design doc's slack-via-MCP is a candidate, not shipped). Clean frontmatter; references `mcp.slack.com` MCP. **Caveat:** revisit when a Hermes slack-MCP integration lands — flip to prefer-Hermes per `t_ab59140b` reverse-drift rule. |
| 32 | `work/skills/work-ticktick`                                      | cc-shaped: `fm_allowed_tools`, `fm_argument_hint`, `claude_plugin_root` | reject | Per `t_ab59140b`: overlap with Hermes built-in `productivity/ticktick` — Hermes wins. Also `${CLAUDE_PLUGIN_ROOT}` (filter #2). |

## Phase-1 accept list (12 skills)

The accepts (column "Decision" = **accept**) — these are the symlinks the next card (`t_764e8127`) should create under `~/A/.hermes-import/skills/`:

```
administer
research
data
data-neo4j
data-sql
work
work-atlassian
work-atlassian-capture
work-atlassian-spec
work-atlassian-status
work-atlassian-triage
work-slack
```

Symlink command shape (per the README contract):

```bash
cd ~/A/.hermes-import/skills
ln -s ../../plugins/administer/skills/administer administer
ln -s ../../plugins/research/skills/research research
ln -s ../../plugins/research/skills/data data
ln -s ../../plugins/research/skills/data/skills/data-neo4j data-neo4j
ln -s ../../plugins/research/skills/data/skills/data-sql data-sql
ln -s ../../plugins/work/skills/work work
ln -s ../../plugins/work/skills/work-atlassian work-atlassian
ln -s ../../plugins/work/skills/work-atlassian/work-atlassian-capture work-atlassian-capture
ln -s ../../plugins/work/skills/work-atlassian/work-atlassian-spec work-atlassian-spec
ln -s ../../plugins/work/skills/work-atlassian/work-atlassian-status work-atlassian-status
ln -s ../../plugins/work/skills/work-atlassian/work-atlassian-triage work-atlassian-triage
ln -s ../../plugins/work/skills/work-slack work-slack
```

## Phase-1 size — why 12, not ~30

The task body targets "~30 skills (target, not hard cap)." After applying scope ADR `t_14d52142` (which post-dates the survey REPORT.md's bucket-A enumeration), the candidate pool shrank from "~50–80 across `~/A` + `~/SD.agents`" to exactly 32 (`~/A/plugins/*` only). Of those 32:

- **12 accept** (Phase 1, this file).
- **1 accept-deferred** (`organize-scan` — router with all children rejected).
- **2 rewrite-then-accept** candidates worth following up: `work-m365` (Karelin-unique by `t_ab59140b`, only blocked by `${CLAUDE_PLUGIN_ROOT}` + frontmatter), plus optionally `core/{compose-agent, memory, skill}` if a future card decides to compete with Hermes built-ins via a fork-and-strip path.
- **2 stubs** (`agent`, `learn` — both 11-12 lines of "interface to be defined" placeholder).
- **15 rejected** for hard reasons (CC frontmatter, `${CLAUDE_PLUGIN_ROOT}`, `mnt/.remote-plugins`, destructive git, conflict-policy overlap with Hermes built-in).

A ~30 Phase-1 list under the current scope would require either (a) lifting the `~/SD.agents/` scope restriction (would mean reopening ADR `t_14d52142`), or (b) re-targeting `~/A` plugins beyond skills (e.g. agent definitions, commands) — neither is in scope for this card.

## Overlap-pair audit (per `t_ab59140b` §"Overlap pairs")

Each of the five overlap pairs from the conflict-policy doc, with this file's decision row referenced:

| Karelin | Hermes | `t_ab59140b` decision | This file's row | Status |
|---|---|---|---|---|
| `work/work-google` | `productivity/google-workspace` | prefer Hermes | row 29 | reject ✓ |
| `work/work-ticktick` | `productivity/ticktick` | prefer Hermes | row 32 | reject ✓ |
| `work/work-m365` | (none) | surface Karelin | row 30 | rewrite-then-accept (Phase-2 candidate) ✓ |
| `work/work-atlassian` | (none) | surface Karelin | rows 24-28 | accept ✓ (5 entries: parent + 4 sub-skills) |
| `work/work-slack` | (none — see slack-MCP note) | surface Karelin | row 31 | accept ✓ (with the noted revisit-when-MCP-lands caveat) |

All five overlap pairs are explicitly resolved.

Implicit additional overlaps surfaced during sanity-read (not in the `t_ab59140b` table — these are Karelin-vs-Hermes-built-in overlaps that the conflict-policy doc didn't enumerate because they're inside the `core/` plugin rather than the `work/` plugin):

| Karelin | Hermes built-in | This file's row | Decision |
|---|---|---|---|
| `core/memory` | `memory` tool (`add`/`replace`/`remove` × `memory`/`user`) | row 9 | reject — Hermes built-in wins |
| `core/skill` | `skill_view`, `skill_manage`, `skills_list` tools + Hermes skill loader | row 11 | reject — Hermes built-in wins (and Karelin version has `mnt/` paths regardless) |
| `core/session` | `session_search` tool + Hermes session DB | row 10 | reject — Hermes built-in wins (and Karelin version is `~/.claude/sessions/`-shaped regardless) |

These follow the same `t_ab59140b` option (b) rule: prefer Hermes built-ins on overlap.

## Follow-up cards to file

(Out of scope for this card; recording the suggestion for downstream.)

1. **Card "rewrite-and-accept `work-m365`"** — strip `${CLAUDE_PLUGIN_ROOT}` and frontmatter; the underlying Graph-API workflows are Karelin-unique per `t_ab59140b`.
2. **Card "audit `core/{compose-agent, memory, skill, session}` for portable subset"** — even though Hermes built-ins win on the named tools, portions of these skills may have prose worth lifting into Hermes built-in skills.
3. **Card "re-evaluate `organize-scan` family"** — after `organize-scan-medical` (and any future `organize-scan-*` siblings) are cleaned of `${CLAUDE_PLUGIN_ROOT}`, the router becomes useful.
4. **Slack-MCP revisit** — per `t_ab59140b` reverse-drift rule, when a Hermes-native Slack skill or MCP lands, flip row 31 from accept to reject and drop the `work-slack` symlink.

## Related cards

- `t_853bdb93` — umbrella (Karelin skills + MCP integration).
- `t_3b6c0f9b` — curation tree + README (parent of this card).
- `t_ab59140b` — conflict policy (parent of this card).
- `t_583daa89` — compatibility survey (source of inventory.csv and REPORT.md).
- `t_14d52142` — scope ADR (`~/A` only).
- `t_26a83f64` — skill-loading ADR (external_dirs + curation tree).
- `t_764e8127` — Phase-1 symlink execution (consumes this file; blocked on this card).
- `t_645780b9` — wire `skills.external_dirs` in `~/.hermes/config.yaml`.
