#!/usr/bin/env node
/**
 * Manages the multi-KB manifest at ~/.config/kb/registry.json (override with $KB_REGISTRY).
 *
 * The manifest is a per-machine LOCAL CACHE. Each entry is fully derivable from a KB's
 * kb.config.json + its local path, so `scan` can rebuild it on any machine / cloud agent.
 * Authoritative product→repo matching always reads kb.config.json; the cached fields are a hint
 * for fast disambiguation and away-from-repo lookups.
 *
 * A KB is any directory holding a kb.config.json. Two layouts:
 *   - standalone — a dedicated KB repo (kb.config.json at its root) documenting one+ source repos.
 *   - in-repo    — the KB lives inside a product repo's own docs/ (kb.config.json at <repo>/docs,
 *                  `layout: "in-repo"`, a single product whose `section` is the docs root "."). The
 *                  repo IS its own KB — no separate KB repo; captures commit with the repo.
 *
 * Commands:
 *   manifest.mjs upsert <kbPath>        # register/refresh one KB (derives fields from kb.config.json)
 *   manifest.mjs scan [roots...]        # find kb.config.json under roots and upsert each
 *   manifest.mjs init [cwd]             # adopt the host repo's docs/ as an in-repo KB (writes
 *                                       #   docs/kb.config.json + index, then registers it)
 *   manifest.mjs list                   # print the manifest
 *   manifest.mjs resolve <cwd>          # deterministic repo-match for a working dir (skill does topic-rank)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const REG = process.env.KB_REGISTRY || join(homedir(), '.config', 'kb', 'registry.json');
const HERE = dirname(fileURLToPath(import.meta.url));
const today = new Date().toISOString().slice(0, 10);

const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return undefined; } };
const loadReg = () => readJson(REG) || { version: 2, knowledgeBases: [] };
const saveReg = (r) => { mkdirSync(dirname(REG), { recursive: true }); writeFileSync(REG, JSON.stringify(r, undefined, 2) + '\n'); };

const entryFromConfig = (kbPath) => {
  const cfg = readJson(join(kbPath, 'kb.config.json'));
  if (!cfg) throw new Error(`no kb.config.json at ${kbPath}`);
  return {
    name: cfg.name || basename(kbPath),
    path: kbPath,
    remote: cfg.remote || null,
    layout: cfg.layout || 'standalone',
    description: cfg.description || '',
    topics: cfg.topics || [],
    products: (cfg.products || []).map((p) => ({ key: p.key, sourceRepo: p.sourceRepo })),
    lastRegistered: today,
  };
};

const upsert = (kbPath) => {
  const e = entryFromConfig(kbPath);
  const r = loadReg();
  r.version = 2;
  r.knowledgeBases = (r.knowledgeBases || []).filter((k) => k.name !== e.name && k.path !== e.path);
  r.knowledgeBases.push(e);
  saveReg(r);
  return e;
};

const findConfigs = (root, depth = 5) => {
  const out = [];
  let names;
  try { names = readdirSync(root); } catch { return out; }
  for (const name of names) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(root, name);
    let s; try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) { if (depth > 0) out.push(...findConfigs(p, depth - 1)); }
    else if (name === 'kb.config.json') out.push(p);
  }
  return out;
};

const scan = (roots) => {
  const dirs = [...new Set(roots.flatMap((root) => findConfigs(root).map(dirname)))];
  return dirs.map(upsert);
};

const git = (cwd, sub) => {
  try { return execSync(`git -C ${JSON.stringify(cwd)} ${sub}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return ''; }
};
const gitRemote = (cwd) => git(cwd, 'remote get-url origin');
const gitRoot = (cwd) => git(cwd, 'rev-parse --show-toplevel') || cwd;
// Normalize a git remote URL (ssh or https) to `owner/repo`.
const ownerRepo = (remote) => { const m = (remote || '').match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/); return m ? m[1] : ''; };

// Heuristic: does this dir hold (or look like) a KB? The signals drive the `/kb init` offer.
const kbSignals = (dir) => {
  const present = (n) => existsSync(join(dir, n));
  return ['kb.config.json', 'kb.index.json', 'CONTEXT.md', 'adr', 'rfc', 'runbooks']
    .filter((n) => present(n))
    .map((n) => (statSync(join(dir, n)).isDirectory() ? `${n}/` : n));
};

const resolve = (cwd) => {
  const remote = gitRemote(cwd);
  const r = loadReg();
  const matches = [];
  for (const kb of r.knowledgeBases) {
    const cfg = readJson(join(kb.path, 'kb.config.json')) || {};
    for (const p of cfg.products || []) {
      const m = p.repoMatch || {};
      const hit =
        (remote && (m.remotes || []).some((s) => remote.includes(s))) ||
        (m.folderNames || []).includes(basename(cwd)) ||
        (m.pathContains || []).some((s) => cwd.includes(s));
      if (hit) matches.push({ kb: kb.name, kbPath: kb.path, product: p.key, layout: cfg.layout || 'standalone' });
    }
  }

  // In-repo probe — does the *working repo* carry its own KB in docs/? (Run before falling to a
  // central KB so repo-local facts never get written into a shared KB.)
  const root = gitRoot(cwd);
  const docs = join(root, 'docs');
  const signals = existsSync(docs) ? kbSignals(docs) : [];
  let inRepo = null;
  if (signals.length) {
    const configured = signals.includes('kb.config.json');
    if (configured && !matches.some((x) => x.kbPath === docs)) {
      // Self-heal: a docs/ KB exists but isn't registered yet → register it (cache only).
      try {
        const e = upsert(docs);
        const cfg = readJson(join(docs, 'kb.config.json')) || {};
        for (const p of cfg.products || []) matches.push({ kb: e.name, kbPath: docs, product: p.key, layout: cfg.layout || 'in-repo' });
      } catch { /* ignore a malformed in-repo config */ }
    }
    inRepo = { root, docsPath: docs, configured, candidate: !configured, signals };
  }

  return {
    cwd,
    gitRemote: remote,
    matches,
    inRepo,
    knowledgeBases: r.knowledgeBases.map((k) => ({ name: k.name, description: k.description, topics: k.topics, products: k.products })),
  };
};

const fm = (o) => '---\n' + Object.entries(o).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n---\n';

// Adopt the host repo's docs/ as an in-repo KB: write docs/kb.config.json (if absent), seed the
// capture targets (never clobber), build the index, and register. Idempotent — re-run to refresh.
const initInRepo = (cwd) => {
  const root = gitRoot(cwd);
  const docs = join(root, 'docs');
  if (!existsSync(docs)) throw new Error(`no docs/ at ${root} — create a docs/ folder to adopt as the KB`);
  const name = basename(root);
  const cfgPath = join(docs, 'kb.config.json');

  if (!existsSync(cfgPath)) {
    const remote = ownerRepo(gitRemote(root));
    const cfg = {
      version: 1,
      kbHome: '.',
      layout: 'in-repo',
      name,
      remote: remote || null,
      description: `${name} — in-repo knowledge base (docs/).`,
      topics: [],
      defaults: { watermarkFile: '.state.json', contextFile: 'CONTEXT.md', indexFile: 'kb.index.json' },
      products: [{
        key: name,
        section: '.',
        name,
        sourceRepo: remote || null,
        inRepo: true,
        repoMatch: {
          remotes: [remote].filter(Boolean),
          folderNames: [name],
          pathContains: [remote, join(basename(dirname(root)), name)].filter(Boolean),
        },
      }],
    };
    writeFileSync(cfgPath, JSON.stringify(cfg, undefined, 2) + '\n');
  }

  // Seed lightweight capture targets at the docs root if absent (never clobber curated docs).
  const seed = (rel, type, summary, body) => {
    const p = join(docs, rel);
    if (existsSync(p)) return;
    const idSlug = rel.replace(/\.md$/, ''); // id matches the filename so cross-links resolve (invariants, notes)
    writeFileSync(p, fm({ id: `${name}-${idSlug}`, type, product: name, summary }) + body);
  };
  seed('glossary.md', 'glossary', `Canonical ${name} terms so every model uses one vocabulary.`,
    `\n# Glossary — ${name}\n\n_Append terms as_ \`- **Term** — definition. (source: pr/file)\`_._\n`);
  seed('invariants.md', 'invariant', 'Rules that must always hold — agent guardrails.',
    `\n# Invariants — ${name}\n\n_Append numbered rules with the reason and source._\n`);
  seed('notes.md', 'note', 'Running follow-ups and open questions. Newest at top.',
    `\n# Notes & follow-ups — ${name}\n\n_Append items under a dated heading, newest at top._\n`);

  try { execSync(`node ${JSON.stringify(join(HERE, 'build-index.mjs'))} ${JSON.stringify(docs)}`, { stdio: 'inherit' }); }
  catch { console.log(`  (run \`node ${join(HERE, 'build-index.mjs')} ${docs}\` to build the index)`); }
  const entry = upsert(docs);
  return { root, docs, entry };
};

const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
  case 'upsert': {
    const e = upsert(rest[0] || process.cwd());
    console.log(`registered '${e.name}' -> ${e.path}`);
    break;
  }
  case 'scan': {
    const envRoots = process.env.KB_SCAN_ROOTS ? process.env.KB_SCAN_ROOTS.split(':') : [];
    const roots = rest.length ? rest : envRoots.length ? envRoots : [join(homedir(), 'Developer'), process.cwd()];
    const added = scan(roots);
    console.log(`Scanned ${roots.join(', ')} — registered ${added.length} KB(s):`);
    added.forEach((e) => console.log(`  - ${e.name}  (${e.products.length} product[s])  ${e.path}`));
    break;
  }
  case 'init': {
    const { root, docs, entry } = initInRepo(rest[0] || process.cwd());
    console.log(`adopted in-repo KB '${entry.name}' -> ${docs}  (host repo ${root})`);
    console.log("  it now resolves for this repo; capture with /kb adr|note|invariant (writes under docs/).");
    break;
  }
  case 'list':
    console.log(JSON.stringify(loadReg(), undefined, 2));
    break;
  case 'resolve':
    console.log(JSON.stringify(resolve(rest[0] || process.cwd()), undefined, 2));
    break;
  default:
    console.log('usage: manifest.mjs upsert <kbPath> | scan [roots...] | init [cwd] | list | resolve <cwd>');
}
