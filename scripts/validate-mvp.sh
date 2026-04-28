#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

python3 - "$repo_root" <<'PY'
import json
import re
import sys
from pathlib import Path

repo = Path(sys.argv[1])

required_files = [
    "AGENTS.md",
    "INSTALL_WITH_AGENT.md",
    "README.md",
    "SKILL.md",
    ".mcp.json",
    "agents/openai.yaml",
    "references/company-scope.md",
    "references/install-and-permissions.md",
    "references/admin-checklist.md",
    "references/search.md",
    "references/write-safety.md",
    "references/content-format.md",
    "adapters/codex/README.md",
    "adapters/codex/AGENTS.snippet.md",
    "adapters/codex/mcp-config.example.toml",
    "adapters/claude/README.md",
    "adapters/claude/mcp-add.example.sh",
    "adapters/openclaw/README.md",
    "adapters/openclaw/mcp-server.example.json",
    "extras/openclaw-extension/README.md",
    "extras/openclaw-extension/index.ts",
    "extras/openclaw-extension/openclaw.plugin.json",
    "scripts/install-skill.sh",
    "scripts/setup-local-clients.sh",
    "scripts/validate-mvp.sh",
    "tests/smoke/prompts.md",
    "tests/smoke/checklist.md",
]

missing = [path for path in required_files if not (repo / path).exists()]
if missing:
    raise SystemExit("Missing required files:\n- " + "\n- ".join(missing))

skill_md = repo / "SKILL.md"
content = skill_md.read_text()
if not content.startswith("---\n"):
    raise SystemExit("SKILL.md is missing YAML frontmatter delimiters.")

match = re.match(r"^---\n(.*?)\n---\n", content, re.DOTALL)
if not match:
    raise SystemExit("SKILL.md frontmatter is malformed.")

frontmatter = match.group(1)
for key in ["name: xd-confluence", "description:"]:
    if key not in frontmatter:
        raise SystemExit(f"SKILL.md frontmatter is missing expected key text: {key}")

json_files = [
    repo / ".mcp.json",
    repo / "adapters/openclaw/mcp-server.example.json",
    repo / "extras/openclaw-extension/openclaw.plugin.json",
]
for path in json_files:
    with path.open() as handle:
        json.load(handle)

toml_path = repo / "adapters/codex/mcp-config.example.toml"
try:
    import tomllib
except ModuleNotFoundError:
    tomllib = None

if tomllib is not None:
    with toml_path.open("rb") as handle:
        tomllib.load(handle)

readme = (repo / "README.md").read_text()
for needle in [
    "https://mcp.atlassian.com/v1/mcp",
    "installable skill repo",
    "INSTALL_WITH_AGENT.md",
    "tests/smoke/prompts.md",
]:
    if needle not in readme:
        raise SystemExit(f"README.md is missing expected text: {needle}")

print("Repository layout and example configs look valid.")
PY

echo "MVP validation passed."
