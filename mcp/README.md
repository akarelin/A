# MCP Server

A multi-endpoint [Model Context Protocol](https://modelcontextprotocol.io/) server packaged as an Azure Function (Python). One container exposes several tool sets — Microsoft 365 Graph (via on-behalf-of), Azure Key Vault secrets, an Obsidian vault, Neo4j, TickTick, and Hindsight (persistent agent memory) — behind a single Entra ID OAuth app. All endpoints speak Streamable HTTP (MCP protocol `2025-03-26`).

## Architecture

```
Claude.ai / Claude Code / any MCP client
        │  Authorization: Bearer <Entra JWT>
        ▼
<MCP_HOST>                            (your reverse proxy / Application Proxy)
        │  pass-through; no auth stripping
        ▼
Azure Functions container (this repo)
        │
        ├── /.well-known/*, /register, /authorize,
        │   /oauth/callback, /token                  ← OAuth shim (anonymous)
        ├── /m365, /m365-admin                       ← open tier (allowlist)
        ├── /keys, /obsidian, /neo4j, /ticktick,
        │   /hindsight, /mcp-proxy/<slug>,
        │   /mcp, /                                  ← privileged tier (allowlist + role)
        └── /docs, /icons/*                          ← anonymous
```

The function validates inbound JWTs itself against the Entra JWKS, so it works behind any pass-through proxy and does not depend on platform-managed auth.

## Authentication

A single multi-tenant Entra app registration handles everything. It publishes one delegated scope, `<SCOPE_NAME>` (default `MCP.Access`), and exposes one app role, `<ROLE_NAME>` (default `MCP.Privileged`).

The flow is standard OAuth 2.0 authorization code with PKCE, brokered by this server so MCP clients see a normal `.well-known/oauth-authorization-server` discovery document:

1. Client hits any MCP endpoint without a Bearer → server returns `401` with `WWW-Authenticate: Bearer resource_metadata=…`.
2. Client fetches `.well-known/oauth-protected-resource` and `.well-known/oauth-authorization-server` and discovers `/authorize`, `/token`, `/register`.
3. Client `POST /register` (RFC 7591 DCR stub) — server returns its fixed Entra `client_id` so the caller can proceed without per-client registration in Entra.
4. Client `GET /authorize` with its own PKCE pair. The server stashes the caller's PKCE challenge, mints a fresh state nonce, and `302`s to Entra's `/authorize` with its own PKCE pair and the requested scope `<SCOPE_NAME>`.
5. User signs in at Microsoft. Entra `302`s back to `/oauth/callback?code=…`.
6. Server exchanges the code for tokens via MSAL using the confidential-client secret, mints an opaque code keyed to the real Entra token, and `302`s back to the client's `redirect_uri`.
7. Client `POST /token` with the opaque code + its PKCE verifier → server verifies PKCE and returns the Entra-issued JWT. `refresh_token` grants are proxied to Entra.

Every subsequent tool call must carry `Authorization: Bearer <jwt>`. The server validates:

- RS256 signature against the issuing tenant's `discovery/v2.0/keys` (cached 1 h)
- `aud` equals the configured `<CLIENT_ID>`
- `iss` equals `https://login.microsoftonline.com/<tid>/v2.0`
- `oid` claim is present and appears in the allowlist loaded from vault

## Authorization

Two tiers, both enforced in the same auth path:

| Tier | Endpoints | Requirement |
|---|---|---|
| Open | `/m365`, `/m365-admin` | `oid` in the allowlist. Per-user permission boundaries are enforced downstream by Microsoft Graph. |
| Privileged | `/keys`, `/obsidian`, `/neo4j`, `/ticktick`, `/hindsight`, `/openviking`, `/mcp-proxy/<slug>`, `/mcp`, `/` (alias) | Allowlist plus the `<ROLE_NAME>` app role in the JWT `roles` claim. Assign per-user in Entra. |

The role is assigned in Entra against the application's service principal; users must sign in again for a newly-assigned role to appear in their token.

## Microsoft Graph via on-behalf-of

The backend never calls Graph with its own identity. For every Graph request:

1. The validated user JWT is stashed in a `ContextVar` per request.
2. `graph_client.get_token()` reads it and calls `msal.acquire_token_on_behalf_of(user_assertion=<jwt>, scopes=["https://graph.microsoft.com/.default"])` using the app's confidential-client credentials.
3. Graph returns a token bound to the caller's identity (cached for ~1 h, keyed by SHA-256 of the assertion).
4. The Graph request runs with that token, so `/me/...` resolves natively and Graph itself enforces what each user can read or write.

Consequence: there is no `user=<someone-else>` override. A user cannot read another user's mailbox by passing a parameter — Graph will reject the call because the OBO token is bound to the original caller.

## Endpoints

| Path | Tier | Description |
|---|---|---|
| `/m365` | open | M365 user tools via Graph OBO: mail (list/read/search/send/draft/reply/folders), calendar (list/today/search/create/delete), Teams chats and channels (list/messages/send/search), OneDrive files (list/search), To Do tasks, contacts, OneNote notebooks, presence, unified `/search/query`. |
| `/m365-admin` | open | Read-only tenant inventory via Graph: users, groups (and members), domains, subscribed SKUs and per-user licences, devices, directory roles (and members), organisation info. Each user only sees what their own roles permit. |
| `/keys` | privileged | `secret_get`, `secret_list`, `secret_create`, `secret_update` against the configured Azure Key Vault. |
| `/obsidian` | privileged | Read/write to a local Obsidian vault via the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin: list, read, write, append, patch (by heading / block-reference / frontmatter-key), delete, open, run command, simple search, Dataview DQL search, tags, active note, daily note get/append. Tries each configured host in order and caches the one that responds. |
| `/neo4j` | privileged | Auto-discovers Neo4j servers from vault secrets of the form `neo4j-<server>-uri` / `neo4j-<server>-password`. Tools: `neo4j_list_servers`, `neo4j_use_server`, `read_neo4j_cypher`, `write_neo4j_cypher`, `get_neo4j_schema`. |
| `/ticktick` | privileged | TickTick projects, tasks, and time-tracking. Tasks: `tt_lists`, `tt_tasks`, `tt_create`, `tt_update`, `tt_complete`, `tt_abandon`. Focus sessions (Pomodoro + Timing) via `/open/v1/focus`: `tt_focus_list`, `tt_focus_get`, `tt_focus_delete`. Accepts natural-language dates (`today`, `tomorrow`, `yesterday`, `N days ago`, `this week`, `in N days`, `next monday`, ISO 8601). |
| `/hindsight` | privileged | Wraps the local Hindsight HTTP API ([vectorize-io/hindsight](https://github.com/vectorize-io/hindsight)) for persistent agent memory: `hindsight_health`, `hindsight_bank_list`, `hindsight_bank_stats`, `hindsight_bank_profile`, `hindsight_retain`, `hindsight_sync_retain`, `hindsight_recall`, `hindsight_reflect`, `hindsight_memory_list`, `hindsight_directive_list`, `hindsight_mental_model_list`. Per-bank isolation via the `bank_id` argument (default from `HINDSIGHT_DEFAULT_BANK`). |
| `/openviking` | privileged | Primary agentic-memory access through OpenViking's native MCP endpoint. Exposes read-only `openviking_find`, `openviking_search`, `openviking_read`, `openviking_list`, `openviking_grep`, `openviking_glob`, `openviking_code_outline`, `openviking_code_search`, `openviking_code_expand`, and `openviking_health`. Tool schemas are discovered from OpenViking at startup. Mutation remains in the chat-capture integrations. |
| `/mcp-proxy/<slug>` | privileged | Generic OAuth-MCP wrapper — forwards `tools/call` to an upstream MCP server, handling Bearer auth and refresh-on-401 transparently. One slug per upstream, configured via `MCP_PROXIES_JSON`. Currently: `neuronet` → Xsolla Neuronet (`neuronet_chat`, `neuronet_submit`, `neuronet_get_result`, `neuronet_health`). |
| `/mcp`, `/` | privileged | Aggregate endpoint exposing every tool from every module above **and** every proxy upstream. One MCP-client connection sees all dispatchable tools. |

Each endpoint also responds to `GET` with a JSON manifest (transport, protocol version, tool name list) for clients that want to introspect before authenticating.

## Proxy framework — wrapping external OAuth-protected MCP servers

`tools_mcp_proxy.py` implements a generic adapter that exposes a remote OAuth-protected MCP server as a local tool group, transparently handling Bearer auth and token refresh against an Azure Key Vault-backed token store. Each upstream is one entry in the `MCP_PROXIES_JSON` env var:

```json
[
  {"slug": "neuronet", "secret_prefix": "mcp-neuronet"},
  {"slug": "example",  "secret_prefix": "mcp-example", "tool_prefix": "example"}
]
```

Optional fields per entry: `upstream_url` (override vault), `scope` (override vault), `tool_prefix` (auto-prefix tool names that don't already share a prefix, to avoid collisions in the `/mcp` aggregator).

For each entry the gateway:

1. Reads `<secret_prefix>-{access-token,refresh-token,client-id,token-endpoint,upstream-url,scope}` from Azure Key Vault at startup.
2. Discovers the upstream's tool list via `initialize` + `tools/list`. Caches the result.
3. Exposes every tool under `/mcp-proxy/<slug>` **and** merges it into `/mcp` so a single MCP-client connection sees everything.
4. On `tools/call`, forwards to the upstream with the cached Bearer. On HTTP 401, runs the OAuth `refresh_token` grant, rewrites both `access-token` and `refresh-token` back to the vault (some upstreams rotate the refresh token on use), and retries once.

Both JSON and SSE (`event: message\ndata: {...}\n\n`) upstream response formats are handled — the gateway sends `Accept: application/json, text/event-stream` and parses whichever the server returns. Protocol version is `2025-06-18` for upstream calls.

**Adding a new proxy:** mint initial tokens via `~/RAN/AI/mcp/proxies/bootstrap.py <slug> --upstream <url> --secret-prefix mcp-<slug>` (writes 5–6 vault secrets), then add the slug to `MCP_PROXIES_JSON` in `~/RAN/AI/ai-docker-compose.yml` and redeploy. Full recipe in `~/RAN/AI/mcp/proxies/README.md`.

## Environment variables

| Variable | Purpose |
|---|---|
| `MCP_BASE_URL` | Public base URL the OAuth shim advertises in discovery documents and uses as its own redirect URI. Required. |
| `MCP_AUTH_MODE` | `entra` (validate JWT — production, default), `disabled` (no auth — dev only). |
| `AZURE_KEYVAULT_NAME` | Name of the Azure Key Vault the container reads all secrets from. The container's identity must have `get` (and `list`/`set` for `/keys` write tools) on the vault. |
| `MCP_TOOL_TEXT_LIMIT` | Max characters per tool response before truncation. Default `12000`. |
| `MCP_DEFAULT_USER` | Legacy default for the (now-ignored) `user` parameter on M365 tools. |
| `MCP_PROXIES_JSON` | JSON list of `/mcp-proxy/<slug>` upstreams to wire up at startup. Each entry needs `slug` + `secret_prefix`; optional `upstream_url`, `scope`, `tool_prefix`. See the proxy-framework section above. |
| `MCP_PROXY_UPSTREAM_TIMEOUT` / `MCP_PROXY_DISCOVERY_TIMEOUT` | Timeouts (seconds) for proxy `tools/call` forwarding and startup `tools/list` discovery. Defaults `120` / `30`. |
| `OBSIDIAN_BASE_URL` | Base URL of the Obsidian Local REST API (e.g. a reverse proxy fronting the plugin). TLS is not verified (self-signed certs accepted). |
| `OBSIDIAN_API_KEY` | Bearer token printed by the Obsidian Local REST API plugin. |
| `TICKTICK_CLIENT_ID` / `TICKTICK_CLIENT_SECRET` | OAuth credentials for TickTick. |
| `TICKTICK_ACCESS_TOKEN` / `TICKTICK_REFRESH_TOKEN` | TickTick tokens. The current build expects a pre-obtained access token. |
| `HINDSIGHT_API_BASE_URL` | Base URL for the Hindsight HTTP API. Default `http://127.0.0.1:8888`. Override when the container can't reach localhost (e.g. `http://host.docker.internal:8888`, `http://alex-mac:8888`, or `https://hindsight-api.karelin.ai`). |
| `HINDSIGHT_ORG` | Hindsight org id (path scope `/v1/{org}/...`). Default `default`. |
| `HINDSIGHT_DEFAULT_BANK` | Bank id used when a tool call omits `bank_id`. Default `alex`. |
| `HINDSIGHT_TIMEOUT` | HTTP timeout in seconds. Default `60`. |
| `OPENVIKING_MCP_URL` | OpenViking's native streamable-HTTP MCP endpoint. Required. |
| `OPENVIKING_USER` | OpenViking user identity sent in `X-OpenViking-User`. Required; production uses `alex`. |
| `OPENVIKING_API_KEY` | Bearer API key sent to the OpenViking MCP upstream (`Authorization: Bearer …`). Required since OpenViking enabled API-key identity resolution; vaulted as `openviking-api-key`. If unset/invalid, OpenViking tools are disabled but the rest of MCP United stays up (discovery failure no longer crashes the function app). |

## Vault secrets

The container resolves all sensitive configuration from Key Vault at runtime. Names below; values stay in vault.

| Secret name | Purpose |
|---|---|
| `mcp-entra-tenant-id` | Entra tenant id for the OAuth shim and OBO exchange. |
| `mcp-entra-client-id` | Application (client) id of the Entra app registration. |
| `mcp-entra-client-secret` | Confidential-client secret used for the `/oauth/callback` token exchange and for OBO. |
| `mcp-entra-resource-audience` | Identifier URI of the same app (e.g. `api://<MCP_HOST>`), used to construct the requested scope. |
| `mcp-allowed-oids` | Comma-separated list of Entra `oid` values permitted to call the server. |
| `neo4j-<server>-uri`, `neo4j-<server>-password` | One pair per Neo4j server. The `/neo4j` endpoint auto-discovers them. |

## Quick start

### Local dev (no auth)

```bash
pip install -r requirements.txt
export MCP_AUTH_MODE=disabled
export MCP_BASE_URL=http://localhost:7071
# Optional, only if you want to exercise tools that read vault:
export AZURE_KEYVAULT_NAME=<VAULT_NAME>
az login    # so DefaultAzureCredential can resolve

func start
```

Point an MCP client at `http://localhost:7071/mcp` (or any per-module path).

### Container

```bash
docker build -t mcp-server .
docker run --rm -p 7071:80 \
  -e MCP_AUTH_MODE=entra \
  -e MCP_BASE_URL=https://<MCP_HOST> \
  -e AZURE_KEYVAULT_NAME=<VAULT_NAME> \
  mcp-server
```

The image is a standard `mcr.microsoft.com/azure-functions/python` base; deploy it wherever you run containers (Azure Container Apps, Container Instances, plain Docker, etc.). Front it with TLS termination at `<MCP_HOST>`; the function should receive `Authorization` headers untouched.

### Client config

Point an MCP-aware client at any endpoint URL. Clients that support OAuth discovery (Claude.ai, Claude Code) will walk the flow automatically:

```bash
claude mcp add my-keys https://<MCP_HOST>/keys
```

Or wire individual endpoints into a static config:

```json
{
  "mcpServers": {
    "M365":      {"type": "http", "url": "https://<MCP_HOST>/m365"},
    "Keys":      {"type": "http", "url": "https://<MCP_HOST>/keys"},
    "Obsidian":  {"type": "http", "url": "https://<MCP_HOST>/obsidian"},
    "Neo4j":     {"type": "http", "url": "https://<MCP_HOST>/neo4j"},
    "TickTick":  {"type": "http", "url": "https://<MCP_HOST>/ticktick"},
    "Hindsight": {"type": "http", "url": "https://<MCP_HOST>/hindsight"}
  }
}
```

## Entra setup (one-time)

In your tenant, create an app registration with:

- **Supported account types:** Accounts in any organisational directory (multi-tenant).
- **Identifier URI:** `api://<MCP_HOST>`.
- **Redirect URI** (Web): `https://<MCP_HOST>/oauth/callback`.
- **Public client / native** flow: enabled (so device-code clients can use the same app).
- **Exposed API scope:** `<SCOPE_NAME>` (default `MCP.Access`).
- **App role:** `<ROLE_NAME>` (default `MCP.Privileged`), assignable to users.
- **Client secret:** create one and store its value as `mcp-entra-client-secret` in your vault.
- **API permissions (delegated Microsoft Graph):** whatever scopes you want the `/m365` tools to be able to exercise (Mail, Calendars, Files, Sites, etc.). Admin-consent them tenant-wide.

Populate the vault secrets listed above (`mcp-entra-tenant-id`, `mcp-entra-client-id`, `mcp-entra-client-secret`, `mcp-entra-resource-audience`, `mcp-allowed-oids`). Grant the container's identity `get` on the vault (and `list`/`set` if you use the `/keys` write tools).

## License

See `LICENSE`.
