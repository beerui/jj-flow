import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOut = path.join(root, '.tmp', `docs-site-test-${process.pid}`);

function runDocsCheck() {
  fs.rmSync(checkOut, { recursive: true, force: true });
  // build-docs --check writes under .tmp/docs-site-check-<pid>; we re-run build to a known dir by monkeying cwd output.
  // Prefer public entry: docs:check validates generators; then docs:build for inspectable site/.
  const check = spawnSync(process.execPath, ['scripts/build-docs.mjs', '--check'], {
    cwd: root,
    encoding: 'utf8',
    env: process.env
  });
  return check;
}

test('docs:check exits 0 and enforces primary path + nested assets', () => {
  const result = runDocsCheck();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /docs site built/);
});

test('built site home exposes install, usage, same, dispatch paths', () => {
  const build = spawnSync(process.execPath, ['scripts/build-docs.mjs'], {
    cwd: root,
    encoding: 'utf8',
    env: process.env
  });
  assert.equal(build.status, 0, build.stderr || build.stdout);

  const home = fs.readFileSync(path.join(root, 'site', 'index.html'), 'utf8');
  for (const required of [
    'installation.html',
    'usage.html',
    'command-jj-same.html',
    'command-jj-ralph.html',
    'command-jj-dispatch.html',
    '项目族编排'
  ]) {
    assert.match(home, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  for (const bad of ['command-jj-delivery.html', 'command-jj-validate.html', 'command-jj-evolve.html']) {
    assert.doesNotMatch(home, new RegExp(`href=["'][^"']*${bad.replace('.', '\\.')}`));
  }
});

test('nested milestone page uses depth-correct relative assets and nav', () => {
  const nested = fs.readFileSync(path.join(root, 'site', 'milestones', 'm6-acceptance.html'), 'utf8');
  assert.match(nested, /href="\.\.\/assets\/styles\.css"/);
  assert.match(nested, /src="\.\.\/assets\/search\.js"/);
  assert.match(nested, /href="\.\.\/index\.html"/);
  assert.match(nested, /data-docs-root="\.\.\/"/);
});

test('markdown tables and bold render in project-plan page', () => {
  const html = fs.readFileSync(path.join(root, 'site', 'project-plan.html'), 'utf8');
  assert.match(html, /<table>/);
  assert.match(html, /<th>/);
  assert.match(html, /<strong>completed<\/strong>/);
});

test('maintenance docs document docs ownership commands', () => {
  const md = fs.readFileSync(path.join(root, 'docs', 'maintenance.md'), 'utf8');
  assert.match(md, /docs\/\*\*/);
  assert.match(md, /npm run docs:check/);
  assert.match(md, /npm run docs:build/);
  assert.match(md, /build-docs\.mjs/);
  assert.match(md, /site\//);
});
