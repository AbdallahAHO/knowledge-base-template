#!/usr/bin/env node
/**
 * Builds kb.index.json — a manifest of every KB doc for cheap agent retrieval.
 *
 * Zero dependencies: a minimal front-matter reader for the KB's flat schema
 * (scalars + inline arrays). Nested blocks like `sources:` are intentionally
 * skipped — the index only needs the retrieval-relevant top-level fields.
 *
 * Usage: node .claude/skills/kb/scripts/build-index.mjs [kbRoot]   (defaults to cwd)
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.argv[2] || process.cwd();
const IGNORE = new Set(['node_modules', '.git', '.claude', 'doc-templates', 'scripts']);

const walk = (dir) => {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (IGNORE.has(name) || name.startsWith('.')) continue;
    const p = join(dir, name);
    out.push(...(statSync(p).isDirectory() ? walk(p) : name.endsWith('.md') ? [p] : []));
  }
  return out;
};

// Reads top-level scalar / inline-array keys plus folded/literal block scalars
// (`key: >`, `>-`, `|`, …); ignores other indented (nested) blocks like `sources:`.
const parseFrontMatter = (text) => {
  if (!text.startsWith('---')) return undefined;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return undefined;
  const lines = text.slice(3, end).split('\n');
  const fm = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || /^\s/.test(line)) continue; // blank or a nested/continuation line
    const m = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].trim();
    const block = val.match(/^([|>])[+-]?$/); // block scalar header → fold the indented body
    if (block) {
      const body = [];
      while (i + 1 < lines.length && (lines[i + 1] === '' || /^\s/.test(lines[i + 1]))) body.push(lines[++i]);
      const dedented = body.map((l) => l.replace(/^\s+/, ''));
      fm[key] = (block[1] === '|' ? dedented.join('\n') : dedented.join(' ').replace(/[ \t]+/g, ' ')).trim();
      continue;
    }
    if (val === '') continue; // a nested block (e.g. `sources:` / `last_verified:`) on following lines
    fm[key] =
      val.startsWith('[') && val.endsWith(']')
        ? val.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean)
        : val.replace(/^["']|["']$/g, '');
  }
  return fm;
};

const firstHeading = (text) => (text.match(/^#\s+(.+)$/m) || [])[1];

const inferType = (rel) => {
  if (rel.includes('/adr/')) return 'adr';
  if (rel.includes('/rfc/')) return 'rfc';
  if (rel.includes('/runbooks/')) return 'runbook';
  if (rel.includes('/audits/')) return 'audit';
  const base = rel.split('/').pop().replace(/\.md$/, '').toLowerCase();
  return (
    { context: 'context', readme: 'index', glossary: 'glossary', invariants: 'invariant', notes: 'note', reference: 'contract', contracts: 'contract' }[base] ||
    'reference'
  );
};

const entries = walk(ROOT)
  .map((file) => {
    const rel = relative(ROOT, file).split(sep).join('/');
    const text = readFileSync(file, 'utf8');
    const fm = parseFrontMatter(text);
    return {
      id: fm?.id || rel.replace(/\.md$/, '').replace(/\//g, '-'),
      type: fm?.type || inferType(rel),
      product: fm?.product || rel.split('/')[0],
      title: fm?.title || firstHeading(text) || rel,
      status: fm?.status,
      scope: fm?.scope,
      summary: fm?.summary,
      related: fm?.related,
      path: rel,
      hasFrontMatter: Boolean(fm),
    };
  })
  .sort((a, b) => a.path.localeCompare(b.path));

const byProduct = {};
for (const e of entries) (byProduct[e.product] ||= []).push(e.id);

const index = {
  generatedAt: new Date().toISOString(),
  count: entries.length,
  missingFrontMatter: entries.filter((e) => !e.hasFrontMatter).map((e) => e.path),
  products: byProduct,
  entries,
};

writeFileSync(join(ROOT, 'kb.index.json'), JSON.stringify(index, undefined, 2) + '\n');
console.log(`kb.index.json: ${entries.length} docs across ${Object.keys(byProduct).length} product(s).`);
if (index.missingFrontMatter.length) {
  console.log(`  ${index.missingFrontMatter.length} without front-matter:`);
  index.missingFrontMatter.forEach((p) => console.log(`   - ${p}`));
}
