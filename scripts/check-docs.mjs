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
if (missingSources.length) failCheck(`侧栏指向不存在的文件：\n  ${missingSources.join('\n  ')}`);
if (orphans.length) failCheck(`文档未进入侧栏（docs/.vitepress/sidebar.mjs）：\n  ${orphans.join('\n  ')}`);

// 2. 表格结构 lint（GFM）。扫哪些文件由 manifest 的 documentation_policy 决定，
//    不在这里另立一套范围。放在构建之前：结构缺陷应该立刻失败，而不是等一个
//    几分钟的 build 之后再失败。
const { main: lintDocTables, EXIT: TABLE_LINT } = await import(
  pathToFileURL(path.join(ROOT, 'scripts/lint-doc-tables.mjs')).href
);
if (lintDocTables([], { cwd: ROOT, manifest }) !== TABLE_LINT.clean) {
  failCheck('文档表格结构缺陷（见上方 doc-tables 输出）');
}

// 2b. 两条文档 lint 的扫描面差集。指针 lint 取 git、表格 lint 取 manifest 的
//     documentation_policy，两个面从来不是一样宽，而没有任何东西数过这个差。这里补上：
//     差集里每个文件都必须被 manifest 一条有名字的规则解释（excluded_paths 或
//     non_documentation_paths），解释不了的非零即红。放在构建之前，理由同第 2 步。
//     差集本身多大不在这里钉：它会随仓自己长，要盯的是「没有无名文件」。
const { main: docScanSurface, EXIT: SURFACE } = await import(
  pathToFileURL(path.join(ROOT, 'scripts/doc-scan-surface.mjs')).href
);
if (docScanSurface([], { cwd: ROOT, manifest }) !== SURFACE.clean) {
  failCheck('两条文档 lint 的扫描面差集里有未解释文件（见上方 doc-scan-surface 输出）');
}

// 2c. 更新日志的来源与两页投影。`CHANGELOG.md` 是 release-please 的唯一来源，站点经
//     `docs/changelog.md` 与 `docs/changelog-archive.md` 两页发布它，两页由
//     `scripts/sync-changelog-pages.mjs` 投影并签入仓库。切分不是美观问题：单页
//     markdown 在 VitePress 打包阶段的耗内存随面积陡增，默认堆在 ~98 KB 处耗尽，
//     本仓的更新日志页切分前已经 99,037 字节，`docs:check` 在 main 上因此一直是红的。
//     放在构建之前，理由同第 2 步：区域标记写坏、忘了重新投影、或哪一页又写了一行
//     include 指令，都该在这里红一行，而不是等一个几分钟的 build 之后以一段 native
//     栈的形式炸开。
const { main: checkChangelogSplit, EXIT: SPLIT } = await import(
  pathToFileURL(path.join(ROOT, 'scripts/check-changelog-split.mjs')).href
);
if (checkChangelogSplit([], { cwd: ROOT }) !== SPLIT.clean) {
  failCheck('更新日志的两页切分有问题（见上方 check-changelog-split 输出）');
}

// 3. 构建到临时目录（dead link 在这里暴露）
fs.rmSync(OUT_DIR, { recursive: true, force: true });
const build = spawnSync(
  process.execPath,
  [path.join(ROOT, 'node_modules/vitepress/bin/vitepress.js'), 'build', 'docs', '--outDir', OUT_DIR],
  { cwd: ROOT, stdio: 'inherit' }
);
if (build.status !== 0) failCheck(`vitepress build 退出码 ${build.status}`);

// 4. 产物断言
for (const file of ['index.html', 'commands/jj-ralph.html', 'changelog.html', 'sitemap.xml', 'design-docs/index.html']) mustExist(file);
if (!read('changelog.html').includes('Changelog')) failCheck('changelog.html 未包含 CHANGELOG 内容');
for (const [from, to] of Object.entries(redirects)) {
  mustExist(to);
  const html = read(from);
  if (!/http-equiv="refresh"/i.test(html) || !html.includes(path.posix.basename(to))) failCheck(`跳转页 ${from} → ${to} 不完整`);
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
  if (!fs.existsSync(path.join(OUT_DIR, file))) failCheck(`缺少产物 ${file}`);
}

function failCheck(message) {
  console.error(`docs:check failed — ${message}`);
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  process.exit(1);
}
