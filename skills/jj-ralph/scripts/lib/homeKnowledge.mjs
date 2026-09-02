import fs from 'node:fs';
import path from 'node:path';
import { resolveKnowledgeRoot } from './namingConfig.mjs';
import { familyOfProjectKey, isGroupedFamily, resolveProjectKeyFromCwd } from './projectMap.mjs';

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function slugPart(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function candidateId(projectKey, title, runId) {
  const left = slugPart(projectKey) || 'project';
  const mid = slugPart(title) || 'note';
  const right = slugPart(runId).replace(/^ralph-/, '') || String(Date.now());
  return 'cap-' + left + '-' + mid + '-' + right;
}

/**
 * Ingest a ralph knowledge-contribution.json into the home knowledge search index.
 * User approval is the gate: items are stored active so the next same-family
 * retrieve can use them. Never called from finalize unless hook is on.
 */
export function ingestContribution(contribution, {
  cwd = process.cwd(),
  knowledgeRoot = null,
  projectKey = null,
  status = 'active'
} = {}) {
  const root = resolveKnowledgeRoot({ explicit: knowledgeRoot }) || knowledgeRoot;
  if (!root) {
    return { ok: false, status: 'skipped', reason: 'knowledge_root not found' };
  }
  const searchPath = path.join(root, 'index', 'search.json');
  fs.mkdirSync(path.join(root, 'index'), { recursive: true });
  const search = readJson(searchPath, { items: [] });
  if (!Array.isArray(search.items)) search.items = [];

  const key = projectKey
    || contribution?.source?.project_key
    || resolveProjectKeyFromCwd(contribution?.source?.repo_root || cwd);
  if (!key) {
    return { ok: false, status: 'skipped', reason: 'project_key missing; refuse cross-project ingest' };
  }
  const family = familyOfProjectKey(key);
  const wantedStatus = String(status || 'active').trim().toLowerCase() || 'active';
  const runId = contribution?.run_id || '';
  const incoming = [];

  const cap = contribution?.capability_hint;
  if (cap?.title) {
    incoming.push({
      type: 'capability',
      title: cap.title,
      summary: contribution?.intent?.goal || cap.title,
      keywords: cap.keywords || []
    });
  }
  for (const cand of contribution?.candidates || []) {
    if (!cand || cand.durable === false) continue;
    incoming.push({
      type: cand.type || 'lesson',
      title: cand.title || cap?.title || runId,
      summary: cand.summary || cand.title || '',
      keywords: cand.keywords || []
    });
  }

  let written = 0;
  let skipped = 0;
  const ids = [];
  for (const item of incoming) {
    const title = String(item.title || '').trim();
    const summary = String(item.summary || '').trim();
    if (!title) {
      skipped += 1;
      continue;
    }
    const dup = search.items.find((row) => (
      String(row.project_key || '') === key
      && String(row.title || '') === title
      && String(row.summary || '') === summary
    ));
    if (dup) {
      skipped += 1;
      ids.push(dup.id);
      continue;
    }
    const id = candidateId(key, title, runId);
    const keywords = [...new Set([key, title, ...(item.keywords || [])].filter(Boolean))];
    const row = {
      id,
      type: item.type || 'capability',
      status: wantedStatus,
      scope: 'project',
      project_key: key,
      family: isGroupedFamily(family) ? family : '',
      title,
      summary,
      keywords,
      text: [title, summary, key, family, runId].filter(Boolean).join(' ')
    };
    search.items.push(row);
    ids.push(id);
    written += 1;
  }

  search.updated_at = new Date().toISOString();
  writeJson(searchPath, search);
  const catalogPath = path.join(root, 'catalog.json');
  const catalog = readJson(catalogPath, {});
  catalog.updated_at = search.updated_at;
  catalog.counts = {
    items: search.items.length,
    active: search.items.filter((i) => i.status === 'active').length,
    candidate: search.items.filter((i) => i.status === 'candidate').length
  };
  writeJson(catalogPath, catalog);

  return {
    ok: true,
    status: written || skipped ? 'ok' : 'empty',
    knowledge_root: root.replaceAll('\\', '/'),
    project_key: key,
    family: isGroupedFamily(family) ? family : '',
    written,
    skipped,
    ids
  };
}
