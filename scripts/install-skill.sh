#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/install-skill.sh --target-dir <dir> [--skill-name xd-confluence]

Copies this repo-root skill package into <dir>/<skill-name>.

Examples:
  ./scripts/install-skill.sh --target-dir "${CODEX_HOME:-$HOME/.codex}/skills"
  ./scripts/install-skill.sh --target-dir "$HOME/.claude/skills"
  ./scripts/install-skill.sh --target-dir "$HOME/.agents/skills"
EOF
}

target_dir=""
skill_name="xd-confluence"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target-dir)
      target_dir="${2:-}"
      shift 2
      ;;
    --skill-name)
      skill_name="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -z "$target_dir" ]; then
  echo "--target-dir is required" >&2
  usage >&2
  exit 1
fi

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
source_dir="$repo_root"
dest_dir="$target_dir/$skill_name"

if [ ! -f "$source_dir/SKILL.md" ]; then
  echo "Skill source not found or invalid: $source_dir" >&2
  exit 1
fi

mkdir -p "$target_dir"

if [ "$dest_dir" = "/" ] || [ -z "$dest_dir" ]; then
  echo "Refusing to install into an unsafe destination: $dest_dir" >&2
  exit 1
fi

case "$dest_dir" in
  "$source_dir"|"$source_dir"/*)
    echo "Refusing to install into the source repository itself: $dest_dir" >&2
    exit 1
    ;;
esac

if command -v rsync >/dev/null 2>&1; then
  mkdir -p "$dest_dir"
  rsync -a --delete \
    --exclude '.git/' \
    --exclude '.DS_Store' \
    "$source_dir/" "$dest_dir/"
else
  rm -rf "$dest_dir"
  mkdir -p "$dest_dir"
  find "$source_dir" -mindepth 1 -maxdepth 1 ! -name '.git' -exec cp -R {} "$dest_dir/" \;
fi

echo "Installed '$skill_name' to $dest_dir"
