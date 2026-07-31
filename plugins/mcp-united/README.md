# MCP United

Version 2.0.0.

MCP United provides one Entra-authenticated connection to Key Vault,
Microsoft 365, Entra, Obsidian, TickTick, and OpenViking at
`https://mcp.karelin.ai/mcp`.

The OpenAI package binds to the registered MCP United connection through
`.app.json`. The Claude package declares the remote Streamable HTTP server in
`mcp.claude.json`; OAuth is discovered from the server and no static
`Authorization` header is configured.

## Install in Codex

```bash
codex plugin marketplace add akarelin/A
codex plugin add mcp-united@karelin
```

Start a new task after installation.

## Install in ChatGPT

In the ChatGPT desktop app, open the plugin marketplace, add `akarelin/A` as a
source, and install MCP United from `Karelin`. Start a new chat and complete
the Entra sign-in. The Codex CLI command above does not install the plugin in
ChatGPT.

## Install in Claude Code

```bash
claude plugin marketplace add akarelin/A
claude plugin install mcp-united@karelin --scope user
```

Run `/reload-plugins`, start a new session, then open `/mcp` to complete Entra
authentication.

## Install in Claude web or desktop

Open Customize → Plugins → Personal plugins, add the marketplace from
`akarelin/A`, install MCP United, and start a new chat.

## Verify

Confirm MCP United appears in the current session and make one real read-only
call:

```text
Use MCP United to run openviking_health.
```

Plugin discovery alone does not prove that OAuth and the remote MCP transport
completed.
