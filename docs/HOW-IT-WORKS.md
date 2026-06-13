---
id: kb-how-it-works
type: explanation
product: kb
status: current
scope: [meta]
summary: Deep dive — architecture, lifecycle, resolution algorithm, the three /kb modes, and the data model.
last_verified: { commit: null, date: null }
related: [kb-root, kb-conventions]
---

# How it works — deep dive

This explains the whole system end to end: the mental model, every component, the full lifecycle
from "Use this template" to daily use, the resolution algorithm, the three `/kb` modes, the data
model, and the design rationale. For the metadata/taxonomy rules see
[CONVENTIONS.md](./CONVENTIONS.md); this doc is the architecture.

---

## 1. Mental model

A **knowledge base (KB)** is a separate, git-versioned repository that holds durable, structured
knowledge about one or more **products** (each product = one source code repo it documents). You
don't read or edit the KB by hand day-to-day. Instead, a single global skill — **`/kb`** — acts as a
**bridge** between whatever repo you're currently working in and the right KB section.

```
   working repo (e.g. acme/web)                 centralized KB repo (acme/knowledge-base)
   ┌───────────────────────────┐                ┌───────────────────────────────────────┐
   │ your live conversation     │   /kb read     │  web/CONTEXT.md, adr/, reference/, ...  │
   │ + git log + current diff   │ ─────────────▶ │  surfaced back into your session        │
   │                            │                │                                        │
   │ a decision emerges         │   /kb capture  │  web/adr/0007-*.md  (committed+pushed)  │
   │                            │ ─────────────▶ │                                        │
   │                            │   /kb sweep    │  reference/* refreshed + audit appended │
   └───────────────────────────┘ ─────────────▶ └───────────────────────────────────────┘
                                                          ▲ never writes back into the working repo
```

Two hard guarantees make this safe and reliable:

1. **No pollution** — `/kb` reads the working repo for context but writes **only** into the KB repo.
2. **Verifiability over memory** — every fact in the KB is **typed**, **provenanced** (cites a PR /
   file / commit), and **staleness-tracked** (`last_verified`). Any agent or model can ingest and
   *verify* it; trust never depends on a particular model's memory. That is what "model-agnostic
   context engineering" means here.

---

## 2. Components

| Component | Lives in | Role |
|-----------|----------|------|
| **`/kb-setup` skill** | `.claude/skills/kb-setup/` | Interactive bootstrap: interview → scaffold → GitHub repo → global wiring. Dual-mode (bootstrap / add-a-product). |
| **`/kb` skill** | `.claude/skills/kb/` | The bridge. Config-driven, registry-aware. Modes: read, capture, sweep. |
| **`scaffold.mjs`** | `scripts/` | Deterministic file generation from setup answers (idempotent — never clobbers content). |
| **`wire-global.sh`** | `scripts/` | Installs `/kb` globally (Claude + Codex) and registers the KB. |
| **`setup.mjs`** | `scripts/` | Terminal equivalent of `/kb-setup` for non-agent use (`npm run setup`). |
| **`build-index.mjs`** | `.claude/skills/kb/scripts/` | Zero-dependency index builder → `kb.index.json`. |
| **`manifest.mjs`** | `.claude/skills/kb/scripts/` | Manages the multi-KB manifest: `upsert` / `scan` / `list` / `resolve`. Travels with the global skill. |
| **`kb.config.json`** | KB root | Product registry for this KB: each product's key, name, source repo, and `repoMatch` rules. |
| **`<product>/.state.json`** | per section | The **watermark** — last PR/commit a `sweep` covered. |
| **`kb.index.json`** | KB root | Generated manifest of all docs (id, type, scope, summary, path). |
| **`~/.config/kb/registry.json`** | your machine | Global list of KBs (`name`, `path`, `remote`) so one `/kb` skill can serve many KBs. |

The split is deliberate: **skills hold the *judgement*** (what to read, how to grill, how to group a
sweep), while **scripts hold the *determinism*** (file generation, symlinks, JSON edits). Agents are
good at the former and unreliable at the latter, so the mechanical steps are scripts the skill calls.

---

## 3. Lifecycle

### 3a. Create a KB from the template
1. **Use this template** on GitHub (or copy the folder). You get the scaffold + both skills.
2. Open the new repo in Claude Code / Codex. Because the skills ship under `.claude/skills/`, they're
   discovered **project-locally** in that session — `/kb-setup` is immediately available. (No global
   install needed yet.)
3. Run **`/kb-setup`** (or `npm run setup` in a terminal). It interviews you, then:
   - `scaffold.mjs` writes `kb.config.json`, the section(s), and the root README; builds the index.
   - `git init` → `gh repo create` (HTTPS push, so a locked SSH agent never blocks it).
   - `wire-global.sh` installs `/kb` into `~/.claude/skills` + `~/.codex/skills` and adds the KB to
     `~/.config/kb/registry.json`.

After this, the KB exists on GitHub and `/kb` is available **everywhere**, not just in the KB repo.

### 3b. Daily use (from any working repo)
- You're editing `acme/web`. You type `/kb`. The skill resolves cwd → the `web` product in the
  `acme` KB (via the registry + `repoMatch`), pulls the KB, and surfaces the relevant
  notes/ADRs/reference for what you're doing.
- A decision crystallises. You type `/kb adr`. The skill runs a short grill-check (type, provenance,
  accuracy, consequences, links), writes the ADR with full front-matter, rebuilds the index, commits,
  and pushes.

### 3c. Periodic refresh
- `/kb sweep web` fans out reader subagents over the source repo's merged PRs **since the watermark**,
  refreshes the current-state reference docs in place, appends a dated audit, and bumps the watermark.

---

## 4. Resolution algorithm (cwd → KB → product)

With multiple KBs on one machine, `/kb` figures out *which KB* and *which product* via a **resolution
ladder** over the manifest (`~/.config/kb/registry.json`):

1. **Explicit override.** `/kb @<name> …` targets a KB by its manifest `name`; `$KB_HOME` forces a
   path. (If the manifest is empty → `manifest.mjs scan` rebuilds it.)
2. **Repo match (deterministic).** `manifest.mjs resolve "$PWD"` tests the working repo against every
   KB's product `repoMatch` — `remotes` (vs `git remote get-url origin`), `folderNames` (cwd folder),
   `pathContains` (cwd path). Exactly one `matches[]` → use it.
3. **Topic match.** No repo match (a general question or unrelated dir) → rank the manifest's
   `knowledgeBases[]` by `description` + `topics` against the conversation. One clearly best → use it.
4. **Ask.** Otherwise show a picker of candidate KBs (`name — description`). One KB total → just use it.

Then **sync + orient**: `git -C <kbPath> pull --ff-only`, read `<section>/CONTEXT.md` + `kb.index.json`.

This is why setup records `sourceRepo`/`sourceLocalPath` (→ `repoMatch` signals) and `description`/
`topics` (→ topic-match signals). The manifest is a **cache**: `kb.config.json` stays authoritative,
and `manifest.mjs upsert`/`scan` rebuild the cache from it (so a new machine self-heals via `/kb scan`).

---

## 5. The three `/kb` modes in depth

### Read / bridge (`/kb`)
1. Infer the topic from the **live conversation** + light repo signals (recent commits, current diff,
   files being edited). The conversation is the query; you don't have to phrase one.
2. Query `kb.index.json` — rank by `scope` tags, `summary`, `title`, `type`. Read the few best docs in
   full (the index keeps this cheap — no full-tree walk).
3. Answer grounded in those docs, **citing each by `id` and its `sources`**. Surface applicable
   `invariant` guardrails first, then relevant `note` follow-ups.
4. If the conversation contradicts a doc (code drifted), say so and offer a capture. Never silently edit.

### Capture (`/kb adr` · `/kb note` · "save this")
1. Choose the `type` and target file (skeletons in `doc-templates/_skeletons.md`).
2. **Grill-check** (one question at a time, only what can't be inferred): type & placement →
   provenance → accuracy → consequences (adr/rfc) → related links.
3. Write with full front-matter; set `last_verified` to today + the working repo's `HEAD` short SHA.
4. Rebuild the index; commit (Conventional Commits, scoped by product); push.

The grill-check is the quality gate — it refuses to write an unsourced claim, and the user's
confirmation **is** the approval for the outward push.

### Sweep (`/kb sweep <product>`)
1. Read `<section>/.state.json` (watermark) and the product's `sourceRepo`.
2. `gh pr list --repo <sourceRepo> --state merged --search "merged:>=<date>"`; group PRs by subsystem.
3. **Fan out** one reader subagent per cluster to read PR bodies + key diffs and return structured
   findings (mirroring the `audits/` style). Scale: a few finders for a light refresh; more + an
   adversarial verify pass for a deep audit. Anything capped (top-N, sampling) is logged, never
   silently truncated.
4. Update `reference`/`contract`/`explanation` docs **in place** (current-state — no changelogs) and
   refresh their `last_verified`.
5. Append a dated `audit` doc; update the watermark; rebuild the index; commit + push.

The watermark is what makes sweeps *incremental* — the second sweep only reads what merged since the
first.

---

## 6. Data model

### `kb.config.json` (per KB)
```jsonc
{
  "version": 1,
  "kbHome": ".",
  "name": "acme",
  "remote": "acme/knowledge-base",
  "description": "Acme product knowledge base.",
  "topics": ["acme", "web", "billing"],
  "products": [
    {
      "key": "web", "section": "web", "name": "Acme Web App",
      "sourceRepo": "acme/web",
      "repoMatch": {
        "remotes": ["acme/web"],
        "folderNames": ["web"],
        "pathContains": ["/Users/you/dev/acme/web", "acme/web"]
      }
    }
  ]
}
```

### `<product>/.state.json` (watermark)
```jsonc
{ "product": "web", "repo": "acme/web",
  "lastSwept": { "pr": 412, "commit": "ab12cd3", "date": "2026-06-13", "method": "sweep", "by": "audits/2026-06-q2.md" } }
```

### `~/.config/kb/registry.json` (per machine, all KBs — the manifest / cache)
```jsonc
{
  "version": 2,
  "knowledgeBases": [{
    "name": "acme", "path": "/Users/you/dev/acme/knowledge-base", "remote": "acme/knowledge-base",
    "description": "Acme product knowledge base.",
    "topics": ["acme", "web", "billing"],
    "products": [{ "key": "web", "sourceRepo": "acme/web" }],
    "lastRegistered": "2026-06-13"
  }]
}
```
Managed by `manifest.mjs`: `upsert <kbPath>` (register/refresh from kb.config.json), `scan [roots…]`
(discover + register), `list`, `resolve <cwd>` (deterministic repo-match). Override the path with
`$KB_REGISTRY`; scan roots with `$KB_SCAN_ROOTS`.

### `kb.index.json` (generated)
Built by `build-index.mjs`, which walks the KB (ignoring `.git`, `.claude`, `doc-templates`,
`scripts`, dotfiles), parses each doc's front-matter (a minimal reader for scalars + inline arrays),
and emits `{ generatedAt, count, missingFrontMatter, products, entries[] }`. Each entry:
`{ id, type, product, title, status, scope, summary, related, path, hasFrontMatter }`. Docs without
front-matter still get indexed with an **inferred** type (from folder/filename) and a path-derived
id, and are flagged under `missingFrontMatter` so gaps are visible.

---

## 7. Why these choices (design rationale)

- **Separate KB repo, not in-repo docs.** Knowledge spans products and outlives any one repo; a
  central KB is queryable from everywhere and survives repo churn. The bridge keeps it from being a
  chore.
- **Front-matter + index, not free-form Markdown.** Structure is what lets *any* model retrieve and
  verify reliably. The index is the retrieval contract — cheap, deterministic, no embeddings needed.
- **Provenance + `last_verified`.** A KB's failure mode is silent staleness. Citations make claims
  checkable; `last_verified` + the watermark make staleness *detectable* and *fixable*.
- **Skills for judgement, scripts for mechanics.** Keeps the agent on tasks it's good at and makes the
  risky steps (file writes, symlinks, JSON edits) deterministic and reviewable.
- **Registry + config-driven `/kb`.** One global skill serves many KBs; KBs are decoupled from the
  skill install, so deleting a KB never leaves a dangling skill.
- **HTTPS-first git.** Avoids the common "locked SSH agent" failure when creating/pushing repos.
- **Idempotent scaffold.** Re-running setup or add-a-product never overwrites authored content
  (`writeIfAbsent`), so it's safe to re-run.

---

## 8. Extending

- **New doc type** — add it to the taxonomy table in `CONVENTIONS.md`, add a skeleton in
  `doc-templates/_skeletons.md`, and (optionally) a folder/filename rule in `build-index.mjs`'s
  `inferType`.
- **New product in an existing KB** — `/kb-setup` (add-a-product mode) or
  `node scripts/scaffold.mjs <answers>.json --product <key>`.
- **New KB** — copy the template (or "Use this template") and run `/kb-setup`. It registers alongside
  any existing KBs.
- **Tune retrieval** — enrich `scope` tags and `summary` lines; the read mode ranks on them.

---

## 9. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `/kb` says no KB found | `~/.config/kb/registry.json` missing/empty → run `/kb-setup`, or set `$KB_HOME`. |
| `/kb` picks the wrong product | Tighten `repoMatch` in `kb.config.json` (add the exact `pathContains`/remote). |
| Push fails: `Permission denied (publickey)` | Locked SSH agent → switch remote to HTTPS and `gh auth setup-git && git push` (setup does this automatically). |
| Index missing a doc | It has no front-matter and an odd path → add front-matter, or extend `inferType`; check `missingFrontMatter` in `kb.index.json`. |
| Empty `adr/`/`rfc/` dirs vanish on clone | They're kept by `.gitkeep` files the scaffold writes. |
| Skill not offered in Claude | Confirm `~/.claude/skills/kb/SKILL.md` resolves (global) or you're in the KB repo (`.claude/skills`). |

---

## 10. Requirements

- **Node ≥ 18** (scripts use `node:` built-ins only — zero npm dependencies).
- **git** and the **GitHub CLI (`gh`)**, authenticated (`gh auth status`).
- **Claude Code** or **Codex** for the skill-driven flow (optional — `npm run setup` works without).
