# Archiving Best Practices Guide

This guide provides standards and best practices for archiving code and documentation in the RAN repository.

## When to Archive vs Delete

### Archive
- Previous versions of refactored code
- Deprecated but historically important features
- Failed experiments with learning value
- Old documentation that provides context
- Configuration files from previous setups

### Delete
- Generated files (*.pyc, __pycache__)
- Temporary files
- Log files (after backing up if needed)
- Duplicate files with no unique value

## Standard Archive Structure

```
project/
└── archive/
    ├── README.md          # REQUIRED: Inventory of all archived items
    ├── legacy/            # Old versions of current code
    │   └── v1/
    │       └── [files]
    ├── experiments/       # Failed or abandoned attempts
    │   └── [experiment_name]/
    │       ├── README.md  # What was tried and why it failed
    │       └── [files]
    ├── misc/             # Miscellaneous files
    │   └── [loose files moved from root]
    └── docs/             # Old documentation
        └── [outdated docs]
```

## Archive README Template

Each archive must have README.md with:
- Table of contents
- For each item:
  - Date archived
  - Original location
  - Reason for archiving
  - Brief description
  - Any warnings or notes

### Example Archive README.md

```markdown
# Archive Inventory

## Table of Contents
- [Legacy Code](#legacy-code)
- [Experiments](#experiments)
- [Miscellaneous](#miscellaneous)

## Legacy Code

### v1/mqtt_handler.py
- **Date Archived**: 2025-07-28
- **Original Location**: /src/mqtt_handler.py
- **Reason**: Refactored to use async/await pattern
- **Description**: Original synchronous MQTT handler
- **Notes**: Contains working logic but poor performance

## Experiments

### websocket_bridge/
- **Date Archived**: 2025-07-25
- **Original Location**: /experiments/websocket_bridge/
- **Reason**: Approach abandoned in favor of REST API
- **Description**: Attempted to create WebSocket-MQTT bridge
- **Notes**: See README.md in folder for lessons learned
```

## Handling Loose Files

Common loose files in root directories and where they belong:
- Test scripts → `archive/experiments/` or `tests/`
- Old configs → `archive/legacy/configs/`
- Workspace files → Keep in root (do not archive .code-workspace files)
- Contact/CRM files → Move to appropriate project
- Documentation → `docs/` or `archive/docs/`

## Archive Naming Conventions

- Use dates: `archive/legacy/v1_20250128/`
- Be descriptive: `archive/experiments/mqtt_bridge_attempt/`
- Keep extensions: Don't rename files during archiving
- Use underscores for spaces in directory names

## Git Considerations

- Always commit before major archiving
- Use descriptive commit messages
- Consider .gitignore for large archived files
- Tag releases before major reorganizations

## Best Practices

1. **Document Everything**: Every archived item needs explanation
2. **Preserve Context**: Include related files together
3. **Maintain History**: Never archive something that might be needed for git blame/history
4. **Review Before Archiving**: Ensure the code isn't referenced elsewhere
5. **Keep It Organized**: Follow the standard structure consistently

## What NOT to Archive

- Files still in active use
- Dependencies or libraries
- Configuration files for active services
- Documentation for current features
- .code-workspace files (keep in root)

## Archive Maintenance

- Review archives annually
- Consider permanent deletion of very old, irrelevant items
- Update archive README.md files when adding new items
- Consolidate similar archived items when sensible