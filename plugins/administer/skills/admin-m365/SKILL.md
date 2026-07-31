---
name: admin-m365
description: >
  Inspect Entra users, groups and members, domains, licenses, devices,
  directory roles and members, or organization details through MCP United.
  Use for read-only Microsoft 365 tenant-directory questions.
metadata:
  id: admin-m365
  mcp-united-version: "2.0.0"
---

# Entra Directory Inspection

Use the canonical MCP United Entra tools. The caller must authenticate with
Entra, and the gateway requires its privileged role for these tools.

## Tools

| Need | Canonical tool |
|------|----------------|
| List, get, or search users | `entra_user_list`, `entra_user_get`, `entra_user_search` |
| List or get groups | `entra_group_list`, `entra_group_get` |
| List group members | `entra_group_member_list` |
| List domains | `entra_domain_list` |
| List tenant licenses | `entra_license_list` |
| List a user's licenses | `entra_user_license_list` |
| List devices | `entra_device_list` |
| List directory roles | `entra_role_list` |
| List role members | `entra_role_member_list` |
| Read organization details | `entra_organization_get` |

## Workflow

1. Use the narrowest list or search call that resolves the requested entity.
2. Reuse returned IDs for group-member, user-license, or role-member calls.
3. Bound list and search results to the request.
4. Report the returned data without implying a write occurred.

The current Entra surface is read-only. User, group, membership, license,
device, role, audit, security, or organization mutations are not exposed.
Do not fall back to raw Graph calls, local scripts, or separately retrieved
application credentials.

The observed successful license workflow is
`entra_license_list` followed by `entra_user_license_list` for the resolved
user. No Entra mutation workflow has been proven because no mutation tool is
published.
