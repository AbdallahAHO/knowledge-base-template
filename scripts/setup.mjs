#!/usr/bin/env node
/**
 * Interactive first-time setup for a knowledge base created from this template.
 *
 * The terminal equivalent of the /kb-setup skill — for use without an agent (or in CI-ish flows).
 * Interviews you, scaffolds the KB, optionally creates the GitHub repo and wires /kb globally.
 *
 * Run:  npm run setup   (or)   node scripts/setup.mjs
 */
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { execSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';

const rl = createInterface({ input, output });
const ask = async (q, def) => (await rl.question(def ? `${q} [${def}]: ` : `${q}: `)).trim() || def || '';
const yes = async (q, def = true) => {
  const a = (await rl.question(`${q} ${def ? '[Y/n]' : '[y/N]'} `)).trim().toLowerCase();
  return a ? a.startsWith('y') : def;
};
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

const banner = `
  ┌──────────────────────────────────────────────┐
  │   Knowledge Base — first-time setup           │
  └──────────────────────────────────────────────┘
`;
console.log(banner);

if (existsSync('kb.config.json')) {
  console.log('  This KB is already configured (kb.config.json exists).');
  console.log('  • Add a product:  run /kb-setup in Claude, or edit kb.config.json then');
  console.log('                    `node scripts/scaffold.mjs --manual`');
  console.log('  • Rebuild index:  `npm run index`\n');
  rl.close();
  process.exit(0);
}

// ---- interview ----
console.log('  Tell me about the knowledge base:\n');
const kbName = await ask('  KB name (short slug)', 'my');
const owner = await ask('  GitHub owner (your username or org)');
const repo = await ask('  GitHub repo name', `${kbName}-knowledge-base`);
const visibility = (await ask('  Visibility (private/public)', 'private')).toLowerCase().startsWith('pub') ? 'public' : 'private';
const description = await ask('  One-line description', `${kbName} knowledge base`);
const topics = (await ask('  Topics / aliases (comma-separated, for /kb disambiguation)', ''))
  .split(',').map((t) => t.trim()).filter(Boolean);

console.log('\n  First product (you can add more later with /kb-setup):\n');
const key = await ask('  product key (kebab slug, e.g. web)');
const name = await ask('  product display name', key);
const sourceRepo = await ask('  source GitHub repo it documents (owner/repo)');
const sourceLocalPath = await ask('  source repo local path (absolute)');

const answers = { kbName, owner, repo, visibility, description, topics, products: [{ key, name, sourceRepo, sourceLocalPath }], attribution: 'none' };

console.log('\n  Plan');
console.log('  ────');
console.log(`  KB        ${kbName}  →  github.com/${owner}/${repo}  (${visibility})`);
console.log(`  Product   ${key} (${name})  documents  ${sourceRepo}`);
console.log(`  Local     ${sourceLocalPath || '(unset)'}\n`);

if (!(await yes('  Scaffold the KB now?'))) {
  console.log('  Aborted — nothing written.\n');
  rl.close();
  process.exit(0);
}

writeFileSync('.kb-answers.json', JSON.stringify(answers, undefined, 2));
run('node scripts/scaffold.mjs .kb-answers.json');

// ---- git + GitHub (HTTPS-first, so a locked SSH agent never blocks it) ----
if (await yes('\n  Create the GitHub repo and push now?')) {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
  } catch {
    run('git init -q && git symbolic-ref HEAD refs/heads/main');
  }
  run('git add -A');
  run(`git -c commit.gpgsign=false commit -q -m "feat: bootstrap ${kbName} knowledge base"`);
  try {
    run(`gh repo create ${owner}/${repo} --${visibility} --description ${JSON.stringify(description)}`);
    run(`git remote add origin https://github.com/${owner}/${repo}.git`);
    try { run('gh auth setup-git'); } catch { /* helper may already be set */ }
    run('git push -u origin main');
  } catch (e) {
    console.log(`  ! GitHub step failed (${e.message}). Create the repo manually and push:`);
    console.log(`      gh repo create ${owner}/${repo} --${visibility} --source=. --remote=origin --push`);
  }
}

// ---- wire /kb globally ----
if (await yes('\n  Wire /kb globally (Claude + Codex) and register this KB?')) {
  run(`bash scripts/wire-global.sh "${process.cwd()}" "${kbName}" "${owner}/${repo}"`);
}

console.log(`\n  ✓ Done. Next:`);
console.log(`    • From ${sourceLocalPath || 'the source repo'}, run  /kb  to bridge your work to the KB.`);
console.log(`    • Run  /kb sweep ${key}  to populate the section from the source repo's history.`);
console.log(`    • Conventions & deep docs: docs/CONVENTIONS.md and docs/HOW-IT-WORKS.md\n`);
rl.close();
