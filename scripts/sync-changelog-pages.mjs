#!/usr/bin/env node
/**
 * sync-changelog-pages.mjs — 从 `CHANGELOG.md` 生成站点上的两页更新日志。
 *
 * WHY THIS EXISTS. `CHANGELOG.md` 是 release-please 的唯一来源，站点要把它发布出去。
 * 原先那条路是 `<!--@include: ../CHANGELOG.md#region-->`，它在本仓走不通，有两个各自
 * 独立的原因：
 *
 *   1. **内存**。实测（VitePress 1.6.4，默认 4 GB 堆）：同样两段内容内联进两页，
 *      构建通过；经 `@include` 包含同样两段，稳定 `FATAL ERROR: Reached heap limit`
 *      + exit 134。切成两页、把区域挪位置、去掉导航项，都不改变这个结果——变量是
 *      `@include` 本身，不是页面积。`docs:check` 因此在 main 上一直是红的（93,032 B
 *      的单页 include）。
 *   2. **静默失败**。VitePress 的 `findRegion` 找不到闭合行时返回 `null`，调用方随即
 *      `lines.slice(undefined, undefined)`——包含整个文件。一个拼错的标记不会报错，
 *      它让页面静默退回发布前的体积，然后 build 用一段 native 栈告诉你它炸了。
 *
 * 所以两页改为由本脚本生成并签入仓库：`CHANGELOG.md` 仍是唯一来源，站点两页是它的
 * 投影，正文一字不改。漂移由 `scripts/check-changelog-split.mjs` 机械守着——
 * `CHANGELOG.md` 改了而两页没重新生成，`docs:check` 立刻红，不靠谁记得跑一遍。
 *
 * WHAT IT DOES NOT CLAIM. 它不判断切分点该在哪一版，也不改 `CHANGELOG.md` 的任何
 * 正文——已发布段落按 `docs/writing-guide.md` §4.1 不动。挪切分点是维护者的决定
 * （在 `CHANGELOG.md` 里移动两个区域标记），本脚本只负责把新的切分点投影到站点。
 *
 * Usage:
 *   node scripts/sync-changelog-pages.mjs          写两页
 *   node scripts/sync-changelog-pages.mjs --check  只报漂移，不写
 *   node scripts/sync-changelog-pages.mjs --json   机器可读输出
 *
 * Exit codes:
 *   0  两页已是最新（--check）或已写入
 *   1  --check 发现有页与 CHANGELOG.md 不一致，或 CHANGELOG.md / 区域有问题
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const EXIT = { clean: 0, drift: 1 };

export const RECENT = 'recent';
export const ARCHIVE = 'archive';

const OPEN_RE = /^<!-- #region ([\w-]+) -->$/;
const CLOSE_RE = /^<!-- #endregion -->$/;

/**
 * 两页的固定外形。`head` / `tail` 是站点自己的话术，`region` 是 `CHANGELOG.md`
 * 里对应区域的正文——后者逐字拷贝，前者由本表固定，改文案只需要改这里。
 */
export const PAGES = [
  {
    file: 'docs/changelog.md',
    region: RECENT,
    label: '近期',
    head: [
      '# Changelog',
      '',
      '版本标题附带发布时间（`YYYY-MM-DD HH:mm`，与发版 commit 本地时区一致）。进行中的变更写在 `Unreleased`；无待发布条目时写「暂无」。',
      ''
    ],
    tail: ['', '更早的版本见[更新日志归档](changelog-archive.md)。']
  },
  {
    file: 'docs/changelog-archive.md',
    region: ARCHIVE,
    label: '归档',
    head: [
      '# 更新日志归档',
      '',
      '较早的发布记录。来源是仓库根的 `CHANGELOG.md`，与[更新日志](changelog.md)同源。',
      ''
    ],
    tail: []
  }
];

/**
 * VitePress 自己的取区域方式：从打开行之后到第一个闭合行之前。复述它而不是另立一套，
 * 是因为两页的正文必须和 `@include` 曾经取到的内容一致——否则换实现就换了发布内容。
 */
export function regionSlice(lines, name) {
  const start = lines.findIndex((line) => line.match(OPEN_RE)?.[1] === name);
  if (start === -1) return null;
  const end = lines.findIndex((line, index) => index > start && CLOSE_RE.test(line));
  if (end === -1) return null;
  return { start: start + 1, end, content: lines.slice(start + 1, end) };
}

/** 归一化后再比较：仓库没有 .gitattributes，core.autocrlf 会把 CRLF/LF 混进工作区。 */
function normalize(text) {
  return text.replace(/\r\n/g, '\n');
}

function eolOf(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

/**
 * 两页「应该是什么样」。`problem` 非空时 `pages` 为空——区域标记坏了就不该投影。
 */
export function buildPages(cwd = process.cwd()) {
  const changelogPath = path.join(cwd, 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    return { problem: 'CHANGELOG.md 不存在', pages: [] };
  }
  const raw = fs.readFileSync(changelogPath, 'utf8');
  const eol = eolOf(raw);
  const lines = raw.split(/\r?\n/);

  const pages = [];
  for (const spec of PAGES) {
    const slice = regionSlice(lines, spec.region);
    if (!slice) {
      return { problem: `<!-- #region ${spec.region} --> 取不出内容（打开行或闭合行缺失）`, pages: [] };
    }
    // 去掉区域末尾的空行：否则页尾会多出几个空行，而且多几个取决于 CHANGELOG.md
    // 恰好在闭合标记前留了几行——那是来源的偶然，不是页面该有的样子。
    const body = [...slice.content];
    while (body.length && body[body.length - 1].trim() === '') body.pop();
    const text = [...spec.head, ...body, ...spec.tail].join(eol) + eol;
    pages.push({
      file: spec.file,
      region: spec.region,
      label: spec.label,
      text,
      bytes: Buffer.byteLength(text, 'utf8')
    });
  }
  return { problem: null, pages };
}

export function check(cwd = process.cwd()) {
  const { problem, pages } = buildPages(cwd);
  if (problem) return { problems: [problem], pages: [] };

  const problems = [];
  for (const page of pages) {
    const abs = path.join(cwd, page.file);
    if (!fs.existsSync(abs)) {
      problems.push(`${page.file} 不存在，跑 \`node scripts/sync-changelog-pages.mjs\` 生成它`);
      continue;
    }
    const onDisk = fs.readFileSync(abs, 'utf8');
    if (normalize(onDisk) !== normalize(page.text)) {
      problems.push(`${page.file} 与 CHANGELOG.md 的 ${page.region} 区域不一致，跑 \`node scripts/sync-changelog-pages.mjs\` 重新生成`);
    }
  }
  return { problems, pages };
}

export function report(result) {
  if (!result.problems.length) {
    const sizes = result.pages.map((p) => `${p.label} ${p.bytes}`).join(', ');
    return `sync-changelog-pages: 两页与 CHANGELOG.md 一致 (${sizes})`;
  }
  const lines = ['sync-changelog-pages: 站点两页与 CHANGELOG.md 有漂移'];
  for (const problem of result.problems) lines.push(`  [SYNC] ${problem}`);
  return lines.join('\n');
}

export function main(argv, { cwd = process.cwd() } = {}) {
  const json = argv.includes('--json');
  const checkOnly = argv.includes('--check');

  if (checkOnly) {
    const result = check(cwd);
    process.stdout.write(`${json ? JSON.stringify(result, null, 2) : report(result)}\n`);
    return result.problems.length ? EXIT.drift : EXIT.clean;
  }

  const { problem, pages } = buildPages(cwd);
  if (problem) {
    process.stdout.write(`sync-changelog-pages: ${problem}\n`);
    return EXIT.drift;
  }
  for (const page of pages) {
    fs.mkdirSync(path.dirname(path.join(cwd, page.file)), { recursive: true });
    fs.writeFileSync(path.join(cwd, page.file), page.text, 'utf8');
  }
  const sizes = pages.map((p) => `${p.label} ${p.bytes}`).join(', ');
  process.stdout.write(`sync-changelog-pages: 已写入 ${pages.map((p) => p.file).join(' + ')} (${sizes})\n`);
  return EXIT.clean;
}

function rel(cwd, file) {
  return path.relative(cwd, file).replaceAll('\\', '/');
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
