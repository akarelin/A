"""Read-only OpenViking MCP proxy for MCP United."""

from __future__ import annotations

import json
import os
from typing import Any

import requests

UPSTREAM_URL = os.environ["OPENVIKING_MCP_URL"].rstrip("/")
OPENVIKING_USER = os.environ["OPENVIKING_USER"]
PROTOCOL_VERSION = "2025-06-18"
TOOL_PREFIX = "openviking_"
ALLOWED_TOOLS = {
    "find",
    "search",
    "read",
    "list",
    "grep",
    "glob",
    "code_outline",
    "code_search",
    "code_expand",
    "health",
}


def _parse_response(response: requests.Response) -> dict[str, Any]:
    response.raise_for_status()
    if "text/event-stream" not in response.headers.get("Content-Type", ""):
        payload = response.json()
    else:
        data_lines = [
            line[5:].strip()
            for line in response.text.splitlines()
            if line.startswith("data:")
        ]
        if not data_lines:
            raise RuntimeError("OpenViking MCP returned SSE without a data event")
        payload = json.loads(data_lines[-1])
    if "error" in payload:
        raise RuntimeError(payload["error"])
    return payload


def _headers(session_id: str | None = None) -> dict[str, str]:
    headers = {
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
        "MCP-Protocol-Version": PROTOCOL_VERSION,
        "X-OpenViking-User": OPENVIKING_USER,
    }
    if session_id:
        headers["Mcp-Session-Id"] = session_id
    return headers


def _request(method: str, params: dict[str, Any], session_id: str | None = None):
    response = requests.post(
        UPSTREAM_URL,
        headers=_headers(session_id),
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
    )
    return response, _parse_response(response)


def _initialize() -> str:
    response, _ = _request(
        "initialize",
        {
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {},
            "clientInfo": {"name": "mcp-united-openviking", "version": "1.0.0"},
        },
    )
    session_id = response.headers.get("Mcp-Session-Id")
    if not session_id:
        raise RuntimeError("OpenViking MCP initialize returned no session id")
    return session_id


def _discover_tools() -> list[dict[str, Any]]:
    session_id = _initialize()
    _, payload = _request("tools/list", {}, session_id)
    upstream_tools = (payload.get("result") or {}).get("tools") or []
    discovered = {tool.get("name"): tool for tool in upstream_tools}
    missing = ALLOWED_TOOLS - discovered.keys()
    if missing:
        raise RuntimeError(f"OpenViking MCP missing required tools: {sorted(missing)}")
    tools = []
    for name in sorted(ALLOWED_TOOLS):
        tool = dict(discovered[name])
        tool["name"] = TOOL_PREFIX + name
        tools.append(tool)
    return tools


TOOLS = _discover_tools()


def dispatch_tool(name: str, arguments: dict[str, Any]) -> Any:
    if not name.startswith(TOOL_PREFIX):
        raise ValueError(f"unknown tool: {name}")
    upstream_name = name[len(TOOL_PREFIX):]
    if upstream_name not in ALLOWED_TOOLS:
        raise ValueError(f"OpenViking mutation tool is not exposed: {upstream_name}")
    session_id = _initialize()
    _, payload = _request(
        "tools/call",
        {"name": upstream_name, "arguments": arguments or {}},
        session_id,
    )
    result = payload.get("result", payload)
    structured = result.get("structuredContent") if isinstance(result, dict) else None
    if isinstance(structured, dict) and "result" in structured:
        return structured["result"]
    return result
