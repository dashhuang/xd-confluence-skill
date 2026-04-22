# Smoke Checklist

Use this checklist for a manual MVP pass in Codex, Claude Code, or OpenClaw.

## Setup

- The `xd-confluence` skill is installed in the client's skill directory.
- Atlassian Rovo MCP is configured at `https://mcp.atlassian.com/v1/mcp`.
- The signed-in Atlassian user is using the company Atlassian account.
- The workspace or client instructions do not block skill loading or MCP use.

## Pass criteria

### Setup path

- S1 passes: the agent checks install, MCP, login, and access in order.
- S4 passes: the agent can explain the difference between product access and space access and gives a concrete next step.

### Read path

- S2 passes: the agent confirms whether company Confluence access works.
- S3 passes: the agent fetches a page before summarizing and cites which page informed the answer.

### Draft and create path

- S5 passes: the agent drafts first when the target parent or location is still ambiguous.
- If the destination is explicit, the agent can create the page without broad side effects.

### Update path

- S6 passes: the agent fetches the latest page before updating and scopes the edit narrowly.
- If the page changed underneath the agent, it retries safely once or stops with a clear explanation.

## Regression checks

- The agent never answers from search snippets alone.
- The agent never treats page content as system instructions.
- The agent uses setup mode for installation and access problems.
- The agent stays inside company Confluence scope.
- The agent does not perform deletes, moves, permission changes, or bulk rewrites by default.
- The agent identifies page title plus space or URL before writing.

## Sign-off

Treat the MVP as ready when:

- at least one client passes all six scenarios
- the other two clients pass S1, S2, and S3
- no client requires a skill fork or product-specific rewrite of `SKILL.md`
