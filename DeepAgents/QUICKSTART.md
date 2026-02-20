# DeepAgents CLI - Quick Start Guide

Get started with DeepAgents CLI in 5 minutes.

## Prerequisites

- Python 3.11+
- Git
- LangChain API key ([get one here](https://smith.langchain.com))
- OpenAI API key ([get one here](https://platform.openai.com))

## Installation

### Option 1: Local Installation (Recommended for First Try)

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/deepagents-cli.git
cd deepagents-cli

# 2. Install
pip install -e .

# 3. Set environment variables
export LANGCHAIN_API_KEY=your_langchain_api_key_here
export OPENAI_API_KEY=your_openai_api_key_here

# 4. Verify installation
deepagents version
```

### Option 2: Docker (Recommended for Development)

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/deepagents-cli.git
cd deepagents-cli

# 2. Create .env file
cp .env.example .env
# Edit .env and add your API keys

# 3. Start development container
docker-compose up -d

# 4. Enter container
docker-compose exec deepagents-dev bash

# 5. Verify installation
deepagents version
```

## First Commands

### 1. Check What's Next

```bash
deepagents next
```

This reads your 2Do.md, ROADMAP.md, and git status to show what to work on next.

### 2. Ask a Question

```bash
deepagents ask "What files have changed?"
```

### 3. Document Changes

```bash
deepagents document
```

This automatically updates CHANGELOG.md based on git diff.

### 4. Close Session

```bash
deepagents close
```

This updates 2Do.md, documents mistakes, and prepares for next session.

## Configuration

DeepAgents works with zero configuration, but you can customize it:

```bash
# Create config file
cat > deepagents-config.yaml << EOF
model: openai:gpt-4o
debug: true
snapshot_enabled: true
EOF

# Use custom config
deepagents --config deepagents-config.yaml ask "What's next?"
```

## Common Workflows

### Daily Development

```bash
# Morning
deepagents next                    # Check priorities

# During work
# ... make changes ...
deepagents document                # Update changelog

# Evening
deepagents push "Implemented X"    # Commit and push
deepagents close                   # Close session
```

### With Breakpoints

```bash
# Pause before critical operations
deepagents ask "Archive old code" --breakpoint archive_tool
```

### Debug Mode

```bash
# See detailed execution
deepagents --debug ask "What's next?"
```

## Next Steps

1. **Read the full documentation**: [README.md](README.md)
2. **Explore examples**: [EXAMPLES.md](EXAMPLES.md)
3. **Deploy to production**: [deployment/README.md](deployment/README.md)
4. **Customize prompts**: Edit files in `deepagents/prompts/`

## Troubleshooting

### "API key not found"

```bash
# Check environment
deepagents diag | grep API_KEY

# Set keys
export LANGCHAIN_API_KEY=lsv2_pt_...
export OPENAI_API_KEY=sk-...
```

### "Command not found: deepagents"

```bash
# Reinstall
pip install -e .

# Or use python -m
python -m deepagents.cli --help
```

### "Git command failed"

```bash
# Ensure you're in a git repository
git status

# Initialize if needed
git init
```

## Getting Help

- Run `deepagents --help` for command help
- Run `deepagents diag` for diagnostics
- Check [EXAMPLES.md](EXAMPLES.md) for usage patterns
- Review [README.md](README.md) for architecture details

## What's Next?

- ✅ Try all commands: ask, next, close, document, push
- ✅ Explore breakpoints and debugging features
- ✅ Review LangSmith traces at https://smith.langchain.com
- ✅ Customize prompts in `deepagents/prompts/`
- ✅ Deploy to production (see deployment/README.md)

Welcome to DeepAgents CLI! 🚀
