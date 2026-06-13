---
name: kb-setup
description: >-
  Bootstrap a new knowledge base from this template, or add a product to an existing one.
  Use when the user opens a freshly-copied knowledge-base template and wants to set it up, types
  /kb-setup, or asks to "spin up / configure / wire up the knowledge base". Runs an interview
  (one question at a time, with recommended answers), then scaffolds files, creates the GitHub repo,
  installs the global /kb skill, and registers the KB.
---

# kb-setup — bootstrap a knowledge base

The interactive scaffolder for a KB created from this template. It interviews the user, then wires
everything up so the `/kb` bridge works from any product repo. Think "GitHub template repo + a guided
setup script."

## Decide the mode first

- **Bootstrap** (new KB): `kb.config.json` does **not** exist (only `kb.config.example.json`). Run the
  full interview below.
- **Add a product** (existing KB): `kb.config.json` exists. Skip to *Add-a-product mode*.

Always run from the KB repo root (the folder containing `kb.config.example.json` / `kb.config.json`).

## Bootstrap interview

Ask **one question at a time**. Provide a recommended answer for each. Use the AskUserQuestion tool
for crisp choices; ask in prose when free-text is needed (names, repo slugs, paths). Grill lightly —
only ask what you can't infer; confirm anything ambiguous.

1. **KB identity & destination** —
   - `kbName` (short slug, e.g. the org/family name).
   - GitHub `owner/repo` for the KB (recommend a dedicated repo, e.g. `<owner>/knowledge-base`).
   - Visibility: **private** (recommended) or public.
2. **First product** (the KB can hold many; start with one) —
   - `key` (kebab slug, e.g. `app`), `name` (human-readable).
   - `sourceRepo` — the GitHub slug the KB documents (e.g. `<owner>/<repo>`). Used by `/kb sweep`.
   - `sourceLocalPath` — absolute local path of that repo (used to match cwd → product).
3. **Global wiring** — install `/kb` into `~/.claude/skills` + `~/.codex/skills` and register this KB
   now? (recommended **yes** — that's what makes `/kb` work from other repos).
4. **Initial content** — start **empty** (recommended; populate later with `/kb sweep <key>`) or run a
   deep sweep now (heavy: fans out agents over the source repo's PR history).
5. **Attribution** — confirm commit/author rules (default: Conventional Commits, **no AI
   attribution**).

Restate the full plan in 3–5 lines and get a final go-ahead before doing anything outward-facing.

## Bootstrap wiring (after confirmation)

1. **Write answers** to `.kb-answers.json` (git-ignored), shaped:
   ```json
   {
     "kbName": "<slug>", "owner": "<owner>", "repo": "<repo>", "visibility": "private",
     "description": "<one line>",
     "products": [{ "key": "<key>", "name": "<name>", "sourceRepo": "<owner>/<repo>",
                    "sourceLocalPath": "<abs path>" }],
     "attribution": "none"
   }
   ```
2. **Scaffold:** `node scripts/scaffold.mjs .kb-answers.json` — writes `kb.config.json`, the KB root
   `README.md` (index), each product section (`CONTEXT.md`, `README.md`, `.state.json`, `glossary.md`,
   `invariants.md`, `notes.md`, and `adr/ rfc/ runbooks/ audits/` dirs), removes
   `kb.config.example.json`, and builds `kb.index.json`.
3. **Git init + first commit:**
   ```bash
   git init -q && git symbolic-ref HEAD refs/heads/main
   git add -A
   git -c commit.gpgsign=false commit -q -m "feat: bootstrap <kbName> knowledge base"
   ```
4. **Create the GitHub repo + push** (outward-facing — already approved in the interview):
   ```bash
   gh repo create <owner>/<repo> --<visibility> --source=. --remote=origin --push --description "<desc>"
   ```
   If the SSH push fails (locked agent): `git remote set-url origin https://github.com/<owner>/<repo>.git`
   then `gh auth setup-git && git push -u origin main`.
5. **Wire globally** (if chosen): `bash scripts/wire-global.sh "$PWD" "<kbName>" "<owner>/<repo>"` —
   installs `/kb` into Claude + Codex and upserts `~/.config/kb/registry.json`.
6. **Optional first sweep:** if the user chose to populate now, invoke the `kb` skill's sweep mode for
   the first product (`/kb sweep <key>`).
7. **Explain how it works** — print a short summary: where the KB lives, the taxonomy
   (`docs/CONVENTIONS.md`), and the `/kb` modes (read / capture / sweep). Point them at
   `<key>/CONTEXT.md`.

## Add-a-product mode (existing KB)

1. Ask: product `key`, `name`, `sourceRepo`, `sourceLocalPath`.
2. Append the product to `kb.config.json` `products[]` (derive `repoMatch` from key + sourceRepo + path).
3. Scaffold just that section: `node scripts/scaffold.mjs .kb-answers.json --product <key>`.
4. Rebuild the index, commit (`feat(<key>): add product section`), push.
5. Offer a first `/kb sweep <key>`.

## Verify (don't claim done until checked)

- `kb.config.json` exists and validates; `kb.index.json` lists the new section(s).
- The GitHub repo exists and `git rev-parse --abbrev-ref @{u}` shows `origin/main`.
- If wired: `~/.claude/skills/kb/SKILL.md` and `~/.codex/skills/kb/SKILL.md` resolve, and the KB is in
  `~/.config/kb/registry.json`.
- From the source repo's path, `/kb` resolves to the right product (smoke-test the registry match).
