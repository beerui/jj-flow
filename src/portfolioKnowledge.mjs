import fs from 'node:fs';
import path from 'node:path';
import { resolveDispatchControlRoot, resolveKnowledgeRoot } from './namingConfig.mjs';
import {
  INJECT_SOFT_CAP,
  MIN_RELATED_SCORE,
  knowledgeItemToRow,
  rankIndexHits
} from './memoryRetrieve.mjs';
import {
  familyOfProjectKey,
  familyProjectKeys,
  isGroupedFamily,
  resolveProjectKeyFromCwd
} from './projectMap.mjs';

function readJson(file, fallback = null) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function looksLikeKbRoot(root) {
  return fs.existsSync(path.join(root, 'index', 'search.json'))
    || fs.existsSync(path.join(root, 'catalog.json'));
}

/**
 * Resolve KB root from config (naming.json / env / ~/.jj-flow/knowledge).
 */
export function resolvePortfolioKbRoot(explicitRoot = null) {
  const configured = resolveKnowledgeRoot({ explicit: explicitRoot });
  const control = resolveDispatchControlRoot();
  const candidates = [
    explicitRoot,
    configured,
    process.env.PORTFOLIO_KB_ROOT,
    control ? path.join(control, 'knowledge') : null
  ].filter(Boolean);

  const seen = new Set();
  for (const root of candidates) {
    const normalized = path.resolve(root);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    if (looksLikeKbRoot(normalized)) return normalized;
  }
  return null;
}

function inferProjectKey(cwd = process.cwd()) {
  return resolveProjectKeyFromCwd(cwd);
}

function emptyAttach(extra = {}) {
  return {
    status: extra.status || 'empty',
    portfolio_kb_root: extra.portfolio_kb_root || null,
    project_key: extra.project_key || null,
    query: extra.query || '',
    knowledge_refs: [],
    knowledge_summary: [],
    knowledge_items: [],
    reason: extra.reason || '',
    match: extra.match || {
      min_related: MIN_RELATED_SCORE,
      inject_soft_cap: INJECT_SOFT_CAP,
      ranked: 0
    },
    attach_template: { knowledge_refs: [], knowledge_summary: [] }
  };
}

/**
 * Attach portfolio knowledge_refs for a ralph/dispatch task.
 * Ranking is jj-multica retrieve: CJK bigram, strong relatedness floor,
 * same-project or same-family confirmed only. Empty is a valid result — never dump N
 * same-project rows to fill a quota.
 */
export function attachKnowledgeRefs({
  q = '',
  project = null,
  goal = '',
  title = '',
  cwd = process.cwd(),
  limit = INJECT_SOFT_CAP,
  status = 'active',
  portfolioRoot = null,
  family = null
} = {}) {
  const root = resolvePortfolioKbRoot(portfolioRoot);
  if (!root) {
    return emptyAttach({
      status: 'unavailable',
      reason: 'knowledge root not found (install-skill / jj home init creates ~/.jj-flow/knowledge; or set dispatch.knowledge_root / PORTFOLIO_KB_ROOT)'
    });
  }

  const rootNorm = root.replaceAll('\\', '/');
  const search = readJson(path.join(root, 'index', 'search.json'), { items: [] });
  const projectKey = project || inferProjectKey(cwd);
  const familyId = family || familyOfProjectKey(projectKey);
  const familyKeys = isGroupedFamily(familyId) ? familyProjectKeys(familyId) : [];
  const needle = String(q || [title, goal].filter(Boolean).join('\n')).trim();
  const cap = Math.max(1, Number(limit) || INJECT_SOFT_CAP);
  const matchMeta = {
    min_related: MIN_RELATED_SCORE,
    inject_soft_cap: cap,
    ranked: 0,
    family: isGroupedFamily(familyId) ? familyId : '',
    family_projects: familyKeys
  };

  if (!projectKey) {
    return emptyAttach({
      status: 'empty',
      portfolio_kb_root: rootNorm,
      query: needle,
      match: matchMeta,
      reason: 'project_key missing; refuse to inject a cross-project dump'
    });
  }

  const wantedStatus = String(status || 'active').trim().toLowerCase();
  const allowStatus = wantedStatus === 'active' || wantedStatus === 'confirmed'
    ? new Set(['active', 'confirmed', ''])
    : new Set([wantedStatus, '']);
  const rows = [];
  for (const item of Array.isArray(search.items) ? search.items : []) {
    if (!item) continue;
    const itemStatus = String(item.status || '').trim().toLowerCase();
    if (!allowStatus.has(itemStatus)) continue;
    const row = knowledgeItemToRow(item);
    if (row) rows.push(row);
  }

  const hits = rankIndexHits({
    text: needle,
    projectId: projectKey,
    familyId: isGroupedFamily(familyId) ? familyId : '',
    familyProjectIds: familyKeys
  }, rows);
  matchMeta.ranked = hits.length;
  const sliced = hits.slice(0, cap);
  if (!sliced.length) {
    return emptyAttach({
      status: 'empty',
      portfolio_kb_root: rootNorm,
      project_key: projectKey,
      query: needle,
      match: matchMeta,
      reason: needle
        ? 'no confirmed same-project/same-family short passed MinRelatedScore'
        : 'empty query; lexical retrieve injects nothing'
    });
  }

  const knowledge_refs = sliced.map((hit) => hit.id);
  const knowledge_summary = sliced.map((hit) => `${hit.id}: ${hit.row.title}`);
  return {
    status: 'ready',
    portfolio_kb_root: rootNorm,
    project_key: projectKey,
    query: needle,
    knowledge_refs,
    knowledge_summary,
    knowledge_items: sliced.map((hit) => {
      const item = hit.row.item || {};
      return {
        id: hit.id,
        type: item.type,
        title: hit.row.title,
        summary: hit.row.body,
        project_key: hit.row.sourceProjectId,
        domain: item.domain,
        related_strong: hit.strong,
        related_total: hit.rel
      };
    }),
    match: matchMeta,
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
