# Session Management Protocol

## Overview

Standardized commands to streamline session beginnings and endings, reducing repetitive instructions. These commands work independently of the subagent system.

## Session Commands

### 1. Session Start: "What's next?"
When you ask "What's next?" at the beginning of a session, the agent will:
1. Check 2Do.md for current priorities
2. Review ROADMAP.md for active epics
3. Check git status for any work in progress
4. Present a summary for your review and approval

**Trigger phrases:**
- "What's next?"
- "What should I work on?"
- "What's the current priority?"

### 2. Session End: "Close"
When you say "close" at the end of a session, the agent will:
1. Update 2Do.md with current progress and next steps
2. Archive any completed work to appropriate directories
3. Document any new mistakes in AGENTS_mistakes.md
4. Clean up temporary files if any
5. Provide summary of what's prepared for next session

**Trigger phrases:**
- "Close"
- "Close session"

### 3. Document Changes: "Document"
When you say "document", the agent will:
1. Run git diff to detect all changes
2. Identify changes made by humans or other agents
3. Update CHANGELOG.md with discovered changes
4. Update relevant documentation as needed

**Trigger phrases:**
- "Document"
- "Document changes"

### 4. Git Operations: "Push"
When you say "push", the agent will:
1. Ensure CHANGELOG.md is updated
2. Commit all changes with appropriate message
3. Push to repository
4. Create PR if on feature branch

**Trigger phrases:**
- "Push"
- "Push changes"

## Command Combinations

You can combine commands for efficiency:

### "Close and push"
1. Performs all close operations
2. Then commits and pushes everything

### "Document and push"  
1. Detects and documents external changes
2. Then commits and pushes everything

## Implementation

These commands are implemented directly in AGENTS.md under the Session Management Commands section. They work for any Claude instance reading AGENTS.md, regardless of whether subagents are configured.

## Benefits

1. **Consistency**: Same process every time
2. **Efficiency**: No need to repeat instructions
3. **Completeness**: Nothing gets forgotten
4. **Context Preservation**: Next session starts smoothly
5. **Independence**: Works without subagent configuration

## Example Usage

### Session Start
```
User: What's next?
Claude: [Checks 2Do.md, ROADMAP.md, git status]

According to 2Do.md, the next priority is implementing the Subagents project. 
Current status:
- Phase 1: Configuration setup is complete
- Next: Create agent markdown files in /agents/

Should I proceed with creating the agent files?
```

### Session End
```
User: Close
Claude: [Automatically performs all close tasks]

Session closed:
✓ Updated 2Do.md with progress
✓ No files to archive
✓ Documented 0 new mistakes
✓ Cleaned up 0 temporary files
✓ Context prepared for next session

Next session will continue with Phase 2 of Subagents project.
```

### Document and Push
```
User: Document and push
Claude: [Detects changes, updates CHANGELOG, commits, pushes]

Changes documented and pushed:
✓ Detected 3 file changes
✓ Updated CHANGELOG.md
✓ Committed with message: "Update session management commands"
✓ Pushed to origin/main
```