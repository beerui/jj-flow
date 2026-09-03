#!/usr/bin/env node
// docs:check — 侧栏覆盖 + VitePress 临时目录构建 + 产物断言。不写 site/。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, '.tmp', `docs-site-check-${process.pid}`);
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'harness-manifest.json'), 'utf8'));
const excluded = manifest.documentation_policy?.excluded_paths || [];
const { sidebarDocPaths } = await import(pathToFileURL(path.join(ROOT, 'docs/.vitepress/sidebar.mjs')).href);
const { redirects } = await import(pathToFileURL(path.join(ROOT, 'docs/.vitepress/redirects.mjs')).href);

// 1. 侧栏 ↔ 文件双向覆盖
const linked = new Set(sidebarDocPaths());
const missingSources = [...linked].filter((doc) => !fs.existsSync(path.join(ROOT, doc)));
const currentDocs = listMarkdown(path.join(ROOT, 'docs'))
  .map((file) => path.relative(ROOT, file).replaceAll('\\', '/'))
  .filter((doc) => !doc.startsWith('docs/.vitepress/') && !excluded.some((entry) => doc === entry || doc.startsWith(`${entry}/`)));
const orphans = currentDocs.filter((doc) => !linked.has(doc));
if (missingSources.length) fail(`侧栏指向不存在的文件：\n  ${missingSources.join('\n  ')}`);
if (orphans.length) fail(`文档未进入侧栏（docs/.vitepress/sidebar.mjs）：\n  ${orphans.join('\n  ')}`);

// 2. 构建到临时目录（dead link 在这里暴露）
fs.rmSync(OUT_DIR, { recursive: true, force: true });
const build = spawnSync(
  process.execPath,
  [path.join(ROOT, 'node_modules/vitepress/bin/vitepress.js'), 'build', 'docs', '--outDir', OUT_DIR],
  { cwd: ROOT, stdio: 'inherit' }
);
if (build.status !== 0) fail(`vitepress build 退出码 ${build.status}`);

// 3. 产物断言
for (const file of ['index.html', 'commands/jj-ralph.html', 'changelog.html', 'sitemap.xml', 'design-docs/index.html']) mustExist(file);
if (!read('changelog.html').includes('Changelog')) fail('changelog.html 未包含 CHANGELOG 内容');
for (const [from, to] of Object.entries(redirects)) {
  mustExist(to);
  const html = read(from);
  if (!/http-equiv="refresh"/i.test(html) || !html.includes(path.posix.basename(to))) fail(`跳转页 ${from} → ${to} 不完整`);
}
fs.rmSync(OUT_DIR, { recursive: true, force: true });
console.log('docs site check passed');

function listMarkdown(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listMarkdown(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

function read(file) {
  return fs.readFileSync(path.join(OUT_DIR, file), 'utf8');
}

function mustExist(file) {
  if (!fs.existsSync(path.join(OUT_DIR, file))) fail(`缺少产物 ${file}`);
}

function fail(message) {
  console.error(`docs:check failed — ${message}`);
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  process.exit(1);
}
