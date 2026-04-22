# Codex Adapter

This adapter installs the repo-root `xd-confluence` skill into Codex local skills and connects Codex to Atlassian Rovo MCP.

## Install the skill

Preferred GitHub flow:

```text
https://github.com/<your-org>/<your-repo>
```

If the agent can install repo-root skill repos directly, use the repository root.

If the agent cannot install repo root automatically, it should copy the whole repo into:

```text
${CODEX_HOME:-$HOME/.codex}/skills/xd-confluence
```

From a checked-out repository:

```bash
./scripts/install-skill.sh --target-dir "${CODEX_HOME:-$HOME/.codex}/skills"
```

Or use the one-shot local bootstrap:

```bash
./scripts/setup-local-clients.sh
```

## Add the MCP server

Use the CLI:

```bash
codex mcp add atlassian-rovo --url https://mcp.atlassian.com/v1/mcp
```

Or merge the example from [mcp-config.example.toml](./mcp-config.example.toml) into your Codex config.

The repo root also includes a reference [.mcp.json](../../.mcp.json) with the same endpoint.

## Optional AGENTS hint

Add the guidance from [AGENTS.snippet.md](./AGENTS.snippet.md) to your project's `AGENTS.md` if you want Codex to prefer the skill automatically during Confluence tasks.

## Verify

```bash
codex mcp list
```

Then prompt Codex with one of the smoke prompts from [tests/smoke/prompts.md](../../tests/smoke/prompts.md).
