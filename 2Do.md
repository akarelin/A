# 2Do - Skills Marketplace

## TODO
- [ ] Evaluate and add BlueBubbles MCP as `work-imessage` sub-skill (https://github.com/jfiggins/bluebubbles-mcp-server)
- [ ] Build Azure Function MCP server for work-m365 (prompt at `D:\Dev\RAN\Services\_AI\AZURE_FUNCTION_PROMPT.md`)
- [ ] Remove 3 local uploads from Claude Desktop UI (File organizer, Medical scan organizer, Skill manager)
- [ ] Commit and push marketplace to GitHub
- [ ] Test: `/plugin marketplace add akarelin/AGENTS.md` after push

## Done
- [x] Convert skills/ into Claude Code plugin marketplace
- [x] Standardize all plugins to `.claude-plugin/plugin.json` + `skills/*/SKILL.md` format
- [x] Create marketplace.json at repo root
- [x] Merge organize + organize-arxiv + medical-scan into single `organize` plugin
- [x] Merge search-everything + search-m365 into single `search` plugin
- [x] Create `work` plugin with m365, slack, jira sub-skills
- [x] Build search-everything MCPB desktop extension (v0.4.0 with bundled es.exe + icon)
- [x] Add Slack sub-skill from official Slack MCP (messaging + search guides)
- [x] Add Jira sub-skill from official Atlassian MCP (5 workflow skills)
- [x] Add Everything Search to claude_desktop_config.json connectors
