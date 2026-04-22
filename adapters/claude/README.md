# Claude Code Adapter

This adapter installs the repo-root `xd-confluence` skill into Claude Code and connects Claude Code to Atlassian Rovo MCP.

## Install the skill

Preferred GitHub flow:

```text
https://github.com/<your-org>/<your-repo>
```

The agent should install the repo root as `xd-confluence`.

For a personal skill:

```bash
./scripts/install-skill.sh --target-dir "$HOME/.claude/skills"
```

For a project skill in another repository:

```bash
./scripts/install-skill.sh --target-dir "/path/to/project/.claude/skills"
```

## Add the MCP server

Run the example in [mcp-add.example.sh](./mcp-add.example.sh):

```bash
claude mcp add --transport http atlassian-rovo https://mcp.atlassian.com/v1/mcp
```

## Verify

Inside Claude Code:

```text
/mcp
```

You should see `atlassian-rovo` listed. Then try one of the prompts from [tests/smoke/prompts.md](../../tests/smoke/prompts.md).
