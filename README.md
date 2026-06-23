# Knowledge Base Template

> A git-based, **model-agnostic** knowledge base you can spin up for any product in two minutes —
> with a guided setup and a `/kb` skill that bridges your day-to-day coding to a centralized,
> verifiable knowledge store. Works with **Claude Code** and **Codex**.

The KB is durable, vendor-independent memory. Every fact is **typed**, **provenanced** (cites a PR /
file / commit), and **staleness-tracked** (`last_verified`) — so any agent or model can retrieve and
*verify* it. Trust comes from verifiability, not from one model's memory.

---

## 🚀 First-time setup

**Standalone KB** (a separate, GitHub-backed repo documenting one+ products) — pick A or B. Or, for a
self-contained project, an **in-repo KB** that lives in your repo's own `docs/` — path C.

### A. With an agent (recommended)
1. Click **“Use this template”** on GitHub → create your KB repo → clone it.
   *(Or copy this folder.)*
2. Open the folder in **Claude Code** or **Codex**. The skills ship under `.claude/skills/`, so
   **`/kb-setup` is available immediately** in that session.
3. Run **`/kb-setup`**. Answer a few questions (GitHub destination, your first product, the source
   repo it documents). It scaffolds the KB, creates the GitHub repo, and wires `/kb` in globally.

### B. From the terminal
```bash
npm run setup     # interactive: interview → scaffold → GitHub repo → global wiring
```

That's it. From any product repo afterwards, just type **`/kb`**.

### C. In-repo KB — no separate repo
For a self-contained project (a starter, a single service), keep the KB **inside the repo's own
`docs/`** instead of a separate repo. From that repo:
```bash
/kb init                                                  # in Claude / Codex
# or:  node ~/.claude/skills/kb/scripts/manifest.mjs init "$PWD"
```
It writes `docs/kb.config.json` (`layout: in-repo`), seeds the capture targets, builds
`docs/kb.index.json`, and registers the KB. `/kb` resolves to it from then on — and the docs ship and
version with your code, no extra repo and no push step. `/kb` even *offers* this automatically when it
sees a `docs/` that looks like a KB but isn't configured yet.

---

## What you get

- **`/kb` — the bridge skill** (config-driven, registry-aware; serves multiple KBs):
  - `/kb` — **read**: detects the product from your cwd, pulls the KB, surfaces the matching
    notes / ADRs / reference for what you're doing. Writes nothing to your working repo.
  - `/kb adr` · `/kb note` — **capture**: a decision/follow-up, with a built-in grill-check, then
    commit + push.
  - `/kb sweep <product>` — **deep refresh**: git/PR fan-out audit since the watermark; rebuilds the
    reference docs and appends a dated audit.
- **`/kb-setup` — the bootstrap skill**: the interactive scaffolder. Dual-mode — bootstrap a new KB,
  or add a product to an existing one.
- **A typed document taxonomy + metadata backbone** — see [`docs/CONVENTIONS.md`](./docs/CONVENTIONS.md).
- **A generated index** (`kb.index.json`, zero-dependency builder) for cheap agent retrieval.
- **Doc skeletons** ([`doc-templates/_skeletons.md`](./doc-templates/_skeletons.md)) copied on capture.

---

## Document taxonomy (at a glance)

`reference` · `explanation` · `adr` · `rfc` · `runbook` · `glossary` · `invariant` · `contract` ·
`audit` · `note` · `context` · `index` — unified by one YAML front-matter schema and one index.
Standards behind them: Diátaxis, MADR, C4, DDD ubiquitous language, RFC. Full details in
[`docs/CONVENTIONS.md`](./docs/CONVENTIONS.md).

---

## How it works

The short version: a single global `/kb` skill bridges whatever repo you're in to the right KB — a
**separate** version-controlled repo, or an **in-repo** one in your own `docs/` (`/kb init`) — reading
context in, capturing decisions out. For the full architecture (resolution algorithm, the three modes,
the data model, design rationale, troubleshooting), read
**[`docs/HOW-IT-WORKS.md`](./docs/HOW-IT-WORKS.md)**.

---

## Requirements

- **Node ≥ 18** (scripts use `node:` built-ins only — zero npm dependencies).
- **git** + the **GitHub CLI (`gh`)**, authenticated (`gh auth status`).
- **Claude Code** or **Codex** for the skill-driven flow (optional; `npm run setup` works without one).

---

## Layout

```
.
├── README.md                       # this file (replaced by the KB index after setup)
├── package.json                    # npm run setup | scaffold | index
├── kb.config.example.json          # shape of the config setup generates
├── docs/
│   ├── CONVENTIONS.md              # taxonomy + metadata schema + folder shape
│   └── HOW-IT-WORKS.md             # deep architecture & operations dive
├── doc-templates/_skeletons.md     # front-matter skeleton per doc type
├── scripts/
│   ├── setup.mjs                   # interactive terminal setup (npm run setup)
│   ├── scaffold.mjs                # deterministic file generation
│   └── wire-global.sh             # install /kb globally + register the KB
└── .claude/skills/
    ├── kb-setup/SKILL.md           # the interactive bootstrap
    └── kb/SKILL.md + scripts/      # the bridge skill + index builder
```

---

## Manual setup (no agent, no prompts)

```bash
cp kb.config.example.json kb.config.json      # edit: name, remote, products, source repos
node scripts/scaffold.mjs --manual            # scaffold sections from kb.config.json
git init && git add -A && git commit -m "feat: bootstrap knowledge base"
gh repo create <owner>/<repo> --private --source=. --remote=origin --push
bash scripts/wire-global.sh "$PWD" "<kb-name>" "<owner>/<repo>"
```

---

## License

[MIT](./LICENSE).
