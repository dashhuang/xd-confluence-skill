# Company Scope

This skill is for the company's own Confluence only.

## Default assumptions

- the user should sign in with their company-managed Atlassian account
- Atlassian Rovo MCP is the default integration path
- the company Confluence content is internal and should be treated as sensitive
- a teammate may need both product-level access and space-level access before the skill works

## Scope rules

- use only the Confluence data exposed through the configured company Atlassian account
- do not intentionally browse unrelated external Confluence sites
- do not suggest exporting company data into public locations
- avoid broad write operations until a read-only smoke test has succeeded

## Setup success criteria

Treat setup as complete only when all of these are true:

1. the skill is installed in the user's agent
2. Atlassian Rovo MCP is configured
3. the user has completed Atlassian login
4. the user can read at least one company Confluence page through MCP

## If the user is blocked

Common blockers:

- wrong Atlassian account
- no Confluence product access
- no permission to the target space
- MCP configured but not logged in
- MCP logged in but company wiki search returns nothing

When blocked, explain which blocker is most likely and use the permission playbook rather than guessing.
