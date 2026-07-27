import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_ROOTS = [
  process.env.PORTFOLIO_KB_ROOT,
  'D:/a/knowledge',
  'D:\\a\\knowledge'
].filter(Boolean);

function readJson(file, fallback = null) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function resolvePortfolioKbRoot(explicitRoot = null) {
  const candidates = [explicitRoot, ...DEFAULT_ROOTS].filter(Boolean);
  for (const root of candidates) {
    const normalized = path.resolve(root);
    if (fs.existsSync(path.join(normalized, 'index', 'search.json'))
      || fs.existsSync(path.join(normalized, 'catalog.json'))) {
      return normalized;
    }
  }
  return null;
}

function inferProjectKey(cwd = process.cwd()) {
  const base = path.basename(path.resolve(cwd)).toLowerCase();
  if (!base || base === 'a' || base === 'knowledge') return null;
  return base;
}

function scoreItem(item, needle, project) {
  let score = 0;
  const text = String(item.text || [item.title, item.summary, ...(item.keywords || [])].join(' ')).toLowerCase();
  if (needle) {
    for (const token of needle.split(/\s+/).filter(Boolean)) {
      if (text.includes(token)) score += 3;
    }
    if (text.includes(needle)) score += 5;
  }
  if (project && item.project_key === project) score += 8;
  if (item.status === 'active') score += 4;
  if (item.type === 'capability') score += 3;
  if (item.type === 'standard') score += 2;
  if (item.type === 'pattern') score += 1;
  return score;
}

/**
 * Attach portfolio knowledge_refs for a ralph/dispatch task.
 * Reads D:/a/knowledge indexes; never treats chat as authority.
 */
export function attachKnowledgeRefs({
  q = '',
  project = null,
  goal = '',
  title = '',
  cwd = process.cwd(),
  limit = 12,
  status = 'active',
  portfolioRoot = null
} = {}) {
  const root = resolvePortfolioKbRoot(portfolioRoot);
  if (!root) {
    return {
      status: 'unavailable',
      portfolio_kb_root: null,
      knowledge_refs: [],
      knowledge_summary: [],
      knowledge_items: [],
      reason: 'portfolio knowledge root not found (set PORTFOLIO_KB_ROOT or create D:/a/knowledge)'
    };
  }

  const search = readJson(path.join(root, 'index', 'search.json'), { items: [] });
  const projectKey = project || inferProjectKey(cwd);
  const needle = String(q || [title, goal].filter(Boolean).join(' ')).toLowerCase().trim();
  let items = Array.isArray(search.items) ? search.items.slice() : [];
  if (status) items = items.filter((item) => item.status === status);
  items = items
    .map((item) => ({ item, score: scoreItem(item, needle, projectKey) }))
    .filter((row) => row.score > 0 || !needle)
    .sort((a, b) => b.score - a.score || String(a.item.id).localeCompare(String(b.item.id)))
    .slice(0, Math.max(1, Number(limit) || 12))
    .map((row) => row.item);

  if (!items.length && projectKey) {
    items = (search.items || [])
      .filter((item) => item.status === status && item.project_key === projectKey)
      .slice(0, Math.max(1, Number(limit) || 12));
  }

  const knowledge_refs = items.map((item) => item.id);
  const knowledge_summary = items.map((item) => `${item.id}: ${item.title}`);
  return {
    status: knowledge_refs.length ? 'ready' : 'empty',
    portfolio_kb_root: root.replaceAll('\\', '/'),
    project_key: projectKey,
    query: needle,
    knowledge_refs,
    knowledge_summary,
    knowledge_items: items.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      summary: item.summary,
      project_key: item.project_key,
      domain: item.domain
    })),
    attach_template: {
      knowledge_refs,
      knowledge_summary
    }
  };
}

export function formatKnowledgeRefsMarkdown(pkg) {
  const lines = ['## knowledge_refs'];
  if (!pkg?.knowledge_refs?.length) {
    lines.push('- (none)');
    return lines.join('\n');
  }
  for (const id of pkg.knowledge_refs) lines.push(`- ${id}`);
  lines.push('', '## knowledge summary');
  for (const row of pkg.knowledge_summary || []) lines.push(`- ${row}`);
  return lines.join('\n');
}
