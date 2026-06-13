# Doc skeletons

Front-matter skeleton per type. `/kb` copies the relevant block on capture and fills it in. Replace
`<...>` placeholders. Keep one concept per file. See
[../docs/CONVENTIONS.md](../docs/CONVENTIONS.md) for the schema.

---

## context  →  `<product>/CONTEXT.md`

```md
---
id: <product>-context
type: context
product: <product>
status: current
scope: [<subsystem>, ...]
summary: Orientation for <product> — load this first.
sources:
  - file: <pointer>
last_verified: { commit: <sha>, date: <YYYY-MM-DD> }
related: [<product>-index, <product>-invariants]
---

# <product> — orientation

## What it is
<one paragraph>

## Where to look
| Need | Doc |
|------|-----|
| ... | ... |

## State
- Watermark: <pr/commit>
- Top guardrails: <…> (see invariants.md)
```

---

## reference  →  `<product>/<subsystem>.md`

```md
---
id: <product>-<subsystem>
type: reference
product: <product>
status: current
scope: [<subsystem>]
summary: <subsystem> — current-state map.
sources:
  - pr: <n>
  - file: <path>
last_verified: { commit: <sha>, date: <YYYY-MM-DD> }
related: []
---

# <subsystem>
```

---

## explanation  →  `<product>/<topic>.md`

```md
---
id: <product>-<topic>
type: explanation
product: <product>
status: current
scope: [<subsystem>, ...]
summary: Why <topic> is shaped the way it is.
sources:
  - pr: <n>
last_verified: { commit: <sha>, date: <YYYY-MM-DD> }
related: []
---

# <topic>
```

---

## adr  →  `<product>/adr/NNNN-kebab-title.md`

```md
---
id: <product>-adr-NNNN
type: adr
product: <product>
status: accepted
scope: [<subsystem>, ...]
summary: <one-line decision>.
sources:
  - pr: <n>
last_verified: { commit: <sha>, date: <YYYY-MM-DD> }
related: []
---

# ADR NNNN — <title>

**Status:** accepted (<date>)

## Context
<the forces and the problem>

## Decision
<what was decided>

## Consequences
**Positive:** <…>
**Negative / follow-ups:** <…>
```

---

## rfc  →  `<product>/rfc/NNNN-kebab-title.md`

```md
---
id: <product>-rfc-NNNN
type: rfc
product: <product>
status: proposed
scope: [<subsystem>, ...]
summary: <proposal, not yet decided>.
sources:
  - pr: <n>
last_verified: { commit: <sha>, date: <YYYY-MM-DD> }
related: []
---

# RFC NNNN — <title>

**Status:** proposed

## Summary
## What it would add
## Trade-offs
## Decision needed
```

---

## runbook  →  `<product>/runbooks/kebab-title.md`

```md
---
id: <product>-runbook-<slug>
type: runbook
product: <product>
status: current
scope: [<subsystem>]
summary: How to <operation> safely.
sources:
  - file: <path>
last_verified: { commit: <sha>, date: <YYYY-MM-DD> }
related: []
---

# Runbook — <operation>

## When
## Steps
## ⚠️ Guardrails
```

---

## glossary  →  `<product>/glossary.md`  (one file, append terms)

```md
---
id: <product>-glossary
type: glossary
product: <product>
status: current
scope: [<subsystem>, ...]
summary: Canonical <product> terms so every model uses one vocabulary.
sources: []
last_verified: { commit: <sha>, date: <YYYY-MM-DD> }
related: []
---

# Glossary — <product>

- **<Term>** — <definition>. (source: <pr/file>)
```

---

## invariant  →  `<product>/invariants.md`  (one file, append rules)

```md
---
id: <product>-invariants
type: invariant
product: <product>
status: current
scope: [<subsystem>, ...]
summary: Rules that must always hold — agent guardrails.
sources: []
last_verified: { commit: <sha>, date: <YYYY-MM-DD> }
related: []
---

# Invariants — <product>

1. **<Rule>.** <why; what breaks if violated>. (<pr/file>)
```

---

## contract  →  `<product>/reference.md` (or `contracts.md`)

```md
---
id: <product>-reference
type: contract
product: <product>
status: current
scope: [<subsystem>, ...]
summary: Interface catalog — events, APIs, env vars, config.
sources:
  - pr: <n>
last_verified: { commit: <sha>, date: <YYYY-MM-DD> }
related: [<product>-glossary]
---

# Quick reference — <product>
```

---

## audit  →  `<product>/audits/YYYY-MM-topic.md`

```md
---
id: <product>-audit-YYYY-MM-<topic>
type: audit
product: <product>
status: current
scope: [<subsystem>, ...]
summary: <what changed and when>.
sources:
  - pr: <n>
last_verified: { commit: <sha>, date: <YYYY-MM-DD> }
related: []
---

# Audit — <topic>, <date range>
```

---

## note  →  `<product>/notes.md`  (one file, newest at top)

```md
---
id: <product>-notes
type: note
product: <product>
status: current
scope: [<subsystem>, ...]
summary: Running follow-ups and open questions. Newest at top.
sources: []
last_verified: { commit: <sha>, date: <YYYY-MM-DD> }
related: []
---

# Notes & follow-ups — <product>

## <YYYY-MM-DD>
- <follow-up / open question>. (<pr/file>)
```
