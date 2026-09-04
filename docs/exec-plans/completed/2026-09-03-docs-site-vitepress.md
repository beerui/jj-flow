# Exec plan — 文档站 VitePress 迁移与使用文档改版

> 状态：completed
>
> 负责人：jj-flow
>
> 开始日期：2026-09-03
>
> 完成日期：2026-09-04
>
> 关联设计：[文档站迁移 VitePress 与使用文档改版](../../design-docs/docs-site-vitepress.md)
>
> 边界：只动 `docs/**`、站点配置与构建/校验脚本、harness 中绑定站点构建的规则、用户可见文案；不改 `skills/`、不改 `src/ralph` 等业务逻辑、不改 README；文案改写不得引入 skill 里没有的行为（设计 §7.5）。

> **给执行者：** 逐任务执行，每个任务末尾有验证命令与提交点；步骤用 `- [ ]` 勾选。Phase A 中间提交允许 `docs:check` / `harness:check` 暂红，A5 结束时 `npm run verify` 必须全绿；Phase B 每个任务结束都必须 `npm run docs:check` 绿。

**目标：** 用 VitePress 替换 `scripts/build-docs.mjs`，保持 `npm run verify` 为唯一门禁；并按新手视角重写命令页与上手页。

**架构：** `docs/` 仍是 Markdown SSOT，`docs/.vitepress/{config,sidebar,redirects}.mjs` 声明站点；`scripts/check-docs.mjs` 承担 `docs:check`（侧栏覆盖 + 临时构建 + 产物断言）；harness 的孤儿文档规则改为读取 `sidebar.mjs` 输出。

**技术栈：** VitePress 1.6.x（唯一 devDependency）、Node ≥ 20.19、`node --test`。

## 全局约束

- `vitepress` 版本 `^1.6.4`，只能是 `devDependencies`。
- 配置文件用 `.mjs`（仓库无 TypeScript）。
- 输出目录保持 `site/`；`base: '/jj-flow/'`；`cleanUrls: false`。
- 内链一律写源文件相对 `.md` 路径；构建 dead link 即失败，不加 `ignoreDeadLinks`。
- 用户页示例仓库统一叫 项目A / 项目B / 项目C；前四段禁用 `CAP-*` / `DEL-*` / `run_id` / `task_key` / Mode S/W/P / A2–A4 / gate 名 / L1/L2 / `events.jsonl`。
- Git 操作一律带 `-c core.autocrlf=input`（工作区是 CRLF checkout，索引是 LF）；只 add 本任务文件。
- 提交信息中文 Conventional Commits，末尾附 `Co-Authored-By: Claude Code <noreply@anthropic.com>`。

## 文件地图

| 文件 | 职责 |
| --- | --- |
| `docs/.vitepress/config.mjs` | VitePress 配置：base / srcExclude（读 manifest）/ 主题 / 搜索分词 / buildEnd 跳转页 |
| `docs/.vitepress/sidebar.mjs` | 侧栏数据 + `sidebarDocPaths()` + 脚本模式打印 JSON |
| `docs/.vitepress/redirects.mjs` | 旧 URL → 新 URL 映射（20 条） |
| `docs/changelog.md` | 包含根 CHANGELOG |
| `scripts/check-docs.mjs` | `docs:check` |
| `tests/docs-site.test.mjs` | 侧栏 / 跳转 / check-docs 端到端 / 维护说明关键词 |
| `scripts/check-harness.mjs` | 删 BUILD 规则；INDEX 规则认 `.md` |
| `src/harnessGc.mjs` | 孤儿文档规则改读 `sidebar.mjs` 输出 |
| `harness-manifest.json` | `site_builder` / `removed_outputs` |
| `scripts/check-project.mjs` | 必需文件清单 |
| `docs/commands/*.md`、`docs/usage.md`、`docs/index.md`、`docs/installation.md`、`docs/commands.md`、`docs/pitfalls.md`、`docs/concepts-hosts.md` | Phase B 文案 |

---

## Phase A · 站点迁移

### A1 · 分支、依赖与站点骨架

**文件：** 新建 `docs/.vitepress/config.mjs`、`docs/.vitepress/sidebar.mjs`、`docs/.vitepress/redirects.mjs`、`docs/changelog.md`；修改 `package.json`、`package-lock.json`、`.gitignore`；删除 `docs/dispatch-demo.md`、`docs/ralph-demo.md`、`docs/end-demo.md`、`docs/other/{dispatch,end,ralph}-demo/`。

**产出接口：** `sidebar.mjs` 导出 `sidebar`（VitePress `SidebarItem[]`）与 `sidebarDocPaths(): string[]`（`docs/...md` 仓库相对路径，posix）；`redirects.mjs` 导出 `redirects: Record<string, string>`（旧路径 → 新路径，均相对站点根、带 `.html`）。

- [x] **A1.1 开分支、装依赖**

```bash
git -c core.autocrlf=input checkout -b feat/docs-vitepress
npm install --save-dev vitepress@^1.6.4
node -e "console.log(require('./node_modules/vitepress/package.json').version)"   # 期望 1.6.x
```

- [x] **A1.2 `.gitignore`**：在 `site/` 行后加 `docs/.vitepress/cache/`；删除文末三行 demo 媒体规则（`docs/other/dispatch-demo/frames/`、`dispatch-demo.gif`、`dispatch-demo.mp4`）及其注释行。

- [x] **A1.3 `package.json` scripts**

```json
"docs:dev": "vitepress dev docs",
"docs:build": "vitepress build docs",
"docs:preview": "vitepress preview docs",
"docs:check": "node scripts/check-docs.mjs",
```

（`docs:check` 指向的脚本在 A3 建；A1–A2 期间该命令不可用。）

- [x] **A1.4 `docs/.vitepress/sidebar.mjs`**

```js
// 侧栏纯数据模块：不 import vitepress，供 config.mjs / scripts/check-docs.mjs / src/harnessGc.mjs 共用。
// 顶层五组手工维护；设计文档 / 执行计划 / ADR 从目录自动生成（标题取首个一级标题）。
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DOCS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function titleOf(file) {
  const match = fs.readFileSync(file, 'utf8').match(/^#\s+(.+?)\s*$/m);
  const raw = match ? match[1] : path.basename(file, '.md');
  return raw.replace(/`/g, '').replace(/^Exec plan\s*[—-]\s*/i, '');
}

/** 目录下除 index.md 外的 .md → 侧栏条目；order 'asc' | 'desc' 按文件名 */
function dirEntries(relDir, order = 'asc') {
  const abs = path.join(DOCS_DIR, relDir);
  const files = fs.readdirSync(abs).filter((f) => f.endsWith('.md') && f !== 'index.md').sort();
  if (order === 'desc') files.reverse();
  return files.map((f) => ({ text: titleOf(path.join(abs, f)), link: `/${relDir}/${f.replace(/\.md$/, '')}` }));
}

export const sidebar = [
  {
    text: '开始',
    items: [
      { text: '首页', link: '/' },
      { text: '安装', link: '/installation' },
      { text: '第一次使用', link: '/usage' },
      { text: '常见踩坑', link: '/pitfalls' }
    ]
  },
  {
    text: '工作流',
    items: [
      { text: '命令总览', link: '/commands' },
      { text: 'init · 接入地图', link: '/commands/jj-init' },
      { text: 'ralph · 单仓闭环', link: '/commands/jj-ralph' },
      { text: 'same · 同源迁移', link: '/commands/jj-same' },
      { text: 'dispatch · 多仓调度', link: '/commands/jj-dispatch' },
      { text: 'review · 审查落盘', link: '/commands/jj-review' },
      { text: 'end · 收工合分支', link: '/commands/jj-end' },
      { text: 'jj · 帮你选路', link: '/commands/jj' },
      { text: 'evaluated · 复盘（可选）', link: '/commands/jj-evaluated' },
      { text: 'coordinate · 多角色（可选）', link: '/commands/jj-team-coordinate' },
      { text: 'lifecycle · SDLC（可选）', link: '/commands/jj-team-lifecycle' },
      { text: 'swarm · 搜索（可选）', link: '/commands/jj-team-swarm' }
    ]
  },
  {
    text: '概念',
    items: [
      { text: '术语表', link: '/glossary' },
      { text: '证据怎么算数', link: '/concepts-evidence' },
      { text: '目录怎么放', link: '/concepts-paths' },
      { text: '宿主与 Mode S', link: '/concepts-hosts' },
      { text: '知识库', link: '/concepts-knowledge' },
      { text: 'Loop 与 Graph', link: '/loop-graph-guide' },
      { text: '记忆速览', link: '/memory-knowledge-guide' }
    ]
  },
  {
    text: '维护者',
    items: [
      { text: '架构', link: '/architecture' },
      { text: '维护说明', link: '/maintenance' },
      { text: 'CLI 参考', link: '/commands/cli' },
      { text: '部署', link: '/deployment' },
      { text: '实验场 sibling 仓', link: '/jj-lab-siblings' },
      { text: '更新日志', link: '/changelog' }
    ]
  },
  {
    text: '参考',
    items: [
      { text: '设计文档', collapsed: true, items: [{ text: '总览', link: '/design-docs/' }, ...dirEntries('design-docs')] },
      {
        text: '执行计划',
        collapsed: true,
        items: [
          { text: '总览', link: '/exec-plans/' },
          ...dirEntries('exec-plans/active', 'desc'),
          ...dirEntries('exec-plans/completed', 'desc')
        ]
      },
      { text: 'ADR', collapsed: true, items: [{ text: '总览', link: '/adr/' }, ...dirEntries('adr')] },
      { text: '项目规划', link: '/project-plan' },
      { text: '真实 Host', link: '/milestones/real-host-acceptance' },
      { text: 'M7 半真实 Host', link: '/milestones/m7-acceptance' },
      { text: 'H5 熵清理', link: '/milestones/h5-acceptance' },
      { text: 'M6 调度', link: '/milestones/m6-acceptance' }
    ]
  }
];

/** 侧栏覆盖到的源文件（仓库相对、posix），供覆盖校验 */
export function sidebarDocPaths() {
  const out = [];
  const walk = (items) => {
    for (const item of items) {
      if (item.link) out.push(linkToDocPath(item.link));
      if (item.items) walk(item.items);
    }
  };
  walk(sidebar);
  return out;
}

function linkToDocPath(link) {
  const rel = link === '/' ? 'index' : link.replace(/^\//, '').replace(/\/$/, '/index');
  return `docs/${rel}.md`;
}

// `node docs/.vitepress/sidebar.mjs` → 打印覆盖清单 JSON（同步脚本用 spawnSync 读取）
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(sidebarDocPaths())}\n`);
}
```

- [x] **A1.5 `docs/.vitepress/redirects.mjs`**

```js
// 旧站点（scripts/build-docs.mjs 时代）URL → VitePress 路径。config.mjs buildEnd 据此写跳转页。
const JJ_COMMANDS = [
  'jj', 'jj-init', 'jj-ralph', 'jj-same', 'jj-dispatch', 'jj-review', 'jj-end',
  'jj-evaluated', 'jj-team-coordinate', 'jj-team-lifecycle', 'jj-team-swarm'
];

export const redirects = {
  ...Object.fromEntries(JJ_COMMANDS.map((name) => [`command-${name}.html`, `commands/${name}.html`])),
  'command-cli.html': 'commands/cli.html',
  'adr-0001-external-tool-boundary.html': 'adr/0001-external-tool-boundary.html',
  'adr-0002-project-family-control-plane.html': 'adr/0002-project-family-control-plane.html',
  // 交互演示已删除：旧地址落到对应命令页
  'ralph-demo.html': 'commands/jj-ralph.html',
  'milestones/ralph-demo.html': 'commands/jj-ralph.html',
  'dispatch-demo.html': 'commands/jj-dispatch.html',
  'milestones/dispatch-demo.html': 'commands/jj-dispatch.html',
  'end-demo.html': 'commands/jj-end.html',
  'milestones/end-demo.html': 'commands/jj-end.html'
};
```

- [x] **A1.6 `docs/.vitepress/config.mjs`**

```js
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';
import { redirects } from './redirects.mjs';
import { sidebar } from './sidebar.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SITE_URL = 'https://beerui.github.io/jj-flow/';
const GITHUB_URL = 'https://github.com/beerui/jj-flow';

// 排除清单与 harness 共用同一真源：docs/other、docs/evaluations、docs/skill-zh-bridge
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'harness-manifest.json'), 'utf8'));
const srcExclude = (manifest.documentation_policy?.excluded_paths || []).map((p) => `${p.replace(/^docs\//, '')}/**`);

export default defineConfig({
  lang: 'zh-CN',
  title: 'jj-flow',
  description: '用对话做项目族编排工作流',
  base: '/jj-flow/',
  srcExclude,
  outDir: '../site',
  sitemap: { hostname: SITE_URL },
  // WSL 上编辑 /mnt/* 的仓库时 inotify 不可用，热更新改轮询
  vite: { server: { watch: { usePolling: Boolean(process.env.WSL_DISTRO_NAME) } } },
  themeConfig: {
    nav: [
      { text: '安装', link: '/installation' },
      { text: '第一次使用', link: '/usage' },
      { text: '更新日志', link: '/changelog' }
    ],
    socialLinks: [{ icon: 'github', link: GITHUB_URL }],
    sidebar,
    outline: { level: [2, 3], label: '本页目录' },
    editLink: { pattern: `${GITHUB_URL}/edit/main/docs/:path`, text: '在 GitHub 上编辑此页' },
    docFooter: { prev: '上一页', next: '下一页' },
    sidebarMenuLabel: '目录',
    returnToTopLabel: '回到顶部',
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色',
    darkModeSwitchTitle: '切换到深色',
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
          modal: {
            displayDetails: '显示详情',
            resetButtonTitle: '清空',
            backButtonTitle: '关闭',
            noResultsText: '没有找到',
            footer: {
              selectText: '打开',
              selectKeyAriaLabel: '回车',
              navigateText: '切换',
              navigateUpKeyAriaLabel: '上',
              navigateDownKeyAriaLabel: '下',
              closeText: '关闭',
              closeKeyAriaLabel: 'esc'
            }
          }
        },
        miniSearch: {
          options: {
            // 中文按词切分。VitePress 会把该函数序列化到客户端，因此必须自包含、不引用外部变量。
            tokenize: (text) => {
              if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
                const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
                return Array.from(segmenter.segment(text))
                  .filter((s) => s.isWordLike)
                  .map((s) => s.segment.toLowerCase());
              }
              return text.toLowerCase().split(/[\n\r\p{Z}\p{P}]+/u).filter(Boolean);
            }
          }
        }
      }
    }
  },
  buildEnd(siteConfig) {
    writeRedirectPages(siteConfig.outDir);
  }
});

function writeRedirectPages(outDir) {
  for (const [from, to] of Object.entries(redirects)) {
    const target = path.posix.relative(path.posix.dirname(from), to);
    const file = path.join(outDir, from);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, redirectHtml(target, new URL(to, SITE_URL).href));
  }
}

function redirectHtml(target, canonical) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url=${target}">
  <link rel="canonical" href="${canonical}">
  <title>页面已移动 · jj-flow</title>
</head>
<body>
  <p>页面已移动到 <a href="${target}">${target}</a>。</p>
</body>
</html>
`;
}
```

- [x] **A1.7 `docs/changelog.md`**

```md
<!--@include: ../CHANGELOG.md-->
```

- [x] **A1.8 CHANGELOG 唯一相对链接改绝对**：`CHANGELOG.md` 第 17 行附近 `(docs/design-docs/ralph-plans-workspace.md)` → `(https://github.com/beerui/jj-flow/blob/main/docs/design-docs/ralph-plans-workspace.md)`。

- [x] **A1.9 删除演示**

```bash
git -c core.autocrlf=input rm -q docs/dispatch-demo.md docs/ralph-demo.md docs/end-demo.md
git -c core.autocrlf=input rm -rq docs/other/dispatch-demo docs/other/end-demo docs/other/ralph-demo
```

- [x] **A1.10 验证骨架**

```bash
node docs/.vitepress/sidebar.mjs | node -e "const a=JSON.parse(require('fs').readFileSync(0));console.log(a.length, a.slice(0,3))"
# 期望：> 60 条，首三条 docs/index.md docs/installation.md docs/usage.md
npx vitepress build docs 2>&1 | tail -30
# 期望：配置加载成功、页面编译成功，最后因 dead links 失败并列出 (*.html) 链接 —— 这是 A2 要修的
```

- [x] **A1.11 提交**

```bash
git -c core.autocrlf=input add package.json package-lock.json .gitignore docs/.vitepress docs/changelog.md CHANGELOG.md
git -c core.autocrlf=input commit -m "feat(docs): 引入 VitePress 站点骨架并删除交互演示

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### A2 · 内链改写为源文件路径

**文件：** 修改 `docs/**/*.md`（非排除目录）；一次性脚本 `.tmp/migrate-links.mjs`（不入库）。

- [x] **A2.1 写迁移脚本**（旧 `PAGES` 表仍在 `scripts/build-docs.mjs`，此时尚未删除）

```js
// .tmp/migrate-links.mjs — 把 docs 内链从旧输出路径改成源文件相对路径（跳过围栏代码块）
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const builder = fs.readFileSync('scripts/build-docs.mjs', 'utf8');
const outputToSource = new Map();
for (const m of builder.matchAll(/source:\s*'([^']+)',\s*output:\s*'([^']+)'/g)) outputToSource.set(m[2], m[1]);
outputToSource.set('changelog.html', 'docs/changelog.md');
const sourceToOutput = new Map([...outputToSource].map(([o, s]) => [s, o]));

const EXCLUDED = ['docs/other', 'docs/evaluations', 'docs/skill-zh-bridge'];
const files = walk('docs').filter((f) => f.endsWith('.md') && !EXCLUDED.some((e) => f.startsWith(e + '/')) && !f.startsWith('docs/.vitepress/'));
const unresolved = [];

for (const file of files) {
  const oldOutput = sourceToOutput.get(file) || file.replace(/^docs\//, '').replace(/\.md$/, '.html');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let fenced = false;
  const next = lines.map((line) => {
    if (/^```/.test(line)) { fenced = !fenced; return line; }
    if (fenced) return line;
    return line.replace(/\]\(([^)\s]+?\.html)(#[^)]*)?\)/g, (whole, target, hash = '') => {
      if (/^(https?:|mailto:)/.test(target)) return whole;
      const absOld = path.posix.normalize(path.posix.join(path.posix.dirname(oldOutput), target));
      const source = outputToSource.get(absOld);
      if (!source) { unresolved.push(`${file}: ${target}`); return whole; }
      let rel = path.posix.relative(path.posix.dirname(file), source);
      if (!rel.startsWith('.')) rel = rel; // 同级/下级不加 ./
      return `](${rel}${hash})`;
    });
  });
  fs.writeFileSync(file, next.join('\n'));
}
console.log(unresolved.length ? `UNRESOLVED:\n${unresolved.join('\n')}` : 'all links resolved');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.posix.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
}
```

- [x] **A2.2 运行并处理剩余**

```bash
node .tmp/migrate-links.mjs
# 期望 UNRESOLVED 只剩 demo 目标（milestones/*-demo.html、*-demo.html）——手工处理：
```

手工改动：
- `docs/commands/jj-end.md`：删除「### 内部机制演示（可交互）」小节（3 段，到 `→ **[end 收工机制动画]…` 为止）。
- `docs/commands/jj-ralph.md`：删除 `可交互演示：[ralph 内部机制动画](…)` 一行（B1 会整页重写，此处先删保证构建）。
- `docs/design-docs/grok-host-adapter.md`：`(../../skills/jj-dispatch/references/grok-dispatch-execution.md)` → `(https://github.com/beerui/jj-flow/blob/main/skills/jj-dispatch/references/grok-dispatch-execution.md)`。
- `docs/design-docs/ralph-workspace-layout.md` 示例表格里 `[…](tasks/task-enter-form-api-fields/progress.md)`、`[…](completed/task-enter-form-fixed-preset/progress.md)` 两个链接改为行内代码（保留显示文本）。

- [x] **A2.3 验证**

```bash
grep -rnE '\]\([^)]*\.html[)#]' docs --include=*.md | grep -v 'skill-zh-bridge\|evaluations\|docs/other' | grep -v '](http'
# 期望：无输出
npx vitepress build docs 2>&1 | tail -5
# 期望：build complete，无 dead links
ls site/commands/jj-ralph.html site/command-jj-ralph.html site/changelog.html site/sitemap.xml site/design-docs/index.html
```

- [x] **A2.4 提交**

```bash
git -c core.autocrlf=input add docs
git -c core.autocrlf=input commit -m "docs: 内链改为源文件相对路径并移除演示引用

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### A3 · `docs:check` 与站点测试

**文件：** 新建 `scripts/check-docs.mjs`；重写 `tests/docs-site.test.mjs`；删除 `scripts/build-docs.mjs`；修改 `scripts/check-project.mjs`。

**产出接口：** `node scripts/check-docs.mjs` 退出码 0 且 stdout 含 `docs site check passed`。

- [x] **A3.1 先写测试 `tests/docs-site.test.mjs`**（整文件替换）

```js
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
```

- [x] **A3.2 跑测试确认失败**：`node --test tests/docs-site.test.mjs` → 期望 `docs:check` 与 `maintenance` 两例失败（脚本不存在 / 文案未更新），其余通过。

- [x] **A3.3 `scripts/check-docs.mjs`**

```js
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
function read(file) { return fs.readFileSync(path.join(OUT_DIR, file), 'utf8'); }
function mustExist(file) { if (!fs.existsSync(path.join(OUT_DIR, file))) fail(`缺少产物 ${file}`); }
function fail(message) {
  console.error(`docs:check failed — ${message}`);
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  process.exit(1);
}
```

- [x] **A3.4 删除旧生成器、更新必需文件清单**

```bash
git -c core.autocrlf=input rm -q scripts/build-docs.mjs
```

`scripts/check-project.mjs`：`'scripts/build-docs.mjs',` 一行替换为

```js
  'scripts/check-docs.mjs',
  'docs/.vitepress/config.mjs',
  'docs/.vitepress/sidebar.mjs',
  'docs/.vitepress/redirects.mjs',
```

- [x] **A3.5 验证**

```bash
npm run docs:check          # 期望 docs site check passed；.tmp 下无残留目录
npm run check               # check-project 通过
node --test tests/docs-site.test.mjs   # 只剩 maintenance 一例失败（A5 修）
```

- [x] **A3.6 提交**

```bash
git -c core.autocrlf=input add scripts/check-docs.mjs scripts/check-project.mjs tests/docs-site.test.mjs
git -c core.autocrlf=input commit -m "feat(docs): docs:check 改为侧栏覆盖 + VitePress 构建校验，删除旧生成器

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### A4 · Harness 规则对齐

**文件：** `scripts/check-harness.mjs`、`src/harnessGc.mjs`、`harness-manifest.json`、`tests/harness-check.test.mjs`。

- [x] **A4.1 先改测试 `tests/harness-check.test.mjs`**
  - 「requires every design doc to be indexed and built」：删除 `HNS-DESIGN-BUILD-001` 断言；测试名改为 `…to be indexed`。
  - 「requires Implemented design evidence」：删除 `builderPath` 相关 3 行（声明、写文件、`site_builder` 赋值）；索引内容改为 `'# 设计文档\n\n- [完成设计](finished.md)\n'`。
  - 「requires every exec plan to be indexed, built, …」：删除 `builderPath` 相关行与 `HNS-EXEC-PLAN-BUILD-001` 断言；测试名去掉 `built`。
  - 运行 `node --test tests/harness-check.test.mjs` → 期望 Implemented-evidence 一例因 `HNS-DESIGN-INDEX-001` 误报而失败（索引里是 `.md`，规则还认 `.html`）。

- [x] **A4.2 `scripts/check-harness.mjs`**
  - 第 417–418 行保留 `siteBuilder` 解析，把 `readTextSurface(siteBuilder, addFinding, 'HNS-DOC-008')` 的返回值丢弃（保留可读性检查），删除三处调用里的 `siteBuilderText` 参数及函数签名中的同名参数。
  - `checkIndexedDocumentSet`：`const htmlName = …` → `const mdName = path.basename(file);`；`indexText.includes(mdName)`；提示语 `在索引中添加指向 ${mdName} 的链接。`；删除 `HNS-*-BUILD-001` 块与函数末尾 `HNS-*-BUILD-002` 块。
  - `checkExecPlanPolicy`：`relativeHtml` → `relativeMd`（`.replace(/\.md$/i, '.html')` 去掉）；删除 `HNS-EXEC-PLAN-BUILD-001/002` 两块。

- [x] **A4.3 `src/harnessGc.mjs`** 第 40–49 行替换为

```js
  const sidebarPath = path.join(cwd, manifest.documentation_policy?.site_builder || 'docs/.vitepress/sidebar.mjs');
  const sidebarDocs = readSidebarDocs(sidebarPath);
  const excluded = (manifest.documentation_policy?.excluded_paths || []).map((item) => normalize(item));
  const currentDocs = listFiles(path.join(cwd, 'docs'), (file) => file.endsWith('.md'))
    .map((file) => relative(cwd, file))
    .filter((file) => !file.startsWith('docs/.vitepress/'))
    .filter((file) => !excluded.some((entry) => file === entry || file.startsWith(`${entry}/`)));
  const orphanDocs = sidebarDocs ? currentDocs.filter((file) => !sidebarDocs.has(normalize(file))) : [];
  if (!sidebarDocs) {
    add('GC-DOC-SIDEBAR-001', 'P1', relative(cwd, sidebarPath), '无法读取文档站侧栏清单。', {}, '确认 documentation_policy.site_builder 指向可执行的 docs/.vitepress/sidebar.mjs。');
  }
  for (const file of orphanDocs) {
    add('GC-DOC-ORPHAN-001', 'P1', file, '当前文档未进入文档站侧栏。', { sidebar: relative(cwd, sidebarPath) }, '把文档加入 docs/.vitepress/sidebar.mjs，或将历史目录明确加入 excluded_paths。');
  }
```

并在文件底部加

```js
/** 同步读取侧栏覆盖清单：sidebar.mjs 作为脚本运行时打印 JSON 数组 */
function readSidebarDocs(sidebarPath) {
  if (!fs.existsSync(sidebarPath)) return null;
  const result = spawnSync(process.execPath, [sidebarPath], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  try {
    return new Set(JSON.parse(result.stdout).map((item) => normalize(item)));
  } catch {
    return null;
  }
}
```

顶部加 `import { spawnSync } from 'node:child_process';`；若 `readText` 因此不再被使用则删除该 helper。

- [x] **A4.4 `harness-manifest.json`**：`"site_builder": "docs/.vitepress/sidebar.mjs"`；`removed_outputs` 三项从 `command-*.html` 改为对应的 `.md` 文件名（文档里不要字面写出，否则会被 `HNS-DOC-FRESHNESS-002` 拦住）；`required_links` 里 8 条 `.html` 链接文本改为 `.md`。

- [x] **A4.5 验证**

```bash
node --test tests/harness-check.test.mjs tests/harness-gc.test.mjs tests/harness-doctor.test.mjs
npm run harness:check && npm run harness:gc
```

- [x] **A4.6 提交**

```bash
git -c core.autocrlf=input add scripts/check-harness.mjs src/harnessGc.mjs harness-manifest.json tests/harness-check.test.mjs
git -c core.autocrlf=input commit -m "chore(harness): 文档站规则改读 VitePress 侧栏清单，索引规则认 .md 链接

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### A5 · 维护文案、全量验证与预览

**文件：** `docs/maintenance.md`、`docs/deployment.md`、`docs/architecture.md`、`ARCHITECTURE.md`、`docs/commands/cli.md`、`CHANGELOG.md`。

- [x] **A5.1 `docs/maintenance.md`「文档 SSOT」表与命令段**改为：

```md
| 层 | 路径 | 规则 |
|----|------|------|
| 正文 | `docs/**/*.md` | 只改 Markdown；内链写源文件相对路径（`../commands/jj-ralph.md`） |
| 站点声明 | `docs/.vitepress/config.mjs` · `docs/.vitepress/sidebar.mjs` · `docs/.vitepress/redirects.mjs` | 配置 / 侧栏 / 旧地址跳转 |
| 产物 | `site/` | `npm run docs:build`；勿手改；不入库 |
| 门禁 | `npm run docs:check` · `harness:check` · `harness:gc` | CI / verify |

新增顶层页面：放文件 + 在 `docs/.vitepress/sidebar.mjs` 对应分组加一行；`design-docs/`、`exec-plans/`、`adr/` 下的文件自动进侧栏（标题取首个 `#`）。忘了加侧栏，`docs:check` 与 `harness:gc` 都会报。构建即校验：内链指向不存在的页面会让 `docs:check` 失败。`CHANGELOG.md` 会被 `docs/changelog.md` 包含进站点，里面的链接只能写绝对 URL。

本地写文档：`npm run docs:dev`（热更新）；发布前 `npm run docs:preview` 看构建产物（站点带 `/jj-flow/` 前缀，不能直接双击 `site/index.html`）。
```

命令段加 `npm run docs:dev`。

- [x] **A5.2 `docs/deployment.md`**：`源：docs/** + scripts/build-docs.mjs` → `源：docs/**（站点声明在 docs/.vitepress/）`；命令注释 `# 本地预览` → `# 构建到 site/`，并加一行 `npm run docs:preview  # 预览构建产物`。
- [x] **A5.3 `ARCHITECTURE.md`** 第 68 行 `scripts/build-docs.mjs 把 docs/ 下的 Markdown 构建为文档站` → `docs/.vitepress/ 声明 VitePress 文档站，scripts/check-docs.mjs 校验侧栏覆盖与构建`；第 131 行 `| 修改文档生成逻辑 | scripts/build-docs.mjs |` → `| 修改文档站配置 / 侧栏 | docs/.vitepress/config.mjs · sidebar.mjs |`。
- [x] **A5.4 `docs/architecture.md`** 第 37 行保持 `npm run docs:build`（无需改）；`docs/commands/cli.md` 第 172–173 行后加 `npm run docs:dev` 与 `npm run docs:preview`。
- [x] **A5.5 `CHANGELOG.md` Unreleased** 顶部加：`- **文档站迁移 VitePress**：删除 scripts/build-docs.mjs 与自制搜索/SPA，站点声明移到 docs/.vitepress/（侧栏顶层手工、design-docs/exec-plans/adr 自动）；内链改为源文件相对路径；旧 command-*.html / adr-*.html / 演示页地址由构建期跳转页承接；交互演示（ralph/dispatch/end）下线；docs:check 改为侧栏覆盖 + 临时构建校验；harness 孤儿文档规则改读侧栏清单，索引规则认 .md。合约：tests/docs-site.test.mjs、tests/harness-check.test.mjs。`
- [x] **A5.6 全量验证**

```bash
npm run verify        # 期望全绿
npm run docs:build && ls site/commands | head
```

- [x] **A5.7 预览截图**（Playwright MCP）：`npx vitepress preview docs --port 4173` 后打开 `http://localhost:4173/jj-flow/`、`/jj-flow/commands/jj-ralph.html`、`/jj-flow/design-docs/jj-ralph.html`（确认「设计文档」组自动展开）、搜索框输入「迁仓」有结果；窗口 390px 宽时侧栏可收起。截图保存到 `.tmp/`，不入库。
- [x] **A5.8 提交**

```bash
git -c core.autocrlf=input add docs/maintenance.md docs/deployment.md docs/architecture.md ARCHITECTURE.md docs/commands/cli.md CHANGELOG.md
git -c core.autocrlf=input commit -m "docs(maintenance): 更新文档站维护说明到 VitePress 流程

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Phase B · 使用文档改版

每页按设计 §7.2 的九段模板写；行为陈述只能来自设计 §7.5；示例仓库叫 项目A / 项目B / 项目C。每个任务结束运行 `npm run docs:check`，并用下面的自查 grep（前四段 = 文件里第一个 `## 开始前` 之前到 `## 常用说法` 之前的区域，人工核对）：

```bash
grep -nE 'CAP-|DEL-|run_id|task_key|Mode [SWP]|A[234]\b|gate|L1|L2|events\.jsonl|migrated/|archive/' docs/commands/jj-ralph.md
```

### B1 · ralph 页 + 「第一次使用」

**文件：** 重写 `docs/commands/jj-ralph.md`、`docs/usage.md`。

- [x] **B1.1 `docs/commands/jj-ralph.md`** 结构与要点：

```md
# ralph — 只改当前这一个仓库
一句话：在当前业务仓里把一个需求从分析做到验收、归档，并把过程记录留在仓库里。不提交、不推送（收工用 end）。
怎么喊表（Codex `$jj-ralph` / 其他 `/jj-ralph`）

## 什么时候用
- 只动这一个仓库；想要有分析 / 计划 / 改动 / 验收的记录
- 不该用：迁到别的仓 → same；多个仓一起派 → dispatch；只想提交合分支 → end

## 开始前
1. 在业务仓库根目录打开对话（不是控制仓）
2. 切到这个需求该用的分支
3. 已装 skill（安装页）

## 第一次这样用
你说：`$jj-ralph 先改项目A：登录后密码过期要提示，只做登录成功那条路`
Agent 会依次：分析（读代码、写目标和验收）→ 计划（列步骤）→ 改代码（边改边验）→ 验收（对照验收项）→ 归档。每步过了自动进下一步，不会反复问"要不要继续"。
你会看到：仓库里多出 `.workflow/ralph/task-…/`，里面 `task_plan.md`（目标 / 验收 / 步骤）、`progress.md`（做了什么）、`findings.md`（踩坑与可复用结论）。
怎么算做完：验收通过并归档——目录搬进 `.workflow/ralph/completed/`，Agent 给一段短报告。归档后会问一次要不要把可复用结论投喂全局知识库，你点头才写。
> 聊天里说"做完了"不算数，看仓库里的记录和 diff。

## 常用说法
开一个需求 / 用截图说需求（「这里」+ 图）/ 先只分析不动代码（说「开始做吧」再动手）/ 小改（tiny）/ 严一点（strict：验收前多一道审查）

## 做完之后
表：再改一点 → 「tip 应是 6px」接着同一任务（归档过也一样）；继续 → 「继续」「修完」；按审查改 → 「按审查改」；改坏了 → 「改坏了」换做法；不做了 → 「这个先不做了」标废弃可救回；完全另一件事 → 「另外做一件…」才新开；迁到别的仓 → 「交接到 项目B 项目C」（same；源仓要先提交）；提交 / 合分支 → `$jj-end`
一句话：同一件事永远接着同一条任务，你不用记编号。

## 进阶
强度档表（tiny / standard / strict）；写整齐的参数格式；卡住时怎么说（换策略 / 先暂停 / 验收不算退回改）

## 记录在哪
`.workflow/ralph/task-…/`（活跃）、`completed/`（归档或废弃）；只需要看 `task_plan.md` 和 `progress.md`

## 相关
```

- [x] **B1.2 `docs/usage.md`** 标题改「第一次使用」：安装确认 → 在仓库里开对话 → 用 ralph 完整走一遍（复用 B1.1 的"第一次这样用"叙事，但更短、带每步你会看到什么）→ 做完之后三条路（再改一点 / 收工 end / 交接 same）→ 「其他两个入口一句话」（same、dispatch 各一段 + 链接）→ 怎样算做完表 → 最容易翻车的三件事（保留）。
- [x] **B1.3 验证**：`npm run docs:check`；自查 grep 前四段无禁用词；通读一遍能否只凭本页跑通。
- [x] **B1.4 提交**：`docs(commands): 重写 ralph 与第一次使用页为新手视角`

### B2 · same / dispatch / end 页

**文件：** 重写 `docs/commands/jj-same.md`、`docs/commands/jj-dispatch.md`、`docs/commands/jj-end.md`；修改 `docs/concepts-hosts.md`。

- [x] **B2.1 same**：一句话（把项目A 做好的能力按项目B 自己的写法迁过去，不是整文件复制）；开始前（项目A 已提交；知道目标仓在哪条分支）；第一次这样用（`$jj-same 交接到 项目B 项目C` → Agent 读交接信息 → 逐仓核对分支（不对就停问你）→ 按目标仓写法改 → 验证 → 每个目标一段结果：做了什么 / 怎么验的 / 分支与提交 / 下一步）；常用说法（交接到 / 开始迁移项目D / 继续迁项目C / 目标说不清会先问）；做完之后（部分成功不算全部；收工 end；提交要你说）；进阶（写整齐的参数）；记录在哪（目标仓 `.workflow/` 下）。
- [x] **B2.2 dispatch**：一句话 + Claude 没有；开始前（源仓已提交；每个目标分支对得上；你本人来批）；第一次这样用（说一句 → 先看到预览表（项目 / 分支 / 当前状态）→ 你说批准 → 派出去 → 中断可续 → 各项目验收通过要有提交 + 审查 + 证明文件）；常用说法；两个误会（验收通过 ≠ 已 push；回退由你点选）；进阶：一句"默认在功能分支上改、不额外开目录；Grok 一个会话串完" + 链接宿主页；记录在哪（`~/.jj-flow`）。
- [x] **B2.3 end**：一句话 + 也可以说「收工」「合到 dev」；开始前（改完了；知道要合进哪条分支，不写就按 dev → develop → main）；第一次这样用（`$jj-end` → 先打印一行 `work→integration` 计划及来源 → 拉最新 → 提交 → 推工作分支 → 合进集成分支 → 推 → 回到工作分支 → 报告分支与 hash）；常用说法（`$jj-end` / `收工，合到 dev` / `$jj-end integration=staging` / `$jj-end dry_run=true`）；做完之后（做完实现 Agent 可能主动收工，不想推就说「先别推」；冲突默认自己合，真判不了才停下把表给你）；硬规矩用户版（不 force、不删分支、不改配置；git log 里的 staging、构建脚本名都不算约定）；end 只动 Git，任务归档看 ralph。
- [x] **B2.4 `docs/concepts-hosts.md`**：接收原 dispatch 页 Mode S / W / P 段落（原文搬入，加小标题「dispatch 在 Grok 上的三种模式」）。
- [x] **B2.5 验证** `npm run docs:check`；**提交** `docs(commands): 重写 same / dispatch / end 页`

### B3 · 其余入口与上手页

**文件：** `docs/commands/jj-init.md`、`jj-review.md`、`jj.md`、`docs/commands.md`、`docs/index.md`、`docs/installation.md`、`docs/pitfalls.md`、`docs/commands/jj-team-*.md`、`jj-evaluated.md`。

- [x] **B3.1 init**：一句话（把当前仓写进全局地图 `~/.jj-flow/map.md`，需要时补知识库；不是开需求）；开始前（无）；第一次这样用（`$jj-init` → 短提案（中文名 / 别名 / 家族 / 待投喂条数）→ 你点头 → 写入 → 短报告）；常用说法（四句）；名字来源规则一句。
- [x] **B3.2 review**：一句话（把审查结论写进当前 ralph 任务，只读）；开始前（有正在做或刚做完的 ralph 任务）；第一次这样用（说一句 → 优先用工具自带 code review → 结论 通过 / 需要修改 / 阻塞 写进 `.workflow/ralph/task-…/.state/reviews/REV-n.json` → 要改就回 ralph 说「按审查改」）；也可以把审查结论贴给它记录。
- [x] **B3.3 jj**：保留分流列表，改成"你说的像… → 去哪"表 + 说不清就先问目标。
- [x] **B3.4 `docs/commands.md`**：总览表不动；"可以怎么说"合并为一组；末尾加「第一次用先看：第一次使用 → ralph」。
- [x] **B3.5 `docs/index.md`**：三步开始改为 安装 → 第一次使用 → 在业务仓对话里说一句话；删除与安装页重复的"怎么喊"表（留一句 + 链接）；其余保留（含"项目族编排"定位语）。
- [x] **B3.6 `docs/installation.md`**：开头加一句"装的是对话入口，不是后台服务"（已有则保留）；把「装好后怎么喊」表上移到「只装某一个工具」之前；下一步链接文字改「第一次使用」。
- [x] **B3.7 `docs/pitfalls.md`**：每条标题下加一行 `发生在：ralph / same / dispatch / end 的哪一步`；`→` 链接改为对应命令页 `.md`（A2 已改路径，这里只补文案）。
- [x] **B3.8 team-* / evaluated**：首段前加统一一句「可选入口：只帮你安排这一轮怎么干，单独跑完不算验收通过；验收仍看 ralph / dispatch 的记录。」，其余不动。
- [x] **B3.9 验证** `npm run docs:check`；**提交** `docs: 其余入口与上手页按新手模板改写`

### B4 · 收口

- [x] **B4.1** `npm run verify` 全绿；`npm run docs:build`；预览再看一遍首页 / 第一次使用 / ralph。
- [x] **B4.2** 设计文档 `docs/design-docs/docs-site-vitepress.md`：`> 状态：Implemented`，加 `> 验收证据：\`tests/docs-site.test.mjs\`、\`tests/harness-check.test.mjs\`、\`scripts/check-docs.mjs\``；`docs/design-docs/index.md` 状态列同步。
- [x] **B4.3** 本计划：`> 状态：completed`、加完成日期，`git mv` 到 `docs/exec-plans/completed/`；`docs/exec-plans/index.md` 从「活跃」移到「已完成」并写结果一行；设计文档头部的关联链接改指 `completed/`。
- [x] **B4.4** 再跑 `npm run verify`（索引与侧栏自动生成会随目录变化）。
- [x] **B4.5 提交** `docs(plan): 文档站 VitePress 迁移与文案改版收口`，然后按 finishing-a-development-branch 给用户选择合并方式。

## 验收命令

```bash
npm run verify
npm run docs:build && ls site/index.html site/commands/jj-ralph.html site/command-jj-ralph.html site/changelog.html site/sitemap.xml
grep -rnE '\]\([^)]*\.html[)#]' docs --include=*.md | grep -v 'skill-zh-bridge\|evaluations\|docs/other' | grep -v '](http'   # 无输出
```

## 决策与风险

- harness 孤儿文档规则保留并改读侧栏清单（spawnSync），不删评分类别（设计 §6.3）。
- `verify` 多一次 VitePress 构建（约 20–40 s）；接受。
- 站点不再支持 `file://` 直开，维护说明已写明 `docs:preview`。
- 文案改写事实风险：以设计 §7.5 为界，每页交付前对照一遍。

## 完成记录

- 2026-09-04：`node --test tests/docs-site.test.mjs` 6/6 通过；文档契约测试 86/86 通过；`npm run docs:check`、`npm run verify`、`npm run docs:build` 全部通过。
- 2026-09-04：浏览器预览核验首页、第一次使用、ralph、设计文档页；确认设计文档侧栏自动展开、搜索“迁仓”有结果；390×844 视口下移动导航可展开/收起，并已恢复默认视口。
- 2026-09-04：`verify` 曾遇 Windows 临时目录 `EBUSY` 瞬态失败，单独重跑 `host:trial` 后完整管线通过；未发现持续性失败。
