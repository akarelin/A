## DeepAgents CLI

Production-ready personal knowledge management system built with LangChain 1.0 and LangGraph 1.0.

### Overview

DeepAgents CLI reimplements and extends the cascading markdown-based agent workflow into a robust, observable, and deployable system. It preserves the philosophy of markdown-driven prompts while adding enterprise-grade features like breakpoints, snapshots, human-in-the-loop controls, and durable state persistence.

### Key Features

**Observability & Debugging**
- LangSmith tracing integration for full execution visibility
- Breakpoints on any tool with interactive inspection
- State snapshots at every step for debugging
- Enhanced logging with timing and metrics
- Diagnostic command for troubleshooting

**Human-in-the-Loop**
- Approval gates for critical operations (git push, archive)
- Interactive breakpoint controls (continue, skip, abort, inspect)
- Configurable auto-approval for trusted workflows

**Durable State**
- SQLite for local development
- PostgreSQL for production deployment
- LangGraph checkpointing for multi-session workflows
- State recovery after interruptions

**Production Deployment**
- GCP VM with Docker Compose, PostgreSQL, and Nginx
- Local Docker Compose with hot reload for development
- LangChain Cloud serverless deployment
- Health checks and auto-restart

**Workflow Automation**
- **What's Next** - Analyzes 2Do.md, ROADMAP.md, and git status
- **Close Session** - Updates progress, documents mistakes, archives work
- **Document Changes** - Auto-generates CHANGELOG.md from git diff
- **Push** - Commits and pushes with changelog verification

### Quick Start

**Installation:**

```bash
# Clone repository
git clone https://github.com/yourusername/deepagents-cli.git
cd deepagents-cli

# Install
pip install -e .

# Configure
export LANGCHAIN_API_KEY=your_key_here
export OPENAI_API_KEY=your_key_here

# Run
deepagents ask "What's next?"
```

**Docker (Development):**

```bash
# Start development environment
docker-compose up -d

# Enter container
docker-compose exec deepagents-dev bash

# Run commands
deepagents ask "What's next?"
```

### Commands

| Command | Description | Example |
|---------|-------------|---------|
| `ask` | Execute a query | `deepagents ask "Archive old code"` |
| `next` | Show what's next | `deepagents next` |
| `close` | Close session | `deepagents close` |
| `document` | Document changes | `deepagents document` |
| `push` | Commit and push | `deepagents push "Implemented feature X"` |
| `version` | Show version | `deepagents version` |
| `diag` | Show diagnostics | `deepagents diag` |

**Advanced Options:**

```bash
# Enable breakpoint on specific tool
deepagents ask "Archive old code" --breakpoint archive_tool

# Disable snapshots
deepagents ask "What's next?" --no-snapshot

# Auto-approve all operations
deepagents ask "Update changelog" --approve-all

# Debug mode
deepagents --debug ask "What's next?"

# Custom config file
deepagents --config my-config.yaml ask "What's next?"
```

### Architecture

**Core Components:**

```
deepagents/
├── cli.py                 # Click-based CLI
├── orchestrator.py        # Main agent creation
├── config.py             # Configuration management
├── observability.py      # Tracing and snapshots
├── persistence.py        # State checkpointing
├── middleware/           # Custom middleware
│   ├── snapshot.py       # State capture
│   ├── breakpoint.py     # Interactive debugging
│   └── logging.py        # Enhanced logging
├── tools/                # LangChain tools
│   ├── changelog.py      # Changelog management
│   ├── archive.py        # Code archival
│   ├── git_operations.py # Git commands
│   └── knowledge_base.py # Markdown operations
├── workflows/            # LangGraph workflows
│   ├── close_session.py  # Session cleanup
│   ├── document_changes.py # Change documentation
│   └── whats_next.py     # Priority analysis
└── prompts/              # Markdown prompts
    ├── system_prompt.md  # Main system prompt
    ├── tools/            # Tool-specific prompts
    └── workflows/        # Workflow prompts
```

**Middleware Stack:**

```
Request
  ↓
EnhancedLoggingMiddleware (captures timing)
  ↓
BreakpointMiddleware (pauses on configured tools)
  ↓
SnapshotMiddleware (captures state)
  ↓
HumanInTheLoopMiddleware (approval gates)
  ↓
Tool Execution
```

**Workflow Example (Close Session):**

```
START
  ↓
Analyze Session (git status, detect changes)
  ↓
Update 2Do.md (add progress summary)
  ↓
Check Mistakes (review session for errors)
  ↓
Archive Work (move completed files)
  ↓
Generate Summary (create session report)
  ↓
END
```

### Configuration

**Zero-Configuration Defaults:**

DeepAgents works out of the box with sensible defaults. For customization, create `config.yaml`:

```yaml
# Model configuration
model: openai:gpt-4o

# Observability
debug: false
trace: true
snapshot_enabled: true
snapshot_dir: ./snapshots

# Persistence
persistence_backend: sqlite
db_path: ./deepagents.db

# Human-in-the-loop
auto_approve: false
approval_tools:
  - git_push_tool
  - archive_tool

# Paths
todo_file: 2Do.md
roadmap_file: ROADMAP.md
changelog_file: CHANGELOG.md
```

**Environment Variables:**

```bash
# Required
export LANGCHAIN_API_KEY=lsv2_pt_...
export OPENAI_API_KEY=sk-...

# Optional
export LANGCHAIN_PROJECT=deepagents-dev
export DEEPAGENTS_MODEL=openai:gpt-4o
export POSTGRES_CONN_STRING=postgresql://...
```

### Tools

All tools from the original markdown-based agents have been migrated:

| Tool | Description | Original Agent |
|------|-------------|----------------|
| `changelog_tool` | Manage CHANGELOG.md | changelog-agent.md |
| `archive_tool` | Archive outdated code | archive-agent.md |
| `mistake_processor_tool` | Document mistakes | mistake-review-agent.md |
| `validation_tool` | Check standards | validation-agent.md |
| `git_push_tool` | Commit and push | git-operations.md |
| `git_status_tool` | Get git status | git-operations.md |
| `git_diff_tool` | Show git diff | git-operations.md |
| `read_markdown_tool` | Read markdown files | knowledge-base.md |
| `search_markdown_tool` | Search markdown | knowledge-base.md |
| `update_markdown_tool` | Update markdown | knowledge-base.md |

### Deployment

Three deployment options are supported:

**1. Local Docker Compose (Development)**
```bash
docker-compose up -d
docker-compose exec deepagents-dev bash
```

**2. GCP VM (Production)**
```bash
cd deployment/gcp
./deploy.sh
```

**3. LangChain Cloud (Serverless)**
```bash
cd deployment/langchain-cloud
langchain deploy
```

See [deployment/README.md](deployment/README.md) for detailed instructions.

### Development

**Setup Development Environment:**

```bash
# Install with dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Format code
black deepagents/
isort deepagents/

# Type checking
mypy deepagents/

# Linting
ruff check deepagents/
```

**Project Structure:**

```
deepagents-cli/
├── deepagents/           # Main package
├── tests/                # Test suite
├── deployment/           # Deployment configs
├── docs/                 # Documentation
├── examples/             # Usage examples
├── pyproject.toml        # Project metadata
├── Dockerfile            # Production image
├── Dockerfile.dev        # Development image
├── docker-compose.yml    # Local development
└── README.md             # This file
```

### Migration from Markdown Agents

DeepAgents CLI preserves your existing workflow while adding production features:

**What's Preserved:**
- ✅ Markdown-based prompts and instructions
- ✅ Cascading agent architecture
- ✅ Tool-specific behaviors and logic
- ✅ Workflow patterns (close, document, push)

**What's Enhanced:**
- ✅ Observability with LangSmith tracing
- ✅ Interactive debugging with breakpoints
- ✅ Durable state with checkpointing
- ✅ Production deployment options
- ✅ Human-in-the-loop controls

**Migration Steps:**

1. Install DeepAgents CLI
2. Copy your markdown prompts to `deepagents/prompts/`
3. Configure tool mappings in `deepagents/tools/__init__.py`
4. Test workflows with `deepagents ask`
5. Deploy to your preferred environment

### Observability

**LangSmith Tracing:**

Every execution is traced in LangSmith for full visibility:
- Tool calls with arguments and results
- Model invocations with prompts and responses
- Workflow state transitions
- Timing and performance metrics

View traces at: https://smith.langchain.com

**Snapshots:**

State is captured at key points:
- Before/after each tool call
- Before model invocations
- At workflow transitions

Snapshots are saved to `./snapshots/` as JSON files.

**Diagnostics:**

```bash
deepagents diag
```

Shows:
- Configuration
- Environment variables
- Checkpointer status
- Git repository status

### Best Practices

**Development:**
- Use `--debug` flag for verbose output
- Set breakpoints on new tools during testing
- Review snapshots when debugging failures
- Check LangSmith traces for unexpected behavior

**Production:**
- Use PostgreSQL for persistence
- Enable SSL with proper certificates
- Set up monitoring and alerting
- Backup database regularly
- Rotate API keys periodically

**Workflow:**
- Run `deepagents next` at session start
- Run `deepagents close` at session end
- Run `deepagents document` before pushing
- Use `deepagents push` for changelog-verified commits

### Troubleshooting

**Common Issues:**

1. **"API key not found"**
   - Set `LANGCHAIN_API_KEY` and `OPENAI_API_KEY`
   - Check with `deepagents diag`

2. **"Database connection failed"**
   - Verify `POSTGRES_CONN_STRING` if using PostgreSQL
   - Use SQLite for local development

3. **"Git command failed"**
   - Ensure you're in a git repository
   - Check git configuration is mounted in Docker

4. **"Tool call failed"**
   - Check LangSmith traces for error details
   - Review snapshots for state at failure
   - Use `--debug` flag for verbose output

### Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Ensure all tests pass
5. Submit a pull request

### License

MIT License - see LICENSE file for details.

### Acknowledgments

Built with:
- [LangChain](https://langchain.com) - Agent framework
- [LangGraph](https://langchain.com/langgraph) - Workflow orchestration
- [LangSmith](https://smith.langchain.com) - Observability
- [Click](https://click.palletsprojects.com) - CLI framework
- [Rich](https://rich.readthedocs.io) - Terminal formatting

Inspired by the original cascading markdown agent system.

### Support

- **Documentation**: [GitHub Wiki](https://github.com/yourusername/deepagents-cli/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/deepagents-cli/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/deepagents-cli/discussions)
