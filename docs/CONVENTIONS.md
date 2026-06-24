---
id: kb-conventions
type: explanation
product: kb
status: current
scope: [meta]
summary: The KB's document taxonomy, metadata backbone, and how the /kb skill works.
last_verified: { commit: null, date: null }
related: [kb-root]
---

# Conventions — how this knowledge base works

This KB is built to be **reliable across any agent or model**. That comes from three things:
a **typed taxonomy**, a **metadata backbone** on every doc, and a **generated index**.

## Metadata backbone (the model-agnostic contract)

Every doc starts with YAML front-matter:

```yaml
---
id: <product>-<type>-<slug>      # stable slug for cross-linking
type: adr                        # one of the taxonomy types below
product: <key>
status: current                  # current | proposed | accepted | superseded | deprecated
scope: [subsystem, ...]          # tags → cheap retrieval
summary: one-line index/RAG snippet
sources:                         # PROVENANCE — verify, don't trust
  - pr: 123
  - file: path/to/source.ts
last_verified: { commit: <sha>, date: <YYYY-MM-DD> }
related: [<other-id>, ...]
---
```

Rules:
- **Atomic** — one concept per file.
- **Stable ids** — never renumber; cross-link by `id`.
- **Provenance on every claim** — cite a PR, file, or commit.
- **`last_verified`** — so staleness is detectable; the sweep refreshes it.

## Taxonomy

Two axes — knowledge and decisions — plus a machine-grade contract layer. (Standards behind these:
Diátaxis, MADR, C4, DDD ubiquitous language, RFC.)

| `type` | Purpose |
|--------|---------|
| `reference` | Factual current-state subsystem maps (what exists + file paths) |
| `explanation` | Architecture / mental models / the "why it's shaped this way" |
| `adr` | Decided architectural calls — light MADR (`status · context · decision · consequences`) |
| `rfc` | Forward-looking proposals **not yet decided** |
| `runbook` | Operational how-to (deploy, recover, migrate) |
| `glossary` | Ubiquitous language — canonical terms so every model uses one vocabulary |
| `invariant` | Rules that must always hold — agent guardrails |
| `contract` | Events, APIs, schemas, env vars, config — near-machine-readable interface catalog |
| `audit` | Dated record of what changed |
| `note` | Running follow-ups / open questions |
| `context` | Per-product orientation doc, loaded first |
| `index` | Section navigation |

Skeletons for each type: [../doc-templates/_skeletons.md](../doc-templates/_skeletons.md).

## Folder shape (per product section)

```
<product>/
├── CONTEXT.md           # orientation, load first (type: context)
├── README.md            # section index (type: index)
├── .state.json          # sweep watermark (lastSwept pr/commit/date)
├── glossary.md          # type: glossary
├── invariants.md        # type: invariant
├── notes.md             # type: note (running log)
├── <subsystem>.md ...   # type: reference / explanation / contract
├── adr/NNNN-*.md        # type: adr
├── rfc/NNNN-*.md        # type: rfc
├── runbooks/*.md        # type: runbook
└── audits/YYYY-MM-*.md  # type: audit (point-in-time)
```

### In-repo layout (a single repo's own docs/)

For a self-contained project the KB can live **inside the product repo's `docs/`** instead of a separate
repo — adopt it with `/kb init`. Then `kb.config.json` sits at `<repo>/docs` with `layout: in-repo` and a
single product whose `section` is `.` (the docs root **is** the section). The shape is **flat** —
`CONTEXT.md`, `glossary.md`, `invariants.md`, `notes.md`, `adr/`, `runbooks/`, … live directly under
`docs/`, not under a `<product>/` subfolder — and the same taxonomy, front-matter, and index apply.

## The index

`kb.index.json` is a generated manifest (id, type, product, scope, summary, path). Agents read the
index first for retrieval instead of walking the tree. Rebuild:
`node .claude/skills/kb/scripts/build-index.mjs .` (from the KB root). `/kb` rebuilds it after writes.

## Editorial rules

- Reference/contract/explanation docs describe the **current state** — keep them evergreen; don't
  append changelogs to them.
- `audit` docs are point-in-time and never edited after the fact.
- `rfc` docs flip to an `adr` (or get `status: accepted/rejected`) once decided.
- Cite PR numbers inline like `(#123)` and link source files by path so claims stay verifiable.
- Follow the host's attribution rules (default: no AI attribution anywhere).
