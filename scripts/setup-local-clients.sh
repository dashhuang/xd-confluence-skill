#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

install_skill_if_dir_exists() {
  local target_dir="$1"
  if [ -d "$target_dir" ]; then
    "$repo_root/scripts/install-skill.sh" --target-dir "$target_dir"
    if [ -d "$target_dir/confluence" ]; then
      echo "Legacy skill '$target_dir/confluence' is still present. Consider removing it to avoid ambiguity."
    fi
    if [ -d "$target_dir/xd-confluence/skills/xd-confluence" ]; then
      echo "Found an older nested-layout xd-confluence install. The current V2 layout uses repo root as the installed skill package."
    fi
  else
    echo "Skipping missing skill directory: $target_dir"
  fi
}

echo "Installing into Codex skills if available..."
install_skill_if_dir_exists "${CODEX_HOME:-$HOME/.codex}/skills"

echo "Installing into Claude skills if available..."
if [ -d "$HOME/.claude" ] || command -v claude >/dev/null 2>&1; then
  mkdir -p "$HOME/.claude/skills"
  "$repo_root/scripts/install-skill.sh" --target-dir "$HOME/.claude/skills"
  if [ -d "$HOME/.claude/skills/confluence" ]; then
    echo "Legacy skill '$HOME/.claude/skills/confluence' is still present. Consider removing it to avoid ambiguity."
  fi
  if [ -d "$HOME/.claude/skills/xd-confluence/skills/xd-confluence" ]; then
    echo "Found an older nested-layout xd-confluence install under Claude skills."
  fi
else
  echo "Skipping Claude skill install because neither ~/.claude nor claude is present."
fi

if command -v codex >/dev/null 2>&1; then
  codex_config="${CODEX_HOME:-$HOME/.codex}/config.toml"
  mkdir -p "$(dirname "$codex_config")"
  touch "$codex_config"

  echo "Ensuring Codex MCP server is configured in config.toml..."
  if grep -q '^\[mcp_servers\.atlassian-rovo\]' "$codex_config"; then
    echo "Codex MCP server 'atlassian-rovo' is already present in config."
  else
    cat >> "$codex_config" <<'EOF'

[mcp_servers.atlassian-rovo]
url = "https://mcp.atlassian.com/v1/mcp"
EOF
    echo "Added Codex MCP config for 'atlassian-rovo'."
  fi

  echo "If Codex asks for Atlassian login on first use, run:"
  echo "  codex mcp login atlassian-rovo"
else
  echo "Skipping Codex MCP and marketplace setup because codex is not installed."
fi

echo "Local client setup complete."
