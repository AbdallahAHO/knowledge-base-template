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

---

# Context types (`layout: vault`)

## source  →  `sources/<origin>/YYYY-MM-DD-slug.md`  (immutable after capture)

```md
---
id: src-<origin>-YYYY-MM-DD-<slug>
type: source
product: <product>
status: current
scope: [<topic>, ...]
summary: <what this artifact is>.
origin: <gemini-notes | wispr | calendar | notion | gdoc | import>
origin_id: <stable id in the origin system>
url: <link back>
captured: <YYYY-MM-DD>
last_verified: { date: <YYYY-MM-DD> }
---

<verbatim content>
```

---

## meeting  →  `meetings/YYYY-MM-DD-slug.md`

```md
---
id: mtg-YYYY-MM-DD-<slug>
type: meeting
product: <product>
status: current
scope: [<topic>, ...]
summary: <one line — what was decided>.
sources:
  - source: <src-id>
attendees: [<person-id>, ...]
last_verified: { date: <YYYY-MM-DD> }
related: [<area/project/person ids>]
---

# <Meeting title> — <date>

## Decisions
## Action items
- [ ] <owner> — <action> (due <date>)
## Takeaways
```

---

## person  →  `people/first-last.md`  (living)

```md
---
id: person-<first-last>
type: person
product: <product>
status: current
scope: [<team>, ...]
summary: <role> — <what they own>.
sources:
  - source: <src-id>
confidence: medium
last_verified: { date: <YYYY-MM-DD> }
related: []
---

# <Name>

## Role & ownership
## Working with them
## Open threads

## Log
- <YYYY-MM-DD> — <what changed> ([source](…))
```

---

## area  →  `areas/<area>/<topic>.md`  (living)

```md
---
id: area-<area>-<topic>
type: area
product: <product>
status: current
scope: [<area>, ...]
summary: <current state in one line>.
sources:
  - source: <src-id>
confidence: medium
last_verified: { date: <YYYY-MM-DD> }
related: []
---

# <Topic>

## Current state
## Open questions

## Log
- <YYYY-MM-DD> — <what changed> ([source](…))
```

---

## project  →  `projects/<slug>/README.md`  (living)

```md
---
id: proj-<slug>
type: project
product: <product>
status: idea            # idea | active | paused | done
scope: [<area>, ...]
summary: <goal in one line>.
sources: []
last_verified: { date: <YYYY-MM-DD> }
related: []
---

# <Project>

## Goal & success metric
## Status
## Next actions
- [ ] <action>

## Log
```

---

## journal  →  `journal/YYYY/YYYY-MM-DD.md` or `journal/YYYY/YYYY-Www.md`

```md
---
id: jrnl-YYYY-MM-DD
type: journal
product: <product>
status: current
summary: <the day/week in one line>.
last_verified: { date: <YYYY-MM-DD> }
---

# <date>
```
