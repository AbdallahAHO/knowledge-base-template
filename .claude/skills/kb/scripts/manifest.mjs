#!/usr/bin/env node
/**
 * Manages the multi-KB manifest at ~/.config/kb/registry.json (override with $KB_REGISTRY).
 *
 * The manifest is a per-machine LOCAL CACHE. Each entry is fully derivable from a KB's
 * kb.config.json + its local path, so `scan` can rebuild it on any machine / cloud agent.
 * Authoritative product→repo matching always reads kb.config.json; the cached fields are a hint
 * for fast disambiguation and away-from-repo lookups.
 *
 * Commands:
 *   manifest.mjs upsert <kbPath>        # register/refresh one KB (derives fields from kb.config.json)
 *   manifest.mjs scan [roots...]        # find kb.config.json under roots and upsert each
 *   manifest.mjs list                   # print the manifest
 *   manifest.mjs resolve <cwd>          # deterministic repo-match for a working dir (skill does topic-rank)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';

const REG = process.env.KB_REGISTRY || join(homedir(), '.config', 'kb', 'registry.json');
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

const gitRemote = (cwd) => {
  try { return execSync(`git -C ${JSON.stringify(cwd)} remote get-url origin`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return ''; }
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
      if (hit) matches.push({ kb: kb.name, kbPath: kb.path, product: p.key });
    }
  }
  return {
    cwd,
    gitRemote: remote,
    matches,
    knowledgeBases: r.knowledgeBases.map((k) => ({ name: k.name, description: k.description, topics: k.topics, products: k.products })),
  };
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
  case 'list':
    console.log(JSON.stringify(loadReg(), undefined, 2));
    break;
  case 'resolve':
    console.log(JSON.stringify(resolve(rest[0] || process.cwd()), undefined, 2));
    break;
  default:
    console.log('usage: manifest.mjs upsert <kbPath> | scan [roots...] | list | resolve <cwd>');
}
