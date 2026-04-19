# ManagedEngines-autodeploy

Experiment: deploy Alex's Claude Code plugin ecosystem as a **Claude Managed Agent** — research + HTML dashboard.

> **This folder is untracked on purpose.** Do not commit.

## What it does

1. Provisions a Managed Agent environment (unrestricted networking).
2. Creates a vault with MCP credentials for `mcp.karelin.ai` (Obsidian, Neo4j, M365) + Atlassian.
3. Uploads every `SKILL.md` under `../../plugins/` as a custom skill. Most will fail — they reference Claude Code harness tools and local scripts that don't exist in the sandbox. Failures are logged, not fatal.
4. Creates a persisted agent with the full Agent Toolset + the four MCP servers + all successfully-uploaded skills.
5. `run_agent.py` starts a session, streams events, writes outputs to `./outputs/`.

## Prerequisites

```bash
export ANTHROPIC_API_KEY=...
export MCP_KARELIN_PSK=...

# Optional — skip Atlassian if any of these are unset
export ATLASSIAN_ACCESS_TOKEN=...
export ATLASSIAN_REFRESH_TOKEN=...
export ATLASSIAN_CLIENT_ID=...

pip install 'anthropic>=0.92'
```

## Usage

```bash
# One-time setup — writes agent_config.json
python setup_agent.py

# Per-invocation
python run_agent.py "Summarize recent developments in Claude Managed Agents. Pull related Obsidian notes and connected Neo4j topics."
```

Generated HTML dashboard lands in `./outputs/report.html`.

## Caveats

- **Gateway auth assumption**: Vault credentials use `mcp_oauth` type with the PSK as `access_token`. This relies on `mcp.karelin.ai` accepting `Authorization: Bearer <PSK>`. If the gateway only accepts the legacy `x-api-key` header, MCP tool calls will 401 and we need the host-side bridge pattern instead.
- **Skill failures are expected**: Claude Code skills reference `Bash`/`Read`/`Skill(get-secret)` in `allowed-tools` and local scripts like `work-m365`. Managed Agent skills need re-authoring.
- **Meta-skills are dead weight here**: `session`, `agent`, `skill`, `compose-agent`, `learn`, `memory`, `core` manage Claude Code itself and have no meaning in a hosted sandbox.

## See also

- Project notes: `~/_/Projects/ManagedEngines-autodeploy.md`
- Managed Agents docs: https://platform.claude.com/docs/en/managed-agents/overview
