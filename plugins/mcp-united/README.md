# MCP United

Plugin version 2.0.3. MCP United runtime version 2.0.1.

MCP United provides one Entra-authenticated connection to Microsoft 365,
Entra, Obsidian, TickTick, OpenViking, and Azure Key Vault at
`https://mcp.karelin.ai/mcp`.

The OpenAI package binds to the registered MCP United connection through
`.app.json`. The Claude package declares the remote Streamable HTTP server in
`mcp.claude.json`; OAuth is discovered from the server and no static
`Authorization` header is configured.

## Install in Codex

```bash
codex plugin marketplace add akarelin/A
codex plugin add mcp-united@mcp-united
```

Start a new task after installation.

## Install in ChatGPT

In the ChatGPT desktop app, open the plugin marketplace, add `akarelin/A` as a
source, and install MCP United from `MCP United`. Start a new chat and complete
the Entra sign-in in the browser. The browser manages the MCP connection but
does not add the repository marketplace source. The Codex CLI command above
does not install the plugin in ChatGPT.

## Install in Claude Code

```bash
claude plugin marketplace add akarelin/A
claude plugin install mcp-united@mcp-united --scope user
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
