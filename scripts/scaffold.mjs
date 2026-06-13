#!/usr/bin/env node
/**
 * Scaffolds a knowledge base from setup answers (or, with --manual, from an existing
 * kb.config.json). Deterministic and idempotent — never clobbers existing doc content.
 *
 * Usage:
 *   node scripts/scaffold.mjs .kb-answers.json            # bootstrap (writes kb.config.json + all sections + root README)
 *   node scripts/scaffold.mjs .kb-answers.json --product <key>   # scaffold just one section
 *   node scripts/scaffold.mjs --manual                   # scaffold sections from existing kb.config.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const manual = args.includes('--manual');
const productFilter = args.includes('--product') ? args[args.indexOf('--product') + 1] : undefined;
const answersPath = args.find((a) => !a.startsWith('--') && a !== productFilter) || '.kb-answers.json';
const today = new Date().toISOString().slice(0, 10);

const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const writeIfAbsent = (rel, body) => {
  const p = join(ROOT, rel);
  if (existsSync(p)) return false;
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, body);
  return true;
};
const write = (rel, body) => {
  const p = join(ROOT, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, body);
};

const configFromAnswers = (a) => ({
  version: 1,
  kbHome: '.',
  name: a.kbName,
  remote: `${a.owner}/${a.repo}`,
  description: a.description || '',
  topics: a.topics || [],
  defaults: { watermarkFile: '.state.json', contextFile: 'CONTEXT.md', indexFile: 'kb.index.json' },
  products: (a.products || []).map((p) => ({
    key: p.key,
    section: p.key,
    name: p.name,
    sourceRepo: p.sourceRepo,
    repoMatch: {
      remotes: [...new Set([p.sourceRepo].filter(Boolean))],
      folderNames: [...new Set([p.key, p.sourceLocalPath ? basename(p.sourceLocalPath) : undefined].filter(Boolean))],
      pathContains: [...new Set([p.sourceLocalPath, p.sourceRepo].filter(Boolean))],
    },
  })),
});

const upsertProducts = (base, incoming) => {
  const byKey = new Map(base.products.map((p) => [p.key, p]));
  for (const p of incoming.products) byKey.set(p.key, p);
  return {
    ...base,
    name: incoming.name || base.name,
    remote: incoming.remote || base.remote,
    description: incoming.description || base.description,
    topics: incoming.topics?.length ? incoming.topics : base.topics,
    products: [...byKey.values()],
  };
};

// ---- resolve config ----
let cfg;
if (manual) {
  cfg = read('kb.config.json');
} else {
  const built = configFromAnswers(read(answersPath));
  let existing;
  try { existing = read('kb.config.json'); } catch { /* fresh */ }
  cfg = existing ? upsertProducts(existing, built) : built;
  write('kb.config.json', JSON.stringify(cfg, undefined, 2) + '\n');
}

// ---- section scaffolding ----
const fm = (o) =>
  '---\n' +
  Object.entries(o).map(([k, v]) => `${k}: ${v}`).join('\n') +
  '\n---\n';

const scaffoldSection = (p) => {
  const base = { product: p.key, status: 'current', scope: '[]', last_verified: `{ commit: null, date: ${today} }` };
  ['adr', 'rfc', 'runbooks', 'audits'].forEach((d) => {
    mkdirSync(join(ROOT, p.section, d), { recursive: true });
    writeIfAbsent(`${p.section}/${d}/.gitkeep`, '');
  });

  writeIfAbsent(`${p.section}/CONTEXT.md`,
    fm({ id: `${p.key}-context`, type: 'context', ...base, summary: `Orientation for ${p.name} — load this first.`, related: `[${p.key}-index, ${p.key}-invariants]` }) +
`\n# ${p.name} — orientation\n\nLoad this first when working in the \`${p.sourceRepo}\` repo.\n\n## What it is\n_TBD — run \`/kb sweep ${p.key}\` to populate from the source repo, or fill in manually._\n\n## Where to look\n| Need | Doc |\n|------|-----|\n| Section index | [README.md](./README.md) |\n| Canonical terms | [glossary.md](./glossary.md) |\n| Hard rules / guardrails | [invariants.md](./invariants.md) |\n| Open follow-ups | [notes.md](./notes.md) |\n| Decisions | [adr/](./adr/) |\n| Proposals (not decided) | [rfc/](./rfc/) |\n| Operations | [runbooks/](./runbooks/) |\n| What changed & when | [audits/](./audits/) |\n\n## State\n- **Source repo:** ${p.sourceRepo}\n- **Watermark:** not yet swept (see [.state.json](./.state.json)). Run \`/kb sweep ${p.key}\`.\n`);

  writeIfAbsent(`${p.section}/README.md`,
    fm({ id: `${p.key}-index`, type: 'index', ...base, summary: `Section index for ${p.name}.`, related: `[${p.key}-context]` }) +
`\n# ${p.name} — section index\n\nStart with [CONTEXT.md](./CONTEXT.md). Manifest: [../kb.index.json](../kb.index.json).\n\n- **context:** [CONTEXT.md](./CONTEXT.md)\n- **language & guardrails:** [glossary.md](./glossary.md) · [invariants.md](./invariants.md)\n- **running log:** [notes.md](./notes.md)\n- **decisions:** [adr/](./adr/) · proposals [rfc/](./rfc/)\n- **operations:** [runbooks/](./runbooks/)\n- **audits:** [audits/](./audits/)\n`);

  writeIfAbsent(`${p.section}/.state.json`,
    JSON.stringify({ product: p.key, repo: p.sourceRepo, lastSwept: { pr: 0, commit: null, date: null, method: 'init', by: null }, note: `Empty section. Run \`/kb sweep ${p.key}\` to populate from git history.` }, undefined, 2) + '\n');

  writeIfAbsent(`${p.section}/glossary.md`,
    fm({ id: `${p.key}-glossary`, type: 'glossary', ...base, summary: `Canonical ${p.name} terms so every model uses one vocabulary.`, sources: '[]', related: `[${p.key}-context]` }) +
`\n# Glossary — ${p.name}\n\n_Append terms as_ \`- **Term** — definition. (source: pr/file)\`_._\n`);

  writeIfAbsent(`${p.section}/invariants.md`,
    fm({ id: `${p.key}-invariants`, type: 'invariant', ...base, summary: 'Rules that must always hold — agent guardrails.', sources: '[]', related: `[${p.key}-context]` }) +
`\n# Invariants — ${p.name}\n\n_Append numbered rules with the reason and source._\n`);

  writeIfAbsent(`${p.section}/notes.md`,
    fm({ id: `${p.key}-notes`, type: 'note', ...base, summary: 'Running follow-ups and open questions. Newest at top.', sources: '[]', related: `[${p.key}-context]` }) +
`\n# Notes & follow-ups — ${p.name}\n\n_Append items under a dated heading, newest at top._\n`);

  console.log(`  scaffolded section: ${p.section}/`);
};

const sections = productFilter ? cfg.products.filter((p) => p.key === productFilter) : cfg.products;
if (!sections.length) { console.error(`No product${productFilter ? ` matching "${productFilter}"` : 's'} in config.`); process.exit(1); }
sections.forEach(scaffoldSection);

// ---- root README + cleanup (full bootstrap only) ----
if (!productFilter) {
  const rows = cfg.products.map((p) => `| [${p.section}/](./${p.section}/CONTEXT.md) | \`${p.sourceRepo}\` |`).join('\n');
  write('README.md',
    fm({ id: 'kb-root', type: 'index', product: 'kb', status: 'current', scope: '[meta]', summary: `Root of the ${cfg.name} knowledge base.`, last_verified: `{ commit: null, date: ${today} }`, related: `[${cfg.products[0]?.key || 'kb'}-context]` }) +
`\n# ${cfg.name} — Knowledge Base\n\nCentralized, model-agnostic knowledge base. Maintained via the global \`/kb\` skill. Every doc is\ntyped, provenanced, and staleness-tracked — see [docs/CONVENTIONS.md](./docs/CONVENTIONS.md).\n\n## Products\n\n| Section | Source repo |\n|---------|-------------|\n${rows}\n\n## How \`/kb\` works\n\n- \`/kb\` — read: surface the KB context relevant to what you're working on.\n- \`/kb adr\` · \`/kb note\` — capture a decision/follow-up (grilled) → commit + push.\n- \`/kb sweep <product>\` — deep git/PR fan-out audit since the watermark.\n\nAdd another product later: run \`/kb-setup\` (add-a-product mode).\n\n## Index\n\n[kb.index.json](./kb.index.json) — generated manifest for retrieval. Rebuild:\n\`node .claude/skills/kb/scripts/build-index.mjs .\`\n`);
  if (existsSync(join(ROOT, 'kb.config.example.json'))) rmSync(join(ROOT, 'kb.config.example.json'));
  console.log('  wrote root README.md, removed kb.config.example.json');
}

// ---- index ----
try {
  execSync('node .claude/skills/kb/scripts/build-index.mjs .', { cwd: ROOT, stdio: 'inherit' });
} catch {
  console.log('  (run `node .claude/skills/kb/scripts/build-index.mjs .` to build the index)');
}
console.log('Scaffold complete.');
