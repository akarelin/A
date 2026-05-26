"""MCP tools for Hindsight (vectorize-io/hindsight) — persistent agent memory.

Talks to the local Hindsight HTTP API (default http://127.0.0.1:8888). The
container running MCP United must be able to reach this URL — override with
HINDSIGHT_API_BASE_URL (e.g. http://host.docker.internal:8888 from Docker on
the host, or https://hindsight-api.karelin.ai if exposed via nginx).

API surface follows the per-org `/v1/{org}/banks/{bank}/...` pattern; the
upstream uses `default` as the org id, exposed here as HINDSIGHT_ORG.
"""

import os

import requests

API_BASE = os.environ.get("HINDSIGHT_API_BASE_URL", "http://127.0.0.1:8888").rstrip("/")
ORG = os.environ.get("HINDSIGHT_ORG", "default")
DEFAULT_BANK = os.environ.get("HINDSIGHT_DEFAULT_BANK", "alex")
TIMEOUT = float(os.environ.get("HINDSIGHT_TIMEOUT", "60"))


def _bank(a):
    return a.get("bank_id") or DEFAULT_BANK


def _req(method, path, **kw):
    url = f"{API_BASE}{path}"
    try:
        r = requests.request(method, url, timeout=TIMEOUT, **kw)
    except requests.RequestException as e:
        return {"error": f"hindsight unreachable at {API_BASE}: {e}"}
    if r.status_code >= 400:
        return {"error": f"HTTP {r.status_code}: {r.text[:500]}"}
    if not r.content:
        return {"ok": True}
    try:
        return r.json()
    except ValueError:
        return {"text": r.text}


# -- Tool Definitions --

_BANK_PROP = {"bank_id": {"type": "string",
                          "description": f"Hindsight bank id. Defaults to '{DEFAULT_BANK}'."}}

TOOLS = [
    {"name": "hindsight_health",
     "description": "Health probe for the Hindsight API. Returns status + DB connectivity.",
     "inputSchema": {"type": "object", "properties": {}}},

    {"name": "hindsight_bank_list",
     "description": "List Hindsight banks (per-agent memory stores).",
     "inputSchema": {"type": "object", "properties": {}}},

    {"name": "hindsight_bank_stats",
     "description": "Stats for a bank: total_documents, total_nodes, total_links, pending/failed operations.",
     "inputSchema": {"type": "object", "properties": _BANK_PROP}},

    {"name": "hindsight_bank_profile",
     "description": "Bank profile (mission, tone, etc.) — the agent identity attached to the bank.",
     "inputSchema": {"type": "object", "properties": _BANK_PROP}},

    {"name": "hindsight_retain",
     "description": "Store a memory in a bank. Async by default — use hindsight_sync_retain to block until indexed.",
     "inputSchema": {
         "type": "object",
         "properties": {
             **_BANK_PROP,
             "content": {"type": "string", "description": "The memory content (one concept; include enough context)."},
             "context": {"type": "string", "description": "Category, e.g. 'preferences', 'decisions', 'work'."},
             "tags": {"type": "array", "items": {"type": "string"}, "description": "Tags, e.g. ['project:foo','kind:decision']."},
             "document_id": {"type": "string", "description": "Stable id for re-import dedupe (optional)."},
             "metadata": {"type": "object", "description": "Extra string-valued metadata (optional)."},
         },
         "required": ["content"],
     }},

    {"name": "hindsight_sync_retain",
     "description": "Store a memory synchronously — blocks until indexed. Use when you need to recall what you just stored.",
     "inputSchema": {
         "type": "object",
         "properties": {
             **_BANK_PROP,
             "content": {"type": "string"},
             "context": {"type": "string"},
             "tags": {"type": "array", "items": {"type": "string"}},
             "document_id": {"type": "string"},
             "metadata": {"type": "object"},
         },
         "required": ["content"],
     }},

    {"name": "hindsight_recall",
     "description": "Fast lookup against a bank. Returns ranked memories. Use natural language; constrain with tags/types/budget.",
     "inputSchema": {
         "type": "object",
         "properties": {
             **_BANK_PROP,
             "query": {"type": "string"},
             "max_tokens": {"type": "integer", "description": "Token budget for the returned context. Default 2048."},
             "tags": {"type": "array", "items": {"type": "string"}},
             "types": {"type": "array", "items": {"type": "string"}},
         },
         "required": ["query"],
     }},

    {"name": "hindsight_reflect",
     "description": "LLM-synthesized answer across stored memories. Use for 'what patterns…?' / 'what should I do?' questions, not recall.",
     "inputSchema": {
         "type": "object",
         "properties": {
             **_BANK_PROP,
             "query": {"type": "string"},
             "budget": {"type": "string", "enum": ["low", "mid", "high"], "description": "Token spend. Default 'mid'."},
         },
         "required": ["query"],
     }},

    {"name": "hindsight_memory_list",
     "description": "Browse stored memories in a bank without ranking. Newest first.",
     "inputSchema": {
         "type": "object",
         "properties": {
             **_BANK_PROP,
             "limit": {"type": "integer", "description": "Default 50."},
             "offset": {"type": "integer"},
         },
     }},

    {"name": "hindsight_directive_list",
     "description": "List behavioral directives attached to a bank.",
     "inputSchema": {"type": "object", "properties": _BANK_PROP}},

    {"name": "hindsight_mental_model_list",
     "description": "List pinned mental models (auto-refreshing reflections) attached to a bank.",
     "inputSchema": {"type": "object", "properties": _BANK_PROP}},
]

_RO = {"readOnlyHint": True, "destructiveHint": False, "openWorldHint": True}
_RW = {"readOnlyHint": False, "destructiveHint": False, "openWorldHint": True}

_WRITE = {"hindsight_retain", "hindsight_sync_retain"}
for _t in TOOLS:
    _t["annotations"] = _RW if _t["name"] in _WRITE else _RO


# -- Handlers --

def _retain(a, sync: bool):
    item = {
        "content": a["content"],
    }
    if a.get("context"):
        item["context"] = a["context"]
    if a.get("document_id"):
        item["document_id"] = a["document_id"]
    if a.get("metadata"):
        item["metadata"] = a["metadata"]
    if a.get("tags"):
        item["tags"] = list(a["tags"])
    body = {"items": [item], "async": not sync}
    return _req("POST", f"/v1/{ORG}/banks/{_bank(a)}/memories", json=body)


def _h_health(a):
    return _req("GET", "/health")


def _h_bank_list(a):
    return _req("GET", f"/v1/{ORG}/banks")


def _h_bank_stats(a):
    return _req("GET", f"/v1/{ORG}/banks/{_bank(a)}/stats")


def _h_bank_profile(a):
    return _req("GET", f"/v1/{ORG}/banks/{_bank(a)}/profile")


def _h_retain(a):
    return _retain(a, sync=False)


def _h_sync_retain(a):
    return _retain(a, sync=True)


def _h_recall(a):
    body = {"query": a["query"]}
    if a.get("max_tokens") is not None:
        body["max_tokens"] = a["max_tokens"]
    if a.get("tags"):
        body["tags"] = list(a["tags"])
    if a.get("types"):
        body["types"] = list(a["types"])
    return _req("POST", f"/v1/{ORG}/banks/{_bank(a)}/recall", json=body)


def _h_reflect(a):
    body = {"query": a["query"]}
    if a.get("budget"):
        body["budget"] = a["budget"]
    return _req("POST", f"/v1/{ORG}/banks/{_bank(a)}/reflect", json=body)


def _h_memory_list(a):
    params = {}
    if a.get("limit") is not None:
        params["limit"] = a["limit"]
    if a.get("offset") is not None:
        params["offset"] = a["offset"]
    return _req("GET", f"/v1/{ORG}/banks/{_bank(a)}/memories", params=params)


def _h_directive_list(a):
    return _req("GET", f"/v1/{ORG}/banks/{_bank(a)}/directives")


def _h_mental_model_list(a):
    return _req("GET", f"/v1/{ORG}/banks/{_bank(a)}/mental-models")


HANDLERS = {
    "hindsight_health": _h_health,
    "hindsight_bank_list": _h_bank_list,
    "hindsight_bank_stats": _h_bank_stats,
    "hindsight_bank_profile": _h_bank_profile,
    "hindsight_retain": _h_retain,
    "hindsight_sync_retain": _h_sync_retain,
    "hindsight_recall": _h_recall,
    "hindsight_reflect": _h_reflect,
    "hindsight_memory_list": _h_memory_list,
    "hindsight_directive_list": _h_directive_list,
    "hindsight_mental_model_list": _h_mental_model_list,
}


def dispatch_tool(name, arguments):
    handler = HANDLERS.get(name)
    if not handler:
        raise ValueError(f"Unknown tool: {name}")
    return handler(arguments)
