#!/usr/bin/env node
/**
 * doc-scan-surface.mjs — 数一数仓里两条文档 lint 的扫描面差多少，并要求差集里
 * 每个文件都有名字。
 *
 * WHY THIS EXISTS. 这个仓有两条文档 lint，而「哪些文件算文档」在仓里有两个定义：
 *   - `lint-doc-pointers.mjs` 取 `git ls-files --cached --others --exclude-standard`
 *     的全部 `.md`（理由写在它自己头里：`--exclude-standard` 挡掉宿主分发镜像，
 *     `--others` 让它能审自己这一批）；
 *   - `lint-doc-tables.mjs` 取 `harness-manifest.json` 的 `documentation_policy`
 *     （`current_roots` + `current_files`），也就是 `docs:check` 已经在尊重的那份策略。
 *
 * 于是同一个文件可以对一条规则可见、对另一条不可见，而**没有任何东西数这个差**。
 * 本脚本就是这个「东西」：它把两个面并排放，算出差集，再要求差集里每个文件都能被
 * manifest 里一条**有名字的规则**解释。解释不了的 = `未解释`，非零即红。
 *
 * 为什么是「未解释=0」而不是「差集=N 个」。N 会自己长：每加一个 skill、每加一份
 * 示例，差集就变大，把 N 钉成断言的那天就是它过期的那天。不变量是差集里**没有
 * 无名文件**——新文件落下来要么被一条既有规则覆盖，要么逼人给它起个名字。
 *
 * 两条解释规则，都来自 manifest，都不是本脚本发明的：
 *   - `documentation_policy.excluded_paths`：在文档根里但明确出局的日期报告
 *     （`docs/other`、`docs/evaluations`）——历史证据，不是当前文档。
 *   - `documentation_policy.non_documentation_paths`：压根不是文档的东西——
 *     install-skill 的分发源（`skills/` `agents/` `claude-commands/`）、示例夹具、
 *     PR 模板、release-please 生成的根 `CHANGELOG.md`。
 *
 * 反向（表格 lint 看得到而 git 看得到不到）不设解释规则：一份指针 lint 审不了的
 * 文档是缺口，不是选择。今天这个数是 0。
 *
 * WHAT IT DOES NOT CLAIM. 它不判断哪条 lint 的面**应该**多宽，也不在这里改任何
 * 一条 lint 的取文件方式。它只保证：两个面的差是被数出来的，且每个成员都有名字。
 * 「把两个面合成一个」是产品决策，不是门禁能替仓定的。
 *
 * Usage:
 *   node scripts/doc-scan-surface.mjs [--json]
 *
 * Exit codes:
 *   0  差集已全部解释
 *   1  存在未解释文件；每个都打印出来
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { currentRepoFiles } from './lint-doc-pointers.mjs';
import { currentDocPaths } from './lint-doc-tables.mjs';

export const EXIT = { clean: 0, unexplained: 1 };

/** 指针 lint 的扫描面：git 知道的所有 `.md`。 */
export function pointerDocSurface(cwd = process.cwd(), { exec = spawnSync } = {}) {
  return currentRepoFiles(cwd, { exec }).filter((file) => file.endsWith('.md')).sort();
}

/** 表格 lint 的扫描面：manifest documentation_policy 声明的当前文档。 */
export function tableDocSurface(cwd = process.cwd(), { manifest, readdir } = {}) {
  return currentDocPaths(cwd, { manifest, readdir }).sort();
}

/**
 * Which named manifest rule, if any, puts `file` outside the table lint's surface.
 * Returns the rule's key, or null when nothing names it.
 *
 * The matching semantics are `excluded_paths`' own: an entry matches the file
 * itself or anything under it. Reusing them rather than inventing a second
 * convention is the point — a reader who understands one key understands both.
 */
export function explainingRule(file, policy = {}) {
  for (const key of ['excluded_paths', 'non_documentation_paths']) {
    const entries = Array.isArray(policy[key]) ? policy[key] : [];
    if (entries.some((entry) => file === entry || file.startsWith(`${entry}/`))) return key;
  }
  return null;
}

/**
 * Both surfaces and the difference between them, split by whether a manifest rule
 * names each member. `unexplained` is the invariant: it must stay empty.
 */
export function scanSurfaceDiff(cwd = process.cwd(), {
  exec = spawnSync,
  manifest = readJson(path.join(cwd, 'harness-manifest.json')),
  readdir,
} = {}) {
  const pointer = pointerDocSurface(cwd, { exec });
  const table = tableDocSurface(cwd, { manifest, readdir });
  const tableSet = new Set(table);
  const pointerSet = new Set(pointer);
  const policy = manifest.documentation_policy || {};

  const onlyInPointer = pointer.filter((file) => !tableSet.has(file));
  const onlyInTable = table.filter((file) => !pointerSet.has(file));

  const explained = [];
  const unexplained = [];
  for (const file of onlyInPointer) {
    const rule = explainingRule(file, policy);
    if (rule) explained.push({ file, rule });
    else unexplained.push({ file, rule: null });
  }

  const byRule = {};
  for (const item of explained) byRule[item.rule] = (byRule[item.rule] || 0) + 1;

  return {
    pointer,
    table,
    onlyInPointer,
    onlyInTable,
    explained: explained.map((item) => item.file),
    unexplained: unexplained.map((item) => item.file),
    byRule,
    // 差集本身。报出来是为了让「两个面不一样」这件事有数，不是拿它当验收标准。
    difference: onlyInPointer.length + onlyInTable.length,
  };
}

export function report(diff) {
  const head = `doc-scan-surface: pointer lint ${diff.pointer.length} files, table lint ${diff.table.length} files, difference ${diff.difference}`;
  if (!diff.unexplained.length && !diff.onlyInTable.length) {
    const rules = Object.entries(diff.byRule)
      .map(([rule, count]) => `${rule}=${count}`)
      .join(' ');
    return `${head}\n  explained ${diff.explained.length} (${rules || 'none'}), unexplained 0`;
  }
  const lines = [head];
  for (const file of diff.unexplained) {
    lines.push(`  [UNEXPLAINED] ${file} — 指针 lint 看得到，表格 lint 看不到，且 manifest 里没有规则解释这件事`);
  }
  for (const file of diff.onlyInTable) {
    lines.push(`  [UNTRACKED-BY-GIT] ${file} — 表格 lint 看得到，但 git 不知道它，指针 lint 审不了`);
  }
  lines.push(`  unexplained ${diff.unexplained.length}, unexplained-in-table ${diff.onlyInTable.length}`);
  lines.push('  修法二选一：给它起个名字（manifest documentation_policy.non_documentation_paths / excluded_paths），或把它纳入表格 lint 的面。');
  return lines.join('\n');
}

export function main(argv, {
  cwd = process.cwd(),
  exec = spawnSync,
  manifest,
  readdir,
} = {}) {
  const json = argv.includes('--json');
  const diff = scanSurfaceDiff(cwd, { exec, manifest, readdir });
  process.stdout.write(`${json ? JSON.stringify(diff, null, 2) : report(diff)}\n`);
  return diff.unexplained.length || diff.onlyInTable.length ? EXIT.unexplained : EXIT.clean;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
