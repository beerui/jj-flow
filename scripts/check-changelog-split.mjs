#!/usr/bin/env node
/**
 * check-changelog-split.mjs — 守着「更新日志被切成两页」这件事没有悄悄坏掉。
 *
 * WHY THIS EXISTS. `CHANGELOG.md` 是 release-please 的唯一来源，站点经
 * `docs/changelog.md` 与 `docs/changelog-archive.md` 两页把它发布出去。切成两页
 * 不是为了好看，是因为**一页装不下**：实测 VitePress 在打包阶段解析单页 markdown
 * 的内存随页面积陡增（约 s^3.6），4 GB 默认堆在 ~98 KB 处耗尽，表现是
 * `FATAL ERROR: Reached heap limit` + 一段 native 栈，然后 `docs:check` 红。
 * 切成两页之前，本仓的更新日志页已经 99,037 字节——正好在墙上。
 *
 * 两页的正文由 `scripts/sync-changelog-pages.mjs` 从 `CHANGELOG.md` 投影而来
 * （不用 `@include`：那条路在本仓稳定 OOM，且 `findRegion` 找不到闭合行时会静默
 * 包含整个文件）。投影就意味着会漂移——release-please 每改一次 `CHANGELOG.md`，
 * 两页就旧一格。所以本脚本查的第三件事是「两页还等于投影吗」。
 *
 * WHAT IT CHECKS.
 *   1. 两个区域各出现一次，且闭合顺序是 recent-open → recent-close →
 *      archive-open → archive-close。`recent` 若没有自己的闭合行，取区域的逻辑
 *      会把给 `archive` 的那一行吃掉，于是归档内容被算进近期页——顺序检查正是
 *      为了在构建之前抓住这一种。
 *   2. 没有任何 `## <版本>` 标题落在两个区域之间。release-please 把新版本标题
 *      插在 `## Unreleased` 正文开头，也就是 `recent` 区域打开之后；一旦它改成
 *      插到别处，新版本就会掉到两个区域之外，从站点上消失。这一条不预测
 *      release-please 的行为，它只断言「没有版本标题掉队」。
 *   3. 站点两页等于 `CHANGELOG.md` 两个区域的投影（逐字，含站点自己的页头页脚）。
 *      这一条把「改了来源忘了重新生成」和「有人手改了生成物」都变成一行红字。
 *   4. 展开后的每一页都在字节预算内。预算不是风格偏好，是那面墙：墙的实测位置
 *      记在 `PAGE_BUDGET_BYTES` 的注释里。把预算设成墙本身会在每次发布时逼人改
 *      这个文件；设成墙的 80% 左右，让人在还有余量时就把切分点往下挪。
 *   5. 没有任何页面再写 `<!--@include: ...-->`。这一条是被一次真实事故逼出来的：
 *      `docs/design-docs/docs-site-vitepress.md` 在文件树清单的**代码块里**写了
 *      一行 include 指令当例子，而 VitePress 的 include 是正则替换、不认代码块，
 *      于是它把 `docs/changelog.md` 整个包进了设计文档那一页；又因为 Windows 的
 *      NTFS 大小写不敏感，`../CHANGELOG.md` 解析到的就是 `docs/changelog.md` 自己，
 *      那一页再递归包含根 `CHANGELOG.md`——两页各自带着一整份更新日志，正好是
 *      切分要避免的那件事，而 `docs:check` 只报一个看不懂的 OOM。所以这里的规则是
 *      「一个字节的 include 指令都不许有」：它能不能解析取决于文件系统大小写敏不
 *      敏感，而那不该由运气决定。
 *
 * WHAT IT DOES NOT CLAIM. 它不判断切分点**应该**在哪一版，也不改 `CHANGELOG.md`
 * 的任何正文——已发布段落按 `docs/writing-guide.md` §4.1 不动。挪切分点是维护者
 * 的决定，本脚本只保证挪之前有人知道墙在哪。
 *
 * Usage:
 *   node scripts/check-changelog-split.mjs [--json]
 *
 * Exit codes:
 *   0  切分完好，两页都在预算内且与来源一致
 *   1  有违规；每条都打印出来
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { regionSlice, check as checkProjection } from './sync-changelog-pages.mjs';

export const EXIT = { clean: 0, violation: 1 };

const RECENT = 'recent';
const ARCHIVE = 'archive';

/**
 * 展开后单页的字节上限。
 *
 * 实测（本仓，`docs:check`，VitePress 1.6.4，默认 4 GB 堆）：
 *   98,121 B → 通过
 *   99,037 B → OOM（exit 134）
 * 二者相差 816 字节，所以这不是「某个构造触发了解析器病态」，而是堆耗尽的临界点：
 * 用等体积的无意义内容复现同样炸。把 `NODE_OPTIONS=--max-old-space-size` 调到
 * 8 GB 只把墙推到 ~120 KB（≈ s^3.6），再翻倍也只买到 ~146 KB——堆不是修法，
 * 它只是把下次发布的时间往后挪几天。
 *
 * 80,000 留出约 20% 余量：余量的用途是让人在还有时间时挪切分点，而不是在墙前
 * 抢一行。切分点往下挪一次，两页都变小，预算不需要跟着改。
 */
export const PAGE_BUDGET_BYTES = 80000;

const OPEN_RE = /^<!-- #region ([\w-]+) -->$/;
const CLOSE_RE = /^<!-- #endregion -->$/;
const VERSION_HEADING = /^## (?!Unreleased(?:$|\s))\S/;
const INCLUDE_RE = /<!--\s*@include:\s*(.*?)\s*-->/;

export function markers(lines) {
  const found = [];
  for (const [index, line] of lines.entries()) {
    const open = line.match(OPEN_RE);
    if (open) found.push({ kind: 'open', name: open[1], line: index + 1 });
    else if (CLOSE_RE.test(line)) found.push({ kind: 'close', name: null, line: index + 1 });
  }
  return found;
}

export function check(cwd = process.cwd()) {
  const problems = [];
  const changelogPath = path.join(cwd, 'CHANGELOG.md');

  if (!fs.existsSync(changelogPath)) {
    return { problems: [`${rel(cwd, changelogPath)} 不存在`], pages: [] };
  }
  const lines = fs.readFileSync(changelogPath, 'utf8').split(/\r?\n/);
  const found = markers(lines);

  // 1. 两个区域各一次，闭合顺序正确。
  const opens = found.filter((m) => m.kind === 'open');
  const closes = found.filter((m) => m.kind === 'close');
  for (const name of [RECENT, ARCHIVE]) {
    const count = opens.filter((m) => m.name === name).length;
    if (count !== 1) {
      problems.push(`<!-- #region ${name} --> 出现 ${count} 次，应为 1 次（行 ${opens.filter((m) => m.name === name).map((m) => m.line).join(', ') || '无'}）`);
    }
  }
  const stray = opens.filter((m) => m.name !== RECENT && m.name !== ARCHIVE);
  for (const m of stray) problems.push(`第 ${m.line} 行是不认识的区域名 \`${m.name}\``);
  if (closes.length !== 2) problems.push(`<!-- #endregion --> 出现 ${closes.length} 次，应为 2 次`);

  const recentOpen = opens.find((m) => m.name === RECENT);
  const archiveOpen = opens.find((m) => m.name === ARCHIVE);
  if (recentOpen && archiveOpen && recentOpen.line > archiveOpen.line) {
    problems.push(`${RECENT} 区域开在 ${ARCHIVE} 区域之后（第 ${recentOpen.line} 行 vs 第 ${archiveOpen.line} 行），近期页会连归档内容一起包含`);
  }
  // `recent` 若没有自己的闭合行，取区域的逻辑会把给 `archive` 的那一行吃掉。
  if (recentOpen && archiveOpen && closes[0] && closes[0].line > archiveOpen.line) {
    problems.push(`${RECENT} 区域的闭合行（第 ${closes[0].line} 行）开在 ${ARCHIVE} 区域之后，归档内容被算进近期页`);
  }

  // 2. 没有版本标题掉队。区域取法与本脚本复述的 VitePress 语义一致。
  const recentSlice = regionSlice(lines, RECENT);
  const archiveSlice = regionSlice(lines, ARCHIVE);
  for (const [name, slice] of [[RECENT, recentSlice], [ARCHIVE, archiveSlice]]) {
    if (!slice) problems.push(`${name} 区域取不出内容（打开行或闭合行缺失）`);
  }
  const inRecent = new Set(recentSlice ? recentSlice.content : []);
  const inArchive = new Set(archiveSlice ? archiveSlice.content : []);
  for (const [index, line] of lines.entries()) {
    if (!VERSION_HEADING.test(line)) continue;
    if (!inRecent.has(line) && !inArchive.has(line)) {
      problems.push(`第 ${index + 1} 行的版本标题 \`${line}\` 不在任何区域里，站点两页都看不到它`);
    }
  }

  // 3 + 4. 两页等于投影，且都在预算内。投影逻辑由 sync 脚本独占，这里只比对。
  const projected = checkProjection(cwd);
  problems.push(...projected.problems);
  const pages = projected.pages.map((p) => ({ page: p.file, label: p.label, bytes: p.bytes }));
  for (const page of pages) {
    if (page.bytes > PAGE_BUDGET_BYTES) {
      problems.push(`${page.page} 展开后 ${page.bytes} 字节，超过上限 ${PAGE_BUDGET_BYTES}——把 ${ARCHIVE} 区域的切分点往下挪（在 CHANGELOG.md 里移动两个区域标记），不要抬这个上限`);
    }
  }

  // 5. 没有任何页面再写 include 指令。
  problems.push(...strayIncludes(cwd));

  return { problems, pages };
}

/** 站点页面里不许再出现 include 指令。见头部第 5 条：它会把别处的文件内容包进这一页。 */
function strayIncludes(cwd) {
  const problems = [];
  for (const file of listMarkdown(path.join(cwd, 'docs'))) {
    if (file.includes(`${path.sep}.vitepress${path.sep}`)) continue;
    const relPath = rel(cwd, file);
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      const include = line.match(INCLUDE_RE);
      if (include) {
        problems.push(`${relPath} 第 ${index + 1} 行有 include 指令 \`${include[0]}\`：更新日志已改为投影，任何 include 指令都会把别处的文件内容包进这一页，删掉它`);
      }
    }
  }
  return problems;
}

function listMarkdown(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listMarkdown(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

export function report(result) {
  if (!result.problems.length) {
    const sizes = result.pages.map((p) => `${p.label} ${p.bytes}`).join(', ');
    return `check-changelog-split: clean (${sizes}; budget ${PAGE_BUDGET_BYTES} bytes/page)`;
  }
  const lines = ['check-changelog-split: 更新日志的两页切分有问题'];
  for (const problem of result.problems) lines.push(`  [SPLIT] ${problem}`);
  lines.push('  修法见 scripts/check-changelog-split.mjs 头部；切分点是维护者的决定，本脚本只保证坏掉时会响。');
  return lines.join('\n');
}

export function main(argv, { cwd = process.cwd() } = {}) {
  const json = argv.includes('--json');
  const result = check(cwd);
  process.stdout.write(`${json ? JSON.stringify(result, null, 2) : report(result)}\n`);
  return result.problems.length ? EXIT.violation : EXIT.clean;
}

function rel(cwd, file) {
  return path.relative(cwd, file).replaceAll('\\', '/');
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
