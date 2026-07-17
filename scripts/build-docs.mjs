#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const CHECK_MODE = process.argv.includes('--check');
const CHECK_OUT_DIR = `docs-site-check-${process.pid}`;
const OUT_DIR = path.join(ROOT, CHECK_MODE ? path.join('.tmp', CHECK_OUT_DIR) : 'site');
const SITE_URL = 'https://beerui.github.io/jj-flow/';

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
    title: '选择与交付',
    pages: [
      { title: '$jj 兼容入口', source: 'docs/commands/jj.md', output: 'command-jj.html' },
      { title: '$jj-delivery 完整交付', source: 'docs/commands/jj-delivery.md', output: 'command-jj-delivery.html' }
    ]
  },
  {
    title: '协作与迁移',
    pages: [
      { title: '$jj-same 同源迁移', source: 'docs/commands/jj-same.md', output: 'command-jj-same.html' },
      { title: '$jj-dispatch 多项目调度', source: 'docs/commands/jj-dispatch.md', output: 'command-jj-dispatch.html' }
    ]
  },
  {
    title: '项目维护',
    pages: [
      { title: '$jj-validate 项目自检', source: 'docs/commands/jj-validate.md', output: 'command-jj-validate.html' },
      { title: '$jj-evolve 项目演进', source: 'docs/commands/jj-evolve.md', output: 'command-jj-evolve.html' },
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
      { title: '项目规划', source: 'docs/project-plan.md', output: 'project-plan.html' },
      { title: 'ADR 0001', source: 'docs/adr/0001-thin-maestro-adapter.md', output: 'adr-0001-thin-maestro-adapter.html' },
      { title: 'ADR 0002', source: 'docs/adr/0002-project-family-control-plane.md', output: 'adr-0002-project-family-control-plane.html' }
    ]
  }
];

const PAGES = NAV_GROUPS.flatMap((group) => group.pages.map((page) => ({ ...page, group: group.title })));

fs.mkdirSync(path.join(OUT_DIR, 'assets'), { recursive: true });

const searchIndex = [];

for (const page of PAGES) {
  const sourcePath = path.join(ROOT, page.source);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing documentation source: ${page.source}`);
  }

  const markdown = fs.readFileSync(sourcePath, 'utf8');
  const html = renderPage(page, renderMarkdown(markdown));
  fs.writeFileSync(path.join(OUT_DIR, page.output), html);
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

  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(OUT_DIR, page.output), 'utf8');
    if (!html.includes('data-doc-search') || !html.includes('assets/search.js')) {
      throw new Error(`Docs page is missing search UI: ${page.output}`);
    }
  }
}

console.log(`docs site built: ${path.relative(ROOT, OUT_DIR)}`);

function renderPage(page, body) {
  const nav = NAV_GROUPS.map((group) => {
    const links = group.pages.map((item) => {
      const active = item.output === page.output ? ' aria-current="page"' : '';
      return `<a href="${item.output}"${active}>${escapeHtml(item.title)}</a>`;
    }).join('\n');

    return `<section class="nav-group">
        <h2 class="nav-group-title">${escapeHtml(group.title)}</h2>
        <div class="nav-group-links">
${links}
        </div>
      </section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.title)} - jj-flow</title>
  <link rel="canonical" href="${escapeAttribute(new URL(page.output, SITE_URL).href)}">
  <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
  <a class="skip-link" href="#main-content">跳到正文</a>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="index.html">jj-flow</a>
      <p>Maestro 上层的交付编排协议</p>
    </div>
  </header>
  <main class="page-shell">
    <aside class="sidebar">
      <div class="doc-search" role="search">
        <label for="doc-search">搜索文档</label>
        <input id="doc-search" type="search" placeholder="搜索命令、场景或关键词…" autocomplete="off" data-doc-search>
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
${body}
    </article>
  </main>
  <script src="assets/search.js" defer></script>
</body>
</html>
`;
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const output = [];
  let paragraph = [];
  let listType = null;
  let inCode = false;

  for (const line of lines) {
    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      flushParagraph();
      closeList();
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
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    const unordered = line.match(/^-\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      openList('ul');
      output.push(`<li>${renderInline(unordered[1])}</li>`);
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      openList('ol');
      output.push(`<li>${renderInline(ordered[1])}</li>`);
      continue;
    }

    const quote = line.match(/^>\s+(.+)$/);
    if (quote) {
      flushParagraph();
      closeList();
      output.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();
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
}

function renderInline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
      return `<a href="${escapeAttribute(href)}">${label}</a>`;
    });
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
    .replace(/[`*_>#]/g, ' ')
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

function buildSearchScript() {
  return String.raw`(() => {
  const input = document.querySelector('[data-doc-search]');
  const resultsElement = document.querySelector('[data-search-results]');
  const statusElement = document.querySelector('[data-search-status]');
  if (!input || !resultsElement || !statusElement) return;

  const mobileNavigation = document.querySelector('.nav-panel');
  if (mobileNavigation && window.matchMedia('(max-width: 720px)').matches) {
    mobileNavigation.removeAttribute('open');
  }

  let indexPromise;

  const normalize = (value) => String(value).toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ').trim();
  const countOccurrences = (text, token) => text.split(token).length - 1;

  const loadIndex = () => {
    if (!indexPromise) {
      indexPromise = fetch('assets/search-index.json').then((response) => {
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

      link.href = item.url;
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
  --bg: #ffffff;
  --surface: #f7f7f8;
  --text: #0d0d0d;
  --muted: #6e6e80;
  --line: #ececf1;
  --line-strong: #d9d9e3;
  --accent: #10a37f;
  --accent-strong: #087f63;
  --focus: #0b6bcb;
  --code-bg: #202123;
  --code-text: #f7f7f8;
  --shadow: 0 16px 40px rgba(13, 13, 13, 0.12);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 15px/1.7 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  text-rendering: optimizeLegibility;
}

a {
  color: var(--text);
  text-underline-offset: 3px;
}

.skip-link {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 100;
  transform: translateY(-160%);
  border-radius: 6px;
  padding: 9px 12px;
  background: var(--text);
  color: var(--bg);
}

.skip-link:focus {
  transform: translateY(0);
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid var(--line);
  background: var(--bg);
}

.header-inner {
  display: flex;
  align-items: baseline;
  gap: 16px;
  width: min(1180px, calc(100% - 48px));
  margin: 0 auto;
  padding: 18px 0;
}

.brand {
  color: var(--text);
  font-size: 18px;
  font-weight: 650;
  letter-spacing: 0;
  text-decoration: none;
}

.site-header p {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.page-shell {
  display: grid;
  grid-template-columns: 272px minmax(0, 800px);
  gap: 48px;
  width: min(1180px, calc(100% - 48px));
  margin: 0 auto;
  padding: 48px 0 96px;
}

.sidebar {
  align-self: start;
  position: sticky;
  top: 88px;
  max-height: calc(100vh - 112px);
  overflow-y: auto;
  padding: 0 10px 24px 0;
}

.sidebar,
.content {
  min-width: 0;
}

.doc-search {
  position: relative;
  margin-bottom: 28px;
}

.doc-search label {
  display: block;
  margin-bottom: 7px;
  color: var(--text);
  font-size: 13px;
  font-weight: 650;
}

.doc-search input {
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  line-height: 1.35;
}

.doc-search input::placeholder {
  color: var(--muted);
}

.doc-search input:focus-visible,
.side-nav a:focus-visible,
.search-results a:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--focus) 36%, transparent);
  outline-offset: 2px;
}

.search-status {
  min-height: 20px;
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.search-results {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  left: 0;
  z-index: 20;
  max-height: min(440px, 70vh);
  overflow-y: auto;
  margin: 0;
  padding: 6px;
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  background: var(--bg);
  box-shadow: var(--shadow);
  list-style: none;
}

.search-results li + li {
  margin-top: 2px;
}

.search-results a {
  display: grid;
  gap: 2px;
  border-radius: 6px;
  padding: 10px;
  text-decoration: none;
}

.search-results a:hover {
  background: var(--surface);
}

.search-results strong {
  font-size: 14px;
  line-height: 1.35;
}

.search-results span {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
}

.side-nav {
  display: grid;
  gap: 26px;
}

.nav-panel > summary {
  display: none;
}

.nav-group-title {
  margin: 0 0 8px;
  padding: 0;
  border: 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.nav-group-links {
  display: grid;
  gap: 2px;
}

.side-nav a {
  display: block;
  border-radius: 6px;
  padding: 8px 10px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.35;
  text-decoration: none;
}

.side-nav a:hover {
  color: var(--text);
  background: var(--surface);
}

.side-nav a[aria-current="page"] {
  background: color-mix(in srgb, var(--accent) 12%, var(--bg));
  color: var(--text);
  font-weight: 600;
}

h1, h2, h3, h4 {
  line-height: 1.25;
  letter-spacing: 0;
}

h1 {
  margin: 0 0 28px;
  font-size: 42px;
  font-weight: 650;
  line-height: 1.05;
}

h2 {
  margin: 48px 0 14px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
  font-size: 24px;
  font-weight: 620;
}

h3 {
  margin: 32px 0 10px;
  font-size: 18px;
  font-weight: 620;
}

h4 {
  margin: 28px 0 8px;
  font-size: 15px;
  font-weight: 650;
}

p {
  margin: 0 0 18px;
  color: #353740;
}

ul, ol {
  margin: 0 0 22px;
  padding-left: 22px;
  color: #353740;
}

li + li {
  margin-top: 6px;
}

pre {
  overflow-x: auto;
  margin: 22px 0;
  padding: 18px;
  border-radius: 6px;
  background: var(--code-bg);
  color: var(--code-text);
  font-size: 14px;
  line-height: 1.6;
}

code {
  border-radius: 4px;
  padding: 2px 4px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.93em;
}

pre code {
  padding: 0;
  background: transparent;
  color: inherit;
}

blockquote {
  margin: 24px 0;
  padding: 2px 0 2px 18px;
  border-left: 2px solid var(--line-strong);
  background: transparent;
  color: var(--muted);
}

.content > *:first-child {
  margin-top: 0;
}

@media (max-width: 720px) {
  .header-inner {
    width: calc(100% - 32px);
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
    padding: 14px 0;
  }

  .page-shell {
    grid-template-columns: minmax(0, 1fr);
    width: calc(100% - 32px);
    gap: 28px;
    padding: 28px 0 64px;
  }

  .sidebar {
    position: static;
    max-height: none;
    overflow: visible;
    padding: 0 0 24px;
    padding-bottom: 18px;
    border-bottom: 1px solid var(--line);
  }

  .side-nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px 16px;
  }

  .nav-panel > summary {
    display: flex;
    min-height: 44px;
    align-items: center;
    justify-content: space-between;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    padding: 10px 12px;
    color: var(--text);
    cursor: pointer;
    font-weight: 650;
    list-style: none;
  }

  .nav-panel > summary::-webkit-details-marker {
    display: none;
  }

  .nav-panel > summary::after {
    content: '展开';
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
  }

  .nav-panel[open] > summary::after {
    content: '收起';
  }

  .nav-panel[open] .side-nav {
    margin-top: 22px;
  }

  .side-nav a {
    min-height: 44px;
    padding: 10px;
  }

  h1 {
    font-size: 36px;
  }
}

@media (max-width: 480px) {
  .side-nav {
    grid-template-columns: 1fr;
  }
}
`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
