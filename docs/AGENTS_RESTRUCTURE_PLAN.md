# AGENTS.md Restructure Plan - 2025-08-13

## Research Summary

### Original Requirements (from git history and archives)
- **Universal Instructions**: AGENTS.md should contain model-agnostic content only
- **Model-Specific Separation**: Claude/Gemini-specific content in respective files
- **Include System**: Support `@AGENTS.md` includes from model-specific files
- **No New Content**: Only rearrange existing content, don't add new text
- **Functionality Preservation**: Maintain all current capabilities

### Git History Analysis
- **Commit 7319d3de**: Migrated all instructions from CLAUDE.md to AGENTS.md
- **Commit 237f1170**: Restructured for universal compatibility, created include system
- **Current Issue**: AGENTS.md contains model-specific content that should be in CLAUDE.md

### File State Analysis

**Before Migration (7319d3de^):**
- CLAUDE.md: Comprehensive instructions with Claude-specific details
- AGENTS.md: Minimal, just basic tool guidelines

**Current State (after 237f1170):**
- AGENTS.md: Contains ALL instructions (both universal and model-specific)
- CLAUDE.md: Only `@AGENTS.md` + minimal Claude config
- GEMINI.md: Only `@AGENTS.md` + minimal Gemini config

**Target State:**
- AGENTS.md: Universal instructions only
- CLAUDE.md: `@AGENTS.md` + comprehensive Claude-specific instructions
- GEMINI.md: `@AGENTS.md` + comprehensive Gemini-specific instructions

## Implementation Strategy

### Content to MOVE FROM AGENTS.md TO model-specific files:
- Detailed CHANGELOG.md formatting rules and examples
- Commit signature templates and attribution rules
- Model-specific validation requirements
- References to specific tools like "Claude Code"
- Author attribution details (`[Claude]`, `[Agent]` etc.)

### Content to KEEP in AGENTS.md (universal):
- Basic tool usage guidelines
- Repository-specific rules
- Universal commands (finalize, document, overview, etc.)
- Basic workflow steps
- File organization principles
- Tool selection priorities

## Execution Plan
1. Strip AGENTS.md to universal content only
2. Enhance CLAUDE.md with moved content
3. Update GEMINI.md with equivalent content
4. Test include system functionality
5. Validate no functionality lost

## Success Criteria
- AGENTS.md: Model-agnostic instructions only
- Model files: Comprehensive via includes
- Include system works (@AGENTS.md)
- All functionality preserved
- No new content added