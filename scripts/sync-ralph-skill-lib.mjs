#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  { src: path.join(root, 'src', 'ralph.mjs'), dest: path.join(root, 'skills', 'jj-ralph', 'scripts', 'lib', 'ralph.mjs') },
  { src: path.join(root, 'src', 'namingConfig.mjs'), dest: path.join(root, 'skills', 'jj-ralph', 'scripts', 'lib', 'namingConfig.mjs') },
  { src: path.join(root, 'src', 'portfolioKnowledge.mjs'), dest: path.join(root, 'skills', 'jj-ralph', 'scripts', 'lib', 'portfolioKnowledge.mjs') }
]
const checkOnly = process.argv.includes('--check');

for (const { src } of files) {
  if (!fs.existsSync(src)) {
    console.error('missing source:', src);
    process.exit(1);
  }
}

if (checkOnly) {
  for (const { src, dest } of files) {
    if (!fs.existsSync(dest)) {
      console.error('missing portable skill lib:', dest);
      process.exit(1);
    }
    if (!fs.readFileSync(src).equals(fs.readFileSync(dest))) {
      console.error('portable skill lib out of sync:', dest);
      process.exit(1);
    }
  }
  console.log(JSON.stringify({ ok: true, action: 'check', in_sync: true, files: files.length }, null, 2));
  process.exit(0);
}

const synced = [];
for (const { src, dest } of files) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const body = fs.readFileSync(src);
  fs.writeFileSync(dest, body);
  synced.push({ src: path.relative(root, src).replaceAll('\\', '/'), dest: path.relative(root, dest).replaceAll('\\', '/'), bytes: body.length });
}
console.log(JSON.stringify({ ok: true, action: 'sync', files: synced }, null, 2));
