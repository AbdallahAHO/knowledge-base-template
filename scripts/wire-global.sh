#!/usr/bin/env bash
# Install the generic /kb bridge skill globally (Claude + Codex) and register this KB.
#
# The global /kb skill is installed once and serves ALL knowledge bases via the registry at
# ~/.config/kb/registry.json. Re-running refreshes the skill and upserts this KB.
#
# Usage: bash scripts/wire-global.sh <kb_abs_path> <kb_name> [<kb_remote>]
set -euo pipefail

KB_PATH="${1:?usage: wire-global.sh <kb_abs_path> <kb_name> [<kb_remote>]}"
KB_NAME="${2:?missing kb name}"
KB_REMOTE="${3:-}"
SKILL_SRC="$KB_PATH/.claude/skills/kb"

[ -d "$SKILL_SRC" ] || { echo "no /kb skill at $SKILL_SRC" >&2; exit 1; }

# 1. Install /kb globally as a real copy (independent of any single KB, so a deleted KB never
#    leaves a dangling skill). The SKILL.md resolves the KB path at runtime via the registry.
mkdir -p "$HOME/.claude/skills" "$HOME/.codex/skills/kb"
rm -rf "$HOME/.claude/skills/kb"          # safe: removes a prior symlink or our prior copy
cp -R "$SKILL_SRC" "$HOME/.claude/skills/kb"
ln -sfn "$HOME/.claude/skills/kb/SKILL.md" "$HOME/.codex/skills/kb/SKILL.md"

# 2. Register this KB in ~/.config/kb/registry.json
REG_DIR="$HOME/.config/kb"; REG="$REG_DIR/registry.json"
mkdir -p "$REG_DIR"
node -e '
const fs=require("fs");
const [reg,name,path,remote]=process.argv.slice(1);
let r={knowledgeBases:[]};
try{r=JSON.parse(fs.readFileSync(reg,"utf8"));}catch{}
r.knowledgeBases=(r.knowledgeBases||[]).filter(k=>k.name!==name);
r.knowledgeBases.push({name,path,remote:remote||null});
fs.writeFileSync(reg,JSON.stringify(r,null,2)+"\n");
console.log("registry:",reg,"->",r.knowledgeBases.length,"KB(s)");
' "$REG" "$KB_NAME" "$KB_PATH" "$KB_REMOTE"

echo "Wired /kb globally (Claude + Codex) and registered '$KB_NAME' -> $KB_PATH"
