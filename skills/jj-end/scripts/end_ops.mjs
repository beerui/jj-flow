#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  ...(process.env.JJ_FLOW_ROOT ? [path.join(process.env.JJ_FLOW_ROOT, 'src/endCli.mjs')] : []),
  path.resolve(dir, '../../../src/endCli.mjs'),
  path.join(dir, 'lib/endCli.mjs')
];
try {
  const file = candidates.find(candidate => fs.existsSync(candidate));
  if (!file) throw new Error('end runner library is missing; reinstall jj-end or run npm run end:sync');
  const { runEndCommand } = await import(pathToFileURL(file).href);
  process.exitCode = runEndCommand(process.argv.slice(2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
}
