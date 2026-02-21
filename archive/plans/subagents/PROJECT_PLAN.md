# Subagents Project Plan

## Project Overview

Implement Epic 2: Multi-Subagent Workflow Architecture using Claude Code's native agents feature to replace the single agentic workflow with a modular system of specialized subagents.

## Architecture

### Native Claude Code Agents
This project leverages Claude Code's built-in `/agents` feature with `.claude-code.yaml` configuration, providing:
- Automatic trigger-based agent invocation
- Hierarchical agent relationships
- Built-in context isolation
- Native slash command support

### Agent Hierarchy
```
Knowledge Management Agent (Parent)
├── Changelog Agent
├── Docs Agent
├── Archive Agent
└── Validation Agent

Push Agent (Standalone)
Mistake Review Agent (Standalone)
```

## Implementation Phases

### Phase 1: Configuration Setup
1. ✅ Move `.claude-code.yaml` to project root
2. Create `/home/alex/RAN/agents/` directory structure
3. Understand and document the configuration system

### Phase 2: Agent Implementation

#### 2.1 knowledge-management-agent.md (Parent Agent)
- **Role**: Orchestrates all knowledge-related tasks
- **Can spawn**: changelog, docs, archive, validation subagents
- **Triggers**: "knowledge management", "document everything", "comprehensive documentation"
- **Responsibilities**:
  - Coordinate documentation updates
  - Manage repository knowledge
  - Delegate to specialized subagents

#### 2.2 changelog-agent.md
- **Role**: Manages CHANGELOG.md updates
- **Reports to**: knowledge-management
- **Triggers**: "changelog", "document changes", "compress"
- **Responsibilities**:
  - Analyze git diffs
  - Generate changelog entries
  - Compress old entries when needed

#### 2.3 docs-agent.md
- **Role**: Updates and maintains documentation
- **Reports to**: knowledge-management
- **Triggers**: "readme", "document structure", "update docs"
- **Responsibilities**:
  - Update README.md files
  - Apply documentation templates
  - Ensure documentation consistency

#### 2.4 archive-agent.md
- **Role**: Handles archiving and cleanup
- **Reports to**: knowledge-management
- **Triggers**: "archive", "outdated", "clean up"
- **Responsibilities**:
  - Archive old code following best practices
  - Update archive inventories
  - Compress large files

#### 2.5 validation-agent.md
- **Role**: Ensures compliance with standards
- **Reports to**: knowledge-management
- **Triggers**: "validate", "check", "review", "pull request"
- **Responsibilities**:
  - Validate documentation standards
  - Check code conventions
  - Report violations

#### 2.6 push-agent.md (Standalone)
- **Role**: Handles git operations
- **Triggers**: "push", "close", "finalize", "commit"
- **Responsibilities**:
  - Validate before push
  - Create commits with proper messages
  - Handle PR creation

#### 2.7 mistake-review-agent.md (Standalone)
- **Role**: Analyzes mistakes and improves system
- **Triggers**: "review mistakes", "validate fixes", "mistake review"
- **Responsibilities**:
  - Analyze AGENTS_mistakes.md
  - Propose systematic improvements
  - Update AGENTS.md with lessons learned

### Phase 3: Testing and Validation

1. **Trigger Testing**
   - Verify each trigger phrase activates correct agent
   - Test parent-child agent communication
   - Validate context isolation

2. **Workflow Testing**
   - Test common workflows end-to-end
   - Verify agent handoffs work correctly
   - Ensure user experience is seamless

## Configuration Details

### .claude-code.yaml Structure
```yaml
version: 1.0
orchestrator:
  enabled: true
  agents_directory: "./agents/"
  
subagents:
  knowledge-management:
    can_spawn_subagents: true
    subagents: ["changelog", "docs", "archive", "validation"]
    
  changelog:
    reports_to: ["knowledge-management"]
    timeout: 30
    
context_isolation:
  enabled: true
  cleanup_after_execution: true
  
logging:
  subagent_calls: false  # Invisible to user
```

## Success Criteria

1. All agents respond correctly to their triggers
2. Parent-child relationships function properly
3. Context isolation prevents information leakage
4. User experience is natural and seamless
5. Both automatic and slash command invocation work

## Native Features Utilized

- **Automatic Routing**: No manual pattern detection needed
- **Context Management**: Built-in isolation between agents
- **Hierarchical Structure**: Parent agents can spawn children
- **Slash Commands**: Direct invocation like `/agents knowledge-management`
- **Hidden Execution**: `subagent_calls: false` keeps it invisible

## Next Session Checklist

1. [ ] Review .claude-code.yaml configuration
2. [ ] Create all agent markdown files
3. [ ] Test trigger phrases
4. [ ] Validate parent-child communication
5. [ ] Update AGENTS.md to reference new system