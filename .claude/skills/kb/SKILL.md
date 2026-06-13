---
name: kb
description: >-
  Bridge between the repo you're working in and a centralized, git-based knowledge base.
  Use when the user types /kb, or wants to look up past decisions / ADRs / notes / reference
  context for the product they're working on, capture a decision or follow-up into the KB,
  or run a deep git/PR sweep to refresh a product's KB section. Config-driven and registry-aware
  (supports multiple KBs). Reads the current conversation and light repo signals; writes ONLY to
  the centralized KB repo, never into the working repo.
---

# kb — knowledge-base bridge

A bidirectional bridge between the **product repo you're working in** and a **centralized,
version-controlled knowledge base**. The KB is durable, model-agnostic memory: every fact is typed,
provenanced, and staleness-tracked. This skill is generic — it resolves which KB and which product
from config, so it works for any KB created from the template.

## Iron rules

1. **Never pollute the working repo.** Read the working repo (conversation, `git log`, current
   diff, staged changes) for context, but **write only inside the KB repo**.
2. **Verify before you write.** Run the built-in grill-check (below) on every capture.
3. **Cite provenance.** Every claim links a PR, file, or commit. No unsourced assertions.
4. **Keep the index fresh.** After any write, rebuild `kb.index.json`.
5. **Honor the host's attribution rules** (default: no AI attribution in files or commits).

## Step 0 — resolve the KB and the product

1. **Find candidate KBs:** read `~/.config/kb/registry.json` (`knowledgeBases: [{name, path, remote}]`).
   Honor a `$KB_HOME` override if set. If the registry is missing/empty, tell the user to run
   `/kb-setup` in a KB clone (or set `$KB_HOME`).
2. **Pick the KB + product:** for each registered KB, read `<path>/kb.config.json` and match the
   working repo against each product's `repoMatch` (git `origin` remote → `remotes`; cwd folder →
   `folderNames`; cwd path → `pathContains`). Choose the matching `{kb, product}`. If several match,
   ask. If none match but exactly one KB exists, use it and ask which product (or offer to add one).
3. **Sync:** `git -C <kbPath> pull --ff-only`.
4. **Orient:** read `<kbPath>/<section>/CONTEXT.md` and `<kbPath>/kb.index.json` before acting.

## Mode: read / bridge  (`/kb`, or a question)

Surface the KB context relevant to what the user is doing now.

1. Infer the topic from the **live conversation** + light repo signals (recent commits, current
   diff, files being edited).
2. Query `kb.index.json` — match on `scope`, `summary`, `title`, `type`. Read the few best docs fully.
3. Answer grounded in those docs. **Cite each by `id` + its `sources`.** Surface relevant `note`
   follow-ups and any applicable `invariant` (guardrails first).
4. If the conversation shows the KB is **stale or wrong** (code contradicts a doc), say so and offer
   to capture a correction. Never silently edit.

## Mode: capture  (`/kb adr`, `/kb note`, "save this to the kb")

Capture a decision, gotcha, or follow-up. Pick the `type` and target (see
`<kbPath>/doc-templates/_skeletons.md` for the skeleton to copy):

- **`adr`** → `<section>/adr/NNNN-kebab-title.md` (light MADR). Next free `NNNN`.
- **`rfc`** → `<section>/rfc/NNNN-kebab-title.md` (`status: proposed`).
- **`note`** → append to `<section>/notes.md`.
- **`invariant`** → append to `<section>/invariants.md`.
- **`glossary`** → append to `<section>/glossary.md`.
- **`runbook`** → `<section>/runbooks/kebab-title.md`.

### Built-in grill-check (before writing)
Ask one at a time, only what you can't infer with confidence:
1. **Type & placement** — "Capturing as `<type>` in `<path>` — right bucket?"
2. **Provenance** — "Source — PR number, file, or commit?" (don't write an unsourced claim).
3. **Accuracy** — restate it in one line; "accurate?"
4. **Consequences** (adr/rfc) — "Any downside or follow-up this creates?"
5. **Links** — propose `related` ids from the index; confirm.

Then write with full front-matter, set `last_verified` to today + the working repo's `HEAD` short
SHA, rebuild the index, commit + push.

## Mode: sweep  (`/kb sweep <product>`)

Heavy refresh — a git/PR fan-out audit since the watermark. Bootstraps a new section or refreshes one.

1. Read `<section>/.state.json` → `lastSwept`. Read the product's `sourceRepo` from `kb.config.json`.
2. List merged PRs since the watermark: `gh pr list --repo <sourceRepo> --state merged --search "merged:>=<date>"`
   (or by number). Group by subsystem/scope.
3. Fan out reader subagents (one per cluster) to read PR bodies + key diffs; return structured
   findings, mirroring the `audits/` style.
4. Update affected `reference`/`contract`/`explanation` docs **in place** (current-state — no
   changelogs), refresh their `last_verified`.
5. Append a dated `audit`: `<section>/audits/YYYY-MM-<topic>.md`.
6. Update `<section>/.state.json` (`pr`, `commit`, `date`, `method`, `by`).
7. Rebuild the index, commit + push.

> Scale to the ask: few finders for a light refresh; more + an adversarial verify pass for a deep
> audit. Log anything you cap — never silently truncate coverage.

## Front-matter schema

See `<kbPath>/docs/CONVENTIONS.md`. Required: `id`, `type`, `product`, `summary`. Always set
`sources` and `last_verified`.

## Git protocol (full-auto, gated by the grill-check)

- **Read:** `git -C <kbPath> pull --ff-only` first.
- **Write:** after the user confirms → `git -C <kbPath> add -A` →
  `git -C <kbPath> commit -m "<conventional message>"` → `git -C <kbPath> push`.
- Conventional Commits, scoped by product: `docs(<product>): adr NNNN — <title>` /
  `chore(<product>): sweep KB to PR #<n>`.
- The grill-check confirmation **is** the approval for the outward push.
- If push fails on SSH (locked agent), switch the remote to HTTPS and push via the `gh` token.

## Index

After every write: `node <kbPath>/.claude/skills/kb/scripts/build-index.mjs <kbPath>`.
