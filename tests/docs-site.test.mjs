import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { redirects } from '../docs/.vitepress/redirects.mjs';
import { sidebar, sidebarDocPaths } from '../docs/.vitepress/sidebar.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('sidebar keeps the five top-level groups and every link has a source file', () => {
  assert.deepEqual(sidebar.map((group) => group.text), ['开始', '工作流', '概念', '维护者', '参考']);
  for (const doc of sidebarDocPaths()) {
    assert.ok(fs.existsSync(path.join(root, doc)), `sidebar links to missing ${doc}`);
  }
});

test('deep reference groups are generated from the filesystem and collapsed by default', () => {
  const reference = sidebar.find((group) => group.text === '参考');
  const design = reference.items.find((item) => item.text === '设计文档');
  assert.equal(design.collapsed, true);
  assert.ok(design.items.some((item) => item.link === '/design-docs/jj-ralph'));
  const plans = reference.items.find((item) => item.text === '执行计划');
  assert.ok(plans.items.some((item) => item.link.startsWith('/exec-plans/completed/')));
  assert.ok(!plans.items.some((item) => /^Exec plan/i.test(item.text)), 'exec plan titles keep the "Exec plan —" prefix');
});

test('sidebar CLI mode prints the same coverage list as the module', () => {
  const result = spawnSync(process.execPath, ['docs/.vitepress/sidebar.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), sidebarDocPaths());
});

test('legacy redirects target existing pages and never a demo page', () => {
  for (const [from, to] of Object.entries(redirects)) {
    assert.match(to, /\.html$/, `${from} target must end with .html`);
    assert.doesNotMatch(to, /demo/);
    assert.ok(fs.existsSync(path.join(root, 'docs', to.replace(/\.html$/, '.md'))), `${from} → ${to} has no source`);
  }
});

test('docs:check builds the site into a temp dir and validates the output', () => {
  const result = spawnSync(process.execPath, ['scripts/check-docs.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /docs site check passed/);
});

test('maintenance docs describe the VitePress workflow', () => {
  const md = fs.readFileSync(path.join(root, 'docs', 'maintenance.md'), 'utf8');
  for (const needle of ['docs/.vitepress/sidebar.mjs', 'npm run docs:dev', 'npm run docs:check', 'npm run docs:build']) {
    assert.ok(md.includes(needle), `maintenance.md missing ${needle}`);
  }
});
