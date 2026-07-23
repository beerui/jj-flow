#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const CHECK_MODE = process.argv.includes('--check');
const CHECK_OUT_DIR = `docs-site-check-${process.pid}`;
const OUT_DIR = path.join(ROOT, CHECK_MODE ? path.join('.tmp', CHECK_OUT_DIR) : 'site');
const SITE_URL = 'https://beerui.github.io/jj-flow/';

/** @type {{ title: string, pages: { title: string, source: string, output: string }[] }[]} */
const NAV_GROUPS = [
  {
    title: '开始使用',
    pages: [
      { title: '首页', source: 'docs/index.md', output: 'index.html' },
      { title: '安装', source: 'docs/installation.md', output: 'installation.html' },
      { title: '使用说明', source: 'docs/usage.md', output: 'usage.html' },
      { title: '命令总览', source: 'docs/commands.md', output: 'commands.html' }
    ]
  },
  {
    title: '命令入口',
    pages: [
      { title: '$jj-same 同源迁移', source: 'docs/commands/jj-same.md', output: 'command-jj-same.html' },
      { title: '$jj-ralph 单仓闭环', source: 'docs/commands/jj-ralph.md', output: 'command-jj-ralph.html' },
      { title: '$jj-review 单仓审查', source: 'docs/commands/jj-review.md', output: 'command-jj-review.html' },
      { title: '$jj-dispatch 多项目调度', source: 'docs/commands/jj-dispatch.md', output: 'command-jj-dispatch.html' },
      { title: '$jj 兼容入口', source: 'docs/commands/jj.md', output: 'command-jj.html' }
    ]
  },
  {
    title: '项目维护',
    pages: [
      { title: 'CLI 调度与自动化', source: 'docs/commands/cli.md', output: 'command-cli.html' },
      { title: '维护说明', source: 'docs/maintenance.md', output: 'maintenance.html' },
      { title: 'GitHub Pages 部署', source: 'docs/deployment.md', output: 'deployment.html' }
    ]
  },
  {
    title: '理解 jj-flow',
    pages: [
      { title: '术语与缩写', source: 'docs/glossary.md', output: 'glossary.html' },
      { title: '架构', source: 'docs/architecture.md', output: 'architecture.html' },
      { title: '设计文档', source: 'docs/design-docs/index.md', output: 'design-docs/index.html' },
      { title: 'Agent Harness 设计', source: 'docs/design-docs/harness-engineering.md', output: 'design-docs/harness-engineering.html' },
      { title: '任务分配与反馈设计', source: 'docs/design-docs/task-assignment-ux.md', output: 'design-docs/task-assignment-ux.html' },
      { title: 'jj-ralph 单仓闭环设计', source: 'docs/design-docs/jj-ralph.md', output: 'design-docs/jj-ralph.html' },
      { title: '执行计划', source: 'docs/exec-plans/index.md', output: 'exec-plans/index.html' },
      { title: 'Harness 收口计划', source: 'docs/exec-plans/active/2026-07-18-harness-hardening.md', output: 'exec-plans/active/2026-07-18-harness-hardening.html' },
      { title: 'ADR 索引', source: 'docs/adr/index.md', output: 'adr/index.html' },
      { title: '项目规划', source: 'docs/project-plan.md', output: 'project-plan.html' },
      { title: 'M6 验收', source: 'docs/milestones/m6-acceptance.md', output: 'milestones/m6-acceptance.html' },
      { title: 'M7 Host 闭环验收', source: 'docs/milestones/m7-acceptance.md', output: 'milestones/m7-acceptance.html' },
      { title: 'H5 持续熵清理验收', source: 'docs/milestones/h5-acceptance.md', output: 'milestones/h5-acceptance.html' },
      { title: 'ADR 0001', source: 'docs/adr/0001-thin-maestro-adapter.md', output: 'adr-0001-thin-maestro-adapter.html' },
      { title: 'ADR 0002', source: 'docs/adr/0002-project-family-control-plane.md', output: 'adr-0002-project-family-control-plane.html' }
    ]
  }
];

const PAGES = NAV_GROUPS.flatMap((group) => group.pages.map((page) => ({ ...page, group: group.title })));
const REMOVED_COMMAND_HTML = [
  'command-jj-delivery.html',
  'command-jj-validate.html',
  'command-jj-evolve.html'
];

fs.mkdirSync(path.join(OUT_DIR, 'assets'), { recursive: true });

const searchIndex = [];

for (const page of PAGES) {
  const sourcePath = path.join(ROOT, page.source);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing documentation source: ${page.source}`);
  }

  const markdown = fs.readFileSync(sourcePath, 'utf8');
  const html = renderPage(page, renderMarkdown(markdown));
  const outputPath = path.join(OUT_DIR, page.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html);
  searchIndex.push(buildSearchEntry(page, markdown));
}

fs.writeFileSync(path.join(OUT_DIR, 'assets', 'styles.css'), buildStyles());
fs.writeFileSync(path.join(OUT_DIR, 'assets', 'search.js'), buildSearchScript());
fs.writeFileSync(path.join(OUT_DIR, 'assets', 'search-index.json'), `${JSON.stringify(searchIndex)}\n`);
fs.writeFileSync(path.join(OUT_DIR, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), buildSitemap());

if (CHECK_MODE) {
  const requiredOutputs = [
    ...PAGES.map((page) => page.output),
    'assets/styles.css',
    'assets/search.js',
    'assets/search-index.json',
    '.nojekyll',
    'sitemap.xml'
  ];
  const missing = requiredOutputs.filter((file) => !fs.existsSync(path.join(OUT_DIR, file)));
  if (missing.length) {
    throw new Error(`Docs build missing outputs:\n${missing.map((file) => `- ${file}`).join('\n')}`);
  }

  validateSearchIndex(searchIndex);
  validateBuiltPages();
}

console.log(`docs site built: ${path.relative(ROOT, OUT_DIR)}`);

function pageDepth(output) {
  return output.split(/[/\\]/).filter(Boolean).length - 1;
}

function rootHref(output, target) {
  const depth = pageDepth(output);
  return `${'../'.repeat(depth)}${target}`;
}

function renderPage(page, body) {
  const root = (target) => rootHref(page.output, target);
  const nav = NAV_GROUPS.map((group) => {
    const links = group.pages.map((item) => {
      const active = item.output === page.output ? ' aria-current="page"' : '';
      return `<a href="${escapeAttribute(root(item.output))}"${active}>${escapeHtml(item.title)}</a>`;
    }).join('\n');

    return `<section class="nav-group">
        <h2 class="nav-group-title">${escapeHtml(group.title)}</h2>
        <div class="nav-group-links">
${links}
        </div>
      </section>`;
  }).join('\n');

  const trail = buildTrail(page);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="jj-flow：项目族编排工作流（same 同源迁移 + dispatch 多项目调度）">
  <title>${escapeHtml(page.title)} · jj-flow</title>
  <link rel="canonical" href="${escapeAttribute(new URL(page.output, SITE_URL).href)}">
  <link rel="stylesheet" href="${escapeAttribute(root('assets/styles.css'))}">
</head>
<body data-docs-root="${escapeAttribute(root(''))}">
  <a class="skip-link" href="#main-content">跳到正文</a>
  <header class="site-header">
    <div class="header-inner">
      <div class="brand-block">
        <a class="brand" href="${escapeAttribute(root('index.html'))}">jj-flow</a>
        <p class="tagline">项目族编排工作流 · same / dispatch</p>
      </div>
      <nav class="header-quick" aria-label="快速入口">
        <a href="${escapeAttribute(root('installation.html'))}">安装</a>
        <a href="${escapeAttribute(root('usage.html'))}">使用</a>
        <a href="${escapeAttribute(root('command-jj-same.html'))}">same</a>
        <a href="${escapeAttribute(root('command-jj-dispatch.html'))}">dispatch</a>
      </nav>
    </div>
  </header>
  <main class="page-shell">
    <aside class="sidebar">
      <div class="doc-search" role="search">
        <label for="doc-search">搜索文档</label>
        <div class="search-field">
          <input id="doc-search" type="search" placeholder="命令、handoff、task_key…" autocomplete="off" data-doc-search>
          <kbd class="search-hint">/</kbd>
        </div>
        <p class="search-status" aria-live="polite" data-search-status></p>
        <ul class="search-results" data-search-results hidden></ul>
      </div>
      <details class="nav-panel" open>
        <summary>浏览文档</summary>
        <nav class="side-nav" aria-label="文档导航">
${nav}
        </nav>
      </details>
    </aside>
    <article class="content" id="main-content" tabindex="-1">
${trail}
${body}
    </article>
  </main>
  <footer class="site-footer">
    <div class="footer-inner">
      <p>Markdown 源在 <code>docs/</code> · 生成：<code>npm run docs:build</code> · 检查：<code>npm run docs:check</code></p>
      <p><a href="${escapeAttribute(root('maintenance.html'))}">维护说明</a> · <a href="${escapeAttribute(root('commands.html'))}">命令总览</a></p>
    </div>
  </footer>
  <script src="${escapeAttribute(root('assets/search.js'))}" defer></script>
</body>
</html>
`;
}

function buildTrail(page) {
  if (page.output === 'index.html') return '';
  const root = (target) => rootHref(page.output, target);
  return `<nav class="breadcrumb" aria-label="面包屑">
  <a href="${escapeAttribute(root('index.html'))}">首页</a>
  <span aria-hidden="true">/</span>
  <span>${escapeHtml(page.group)}</span>
  <span aria-hidden="true">/</span>
  <span>${escapeHtml(page.title)}</span>
</nav>`;
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const output = [];
  let paragraph = [];
  let listType = null;
  let inCode = false;
  let tableRows = [];

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
        const language = fence[1] ? ` class="language-${escapeAttribute(fence[1])}"` : '';
        output.push(`<pre><code${language}>`);
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

    const hr = line.match(/^(-{3,}|\*{3,}|_{3,})\s*$/);
    if (hr) {
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
      output.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();
  flushTable();
  if (inCode) output.push('</code></pre>');
  return output.join('\n');

  function flushParagraph() {
    if (!paragraph.length) return;
    output.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  function openList(type) {
    if (listType === type) return;
    closeList();
    output.push(`<${type}>`);
    listType = type;
  }

  function closeList() {
    if (!listType) return;
    output.push(`</${listType}>`);
    listType = null;
  }

  function flushTable() {
    if (!tableRows.length) return;
    const [headerLine, ...bodyLines] = tableRows;
    const headers = splitTableCells(headerLine);
    const rows = bodyLines.map(splitTableCells);
    const thead = `<thead><tr>${headers.map((cell) => `<th>${renderInline(cell)}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    output.push(`<div class="table-wrap"><table>${thead}${tbody}</table></div>`);
    tableRows = [];
  }
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
    .map((cell) => cell.trim());
}

function slugify(text) {
  return String(text)
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'section';
}

function renderInline(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    return `<a href="${escapeAttribute(href)}">${label}</a>`;
  });
  return html;
}

function buildSearchEntry(page, markdown) {
  const content = markdownToSearchText(markdown);
  return {
    title: page.title,
    group: page.group,
    url: page.output,
    summary: content.slice(0, 180),
    content
  };
}

function markdownToSearchText(markdown) {
  return markdown
    .replace(/```\w*\s*/g, ' ')
    .replace(/```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[`*_>#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function validateSearchIndex(index) {
  if (index.length !== PAGES.length) {
    throw new Error(`Search index size mismatch: expected ${PAGES.length}, got ${index.length}`);
  }

  const indexedUrls = new Set(index.map((item) => item.url));
  for (const page of PAGES) {
    if (!indexedUrls.has(page.output)) {
      throw new Error(`Search index is missing page: ${page.output}`);
    }
  }

  for (const item of index) {
    if (!item.title || !item.group || !item.url || !item.content) {
      throw new Error(`Invalid search index entry: ${JSON.stringify(item)}`);
    }
  }
}

function validateBuiltPages() {
  const primaryPages = [
    'index.html',
    'installation.html',
    'usage.html',
    'commands.html',
    'command-jj-same.html',
    'command-jj-dispatch.html'
  ];

  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(OUT_DIR, page.output), 'utf8');
    const expectedRoot = rootHref(page.output, '');
    const expectedCss = rootHref(page.output, 'assets/styles.css');
    if (!html.includes(`href="${expectedCss}"`)) {
      throw new Error(`Docs page missing depth-correct stylesheet: ${page.output} (expected ${expectedCss})`);
    }
    if (!html.includes('data-doc-search') || !html.includes(rootHref(page.output, 'assets/search.js'))) {
      throw new Error(`Docs page is missing search UI: ${page.output}`);
    }
    if (!html.includes(`data-docs-root="${expectedRoot}"`)) {
      throw new Error(`Docs page missing data-docs-root: ${page.output}`);
    }
  }

  for (const file of primaryPages) {
    const html = fs.readFileSync(path.join(OUT_DIR, file), 'utf8');
    for (const bad of REMOVED_COMMAND_HTML) {
      if (new RegExp(`href=["'][^"']*${bad.replace('.', '\\.')}["']`).test(html)) {
        throw new Error(`Primary page ${file} links to removed command page ${bad}`);
      }
    }
    if (!/项目族编排|编排工作流/.test(html)) {
      throw new Error(`Primary page missing orchestration positioning: ${file}`);
    }
  }

  const home = fs.readFileSync(path.join(OUT_DIR, 'index.html'), 'utf8');
  for (const required of ['installation.html', 'usage.html', 'command-jj-same.html', 'command-jj-dispatch.html']) {
    if (!home.includes(required)) {
      throw new Error(`Home page missing required path link: ${required}`);
    }
  }

  const plan = fs.readFileSync(path.join(OUT_DIR, 'project-plan.html'), 'utf8');
  if (!plan.includes('<table>') || !plan.includes('<th>')) {
    throw new Error('project-plan.html must render markdown tables as HTML tables');
  }

  const nested = fs.readFileSync(path.join(OUT_DIR, 'milestones/m6-acceptance.html'), 'utf8');
  if (!nested.includes('href="../assets/styles.css"') || !nested.includes('href="../index.html"')) {
    throw new Error('Nested milestone page must use ../ relative links for assets and home');
  }
}

function buildSearchScript() {
  return String.raw`(() => {
  const input = document.querySelector('[data-doc-search]');
  const resultsElement = document.querySelector('[data-search-results]');
  const statusElement = document.querySelector('[data-search-status]');
  if (!input || !resultsElement || !statusElement) return;

  const docsRoot = document.body?.dataset?.docsRoot || '';
  const mobileNavigation = document.querySelector('.nav-panel');
  if (mobileNavigation && window.matchMedia('(max-width: 720px)').matches) {
    mobileNavigation.removeAttribute('open');
  }

  let indexPromise;

  const normalize = (value) => String(value).toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ').trim();
  const countOccurrences = (text, token) => text.split(token).length - 1;
  const resolveUrl = (url) => docsRoot + url;

  const loadIndex = () => {
    if (!indexPromise) {
      indexPromise = fetch(resolveUrl('assets/search-index.json')).then((response) => {
        if (!response.ok) throw new Error('search index unavailable');
        return response.json();
      });
    }
    return indexPromise;
  };

  const clearResults = () => {
    resultsElement.replaceChildren();
    resultsElement.hidden = true;
    statusElement.textContent = '';
  };

  const buildSnippet = (content, tokens) => {
    const normalizedContent = normalize(content);
    const positions = tokens
      .map((token) => normalizedContent.indexOf(token))
      .filter((position) => position >= 0);
    const firstMatch = positions.length ? Math.min(...positions) : 0;
    const start = Math.max(0, firstMatch - 48);
    const end = Math.min(content.length, start + 150);
    return (start > 0 ? '…' : '') + content.slice(start, end).trim() + (end < content.length ? '…' : '');
  };

  const renderResults = (items, tokens) => {
    resultsElement.replaceChildren();

    for (const item of items) {
      const listItem = document.createElement('li');
      const link = document.createElement('a');
      const title = document.createElement('strong');
      const group = document.createElement('span');
      const snippet = document.createElement('span');

      link.href = resolveUrl(item.url);
      title.textContent = item.title;
      group.textContent = item.group;
      snippet.textContent = buildSnippet(item.content, tokens);

      link.append(title, group, snippet);
      listItem.append(link);
      resultsElement.append(listItem);
    }

    resultsElement.hidden = items.length === 0;
  };

  const search = async () => {
    const query = normalize(input.value);
    if (!query) {
      clearResults();
      return;
    }

    statusElement.textContent = '正在搜索…';
    const tokens = query.split(' ').filter(Boolean);

    try {
      const index = await loadIndex();
      const matches = index
        .map((item) => {
          const title = normalize(item.title);
          const group = normalize(item.group);
          const content = normalize(item.content);
          const haystack = title + ' ' + group + ' ' + content;
          if (!tokens.every((token) => haystack.includes(token))) return null;

          let score = 0;
          for (const token of tokens) {
            if (title.includes(token)) score += 12;
            if (group.includes(token)) score += 4;
            score += Math.min(6, countOccurrences(content, token));
          }
          return { ...item, score };
        })
        .filter(Boolean)
        .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, 'zh-CN'))
        .slice(0, 20);

      renderResults(matches, tokens);
      statusElement.textContent = matches.length ? '找到 ' + matches.length + ' 条结果' : '没有找到匹配内容，请换一个关键词。';
    } catch {
      resultsElement.hidden = true;
      statusElement.textContent = '搜索暂不可用，请使用文档菜单。';
    }
  };

  input.addEventListener('input', search);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.value = '';
      clearResults();
      input.blur();
    }
  });

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
    if (event.key === '/' && !editing) {
      event.preventDefault();
      input.focus();
    }
  });
})();
`;
}

function buildSitemap() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map((page) => `  <url><loc>${escapeHtml(new URL(page.output, SITE_URL).href)}</loc></url>`).join('\n')}
</urlset>
`;
}

function buildStyles() {
  return `:root {
  color-scheme: light;
  --bg: #fafafa;
  --surface: #ffffff;
  --panel: #f3f4f6;
  --text: #111827;
  --muted: #6b7280;
  --line: #e5e7eb;
  --line-strong: #d1d5db;
  --accent: #0f766e;
  --accent-soft: #ccfbf1;
  --focus: #2563eb;
  --code-bg: #111827;
  --code-text: #f9fafb;
  --shadow: 0 12px 32px rgba(17, 24, 39, 0.08);
  --radius: 12px;
}

* { box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  margin: 0;
  background:
    radial-gradient(1200px 400px at 10% -10%, #ecfeff 0%, transparent 55%),
    radial-gradient(900px 320px at 90% 0%, #f0fdf4 0%, transparent 50%),
    var(--bg);
  color: var(--text);
  font: 16px/1.7 "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", ui-sans-serif, system-ui, sans-serif;
  text-rendering: optimizeLegibility;
}

a {
  color: var(--accent);
  text-underline-offset: 3px;
}

.skip-link {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 100;
  transform: translateY(-160%);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--text);
  color: #fff;
}

.skip-link:focus { transform: translateY(0); }

.site-header {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  backdrop-filter: blur(12px);
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
  padding: 14px 0;
}

.brand-block { min-width: 0; }

.brand {
  color: var(--text);
  font-size: 1.125rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  text-decoration: none;
}

.tagline {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 0.8125rem;
}

.header-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.header-quick a {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0 12px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
}

.header-quick a:hover {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--line));
  background: var(--accent-soft);
}

.page-shell {
  display: grid;
  grid-template-columns: 280px minmax(0, 820px);
  gap: 40px;
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
  padding: 32px 0 48px;
}

.sidebar {
  align-self: start;
  position: sticky;
  top: 84px;
  max-height: calc(100vh - 104px);
  overflow-y: auto;
  padding: 0 4px 16px 0;
}

.sidebar, .content { min-width: 0; }

.doc-search { position: relative; margin-bottom: 24px; }

.doc-search label {
  display: block;
  margin-bottom: 8px;
  color: var(--text);
  font-size: 0.8125rem;
  font-weight: 700;
}

.search-field { position: relative; }

.doc-search input {
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  padding: 10px 40px 10px 12px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
}

.search-hint {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 2px 6px;
  background: var(--panel);
  color: var(--muted);
  font: 11px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.doc-search input:focus-visible,
.side-nav a:focus-visible,
.search-results a:focus-visible,
.header-quick a:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--focus) 35%, transparent);
  outline-offset: 2px;
}

.search-status {
  min-height: 20px;
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 0.75rem;
}

.search-results {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  z-index: 30;
  max-height: min(440px, 70vh);
  overflow-y: auto;
  margin: 0;
  padding: 6px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow);
  list-style: none;
}

.search-results li + li { margin-top: 2px; }

.search-results a {
  display: grid;
  gap: 2px;
  border-radius: 8px;
  padding: 10px;
  color: inherit;
  text-decoration: none;
}

.search-results a:hover { background: var(--panel); }
.search-results strong { font-size: 0.875rem; }
.search-results span { color: var(--muted); font-size: 0.75rem; line-height: 1.45; }

.side-nav { display: grid; gap: 22px; }
.nav-panel > summary { display: none; }

.nav-group-title {
  margin: 0 0 8px;
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.nav-group-links { display: grid; gap: 2px; }

.side-nav a {
  display: block;
  border-radius: 8px;
  padding: 8px 10px;
  color: var(--muted);
  font-size: 0.875rem;
  line-height: 1.35;
  text-decoration: none;
}

.side-nav a:hover {
  color: var(--text);
  background: var(--surface);
}

.side-nav a[aria-current="page"] {
  background: var(--accent-soft);
  color: var(--text);
  font-weight: 650;
}

.content {
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 28px 32px 40px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.breadcrumb {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 0 0 18px;
  color: var(--muted);
  font-size: 0.8125rem;
}

.breadcrumb a {
  color: var(--muted);
  text-decoration: none;
}

.breadcrumb a:hover { color: var(--accent); }

h1, h2, h3, h4 { line-height: 1.25; color: var(--text); }

h1 {
  margin: 0 0 20px;
  font-size: clamp(1.75rem, 2.4vw, 2.25rem);
  font-weight: 750;
  letter-spacing: -0.03em;
}

h2 {
  margin: 40px 0 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
  font-size: 1.35rem;
  font-weight: 700;
}

h3 {
  margin: 28px 0 10px;
  font-size: 1.05rem;
  font-weight: 700;
}

h4 {
  margin: 22px 0 8px;
  font-size: 0.95rem;
  font-weight: 700;
}

p {
  margin: 0 0 16px;
  color: #374151;
}

ul, ol {
  margin: 0 0 18px;
  padding-left: 1.35rem;
  color: #374151;
}

li + li { margin-top: 6px; }

pre {
  overflow-x: auto;
  margin: 18px 0;
  padding: 16px 18px;
  border-radius: 10px;
  background: var(--code-bg);
  color: var(--code-text);
  font-size: 0.875rem;
  line-height: 1.6;
}

code {
  border-radius: 6px;
  padding: 0.12em 0.35em;
  background: var(--panel);
  color: var(--text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9em;
}

pre code {
  padding: 0;
  background: transparent;
  color: inherit;
}

blockquote {
  margin: 18px 0;
  padding: 10px 14px;
  border-left: 3px solid var(--accent);
  border-radius: 0 10px 10px 0;
  background: color-mix(in srgb, var(--accent-soft) 55%, var(--surface));
  color: #374151;
}

hr {
  border: 0;
  border-top: 1px solid var(--line);
  margin: 28px 0;
}

.table-wrap {
  overflow-x: auto;
  margin: 18px 0 24px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

th, td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}

th {
  background: var(--panel);
  color: var(--text);
  font-weight: 700;
}

tr:last-child td { border-bottom: 0; }

.content > *:first-child { margin-top: 0; }

.site-footer {
  border-top: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface) 80%, transparent);
}

.footer-inner {
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
  padding: 20px 0 36px;
  color: var(--muted);
  font-size: 0.8125rem;
}

.footer-inner p { margin: 0 0 8px; color: inherit; }
.footer-inner a { color: var(--muted); }
.footer-inner a:hover { color: var(--accent); }

@media (max-width: 900px) {
  .header-inner {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .page-shell {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
    padding-top: 20px;
  }

  .sidebar {
    position: static;
    max-height: none;
    overflow: visible;
    padding: 0 0 8px;
  }

  .content {
    padding: 22px 18px 32px;
  }
}

@media (max-width: 720px) {
  .header-inner,
  .page-shell,
  .footer-inner {
    width: calc(100% - 24px);
  }

  .nav-panel > summary {
    display: flex;
    min-height: 44px;
    align-items: center;
    justify-content: space-between;
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    padding: 10px 12px;
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    font-weight: 700;
    list-style: none;
  }

  .nav-panel > summary::-webkit-details-marker { display: none; }
  .nav-panel > summary::after {
    content: '展开';
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 500;
  }
  .nav-panel[open] > summary::after { content: '收起'; }
  .nav-panel[open] .side-nav { margin-top: 16px; }

  .side-nav {
    grid-template-columns: 1fr;
    gap: 18px;
  }

  .side-nav a {
    min-height: 44px;
    padding: 10px;
  }

  h1 { font-size: 1.65rem; }
}
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
