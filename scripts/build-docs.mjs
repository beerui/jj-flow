#!/usr/bin/env node
// jj-flow docs site builder.
// SSOT: docs markdown → site/
// IA: task-first workflows + shallow nav / deep pages
// UI: light VitePress-like, system fonts, Lucide icons, SPA content swap
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const CHECK_MODE = process.argv.includes('--check');
const CHECK_OUT_DIR = `docs-site-check-${process.pid}`;
const OUT_DIR = path.join(ROOT, CHECK_MODE ? path.join('.tmp', CHECK_OUT_DIR) : 'site');
const SITE_URL = 'https://beerui.github.io/jj-flow/';
const GITHUB_URL = 'https://github.com/beerui/jj-flow';

const NAV_ICONS = {
  开始: 'rocket',
  工作流: 'git-branch',
  概念: 'book-open',
  维护者: 'wrench',
  参考: 'library'
};

/** 侧栏高频入口 */
const SIDEBAR_GROUPS = [
  {
    title: '开始',
    pages: [
      { title: '首页', source: 'docs/index.md', output: 'index.html' },
      { title: '安装', source: 'docs/installation.md', output: 'installation.html' },
      { title: '五分钟上手', source: 'docs/usage.md', output: 'usage.html' },
      { title: '常见踩坑', source: 'docs/pitfalls.md', output: 'pitfalls.html' }
    ]
  },
  {
    title: '工作流',
    pages: [
      { title: '命令总览', source: 'docs/commands.md', output: 'commands.html' },
      { title: 'init · 接入地图', source: 'docs/commands/jj-init.md', output: 'command-jj-init.html' },
      { title: 'ralph · 单仓闭环', source: 'docs/commands/jj-ralph.md', output: 'command-jj-ralph.html' },
      { title: 'same · 同源迁移', source: 'docs/commands/jj-same.md', output: 'command-jj-same.html' },
      { title: 'dispatch · 多仓调度', source: 'docs/commands/jj-dispatch.md', output: 'command-jj-dispatch.html' },
      { title: 'review · 审查落盘', source: 'docs/commands/jj-review.md', output: 'command-jj-review.html' },
      { title: 'end · 收工合支', source: 'docs/commands/jj-end.md', output: 'command-jj-end.html' },
      { title: 'evaluated · 复盘', source: 'docs/commands/jj-evaluated.md', output: 'command-jj-evaluated.html' },
      { title: 'team · 多角色（可选）', source: 'docs/commands/jj-team-coordinate.md', output: 'command-jj-team-coordinate.html' },
      { title: 'team · SDLC（可选）', source: 'docs/commands/jj-team-lifecycle.md', output: 'command-jj-team-lifecycle.html' },
      { title: 'team · 搜索（可选）', source: 'docs/commands/jj-team-swarm.md', output: 'command-jj-team-swarm.html' },
      { title: 'jj · 帮你选路', source: 'docs/commands/jj.md', output: 'command-jj.html' }
    ]
  },
  {
    title: '概念',
    pages: [
      { title: '术语表', source: 'docs/glossary.md', output: 'glossary.html' },
      { title: '证据怎么算数', source: 'docs/concepts-evidence.md', output: 'concepts-evidence.html' },
      { title: '目录怎么放', source: 'docs/concepts-paths.md', output: 'concepts-paths.html' },
      { title: '宿主与 Mode S', source: 'docs/concepts-hosts.md', output: 'concepts-hosts.html' },
      { title: '知识库', source: 'docs/concepts-knowledge.md', output: 'concepts-knowledge.html' },
      { title: 'Loop 与 Graph', source: 'docs/loop-graph-guide.md', output: 'loop-graph-guide.html' },
      { title: '记忆速览', source: 'docs/memory-knowledge-guide.md', output: 'memory-knowledge-guide.html' }
    ]
  },
  {
    title: '维护者',
    pages: [
      { title: '架构', source: 'docs/architecture.md', output: 'architecture.html' },
      { title: '维护说明', source: 'docs/maintenance.md', output: 'maintenance.html' },
      { title: 'CLI 参考', source: 'docs/commands/cli.md', output: 'command-cli.html' },
      { title: '部署', source: 'docs/deployment.md', output: 'deployment.html' },
      { title: '更新日志', source: 'CHANGELOG.md', output: 'changelog.html' }
    ]
  },
  {
    title: '参考',
    pages: [
      { title: '设计文档', source: 'docs/design-docs/index.md', output: 'design-docs/index.html' },
      { title: '执行计划', source: 'docs/exec-plans/index.md', output: 'exec-plans/index.html' },
      { title: 'ADR', source: 'docs/adr/index.md', output: 'adr/index.html' },
      { title: '项目规划', source: 'docs/project-plan.md', output: 'project-plan.html' },
      { title: '真实 Host', source: 'docs/milestones/real-host-acceptance.md', output: 'milestones/real-host-acceptance.html' },
      { title: 'M7 半真实 Host', source: 'docs/milestones/m7-acceptance.md', output: 'milestones/m7-acceptance.html' },
      { title: 'H5 熵清理', source: 'docs/milestones/h5-acceptance.md', output: 'milestones/h5-acceptance.html' },
      { title: 'M6 调度', source: 'docs/milestones/m6-acceptance.md', output: 'milestones/m6-acceptance.html' },
      // Canonical under milestones/ (same folder as other milestone pages); root path kept as redirect below.
      { title: '调度演示', source: 'docs/dispatch-demo.md', output: 'milestones/dispatch-demo.html' },
      { title: 'ralph 机制演示', source: 'docs/ralph-demo.md', output: 'milestones/ralph-demo.html' },
      { title: 'end 收工演示', source: 'docs/end-demo.md', output: 'milestones/end-demo.html' }
    ]
  }
];

/** 仍构建、不进侧栏 */
const DEEP_PAGES = [
  { title: 'Agent Harness 设计', source: 'docs/design-docs/harness-engineering.md', output: 'design-docs/harness-engineering.html', group: '设计文档' },
  { title: '任务分配与反馈设计', source: 'docs/design-docs/task-assignment-ux.md', output: 'design-docs/task-assignment-ux.html', group: '设计文档' },
  { title: 'jj-ralph 设计', source: 'docs/design-docs/jj-ralph.md', output: 'design-docs/jj-ralph.html', group: '设计文档' },
  { title: 'Portfolio Knowledge', source: 'docs/design-docs/portfolio-knowledge.md', output: 'design-docs/portfolio-knowledge.html', group: '设计文档' },
  { title: 'Ralph 知识库贡献', source: 'docs/design-docs/ralph-knowledge-contribute.md', output: 'design-docs/ralph-knowledge-contribute.html', group: '设计文档' },
  { title: 'Ralph 归档提升', source: 'docs/design-docs/ralph-archive-elevation.md', output: 'design-docs/ralph-archive-elevation.html', group: '设计文档' },
  { title: 'Ralph 任务工作区 .plans 化改造', source: 'docs/design-docs/ralph-plans-workspace.md', output: 'design-docs/ralph-plans-workspace.html', group: '设计文档' },
  { title: 'Ralph 工作区布局（方案 A）', source: 'docs/design-docs/ralph-workspace-layout.md', output: 'design-docs/ralph-workspace-layout.html', group: '设计文档' },
  { title: 'Ralph 多轮任务内容预览', source: 'docs/design-docs/ralph-plans-workspace.preview.md', output: 'design-docs/ralph-plans-workspace.preview.html', group: '设计文档' },
  { title: 'jj-evaluated 设计', source: 'docs/design-docs/jj-evaluated.md', output: 'design-docs/jj-evaluated.html', group: '设计文档' },
  { title: 'Grok Host Adapter', source: 'docs/design-docs/grok-host-adapter.md', output: 'design-docs/grok-host-adapter.html', group: '设计文档' },
  { title: 'jj-team-coordinate 设计', source: 'docs/design-docs/jj-team-coordinate.md', output: 'design-docs/jj-team-coordinate.html', group: '设计文档' },
  { title: 'jj-team-lifecycle 设计', source: 'docs/design-docs/jj-team-lifecycle.md', output: 'design-docs/jj-team-lifecycle.html', group: '设计文档' },
  { title: 'jj-team-swarm 设计', source: 'docs/design-docs/jj-team-swarm.md', output: 'design-docs/jj-team-swarm.html', group: '设计文档' },
  { title: 'AI-native SDLC 对齐', source: 'docs/design-docs/ai-native-sdlc.md', output: 'design-docs/ai-native-sdlc.html', group: '设计文档' },
  { title: '实验场 Loop gym / Family gym', source: 'docs/design-docs/jj-flow-labs.md', output: 'design-docs/jj-flow-labs.html', group: '设计文档' },
  { title: '实验场 sibling 仓', source: 'docs/jj-lab-siblings.md', output: 'jj-lab-siblings.html', group: '维护者' },
  { title: 'Ralph 工作区 P2+ lite 执行', source: 'docs/exec-plans/completed/2026-09-03-ralph-plans-workspace-p2-lite.md', output: 'exec-plans/completed/2026-09-03-ralph-plans-workspace-p2-lite.html', group: '执行计划' },
  { title: 'Ralph 工作区 P2 执行', source: 'docs/exec-plans/completed/2026-09-02-ralph-plans-workspace-p2.md', output: 'exec-plans/completed/2026-09-02-ralph-plans-workspace-p2.html', group: '执行计划' },
  { title: 'Ralph 工作区 P1 执行', source: 'docs/exec-plans/completed/2026-09-02-ralph-plans-workspace-p1.md', output: 'exec-plans/completed/2026-09-02-ralph-plans-workspace-p1.html', group: '执行计划' },
  { title: '实验场执行', source: 'docs/exec-plans/completed/2026-08-31-jj-flow-labs.md', output: 'exec-plans/completed/2026-08-31-jj-flow-labs.html', group: '执行计划' },
  { title: 'AI-native SDLC 对齐执行', source: 'docs/exec-plans/completed/2026-08-31-ai-native-sdlc.md', output: 'exec-plans/completed/2026-08-31-ai-native-sdlc.html', group: '执行计划' },
  { title: 'Grok Mode S 执行', source: 'docs/exec-plans/active/2026-07-30-grok-dispatch-execution.md', output: 'exec-plans/active/2026-07-30-grok-dispatch-execution.html', group: '执行计划' },
  { title: 'Grok Host Phase 2', source: 'docs/exec-plans/completed/2026-09-01-grok-host-adapter-phase2.md', output: 'exec-plans/completed/2026-09-01-grok-host-adapter-phase2.html', group: '执行计划' },
  { title: 'Dispatch Ralph 回退', source: 'docs/exec-plans/completed/2026-07-31-dispatch-ralph-rollback.md', output: 'exec-plans/completed/2026-07-31-dispatch-ralph-rollback.html', group: '执行计划' },
  { title: 'Dispatch 升级 backlog', source: 'docs/exec-plans/active/2026-07-31-dispatch-upgrade-backlog.md', output: 'exec-plans/active/2026-07-31-dispatch-upgrade-backlog.html', group: '执行计划' },
  { title: 'Grok Host Phase 1', source: 'docs/exec-plans/completed/2026-07-27-grok-host-adapter.md', output: 'exec-plans/completed/2026-07-27-grok-host-adapter.html', group: '执行计划' },
  { title: 'Harness 收口', source: 'docs/exec-plans/completed/2026-07-18-harness-hardening.md', output: 'exec-plans/completed/2026-07-18-harness-hardening.html', group: '执行计划' },
  { title: 'ADR 0001', source: 'docs/adr/0001-external-tool-boundary.md', output: 'adr-0001-external-tool-boundary.html', group: 'ADR' },
  { title: 'ADR 0002', source: 'docs/adr/0002-project-family-control-plane.md', output: 'adr-0002-project-family-control-plane.html', group: 'ADR' }
];

const PAGES = [
  ...SIDEBAR_GROUPS.flatMap((g) => g.pages.map((p) => ({ ...p, group: g.title }))),
  ...DEEP_PAGES
];

const REMOVED_COMMAND_HTML = [
  'command-jj-delivery.html',
  'command-jj-validate.html',
  'command-jj-evolve.html'
];

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

fs.mkdirSync(path.join(OUT_DIR, 'assets'), { recursive: true });
const searchIndex = [];

for (const page of PAGES) {
  const sourcePath = path.join(ROOT, page.source);
  if (!fs.existsSync(sourcePath)) throw new Error(`Missing documentation source: ${page.source}`);
  const markdown = fs.readFileSync(sourcePath, 'utf8');
  const bodyHtml = renderMarkdownWithEmbeds(markdown);
  fs.mkdirSync(path.dirname(path.join(OUT_DIR, page.output)), { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, page.output), renderPage(page, bodyHtml));
  searchIndex.push(buildSearchEntry(page, markdown));
}

fs.writeFileSync(path.join(OUT_DIR, 'assets', 'styles.css'), buildStyles());
// 索引内嵌进 search.js，避免 file:// 或错误相对路径导致 fetch 失败（「搜索暂不可用」）
fs.writeFileSync(path.join(OUT_DIR, 'assets', 'search.js'), buildClientScript(searchIndex));
fs.writeFileSync(path.join(OUT_DIR, 'assets', 'search-index.json'), `${JSON.stringify(searchIndex)}\n`);
fs.writeFileSync(path.join(OUT_DIR, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), buildSitemap());
// Legacy root URL → milestones (bookmarks / guessed paths both work).
fs.writeFileSync(
  path.join(OUT_DIR, 'dispatch-demo.html'),
  buildRedirectPage('milestones/dispatch-demo.html', '调度演示')
);
fs.writeFileSync(
  path.join(OUT_DIR, 'ralph-demo.html'),
  buildRedirectPage('milestones/ralph-demo.html', 'ralph 机制演示')
);
fs.writeFileSync(
  path.join(OUT_DIR, 'end-demo.html'),
  buildRedirectPage('milestones/end-demo.html', 'end 收工演示')
);

if (CHECK_MODE) {
  for (const page of PAGES) {
    if (!fs.existsSync(path.join(OUT_DIR, page.output))) throw new Error(`Missing output ${page.output}`);
  }
  for (const f of [
    'assets/styles.css',
    'assets/search.js',
    'assets/search-index.json',
    '.nojekyll',
    'sitemap.xml',
    'dispatch-demo.html',
    'milestones/dispatch-demo.html',
    'ralph-demo.html',
    'milestones/ralph-demo.html',
    'end-demo.html',
    'milestones/end-demo.html'
  ]) {
    if (!fs.existsSync(path.join(OUT_DIR, f))) throw new Error(`Missing ${f}`);
  }
  validateSearchIndex(searchIndex);
  validateBuiltPages();
}

console.log(`docs site built: ${path.relative(ROOT, OUT_DIR)}`);

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

function pageDepth(output) {
  return output.split(/[/\\]/).filter(Boolean).length - 1;
}

function rootHref(output, target) {
  return `${'../'.repeat(pageDepth(output))}${target}`;
}

function icon(name, cls = '') {
  return `<i data-lucide="${escapeAttribute(name)}"${cls ? ` class="${escapeAttribute(cls)}"` : ''} aria-hidden="true"></i>`;
}

function renderPage(page, body) {
  const root = (t) => rootHref(page.output, t);
  const nav = SIDEBAR_GROUPS.map((group) => {
    const ic = NAV_ICONS[group.title] || 'folder';
    const links = group.pages
      .map((item) => {
        const active = item.output === page.output ? ' aria-current="page"' : '';
        return `<a href="${escapeAttribute(root(item.output))}" data-nav-page="${escapeAttribute(item.output)}"${active}>${escapeHtml(item.title)}</a>`;
      })
      .join('\n');
    return `<section class="nav-group">
      <h2 class="nav-group-title">${icon(ic, 'nav-ico')}<span>${escapeHtml(group.title)}</span></h2>
      <div class="nav-group-links">${links}</div>
    </section>`;
  }).join('\n');

  const trail =
    page.output === 'index.html'
      ? ''
      : `<nav class="breadcrumb" aria-label="面包屑">
  <a href="${escapeAttribute(root('index.html'))}" data-nav-page="index.html">首页</a>
  <span class="sep">/</span>
  <span>${escapeHtml(page.group)}</span>
  <span class="sep">/</span>
  <span class="current">${escapeHtml(page.title)}</span>
</nav>`;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="jj-flow：用对话在多个项目里改功能、迁功能、一起派任务">
  <meta name="color-scheme" content="light">
  <meta name="theme-color" content="#f8fafc">
  <title>${escapeHtml(page.title)} · jj-flow</title>
  <link rel="canonical" href="${escapeAttribute(new URL(page.output, SITE_URL).href)}">
  <link rel="stylesheet" href="${escapeAttribute(root('assets/styles.css'))}">
</head>
<body data-docs-root="${escapeAttribute(root(''))}" data-page-output="${escapeAttribute(page.output)}">
  <a class="skip-link" href="#main-content">跳到正文</a>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="${escapeAttribute(root('index.html'))}" data-nav-page="index.html">
        ${icon('workflow', 'brand-ico')}<span>jj-flow</span>
      </a>
      <p class="tagline">用对话做项目族编排工作流</p>
      <nav class="header-quick" aria-label="快速入口">
        <button type="button" class="search-trigger" data-search-open title="搜索 (Ctrl+K)">
          ${icon('search')}<span>搜索</span><kbd>Ctrl</kbd><kbd>K</kbd>
        </button>
        <a href="${escapeAttribute(root('installation.html'))}" data-nav-page="installation.html">${icon('download')}<span>安装</span></a>
        <a href="${escapeAttribute(root('usage.html'))}" data-nav-page="usage.html">${icon('play')}<span>上手</span></a>
        <a href="${escapeAttribute(root('changelog.html'))}" data-nav-page="changelog.html">${icon('scroll-text')}<span>更新日志</span></a>
        <a class="header-external" href="${escapeAttribute(GITHUB_URL)}" target="_blank" rel="noopener noreferrer">${icon('github')}<span>GitHub</span></a>
      </nav>
    </div>
  </header>
  <div class="search-modal" data-search-modal hidden>
    <div class="search-modal-backdrop" data-search-close tabindex="-1"></div>
    <div class="search-modal-panel" role="dialog" aria-modal="true" aria-label="搜索文档">
      <div class="doc-search" role="search">
        <div class="search-field">
          ${icon('search', 'search-ico')}
          <input id="doc-search" type="search" placeholder="搜命令或场景，例如 单仓 / 迁仓 / 派发…" autocomplete="off" data-doc-search>
          <kbd data-search-close-hint>Esc</kbd>
        </div>
        <p class="search-status" data-search-status aria-live="polite"></p>
        <ul class="search-results" data-search-results hidden></ul>
      </div>
    </div>
  </div>
  <main class="page-shell">
    <aside class="sidebar" data-sidebar>
      <details class="nav-panel" open>
        <summary>目录</summary>
        <nav class="side-nav" data-side-nav aria-label="文档导航">${nav}</nav>
      </details>
    </aside>
    <article class="content" id="main-content" tabindex="-1" data-doc-content>
${trail}
${body}
    </article>
  </main>
  <footer class="site-footer">
    <div class="footer-inner">
      <p>文档源码在 <code>docs/</code>。维护构建：<code>npm run docs:build</code> · <code>npm run docs:check</code></p>
      <p>
        <a href="${escapeAttribute(root('maintenance.html'))}" data-nav-page="maintenance.html">维护</a>
        · <a href="${escapeAttribute(root('commands.html'))}" data-nav-page="commands.html">命令</a>
        · <a href="${escapeAttribute(root('architecture.html'))}" data-nav-page="architecture.html">架构</a>
      </p>
    </div>
  </footer>
  <script src="https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js" defer></script>
  <script src="${escapeAttribute(root('assets/search.js'))}" defer></script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

function renderMarkdownWithEmbeds(markdown) {
  const embedRe = /<!--\s*embed:([^>]+?)\s*-->/g;
  const parts = [];
  let last = 0;
  let match;
  while ((match = embedRe.exec(markdown)) !== null) {
    const before = markdown.slice(last, match.index);
    if (before.trim()) parts.push(renderMarkdown(before));
    const abs = path.isAbsolute(match[1].trim()) ? match[1].trim() : path.join(ROOT, match[1].trim());
    if (!fs.existsSync(abs)) throw new Error(`Missing embed fragment: ${match[1].trim()}`);
    parts.push(fs.readFileSync(abs, 'utf8'));
    last = match.index + match[0].length;
  }
  const rest = markdown.slice(last);
  if (rest.trim()) parts.push(renderMarkdown(rest));
  return parts.join('\n');
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const output = [];
  let paragraph = [];
  let listType = null;
  let inCode = false;
  let tableRows = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    output.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!listType) return;
    output.push(`</${listType}>`);
    listType = null;
  };
  const openList = (type) => {
    if (listType === type) return;
    closeList();
    output.push(`<${type}>`);
    listType = type;
  };
  const flushTable = () => {
    if (!tableRows.length) return;
    const [headerLine, ...bodyLines] = tableRows;
    const headers = splitTableCells(headerLine);
    const rows = bodyLines.map(splitTableCells);
    const thead = `<thead><tr>${headers.map((c) => `<th>${renderInline(c)}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${renderInline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    output.push(`<div class="table-wrap"><table>${thead}${tbody}</table></div>`);
    tableRows = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      flushParagraph();
      closeList();
      flushTable();
      if (inCode) {
        output.push('</code></pre>');
        inCode = false;
      } else {
        const lang = fence[1] ? ` class="language-${escapeAttribute(fence[1])}"` : '';
        output.push(`<pre><code${lang}>`);
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      output.push(escapeHtml(line));
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      closeList();
      flushTable();
      continue;
    }
    if (isTableRow(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      flushParagraph();
      closeList();
      tableRows = [line];
      i += 1;
      while (i + 1 < lines.length && isTableRow(lines[i + 1])) {
        i += 1;
        tableRows.push(lines[i]);
      }
      flushTable();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      flushTable();
      const level = heading[1].length;
      const id = slugify(heading[2]);
      output.push(`<h${level} id="${escapeAttribute(id)}">${renderInline(heading[2])}</h${level}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushParagraph();
      closeList();
      flushTable();
      output.push('<hr>');
      continue;
    }
    const unordered = line.match(/^-\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      flushTable();
      openList('ul');
      output.push(`<li>${renderInline(unordered[1])}</li>`);
      continue;
    }
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      flushTable();
      openList('ol');
      output.push(`<li>${renderInline(ordered[1])}</li>`);
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      closeList();
      flushTable();
      const quoteLines = [quote[1]];
      while (i + 1 < lines.length && /^>\s?/.test(lines[i + 1])) {
        i += 1;
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
      }
      const html = quoteLines.map((p) => (p.trim() ? renderInline(p) : '<br>')).join('<br>');
      output.push(`<blockquote>${html}</blockquote>`);
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  closeList();
  flushTable();
  if (inCode) output.push('</code></pre>');
  return output.join('\n');
}

function isTableRow(line) {
  return /^\s*\|.+\|\s*$/.test(line);
}
function isTableDivider(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}
function splitTableCells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}
function slugify(text) {
  return (
    String(text)
      .replace(/`/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'section'
  );
}
function renderInline(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => `<a href="${escapeAttribute(href)}">${label}</a>`);
  return html;
}

function buildSearchEntry(page, markdown) {
  const content = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[`*_>#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { title: page.title, group: page.group, url: page.output, summary: content.slice(0, 180), content };
}

function validateSearchIndex(index) {
  if (index.length !== PAGES.length) throw new Error(`Search index size mismatch: ${index.length} vs ${PAGES.length}`);
  for (const page of PAGES) {
    if (!index.some((i) => i.url === page.output)) throw new Error(`Search missing ${page.output}`);
  }
}

function validateBuiltPages() {
  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(OUT_DIR, page.output), 'utf8');
    const expectedCss = rootHref(page.output, 'assets/styles.css');
    if (!html.includes(`href="${expectedCss}"`)) throw new Error(`Bad css path on ${page.output}`);
    if (!html.includes('data-doc-search') || !html.includes(rootHref(page.output, 'assets/search.js'))) {
      throw new Error(`Missing search on ${page.output}`);
    }
    if (!html.includes(`data-docs-root="${rootHref(page.output, '')}"`)) throw new Error(`Bad docs-root on ${page.output}`);
  }
  for (const file of ['index.html', 'installation.html', 'usage.html', 'commands.html', 'command-jj-same.html', 'command-jj-dispatch.html']) {
    const html = fs.readFileSync(path.join(OUT_DIR, file), 'utf8');
    for (const bad of REMOVED_COMMAND_HTML) {
      if (new RegExp(`href=["'][^"']*${bad.replace('.', '\\.')}`).test(html)) {
        throw new Error(`${file} links removed ${bad}`);
      }
    }
    if (!/项目族编排|编排工作流/.test(html)) throw new Error(`${file} missing positioning`);
  }
  const home = fs.readFileSync(path.join(OUT_DIR, 'index.html'), 'utf8');
  for (const required of ['installation.html', 'usage.html', 'command-jj-same.html', 'command-jj-dispatch.html']) {
    if (!home.includes(required)) throw new Error(`Home missing ${required}`);
  }
  const plan = fs.readFileSync(path.join(OUT_DIR, 'project-plan.html'), 'utf8');
  if (!plan.includes('<table>') || !plan.includes('<th>')) throw new Error('project-plan tables missing');
  const nested = fs.readFileSync(path.join(OUT_DIR, 'milestones/m6-acceptance.html'), 'utf8');
  if (!nested.includes('href="../assets/styles.css"') || !nested.includes('href="../index.html"')) {
    throw new Error('Nested milestone paths broken');
  }
  const demo = fs.readFileSync(path.join(OUT_DIR, 'milestones/dispatch-demo.html'), 'utf8');
  if (!demo.includes('href="../assets/styles.css"') || !demo.includes('href="../loop-graph-guide.html')) {
    throw new Error('dispatch-demo nested page links broken');
  }
  const demoRedirect = fs.readFileSync(path.join(OUT_DIR, 'dispatch-demo.html'), 'utf8');
  if (!demoRedirect.includes('milestones/dispatch-demo.html')) {
    throw new Error('root dispatch-demo.html redirect missing');
  }
  const ralphDemo = fs.readFileSync(path.join(OUT_DIR, 'milestones/ralph-demo.html'), 'utf8');
  if (!ralphDemo.includes('href="../assets/styles.css"') || !ralphDemo.includes('ralph-demo-app')) {
    throw new Error('ralph-demo nested page missing embed or assets');
  }
  const ralphRedirect = fs.readFileSync(path.join(OUT_DIR, 'ralph-demo.html'), 'utf8');
  if (!ralphRedirect.includes('milestones/ralph-demo.html')) {
    throw new Error('root ralph-demo.html redirect missing');
  }
  const endDemo = fs.readFileSync(path.join(OUT_DIR, 'milestones/end-demo.html'), 'utf8');
  if (!endDemo.includes('href="../assets/styles.css"') || !endDemo.includes('end-demo-app')) {
    throw new Error('end-demo nested page missing embed or assets');
  }
  const endRedirect = fs.readFileSync(path.join(OUT_DIR, 'end-demo.html'), 'utf8');
  if (!endRedirect.includes('milestones/end-demo.html')) {
    throw new Error('root end-demo.html redirect missing');
  }
}

/** Static HTML redirect for legacy or dual-published paths (no SPA shell). */
function buildRedirectPage(target, title) {
  const safeTarget = escapeAttribute(target);
  const safeTitle = escapeHtml(title);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url=${safeTarget}">
  <link rel="canonical" href="${escapeAttribute(new URL(target, SITE_URL).href)}">
  <title>${safeTitle} · jj-flow</title>
</head>
<body>
  <p>页面已移动到 <a href="${safeTarget}">${safeTitle}</a>。</p>
</body>
</html>
`;
}

function buildSitemap() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map((p) => `  <url><loc>${escapeHtml(new URL(p.output, SITE_URL).href)}</loc></url>`).join('\n')}
</urlset>
`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", '&#39;');
}

// ---------------------------------------------------------------------------
// Client: search + SPA
// ---------------------------------------------------------------------------

function buildClientScript(searchIndex) {
  const embedded = JSON.stringify(searchIndex);
  return `(() => {
  const docsRoot = () => document.body?.dataset?.docsRoot || '';
  const resolveUrl = (url) => {
    try {
      return new URL(url, new URL(docsRoot() || './', location.href)).href;
    } catch {
      return docsRoot() + url;
    }
  };

  // 构建时内嵌，file:// 与任意部署路径均可搜索
  const EMBEDDED_INDEX = ${embedded};

  function refreshIcons() {
    if (window.lucide?.createIcons) window.lucide.createIcons({ attrs: { 'stroke-width': 1.75 } });
  }

  const modal = document.querySelector('[data-search-modal]');
  const input = document.querySelector('[data-doc-search]');
  const resultsElement = document.querySelector('[data-search-results]');
  const statusElement = document.querySelector('[data-search-status]');
  const openButtons = document.querySelectorAll('[data-search-open]');
  let indexPromise;
  let activeIndex = -1;
  const normalize = (v) => String(v).toLocaleLowerCase('zh-CN').replace(/\\s+/g, ' ').trim();

  const loadIndex = () => {
    if (Array.isArray(EMBEDDED_INDEX) && EMBEDDED_INDEX.length) {
      return Promise.resolve(EMBEDDED_INDEX);
    }
    if (!indexPromise) {
      indexPromise = fetch(resolveUrl('assets/search-index.json'))
        .then((r) => {
          if (!r.ok) throw new Error('no index');
          return r.json();
        })
        .catch(() => {
          throw new Error('search index unavailable');
        });
    }
    return indexPromise;
  };

  const clearResults = () => {
    if (!resultsElement || !statusElement) return;
    resultsElement.replaceChildren();
    resultsElement.hidden = true;
    statusElement.textContent = '';
    activeIndex = -1;
  };

  const openSearch = () => {
    if (!modal || !input) return;
    modal.hidden = false;
    document.body.classList.add('search-open');
    input.value = '';
    clearResults();
    statusElement.textContent = '输入命令名或场景，例如 ralph、迁仓、派发';
    requestAnimationFrame(() => input.focus());
    loadIndex().catch(() => {});
  };

  const closeSearch = () => {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('search-open');
    if (input) input.value = '';
    clearResults();
  };

  const isSearchOpen = () => modal && !modal.hidden;

  const search = async () => {
    if (!input || !resultsElement || !statusElement) return;
    const query = normalize(input.value);
    activeIndex = -1;
    if (!query) {
      clearResults();
      statusElement.textContent = '输入命令名或场景，例如 ralph、迁仓、派发';
      return;
    }
    statusElement.textContent = '搜索中…';
    const tokens = query.split(' ').filter(Boolean);
    try {
      const index = await loadIndex();
      const matches = index
        .map((item) => {
          const hay = normalize(item.title + ' ' + item.group + ' ' + item.content);
          if (!tokens.every((t) => hay.includes(t))) return null;
          let score = 0;
          for (const t of tokens) {
            if (normalize(item.title).includes(t)) score += 12;
            score += Math.min(6, hay.split(t).length - 1);
          }
          return { ...item, score };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
      resultsElement.replaceChildren();
      for (const item of matches) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = resolveUrl(item.url);
        a.dataset.navPage = item.url;
        const strong = document.createElement('strong');
        strong.textContent = item.title;
        const span = document.createElement('span');
        span.textContent = item.group;
        a.append(strong, span);
        li.append(a);
        resultsElement.append(li);
      }
      resultsElement.hidden = matches.length === 0;
      statusElement.textContent = matches.length ? ('找到 ' + matches.length + ' 条，Enter 打开') : '没有找到。试试 ralph、same、dispatch、踩坑';
    } catch {
      statusElement.textContent = '搜索暂时不可用，请刷新后再试';
    }
  };

  const resultLinks = () => [...(resultsElement?.querySelectorAll('a') || [])];

  const setActiveResult = (index) => {
    const links = resultLinks();
    if (!links.length) {
      activeIndex = -1;
      return;
    }
    activeIndex = (index + links.length) % links.length;
    links.forEach((link, i) => link.classList.toggle('is-active', i === activeIndex));
    links[activeIndex]?.scrollIntoView({ block: 'nearest' });
  };

  openButtons.forEach((btn) => btn.addEventListener('click', openSearch));
  modal?.querySelectorAll('[data-search-close]').forEach((el) => {
    el.addEventListener('click', closeSearch);
  });

  if (input) {
    input.addEventListener('input', search);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSearch();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveResult(activeIndex + 1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveResult(activeIndex <= 0 ? resultLinks().length - 1 : activeIndex - 1);
        return;
      }
      if (e.key === 'Enter') {
        const links = resultLinks();
        const target = activeIndex >= 0 ? links[activeIndex] : links[0];
        if (target) {
          e.preventDefault();
          closeSearch();
          target.click();
        }
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (isSearchOpen()) closeSearch();
      else openSearch();
      return;
    }
    if (e.key === 'Escape' && isSearchOpen()) {
      e.preventDefault();
      closeSearch();
    }
  });

  const navPanel = document.querySelector('.nav-panel');
  if (navPanel && window.matchMedia('(max-width: 720px)').matches) navPanel.removeAttribute('open');

  function pageKeyFromHref(href) {
    try {
      const url = new URL(href, location.href);
      if (url.origin !== location.origin) return null;
      let path = decodeURIComponent(url.pathname).replace(/\\\\/g, '/');
      const siteRoot = new URL(docsRoot() || './', location.href);
      let rootPath = decodeURIComponent(siteRoot.pathname).replace(/\\\\/g, '/');
      if (rootPath.endsWith('.html')) rootPath = rootPath.replace(/[^/]+$/, '');
      if (!rootPath.endsWith('/')) rootPath += '/';
      if (path.startsWith(rootPath)) path = path.slice(rootPath.length);
      else {
        const siteIdx = path.lastIndexOf('/site/');
        if (siteIdx >= 0) path = path.slice(siteIdx + 6);
        else {
          const flowIdx = path.lastIndexOf('/jj-flow/');
          path = flowIdx >= 0 ? path.slice(flowIdx + 9) : path.split('/').pop() || 'index.html';
        }
      }
      path = path.replace(/^\\/+/, '');
      if (!path || path.endsWith('/')) path += 'index.html';
      if (!path.endsWith('.html')) path += '.html';
      return path;
    } catch {
      return null;
    }
  }

  function setActiveNav(pageKey) {
    // 仅侧栏高亮，避免顶栏链接也带上选中样式
    document.querySelectorAll('.side-nav [data-nav-page]').forEach((link) => {
      if (link.getAttribute('data-nav-page') === pageKey) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.body.dataset.pageOutput = pageKey || '';
  }

  function updateDocsRoot(pageKey) {
    const depth = Math.max(0, pageKey.split('/').length - 1);
    document.body.dataset.docsRoot = depth ? '../'.repeat(depth) : '';
  }

  let navigating = false;
  async function navigateTo(href, { push = true } = {}) {
    const pageKey = pageKeyFromHref(href);
    if (!pageKey || navigating) return false;
    if (pageKey === document.body.dataset.pageOutput && push) {
      closeSearch();
      return true;
    }
    navigating = true;
    const article = document.querySelector('[data-doc-content]');
    if (article) article.setAttribute('aria-busy', 'true');
    try {
      const res = await fetch(href, { headers: { Accept: 'text/html' } });
      if (!res.ok) throw new Error('fetch');
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const next = doc.querySelector('[data-doc-content]');
      if (!next || !article) throw new Error('content');
      article.innerHTML = next.innerHTML;
      const title = doc.querySelector('title')?.textContent;
      if (title) document.title = title;
      const can = document.querySelector('link[rel="canonical"]');
      const nextCan = doc.querySelector('link[rel="canonical"]')?.getAttribute('href');
      if (can && nextCan) can.setAttribute('href', nextCan);
      updateDocsRoot(pageKey);
      setActiveNav(pageKey);
      closeSearch();
      refreshIcons();
      if (push) history.pushState({ pageKey }, '', href);
      window.scrollTo(0, 0);
      article.focus({ preventScroll: true });
      return true;
    } catch {
      location.href = href;
      return false;
    } finally {
      navigating = false;
      article?.removeAttribute('aria-busy');
    }
  }

  document.addEventListener('click', (e) => {
    const a = e.target instanceof Element ? e.target.closest('a') : null;
    if (!a || a.target === '_blank' || a.classList.contains('header-external')) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;
    if (!pageKeyFromHref(a.href)) return;
    e.preventDefault();
    navigateTo(a.href, { push: true });
  });
  window.addEventListener('popstate', () => navigateTo(location.href, { push: false }));
  refreshIcons();
})();
`;
}

// ---------------------------------------------------------------------------
// Styles — light, system fonts, no flashy canvas
// ---------------------------------------------------------------------------

function buildStyles() {
  return `:root {
  color-scheme: light;
  --bg: #f8fafc;
  --surface: #ffffff;
  --panel: #f1f5f9;
  --text: #0f172a;
  --soft: #334155;
  --muted: #64748b;
  --line: #e2e8f0;
  --line2: #cbd5e1;
  --accent: #0f766e;
  --accent-bg: #ccfbf1;
  --focus: #2563eb;
  --code-bg: #0f172a;
  --code-fg: #e2e8f0;
  --font: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --mono: ui-monospace, "Cascadia Mono", "SF Mono", Consolas, Menlo, monospace;
  --header-h: 60px;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  min-height: 100vh;
  font: 16px/1.7 var(--font);
  color: var(--text);
  background: #fff;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--accent); text-underline-offset: 3px; }
a:hover { color: #0d9488; }
[data-lucide] { width: 1em; height: 1em; stroke: currentColor; flex-shrink: 0; }

.skip-link {
  position: fixed; top: 8px; left: 8px; z-index: 100;
  transform: translateY(-160%); padding: 8px 12px;
  background: var(--text); color: #fff; border-radius: 8px; text-decoration: none;
}
.skip-link:focus { transform: none; }

.site-header {
  position: sticky; top: 0; z-index: 40;
  border-bottom: 1px solid #eef2f6;
  background: rgba(255,255,255,.92);
  backdrop-filter: blur(10px);
}
.header-inner {
  display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px;
  width: min(1600px, calc(100% - 32px)); margin: 0 auto; min-height: var(--header-h);
}
.brand {
  display: inline-flex; align-items: center; gap: 8px;
  color: var(--text); text-decoration: none; font-weight: 700; font-size: 1.1rem;
}
.brand-ico { color: var(--accent); }
.tagline { margin: 0; color: var(--muted); font-size: .8rem; flex: 1; }
.header-quick { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.header-quick a,
.search-trigger {
  display: inline-flex; align-items: center; gap: 6px;
  min-height: 34px; padding: 0 12px; border: 1px solid var(--line);
  border-radius: 999px; background: var(--surface); color: var(--text);
  font: inherit; font-size: .85rem; font-weight: 600; text-decoration: none; cursor: pointer;
}
.header-quick a:hover,
.search-trigger:hover { background: var(--accent-bg); border-color: #99f6e4; }
.search-trigger kbd {
  border: 1px solid var(--line); border-radius: 4px; padding: 0 5px;
  font: 11px var(--mono); color: var(--muted); background: var(--panel);
}
body.search-open { overflow: hidden; }
.search-modal[hidden] { display: none !important; }
.search-modal {
  position: fixed; inset: 0; z-index: 80;
  display: grid; place-items: start center; padding: 12vh 16px 16px;
}
.search-modal-backdrop {
  position: absolute; inset: 0; background: rgba(15, 23, 42, .45);
  border: 0; cursor: pointer;
}
.search-modal-panel {
  position: relative; z-index: 1; width: min(720px, 100%);
  border: 1px solid var(--line2); border-radius: 16px;
  background: var(--surface); box-shadow: 0 24px 64px rgba(15, 23, 42, .2);
  overflow: hidden;
}

.page-shell {
  display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 40px;
  width: min(1600px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 56px;
}
/* 侧栏随整页滚动，不单独出滚动条；无分割线 */
.sidebar {
  position: static;
  align-self: start;
  overflow: visible;
  max-height: none;
  padding: 4px 8px 24px 0;
  border: 0;
}
.sidebar, .content { min-width: 0; }

.doc-search { padding: 14px; }
.search-field { position: relative; }
.search-ico { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); width: 1.05rem; height: 1.05rem; }
.doc-search input {
  width: 100%; min-height: 52px; border: 1px solid var(--line2); border-radius: 12px;
  padding: 12px 56px 12px 42px; font: inherit; font-size: 1rem; background: #fff; color: var(--text);
}
.doc-search input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(15,118,110,.12); }
.doc-search kbd {
  position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
  border: 1px solid var(--line); border-radius: 4px; padding: 2px 6px;
  font: 11px var(--mono); color: var(--muted); background: var(--panel);
}
.search-status { min-height: 18px; margin: 10px 6px 0; font-size: .75rem; color: var(--muted); }
.search-results {
  max-height: min(440px, 52vh); overflow: auto; margin: 10px 0 0; padding: 6px;
  list-style: none; border-top: 1px solid var(--line);
  scrollbar-width: thin;
}
.search-results a {
  display: grid; gap: 2px; padding: 11px 12px; border-radius: 10px;
  text-decoration: none; color: inherit;
}
.search-results a:hover,
.search-results a.is-active { background: var(--panel); }
.search-results a.is-active { outline: 1px solid var(--line2); }
.search-results strong { font-size: .92rem; color: var(--text); }
.search-results span { font-size: .75rem; color: var(--muted); }

.nav-panel {
  border: 0;
  border-radius: 0;
  padding: 0;
  background: transparent;
}
.nav-panel > summary { display: none; }
.side-nav { display: grid; gap: 20px; }
.nav-group + .nav-group {
  padding-top: 4px;
}
.nav-group-title {
  display: flex; align-items: center; gap: 7px;
  margin: 0 0 8px; padding-top: 0; border-top: 0;
  font-size: .7rem; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: #94a3b8;
}
.nav-ico { width: .85rem; height: .85rem; color: #94a3b8; opacity: .9; }
.nav-group-links { display: grid; gap: 2px; }
.side-nav a {
  display: flex; align-items: center;
  position: relative;
  min-height: 34px;
  padding: 6px 10px 6px 12px;
  border-radius: 8px;
  color: #475569;
  text-decoration: none;
  font-size: .875rem;
  line-height: 1.35;
  font-weight: 500;
  transition: background .12s ease, color .12s ease;
}
.side-nav a:hover {
  color: var(--text);
  background: rgba(15, 23, 42, .04);
}
.side-nav a[aria-current="page"] {
  color: var(--accent);
  font-weight: 600;
  background: transparent;
  box-shadow: none;
}
.side-nav a[aria-current="page"]::before {
  content: "";
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 2px;
  border-radius: 2px;
  background: var(--accent);
}

.content {
  border: 0;
  border-radius: 0;
  padding: 4px 8px 48px 8px;
  background: transparent;
  box-shadow: none;
}
.content[aria-busy="true"] { opacity: .75; }
.breadcrumb {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  margin: 0 0 16px; font-size: .8rem; color: var(--muted);
}
.breadcrumb a { color: var(--muted); text-decoration: none; }
.breadcrumb a:hover { color: var(--accent); }
.breadcrumb .current { color: var(--soft); }

h1,h2,h3,h4 { font-family: var(--font); color: var(--text); line-height: 1.25; font-weight: 700; }
h1 { margin: 0 0 16px; font-size: clamp(1.6rem, 2vw, 1.95rem); letter-spacing: -.02em; }
/* 章节分隔只作用于正文，避免侧栏「开始」等 h2 标题上方出现线 */
.content h2 {
  margin: 2rem 0 10px;
  padding-top: 1.1rem;
  border-top: 1px solid #eef2f6;
  font-size: 1.2rem;
}
.content > h2:first-of-type {
  margin-top: 1.25rem;
  padding-top: 0;
  border-top: 0;
}
h3 { margin: 24px 0 8px; font-size: 1.02rem; }
h4 { margin: 18px 0 6px; font-size: .95rem; color: var(--soft); }
p, li { color: var(--soft); }
p { margin: 0 0 14px; }
ul, ol { margin: 0 0 14px; padding-left: 1.25rem; }
li + li { margin-top: 5px; }
pre {
  overflow-x: auto; margin: 14px 0; padding: 14px 16px; border-radius: 10px;
  background: var(--code-bg); color: var(--code-fg); font: .85rem/1.6 var(--mono);
  border: 1px solid #1e293b;
}
code {
  font-family: var(--mono); font-size: .9em;
  background: var(--panel); padding: .1em .35em; border-radius: 5px; color: var(--text);
}
pre code { background: transparent; color: inherit; padding: 0; }
blockquote {
  margin: 14px 0; padding: 10px 14px; border-left: 3px solid var(--accent);
  background: #f0fdfa; border-radius: 0 8px 8px 0; color: var(--soft);
}
hr {
  border: 0;
  border-top: 1px solid #eef2f6;
  margin: 28px 0;
}
.table-wrap {
  overflow-x: auto; margin: 14px 0 20px; border: 0;
  border-radius: 0; background: transparent;
}
table { width: 100%; border-collapse: collapse; font-size: .9rem; }
th, td { padding: 10px 0; border-bottom: 1px solid #eef2f6; text-align: left; vertical-align: top; }
th { background: transparent; font-weight: 700; color: var(--text); }
td { color: var(--soft); }
tr:last-child td { border-bottom: 0; }
strong { color: var(--text); }
.content > :first-child { margin-top: 0; }

.site-footer { border-top: 1px solid #eef2f6; background: #fff; }
.footer-inner {
  width: min(1600px, calc(100% - 32px)); margin: 0 auto; padding: 16px 0 32px;
  font-size: .8rem; color: var(--muted);
}
.footer-inner a { color: var(--muted); }
.footer-inner a:hover { color: var(--accent); }

.doc-search input:focus-visible,
.side-nav a:focus-visible,
.header-quick a:focus-visible,
.search-trigger:focus-visible,
.search-results a:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--focus) 55%, transparent);
  outline-offset: 2px;
}

@media (max-width: 900px) {
  .page-shell { grid-template-columns: 1fr; gap: 16px; }
  .sidebar {
    position: static; max-height: none; overflow: visible;
    border: 0; padding-right: 0; padding-bottom: 8px; margin-bottom: 0;
  }
  .tagline { flex: 1 1 100%; order: 3; }
  .content { padding: 8px 0 32px; }
}
@media (max-width: 720px) {
  .header-inner, .page-shell, .footer-inner { width: calc(100% - 20px); }
  .search-trigger span { display: none; }
  .nav-panel { padding: 0; border: 0; background: transparent; }
  .nav-panel > summary {
    display: flex; min-height: 44px; align-items: center;
    border: 1px solid var(--line2); border-radius: 10px; padding: 10px 12px;
    background: #fff; font-weight: 700; cursor: pointer; list-style: none;
  }
  .nav-panel > summary::-webkit-details-marker { display: none; }
  .nav-panel[open] .side-nav {
    margin-top: 10px; padding: 8px 0; border: 0; background: transparent;
  }
  .side-nav a { min-height: 40px; padding: 8px 10px 8px 12px; }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
}
`;
}
