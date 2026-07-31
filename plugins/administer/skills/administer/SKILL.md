---
name: administer
description: >
  Cloud administration router. Use when the user needs read-only Entra
  directory inspection or a Portainer Docker stack deployment.
metadata:
  id: administer
  mcp-united-version: "2.0.0"
---

# Administer

Cloud and tenant administration.

## Sub-skills

| Skill | Platform | Description |
|-------|----------|-------------|
| admin-m365 | Entra | Read-only users, groups and members, domains, licenses, devices, roles and organization details |
| admin-portainer | Portainer | Docker Compose stack deploys on the karel.in fleet |

## Routing

- **"Entra", "directory users", "groups", "licenses", "directory roles", "tenant organization"** → admin-m365
- **"Portainer", "redeploy stack", "compose deploy", "roll image", host names (seven/kolme/five/trix/kiiro)** → admin-portainer

GCP (`admin-gcp`) is archived — not in use.
