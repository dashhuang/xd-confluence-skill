# Repo Agent Guide

This repository root is itself the installable `xd-confluence` skill package.

If a user gives you this repository URL and asks to install it:

- treat the **repo root** as the source of truth
- install the repo root into the user's local skill directory as `xd-confluence`
- then guide the user through company Confluence setup

## Install goal

Install the `xd-confluence` skill into the user's local agent skill directory, then help them connect company Confluence through Atlassian Rovo MCP.

## Preferred install behavior

### Codex

- If you can install from GitHub directly, install this repo root as `xd-confluence`.
- If your built-in installer only supports subpaths and cannot install repo root, clone or copy the repo root into `~/.codex/skills/xd-confluence`.
- Ensure `atlassian-rovo` points to `https://mcp.atlassian.com/v1/mcp`.
- If login is required, guide the user through `codex mcp login atlassian-rovo`.

### Claude Code

- Copy the repo root into either:
  - `~/.claude/skills/xd-confluence`
  - or `<repo>/.claude/skills/xd-confluence`
- Ensure Claude has an Atlassian Rovo MCP entry for `https://mcp.atlassian.com/v1/mcp`.

### OpenClaw

- Copy the repo root into one of:
  - `<workspace>/skills/xd-confluence`
  - `~/.agents/skills/xd-confluence`
  - `~/.openclaw/skills/xd-confluence`
- Prefer the repo root `.mcp.json` for the default Rovo MCP path.
- Only mention `extras/openclaw-extension/` if the user explicitly wants advanced OpenClaw-only mirror or REST features.

## Setup flow after install

After installation, guide the user step by step:

1. confirm the skill is visible
2. confirm Atlassian Rovo MCP is configured
3. confirm the user signs in with the company Atlassian account
4. confirm the user has Confluence product access
5. confirm the user can reach the company Confluence tenant through Rovo MCP
6. run a read-only smoke test against onboarding, handbook, or another safe page
7. only after read access works, proceed to any write flow

If access fails, stop and explain the next concrete permission step instead of guessing.

## Scope

- This skill is only for the company's own Confluence
- Do not repurpose it for arbitrary external Confluence sites by default
- Do not enable bulk writes, deletes, or moves during setup
