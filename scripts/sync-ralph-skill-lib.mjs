#!/usr/bin/env node
/**
 * Keep skill-portable ralph library in sync with package source.
 * Source of truth: src/ralph.mjs
 * Portable copy: .codex/skills/jj-ralph/scripts/lib/ralph.mjs
 *
 *   node scripts/sync-ralph-skill-lib.mjs           # write copy
 *   node scripts/sync-ralph-skill-lib.mjs --check   # fail if drift
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src', 'ralph.mjs');
const dest = path.join(root, '.codex', 'skills', 'jj-ralph', 'scripts', 'lib', 'ralph.mjs');
const checkOnly = process.argv.includes('--check');

if (!fs.existsSync(src)) {
  console.error('missing source:', src);
  process.exit(1);
}
const body = fs.readFileSync(src);
if (checkOnly) {
  if (!fs.existsSync(dest)) {
    console.error('missing portable skill lib:', dest, '(run: npm run ralph:sync)');
    process.exit(1);
  }
  const current = fs.readFileSync(dest);
  if (!body.equals(current)) {
    console.error('portable skill lib out of sync with src/ralph.mjs (run: npm run ralph:sync)');
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, action: 'check', in_sync: true }, null, 2));
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, body);
console.log(JSON.stringify({
  ok: true,
  action: 'sync',
  src: path.relative(root, src).replaceAll('\\', '/'),
  dest: path.relative(root, dest).replaceAll('\\', '/'),
  bytes: body.length
}, null, 2));
