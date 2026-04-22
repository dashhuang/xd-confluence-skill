# Install With An Agent

Share this repository URL with your AI agent and use one of the prompts below.

Replace `<repo-url>` with the real GitHub repository URL.

## Generic prompt

```text
Open <repo-url>. Install this repository root as the xd-confluence skill into my local agent skills, then guide me step by step through company Confluence setup. Use AGENTS.md and references/install-and-permissions.md. Do not skip permission checks.
```

## Codex-oriented prompt

```text
Install <repo-url> as the xd-confluence skill into my Codex skills. If direct repo-root install is unsupported, copy the repo root manually. Then configure Atlassian Rovo MCP if needed and use xd-confluence in setup mode to guide me through company Confluence access.
```

## Claude Code oriented prompt

```text
Open <repo-url>. Copy the repo root into my Claude skills directory as xd-confluence, configure Atlassian Rovo MCP, then use xd-confluence to walk me through login, access, and a read-only smoke test.
```

## OpenClaw oriented prompt

```text
Open <repo-url>. Install the repo root as xd-confluence into my OpenClaw skills, make sure Atlassian Rovo MCP points to https://mcp.atlassian.com/v1/mcp, then guide me through company Confluence setup one step at a time.
```
