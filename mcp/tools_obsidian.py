"""MCP tools for Obsidian vault access via the Local REST API plugin.

Talks to a single base URL (OBSIDIAN_BASE_URL). Workstation failover lives
in nginx on seven (obsidian.karelin.ai → first available of
alex-mac / alex-pc / alex-surface), not here.
"""

import json
import logging
import os
import requests
from urllib3.exceptions import InsecureRequestWarning

requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

BASE_URL = os.environ.get("OBSIDIAN_BASE_URL", "").rstrip("/")
API_KEY = os.environ.get("OBSIDIAN_API_KEY", "")


def _request(method, path, params=None, json_body=None, data=None,
             extra_headers=None, timeout=10):
    headers = {"Authorization": f"Bearer {API_KEY}"}
    if extra_headers:
        headers.update(extra_headers)

    url = f"{BASE_URL}{path}"
    try:
        resp = requests.request(method, url, headers=headers, params=params,
                                json=json_body, data=data, verify=False,
                                timeout=timeout)
    except requests.exceptions.ConnectionError:
        return {"error": f"Connection refused: {BASE_URL}"}
    except requests.exceptions.Timeout:
        return {"error": f"Timeout: {BASE_URL}"}
    except Exception as e:
        return {"error": f"{BASE_URL}: {e}"}

    if resp.status_code == 204:
        return {"status": "ok"}
    try:
        return resp.json()
    except Exception:
        ct = resp.headers.get("Content-Type", "")
        if "text/" in ct:
            return {"content": resp.text}
        return {"status": resp.status_code, "body": resp.text[:500]}


# ── Tool Definitions ────────────────────────────────────────────────

_PATH = {"type": "string", "description": "Path relative to vault root (e.g. 'Notes/daily.md')"}
_QUERY = {"type": "string", "description": "Search query"}

TOOLS = [
    # --  Read  --
    {"name": "note_list", "description": "List files and folders at a path", "inputSchema": {
        "type": "object",
        "properties": {"path": {"type": "string", "description": "Directory path (default: root)"}}
    }},
    {"name": "note_read", "description": "Read one note by path", "inputSchema": {
        "type": "object",
        "properties": {"path": _PATH},
        "required": ["path"]
    }},
    {"name": "note_search", "description": "Search notes by text query", "inputSchema": {
        "type": "object",
        "properties": {"query": _QUERY},
        "required": ["query"]
    }},
    {"name": "note_search_jsonlogic", "description": "Search notes with a JsonLogic query evaluated against each note's metadata (frontmatter, tags, path, content, stat). See https://jsonlogic.com/operations.html; also supports glob:[pattern,value] and regexp:[pattern,value].", "inputSchema": {
        "type": "object",
        "properties": {"query": {"type": "object", "description": "JsonLogic query object, e.g. {\"in\": [\"myTag\", {\"var\": \"tags\"}]}"}},
        "required": ["query"]
    }},
    {"name": "note_tags", "description": "List tags in the vault", "inputSchema": {
        "type": "object",
        "properties": {}
    }},
    {"name": "note_active", "description": "Get the currently active note", "inputSchema": {
        "type": "object",
        "properties": {}
    }},
    {"name": "note_commands", "description": "List Obsidian commands", "inputSchema": {
        "type": "object",
        "properties": {}
    }},
    {"name": "note_status", "description": "Check Obsidian connection status", "inputSchema": {
        "type": "object",
        "properties": {}
    }},

    # --  Write  --
    {"name": "note_write", "description": "Create or overwrite a note", "inputSchema": {
        "type": "object",
        "properties": {
            "path": _PATH,
            "content": {"type": "string", "description": "File content (markdown)"}
        },
        "required": ["path", "content"]
    }},
    {"name": "note_append", "description": "Append text to a note", "inputSchema": {
        "type": "object",
        "properties": {
            "path": _PATH,
            "content": {"type": "string", "description": "Content to append"}
        },
        "required": ["path", "content"]
    }},
    {"name": "note_patch", "description": "Insert or replace content in a note section", "inputSchema": {
        "type": "object",
        "properties": {
            "path": _PATH,
            "content": {"type": "string", "description": "Content to insert"},
            "operation": {"type": "string", "description": "insert, append, prepend, or replace (default: append)"},
            "target_type": {"type": "string", "description": "heading, block-reference, or frontmatter-key"},
            "target": {"type": "string", "description": "The heading text, block ID, or frontmatter key to target"}
        },
        "required": ["path", "content", "target_type", "target"]
    }},
    {"name": "note_move", "description": "Move or rename a note. Server-side read+write+delete (the Local REST API has no move endpoint); content never round-trips through the client. Fails if destination exists.", "inputSchema": {
        "type": "object",
        "properties": {
            "path": _PATH,
            "new_path": {"type": "string", "description": "Destination path relative to vault root (e.g. 'Archive/daily.md')"}
        },
        "required": ["path", "new_path"]
    }},
    {"name": "note_delete", "description": "Delete a note or folder", "inputSchema": {
        "type": "object",
        "properties": {"path": _PATH},
        "required": ["path"]
    }},
    {"name": "note_open", "description": "Open a note in Obsidian UI", "inputSchema": {
        "type": "object",
        "properties": {"path": _PATH},
        "required": ["path"]
    }},
    {"name": "note_command", "description": "Run an Obsidian command by ID", "inputSchema": {
        "type": "object",
        "properties": {"command_id": {"type": "string", "description": "Command ID to execute"}},
        "required": ["command_id"]
    }},

    # --  Periodic notes  --
    {"name": "note_daily", "description": "Get today's daily note", "inputSchema": {
        "type": "object",
        "properties": {}
    }},
    {"name": "note_daily_append", "description": "Append text to today's daily note", "inputSchema": {
        "type": "object",
        "properties": {"content": {"type": "string", "description": "Content to append"}},
        "required": ["content"]
    }},
]

# ── Annotations ─────────────────────────────────────────────────────

_RO  = {"readOnlyHint": True,  "destructiveHint": False, "openWorldHint": False}
_WR  = {"readOnlyHint": False, "destructiveHint": False, "openWorldHint": True}
_DEL = {"readOnlyHint": False, "destructiveHint": True,  "openWorldHint": True}

_READ_TOOLS = {
    "note_list", "note_read", "note_search", "note_search_jsonlogic",
    "note_tags", "note_active", "note_commands", "note_status",
    "note_daily",
}
_DESTRUCTIVE_TOOLS = {"note_delete"}

for _t in TOOLS:
    if _t["name"] in _READ_TOOLS:
        _t["annotations"] = _RO
    elif _t["name"] in _DESTRUCTIVE_TOOLS:
        _t["annotations"] = _DEL
    else:
        _t["annotations"] = _WR


# ── Handlers ────────────────────────────────────────────────────────

def _note_list(a):
    path = a.get("path", "/")
    if not path.startswith("/"):
        path = "/" + path
    return _request("GET", f"/vault{path}",
                        extra_headers={"Accept": "application/json"})

def _note_read(a):
    path = a["path"]
    if not path.startswith("/"):
        path = "/" + path
    return _request("GET", f"/vault{path}")

def _note_search(a):
    return _request("POST", "/search/simple/", params={"query": a["query"]},
                        extra_headers={"Accept": "application/json"})

def _note_search_jsonlogic(a):
    # v4.1.3 of the plugin dropped Dataview DQL support (vnd.olrapi.dataview.dql+txt
    # is rejected with 40012 "Unknown or invalid Content-Type"); JsonLogic is the
    # only search query format /search/ still accepts. Live-confirmed 2026-07-05.
    return _request("POST", "/search/",
                        json_body=a["query"],
                        extra_headers={"Content-Type": "application/vnd.olrapi.jsonlogic+json",
                                       "Accept": "application/json"})

def _note_tags(a):
    return _request("GET", "/tags/",
                        extra_headers={"Accept": "application/json"})

def _note_active(a):
    return _request("GET", "/active/")

def _note_commands(a):
    return _request("GET", "/commands/",
                        extra_headers={"Accept": "application/json"})

def _note_status(a):
    result = _request("GET", "/")
    result["base_url"] = BASE_URL
    return result

def _note_write(a):
    path = a["path"]
    if not path.startswith("/"):
        path = "/" + path
    return _request("PUT", f"/vault{path}",
                        data=a["content"].encode("utf-8"),
                        extra_headers={"Content-Type": "text/markdown"})

def _note_append(a):
    path = a["path"]
    if not path.startswith("/"):
        path = "/" + path
    return _request("POST", f"/vault{path}",
                        data=a["content"].encode("utf-8"),
                        extra_headers={"Content-Type": "text/markdown"})

def _note_patch(a):
    path = a["path"]
    if not path.startswith("/"):
        path = "/" + path
    hdrs = {
        "Content-Type": "text/markdown",
        "Operation": a.get("operation", "append"),
        "Target-Type": a["target_type"],
        "Target": a["target"],
    }
    return _request("PATCH", f"/vault{path}",
                        data=a["content"].encode("utf-8"),
                        extra_headers=hdrs)

def _note_move(a):
    src = a["path"]
    if not src.startswith("/"):
        src = "/" + src
    dst = a["new_path"]
    if not dst.startswith("/"):
        dst = "/" + dst
    existing = _request("GET", f"/vault{dst}")
    if "content" in existing:
        return {"error": f"destination already exists: {dst}"}
    read = _request("GET", f"/vault{src}")
    if "content" not in read:
        return {"error": f"source read failed: {src}", "response": read}
    write = _request("PUT", f"/vault{dst}",
                         data=read["content"].encode("utf-8"),
                         extra_headers={"Content-Type": "text/markdown"})
    if write.get("status") != "ok":
        return {"error": f"write failed: {dst} (source untouched)", "response": write}
    delete = _request("DELETE", f"/vault{src}")
    if delete.get("status") != "ok":
        return {"error": f"copied to {dst} but source delete failed: {src}", "response": delete}
    return {"status": "ok", "from": src, "to": dst}

def _note_delete(a):
    path = a["path"]
    if not path.startswith("/"):
        path = "/" + path
    return _request("DELETE", f"/vault{path}")

def _note_open(a):
    path = a["path"]
    if not path.startswith("/"):
        path = "/" + path
    return _request("POST", f"/open{path}")

def _note_command(a):
    return _request("POST", f"/commands/{a['command_id']}/")

def _note_daily(a):
    return _request("GET", "/periodic/daily/")

def _note_daily_append(a):
    return _request("POST", "/periodic/daily/",
                        data=a["content"].encode("utf-8"),
                        extra_headers={"Content-Type": "text/markdown"})


HANDLERS = {
    "note_list": _note_list, "note_read": _note_read,
    "note_search": _note_search, "note_search_jsonlogic": _note_search_jsonlogic,
    "note_tags": _note_tags, "note_active": _note_active,
    "note_commands": _note_commands, "note_status": _note_status,
    "note_write": _note_write, "note_append": _note_append,
    "note_patch": _note_patch, "note_move": _note_move, "note_delete": _note_delete,
    "note_open": _note_open, "note_command": _note_command,
    "note_daily": _note_daily, "note_daily_append": _note_daily_append,
}


def dispatch_tool(name, arguments):
    handler = HANDLERS.get(name)
    if not handler:
        raise ValueError(f"Unknown tool: {name}")
    return handler(arguments)
