#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['end.mjs', 'endCli.mjs', 'gitSnapshot.mjs'];
const check = process.argv.includes('--check');
for (const file of files) {
  const source = fs.readFileSync(path.join(root, 'src', file));
  const dest = path.join(root, 'skills/jj-end/scripts/lib', file);
  if (check) {
    if (!fs.existsSync(dest) || !source.equals(fs.readFileSync(dest))) {
      console.error('portable end lib out of sync: ' + dest);
      process.exit(1);
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, source);
  }
}
console.log(JSON.stringify({ ok: true, action: check ? 'check' : 'sync', files }));
