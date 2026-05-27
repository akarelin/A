"""Generic MCP-over-MCP proxy: expose an upstream OAuth-protected MCP server
as one of this gateway's tool groups, transparently handling Bearer auth and
token refresh against an Azure Key Vault-backed token store.

Design
------

Each proxy is configured by a dict (see ``McpProxy.from_config``)::

    {
      "slug":          "neuronet",                # path suffix under /mcp-proxy/
      "upstream_url":  "https://mcp.example.com/mcp",
      "secret_prefix": "mcp-neuronet",            # vault secret name prefix
      "tool_prefix":   "neuronet",                # optional, auto-prefix tool names
      "scope":         "neuronet:chat ...",       # optional, only used on refresh
    }

Vault secrets read at startup (and rewritten on each refresh):

  <secret_prefix>-access-token        — current access token
  <secret_prefix>-refresh-token       — current refresh token
  <secret_prefix>-client-id           — OAuth client_id (public, no secret)
  <secret_prefix>-token-endpoint      — OAuth /token URL

Plus optionally read once (never rewritten):

  <secret_prefix>-upstream-url        — alternative to passing in config
  <secret_prefix>-scope               — alternative to passing in config

Discovery happens once at construction: we POST ``initialize`` + ``tools/list``
against the upstream and cache the result. Each ``tools/call`` is forwarded
upstream with the cached Bearer; on a 401 we refresh once, rewrite the vault
secrets, and retry.

Token refresh is best-effort: two concurrent Function instances refreshing
the same upstream is rare (24h-ish token life) and the loser just writes a
slightly older token that the next 401 will recycle.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from typing import Any, Callable

import requests
from gppu import Vault

UPSTREAM_TIMEOUT = float(os.environ.get("MCP_PROXY_UPSTREAM_TIMEOUT", "120"))
DISCOVERY_TIMEOUT = float(os.environ.get("MCP_PROXY_DISCOVERY_TIMEOUT", "30"))
PROTOCOL_VERSION = "2025-06-18"  # latest as of the Xsolla Neuronet probe.

_log = logging.getLogger("mcp_proxy")


def _now() -> int:
    return int(time.time())


def _parse_sse_or_json(resp: requests.Response) -> dict[str, Any]:
    """Upstream may answer JSON or SSE (``event: message\\ndata: {...}\\n\\n``).

    We always send ``Accept: application/json, text/event-stream`` so the
    upstream chooses. Normalise both into a plain dict.
    """
    ct = resp.headers.get("Content-Type", "")
    if "text/event-stream" in ct:
        # One event expected. Take the last ``data:`` line.
        for line in resp.text.splitlines():
            if line.startswith("data:"):
                return json.loads(line[5:].strip())
        raise ValueError(f"SSE response had no data line: {resp.text[:200]}")
    return resp.json()


class McpProxy:
    """One upstream MCP server, fronted by this gateway."""

    def __init__(
        self,
        slug: str,
        upstream_url: str,
        secret_prefix: str,
        tool_prefix: str | None = None,
        scope: str | None = None,
    ):
        self.slug = slug
        self.upstream_url = upstream_url.rstrip("/")
        self.secret_prefix = secret_prefix
        self.tool_prefix = tool_prefix
        self.scope = scope

        self._lock = threading.Lock()
        self._access_token: str | None = None
        self._session_id: str | None = None  # MCP session, if upstream uses one

        # Tools discovered at startup. Each entry is the upstream tool dict
        # with ``name`` rewritten per the prefix rule.
        self.tools: list[dict[str, Any]] = []
        self._upstream_name_by_local: dict[str, str] = {}

        self._bootstrap()

    # ── factory ────────────────────────────────────────────────────

    @classmethod
    def from_config(cls, cfg: dict[str, Any]) -> "McpProxy":
        slug = cfg["slug"]
        secret_prefix = cfg["secret_prefix"]
        upstream_url = cfg.get("upstream_url") or Vault.get(f"{secret_prefix}-upstream-url")
        if not upstream_url:
            raise ValueError(f"mcp-proxy[{slug}]: no upstream_url in config or vault")
        scope = cfg.get("scope") or Vault.get(f"{secret_prefix}-scope") or None
        return cls(
            slug=slug,
            upstream_url=upstream_url,
            secret_prefix=secret_prefix,
            tool_prefix=cfg.get("tool_prefix"),
            scope=scope,
        )

    # ── name handling ──────────────────────────────────────────────

    def _local_name(self, upstream_name: str) -> str:
        """Apply the tool-name prefix rule.

        If a ``tool_prefix`` is configured and the upstream name doesn't
        already start with ``<prefix>_``, prepend it. This avoids
        ``neuronet_neuronet_chat`` while still namespacing tools from a
        less-cooperative upstream.
        """
        if not self.tool_prefix:
            return upstream_name
        pref = f"{self.tool_prefix}_"
        if upstream_name.startswith(pref):
            return upstream_name
        return pref + upstream_name

    # ── vault I/O ──────────────────────────────────────────────────

    def _vault_get(self, suffix: str) -> str | None:
        return Vault.get(f"{self.secret_prefix}-{suffix}")

    def _vault_update(self, suffix: str, value: str) -> None:
        Vault.update(f"{self.secret_prefix}-{suffix}", value, create=True)

    # ── bootstrap: load tokens + discover tools ───────────────────

    def _bootstrap(self) -> None:
        self._access_token = self._vault_get("access-token")
        if not self._access_token:
            raise RuntimeError(
                f"mcp-proxy[{self.slug}]: no access token in vault "
                f"({self.secret_prefix}-access-token). Run bootstrap.py to seed."
            )
        self._discover_tools()

    def _discover_tools(self) -> None:
        # initialize then tools/list. Use the same Bearer for both.
        init_resp = self._upstream_call(
            method="initialize",
            params={
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {"name": f"karelin-mcp-proxy[{self.slug}]", "version": "1.0.0"},
            },
            timeout=DISCOVERY_TIMEOUT,
        )
        # Some upstreams hand back an Mcp-Session-Id header to use on subsequent calls.
        # We surface that via _upstream_call's side-effect on self._session_id.
        _ = init_resp  # not currently needed beyond validating auth

        tools_resp = self._upstream_call(
            method="tools/list",
            params={},
            timeout=DISCOVERY_TIMEOUT,
        )
        tools = (tools_resp.get("result") or {}).get("tools") or []
        rewritten: list[dict[str, Any]] = []
        for t in tools:
            up_name = t.get("name")
            if not up_name:
                continue
            local = self._local_name(up_name)
            self._upstream_name_by_local[local] = up_name
            new_t = dict(t)
            new_t["name"] = local
            rewritten.append(new_t)
        self.tools = rewritten
        _log.info(
            "mcp-proxy[%s]: discovered %d tools from %s",
            self.slug, len(self.tools), self.upstream_url,
        )

    # ── upstream JSON-RPC ─────────────────────────────────────────

    def _upstream_call(
        self,
        method: str,
        params: dict[str, Any],
        timeout: float | None = None,
    ) -> dict[str, Any]:
        """Send one JSON-RPC request to the upstream. Returns parsed dict.

        On HTTP 401, refresh the access token once and retry. Any other
        non-2xx becomes a ``RuntimeError`` carrying the response text.
        """
        body = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
        for attempt in (1, 2):
            access = self._access_token
            assert access, "access token missing — bootstrap should have failed earlier"
            headers = {
                "Authorization": "Bearer " + access,
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
                "MCP-Protocol-Version": PROTOCOL_VERSION,
            }
            if self._session_id:
                headers["Mcp-Session-Id"] = self._session_id
            resp = requests.post(
                self.upstream_url,
                json=body,
                headers=headers,
                timeout=timeout or UPSTREAM_TIMEOUT,
            )
            new_session = resp.headers.get("Mcp-Session-Id")
            if new_session:
                self._session_id = new_session
            if resp.status_code == 401 and attempt == 1:
                _log.info("mcp-proxy[%s]: 401 from upstream, refreshing token", self.slug)
                self._refresh_token()
                continue
            if resp.status_code >= 400:
                raise RuntimeError(
                    f"upstream {self.upstream_url} returned {resp.status_code}: "
                    f"{resp.text[:500]}"
                )
            return _parse_sse_or_json(resp)
        raise RuntimeError(f"upstream {self.upstream_url}: 401 even after refresh")

    # ── token refresh ─────────────────────────────────────────────

    def _refresh_token(self) -> None:
        """OAuth refresh_token grant. Writes new access+refresh tokens to vault."""
        with self._lock:
            refresh_token = self._vault_get("refresh-token")
            client_id = self._vault_get("client-id")
            token_endpoint = self._vault_get("token-endpoint")
            if not (refresh_token and client_id and token_endpoint):
                raise RuntimeError(
                    f"mcp-proxy[{self.slug}]: missing vault secret "
                    f"({self.secret_prefix}-{{refresh-token,client-id,token-endpoint}})"
                )
            data = {
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": client_id,
            }
            if self.scope:
                data["scope"] = self.scope
            resp = requests.post(
                token_endpoint,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=30,
            )
            if resp.status_code != 200:
                raise RuntimeError(
                    f"mcp-proxy[{self.slug}]: refresh failed "
                    f"({resp.status_code}): {resp.text[:300]}"
                )
            tok = resp.json()
            new_access = tok.get("access_token")
            if not new_access:
                raise RuntimeError(
                    f"mcp-proxy[{self.slug}]: refresh response missing access_token: {tok}"
                )
            self._access_token = new_access
            self._vault_update("access-token", new_access)
            # Some servers rotate refresh tokens; some don't return one.
            new_refresh = tok.get("refresh_token")
            if new_refresh and new_refresh != refresh_token:
                self._vault_update("refresh-token", new_refresh)
            _log.info("mcp-proxy[%s]: token refreshed", self.slug)

    # ── tool call dispatch ────────────────────────────────────────

    def dispatch_tool(self, local_name: str, arguments: dict[str, Any]) -> Any:
        upstream_name = self._upstream_name_by_local.get(local_name)
        if not upstream_name:
            raise ValueError(f"unknown tool: {local_name}")
        resp = self._upstream_call(
            method="tools/call",
            params={"name": upstream_name, "arguments": arguments or {}},
        )
        # Bubble up the upstream's content array. The gateway's _handle()
        # will wrap whatever we return in a {"content":[{"type":"text"...}]}
        # — we return the inner ``result`` so the caller sees the raw upstream
        # payload.
        if "error" in resp:
            return resp["error"]
        return resp.get("result", resp)


# ── registry ──────────────────────────────────────────────────────

_PROXIES: dict[str, McpProxy] = {}
_LOAD_ATTEMPTED = False


def load_proxies() -> dict[str, McpProxy]:
    """Read ``MCP_PROXIES_JSON`` env var and instantiate each entry.

    Idempotent: subsequent calls return the cached dict. Construction
    failures are logged and skipped; one bad proxy doesn't take down the
    others.
    """
    global _LOAD_ATTEMPTED
    if _LOAD_ATTEMPTED:
        return _PROXIES
    _LOAD_ATTEMPTED = True

    raw = os.environ.get("MCP_PROXIES_JSON", "").strip()
    if not raw:
        _log.info("mcp-proxy: MCP_PROXIES_JSON empty, no proxies registered")
        return _PROXIES
    try:
        cfgs = json.loads(raw)
    except json.JSONDecodeError as e:
        _log.error("mcp-proxy: MCP_PROXIES_JSON is not valid JSON: %s", e)
        return _PROXIES
    if not isinstance(cfgs, list):
        _log.error("mcp-proxy: MCP_PROXIES_JSON must be a list, got %s", type(cfgs).__name__)
        return _PROXIES

    for cfg in cfgs:
        try:
            proxy = McpProxy.from_config(cfg)
        except Exception as e:
            _log.error(
                "mcp-proxy: failed to load %s: %s",
                cfg.get("slug", "<no-slug>"), e,
            )
            continue
        if proxy.slug in _PROXIES:
            _log.error("mcp-proxy: duplicate slug %s, skipping", proxy.slug)
            continue
        _PROXIES[proxy.slug] = proxy
    return _PROXIES


def get_proxy(slug: str) -> McpProxy | None:
    return load_proxies().get(slug)


def list_proxies() -> list[str]:
    return list(load_proxies().keys())
