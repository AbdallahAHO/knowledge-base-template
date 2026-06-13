# Knowledge Base Template

A git-based, **model-agnostic** knowledge-base scaffold for any product or product family. It ships
with two skills — a `/kb-setup` bootstrap and a `/kb` bridge — and a typed, provenanced,
staleness-tracked document taxonomy. Copy it, open it in Claude (or Codex), run `/kb-setup`, answer
a few questions, and you have a wired, GitHub-backed knowledge base.

> The KB is durable, vendor-independent memory. Every fact is **typed**, **provenanced** (cites a
> PR / file / commit), and **staleness-tracked** (`last_verified`). Trust comes from verifiability,
> not from any one model's memory.

## Quick start

1. **Copy this template** to a new folder (the KB will live here):
   ```bash
   cp -R ~/Developer/templates/knowledge-base ~/Developer/<somewhere>/<my>-knowledge-base
   # or, if published as a GitHub template repo: "Use this template" → clone
   ```
2. **Open that folder in Claude Code** (or Codex). Because the skills ship under `.claude/skills/`,
   `/kb-setup` and `/kb` are immediately available in that session.
3. **Run `/kb-setup`.** It interviews you (GitHub destination, first product, source repo to
   document, wiring) one question at a time, then:
   - writes `kb.config.json` and the section scaffolding,
   - `git init` + creates the GitHub repo + pushes,
   - installs `/kb` globally (Claude + Codex) and registers this KB,
   - optionally runs a first deep sweep to populate from the source repo's history.
4. **Done.** From any product repo, `/kb` now bridges your work to this KB.

## What you get

- **`/kb` (bridge skill)** — config-driven, registry-aware. Modes:
  - `/kb` — read: detect the product from cwd, pull the KB, surface the matching notes/ADRs/reference.
  - `/kb adr` · `/kb note` — capture a decision/follow-up (with a built-in grill-check) → commit + push.
  - `/kb sweep <product>` — heavy git/PR fan-out audit since the watermark; rebuilds docs + bumps it.
- **`/kb-setup` (bootstrap skill)** — the interactive scaffolder. Dual-mode: bootstrap a new KB, or
  add a product to an existing one.
- **Document taxonomy + metadata backbone** — see [docs/CONVENTIONS.md](./docs/CONVENTIONS.md).
- **Generated index** — `kb.index.json` (zero-dep `build-index.mjs`) for cheap agent retrieval.
- **Doc skeletons** — [doc-templates/_skeletons.md](./doc-templates/_skeletons.md), copied on capture.

## Layout

```
.
├── README.md                       # this file (replaced by the KB index after setup)
├── kb.config.example.json          # shape of the config /kb-setup will generate
├── docs/CONVENTIONS.md             # taxonomy + metadata schema + how /kb works
├── doc-templates/_skeletons.md     # front-matter skeleton per doc type
├── scripts/
│   ├── scaffold.mjs                # deterministic file generation from setup answers
│   └── wire-global.sh              # install /kb globally + register the KB
└── .claude/skills/
    ├── kb-setup/SKILL.md           # the interactive bootstrap
    └── kb/SKILL.md + scripts/      # the bridge skill + index builder
```

## Manual setup (no agent)

```bash
cp kb.config.example.json kb.config.json   # then edit: remote, products, source repos
node scripts/scaffold.mjs --manual         # scaffold sections from kb.config.json
git init && git add -A && git commit -m "feat: bootstrap knowledge base"
gh repo create <owner>/<repo> --private --source=. --remote=origin --push
bash scripts/wire-global.sh "$PWD" "<kb-name>" "<owner>/<repo>"
```

All the context an agent needs to set this up lives in
[`.claude/skills/kb-setup/SKILL.md`](./.claude/skills/kb-setup/SKILL.md).
