# Claude Code YAML Configuration Documentation

## Overview

The `.claude-code.yaml` file enables Claude Code's native agent management system, providing automatic routing, context isolation, and hierarchical agent relationships.

## Configuration Structure

### Top-Level Settings

```yaml
version: 1.0  # Configuration version
orchestrator:
  enabled: true  # Enables the agent system
  main_instructions: "./ORCHESTRATOR.md"  # Optional main orchestrator file
  agents_directory: "./agents/"  # Directory containing agent markdown files
```

### Subagent Definitions

Each agent is defined under the `subagents` key with these properties:

```yaml
subagents:
  agent-name:
    file: "agents/agent-name.md"  # Path to agent instructions
    triggers: []  # Phrases that activate this agent
    timeout: 30  # Execution timeout in seconds
    can_spawn_subagents: false  # Whether this agent can call others
    subagents: []  # List of agents this one can spawn
    reports_to: []  # Parent agents this reports to
```

### Hierarchical Relationships

#### Parent Agent Example
```yaml
knowledge-management:
  file: "agents/knowledge-management-agent.md"
  triggers:
    - "knowledge management"
    - "document everything"
  timeout: 90
  can_spawn_subagents: true  # Can spawn child agents
  subagents: ["changelog", "docs", "archive", "validation"]
```

#### Child Agent Example
```yaml
changelog:
  file: "agents/changelog-agent.md"
  triggers: 
    - "changelog"
    - "document changes"
  timeout: 30
  reports_to: ["knowledge-management"]  # Reports to parent
```

### Context Isolation

```yaml
context_isolation:
  enabled: true  # Isolates agent contexts
  max_context_share: "summary_only"  # Limits information sharing
  cleanup_after_execution: true  # Cleans up after agent runs
```

### Logging Configuration

```yaml
logging:
  subagent_calls: false  # Hides agent invocations from user
  summary_only: true  # Only shows summaries, not full execution
```

## How It Works

### 1. Automatic Trigger Detection
When a user message contains trigger phrases, Claude Code automatically:
- Identifies the matching agent
- Invokes it with relevant context
- Returns results seamlessly

### 2. Parent-Child Communication
- Parent agents with `can_spawn_subagents: true` can delegate to children
- Children with `reports_to` send results back to parents
- Enables complex workflows with proper delegation

### 3. Context Management
- Each agent runs in isolation
- Only summaries are shared between agents
- Main conversation context remains clean

### 4. User Experience
- With `subagent_calls: false`, invocations are invisible
- Results appear as natural conversation
- Slash commands like `/agents knowledge-management` also work

## Best Practices

### 1. Trigger Design
- Use specific, unambiguous phrases
- Avoid overlapping triggers between agents
- Include variations users might say

### 2. Hierarchy Design
- Group related functionality under parent agents
- Keep standalone agents for independent tasks
- Limit hierarchy depth for clarity

### 3. Timeout Settings
- Set appropriate timeouts based on task complexity
- Knowledge tasks may need longer (60-90s)
- Simple validations can be shorter (30s)

### 4. Testing
- Test each trigger phrase individually
- Verify parent-child communication
- Ensure context isolation works properly

## Example: Knowledge Management System

The configuration implements a knowledge management system where:

1. **Knowledge Management Agent** (parent) orchestrates all documentation
2. **Child Agents** handle specific tasks:
   - Changelog: Updates CHANGELOG.md
   - Docs: Maintains README files
   - Archive: Handles code archival
   - Validation: Ensures standards compliance
3. **Standalone Agents** handle independent tasks:
   - Push: Git operations
   - Mistake Review: System improvement

This creates a powerful, automated system for repository management while maintaining a clean, natural user interface.