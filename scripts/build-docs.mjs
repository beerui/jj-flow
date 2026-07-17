#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const CHECK_MODE = process.argv.includes('--check');
const CHECK_OUT_DIR = `docs-site-check-${process.pid}`;
const OUT_DIR = path.join(ROOT, CHECK_MODE ? path.join('.tmp', CHECK_OUT_DIR) : 'site');
const SITE_URL = 'https://beerui.github.io/jj-flow/';

const PAGES = [
  { title: '首页', source: 'docs/index.md', output: 'index.html' },
  { title: '安装', source: 'docs/installation.md', output: 'installation.html' },
  { title: '使用说明', source: 'docs/usage.md', output: 'usage.html' },
  { title: '命令参考', source: 'docs/commands.md', output: 'commands.html' },
  { title: '术语与缩写', source: 'docs/glossary.md', output: 'glossary.html' },
  { title: '架构', source: 'docs/architecture.md', output: 'architecture.html' },
  { title: '项目规划', source: 'docs/project-plan.md', output: 'project-plan.html' },
  { title: '维护说明', source: 'docs/maintenance.md', output: 'maintenance.html' },
  { title: 'GitHub Pages 部署', source: 'docs/deployment.md', output: 'deployment.html' },
  { title: 'ADR 0001', source: 'docs/adr/0001-thin-maestro-adapter.md', output: 'adr-0001-thin-maestro-adapter.html' },
  { title: 'ADR 0002', source: 'docs/adr/0002-project-family-control-plane.md', output: 'adr-0002-project-family-control-plane.html' }
];

fs.mkdirSync(path.join(OUT_DIR, 'assets'), { recursive: true });

for (const page of PAGES) {
  const sourcePath = path.join(ROOT, page.source);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing documentation source: ${page.source}`);
  }

  const markdown = fs.readFileSync(sourcePath, 'utf8');
  const html = renderPage(page, renderMarkdown(markdown));
  fs.writeFileSync(path.join(OUT_DIR, page.output), html);
}

fs.writeFileSync(path.join(OUT_DIR, 'assets', 'styles.css'), buildStyles());
fs.writeFileSync(path.join(OUT_DIR, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), buildSitemap());

if (CHECK_MODE) {
  const requiredOutputs = [
    ...PAGES.map((page) => page.output),
    'assets/styles.css',
    '.nojekyll',
    'sitemap.xml'
  ];
  const missing = requiredOutputs.filter((file) => !fs.existsSync(path.join(OUT_DIR, file)));
  if (missing.length) {
    throw new Error(`Docs build missing outputs:\n${missing.map((file) => `- ${file}`).join('\n')}`);
  }
}

console.log(`docs site built: ${path.relative(ROOT, OUT_DIR)}`);

function renderPage(page, body) {
  const nav = PAGES.map((item) => {
    const active = item.output === page.output ? ' aria-current="page"' : '';
    return `<a href="${item.output}"${active}>${escapeHtml(item.title)}</a>`;
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
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="index.html">jj-flow</a>
      <p>Maestro 上层的交付编排协议</p>
    </div>
  </header>
  <main class="page-shell">
    <aside class="sidebar">
      <nav class="side-nav" aria-label="文档导航">
${nav}
      </nav>
    </aside>
    <article class="content">
${body}
    </article>
  </main>
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
  --code-bg: #202123;
  --code-text: #f7f7f8;
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

.site-header {
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(16px);
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
  grid-template-columns: 220px minmax(0, 760px);
  gap: 64px;
  width: min(1180px, calc(100% - 48px));
  margin: 0 auto;
  padding: 48px 0 96px;
}

.sidebar {
  align-self: start;
  position: sticky;
  top: 88px;
}

.side-nav {
  display: grid;
  gap: 2px;
}

.side-nav a {
  display: block;
  border-left: 2px solid transparent;
  padding: 7px 0 7px 14px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.35;
  text-decoration: none;
}

.side-nav a:hover {
  color: var(--text);
}

.side-nav a[aria-current="page"] {
  border-left-color: var(--accent);
  color: var(--text);
  font-weight: 600;
}

h1, h2, h3, h4 {
  line-height: 1.25;
  letter-spacing: 0;
}

h1 {
  margin: 0 0 28px;
  font-size: clamp(36px, 6vw, 64px);
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
    grid-template-columns: 1fr;
    width: calc(100% - 32px);
    gap: 28px;
    padding: 28px 0 64px;
  }

  .sidebar {
    position: static;
    padding-bottom: 18px;
    border-bottom: 1px solid var(--line);
  }

  .side-nav {
    display: flex;
    gap: 14px;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .side-nav a {
    flex: 0 0 auto;
    border-left: 0;
    border-bottom: 2px solid transparent;
    padding: 0 0 8px;
    white-space: nowrap;
  }

  .side-nav a[aria-current="page"] {
    border-bottom-color: var(--accent);
  }

  h1 {
    font-size: 40px;
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
