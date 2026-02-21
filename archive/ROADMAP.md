# RAN Project Roadmap

## Epic Structure

### Epic 1: Documentation Workflow ✅ COMPLETED
- Migrated all instructions from CLAUDE.md to AGENTS.md
- Created comprehensive documentation templates and standards
- Established archiving practices for legacy code
- Implemented proper security measures
- **Status**: Completed and archived in archive/projects/documentation_restructuring/

### Epic 2: Subagent Instructions and Orchestrator (IN PROGRESS)
**Project Plan**: [claude-code-orchestration-plan.md](./claude-code-orchestration-plan.md)
- Replace single agentic workflow with multi-subagent system
- Create `/home/alex/RAN/agents/` directory with specialized subagents
- Implement ORCHESTRATOR.md with intelligent task delegation
- Create clear interfaces between agents
- Enable subagent slash commands for direct access

### Epic 3: Agent-Driven Repository Improvements (FUTURE)
Using the new subagent system to systematically improve the repository:

#### Documentation Agent Tasks
- **README.md Standardization**: Review all folders and work with human to identify project boundaries
- Complete restructuring across all subprojects (CRAP, Y2, Services, IoT)
- Apply templates to all documentation files
- **NEEDS HUMAN REVIEW**: Identify which folders represent actual projects/systems requiring README.md files

#### Optimization Agent Tasks  
- **AGENTS.md Size Optimization**: Reduce size while maintaining clarity
- Move detailed practices to agent-specific documentation
- Consolidate repetitive sections
- **Documentation Deduplication**: Remove duplicates and add includes where needed

#### Mistake Analysis Agent Tasks
- Analyze patterns in AGENTS_mistakes.md
- Propose systematic solutions to prevent error patterns
- Implement improvements to AGENTS.md instructions
- Focus on eliminating entire classes of mistakes

#### Archive Agent Tasks
- Complete archiving of remaining outdated code
- Standardize archive structure across all projects
- Create missing archive directories and README inventories

## Implementation Order

1. **Complete Epic 2** - Build the subagent infrastructure
2. **Test and validate** - Ensure agents work correctly
3. **Execute Epic 3** - Use agents to improve the repository systematically

## Success Metrics

- Functional multi-agent system with clear task delegation
- Zero duplicate instructions across documentation
- 50% reduction in repeated mistake patterns
- All critical files (README.md, CHANGELOG.md, AGENTS_mistakes.md) properly maintained
- Clear identification of all projects vs. simple folders