#!/usr/bin/env bash
# Install the generic /kb bridge skill globally (Claude + Codex) and register this KB in the
# multi-KB manifest (~/.config/kb/registry.json).
#
# The global /kb skill is installed once and serves ALL knowledge bases via the manifest.
# Re-running refreshes the skill and upserts this KB's manifest entry (derived from kb.config.json).
#
# Usage: bash scripts/wire-global.sh <kb_abs_path> [<kb_name>] [<kb_remote>]
#   (name/remote are optional — they're read from <kb_abs_path>/kb.config.json)
set -euo pipefail

KB_PATH="${1:?usage: wire-global.sh <kb_abs_path> [<kb_name>] [<kb_remote>]}"
SKILL_SRC="$KB_PATH/.claude/skills/kb"

[ -d "$SKILL_SRC" ] || { echo "no /kb skill at $SKILL_SRC" >&2; exit 1; }
[ -f "$KB_PATH/kb.config.json" ] || { echo "no kb.config.json at $KB_PATH (run setup/scaffold first)" >&2; exit 1; }

# 1. Install /kb globally as a real copy (independent of any single KB, so a deleted KB never
#    leaves a dangling skill). The skill resolves KB paths at runtime via the manifest.
#    Guard against DOWNGRADES: KBs created at different times drift, so never overwrite a newer
#    global skill with an older KB's bundled copy — compare VERSION, install only same-or-newer.
mkdir -p "$HOME/.claude/skills" "$HOME/.codex/skills/kb"
incoming_v="$(cat "$SKILL_SRC/VERSION" 2>/dev/null || echo 1)"
installed_v="$(cat "$HOME/.claude/skills/kb/VERSION" 2>/dev/null || echo 0)"
if [ "${installed_v:-0}" -gt "${incoming_v:-1}" ]; then
  echo "Global /kb skill is v$installed_v (newer than this KB's v$incoming_v) — keeping it; only refreshing the manifest entry."
else
  rm -rf "$HOME/.claude/skills/kb"          # safe: removes a prior symlink or our prior copy
  cp -R "$SKILL_SRC" "$HOME/.claude/skills/kb"
  echo "Installed /kb skill v$incoming_v globally."
fi
ln -sfn "$HOME/.claude/skills/kb/SKILL.md" "$HOME/.codex/skills/kb/SKILL.md"

# 2. Register this KB in the manifest (derives name/description/topics/products from kb.config.json)
node "$HOME/.claude/skills/kb/scripts/manifest.mjs" upsert "$KB_PATH"

echo "Wired /kb globally (Claude + Codex)."
