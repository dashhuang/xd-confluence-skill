# OpenClaw Adapter

This repository root is itself the `xd-confluence` skill package.

## Default path

Prefer Atlassian Rovo MCP + OAuth for OpenClaw as well.

Do not switch to Confluence REST API + API token just because the user is using OpenClaw. REST/API token is a fallback for cases where the current OpenClaw runtime cannot load remote HTTP MCP, the environment cannot complete OAuth, or the user explicitly enables the advanced REST extension.

## Option 1: Use this repository as the workspace

If OpenClaw is pointed at this repository as its workspace, no extra skill copy is required. The repo root `.mcp.json` gives the default Atlassian Rovo MCP endpoint.

## Option 2: Copy the skill into another OpenClaw location

Workspace-level install:

```bash
./scripts/install-skill.sh --target-dir "/path/to/workspace/skills"
```

Personal shared install:

```bash
./scripts/install-skill.sh --target-dir "$HOME/.agents/skills"
```

Managed local install:

```bash
./scripts/install-skill.sh --target-dir "$HOME/.openclaw/skills"
```

## Add the MCP server

Use `openclaw mcp set` with the example JSON in [mcp-server.example.json](./mcp-server.example.json):

```bash
openclaw mcp set atlassian-rovo '{"url":"https://mcp.atlassian.com/v1/mcp","transport":"streamable-http"}'
```

Or rely on the repo root [.mcp.json](../../.mcp.json) if your OpenClaw setup already consumes project-level MCP config.

If an older OpenClaw runtime reports that only stdio MCP servers are supported, first try upgrading OpenClaw or enabling a compatible remote MCP path. Treat REST/API token as a fallback, not the normal setup path.

## Optional advanced layer

If you need local mirror, cache, or section-level write helpers, see:

- [extras/openclaw-extension/README.md](../../extras/openclaw-extension/README.md)

That is an advanced OpenClaw-only path and is not required for normal teammate rollout.

## Verify

```bash
openclaw skills list
openclaw mcp show atlassian-rovo
```

Then run one of the prompts from [tests/smoke/prompts.md](../../tests/smoke/prompts.md) in an OpenClaw session.
