/**
 * User-level hot memory layer (P0 of ralph-plans-workspace).
 *
 * One append-only markdown file per project under ~/.jj-flow/memory/<slug>.md:
 *   - [ ] 2026-09-02 · task-enter-form-dynamic · 外部接口 path 未确认前不落码（→ F-002） @ .workflow/ralph/RALPH-x/findings.md#F-002
 *   - [x] … (confirmed by `jj ralph knowledge-confirm`)
 *
 * Writes happen at archive (promote findings `## 可复用结论`); reads/injection at
 * init / resume / dispatch via memoryRetrieve lexical ranking (confirmed first).
 * Storage may grow unbounded; every injection path is capped (INJECT_SOFT_CAP).
 */
import fs from 'node:fs';
import path from 'node:path';

import { INJECT_SOFT_CAP, indexTokens, rankIndexHits } from './memoryRetrieve.mjs';
import { normalizeCmp, similarText } from './memoryExtract.mjs';
import { defaultJjFlowHome } from './homeLayout.mjs';

export const HOT_MEMORY_DIRNAME = 'memory';
export const HOT_MEMORY_MAX_ENTRIES = 200;
export const FINDINGS_RULES_HEADING = '## 可复用结论';

const ENTRY_RE = /^-\s+\[([ xX])\]\s+(\d{4}-\d{2}-\d{2})\s+·\s+(.+?)\s+·\s+(.+)$/;
const BACKREF_RE = /\s@\s(\S+)$/;

/** Filename-safe project key; alias table is not filtered for Windows-invalid chars, so slug here. */
export function slugProjectKey(projectKey) {
  const slug = String(projectKey || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'unknown-project';
}

export function hotMemoryDir(home = null) {
  return path.join(home ? path.resolve(home) : defaultJjFlowHome(), HOT_MEMORY_DIRNAME);
}

export function hotMemoryFilePath(projectKey, { home = null } = {}) {
  return path.join(hotMemoryDir(home), slugProjectKey(projectKey) + '.md');
}

/** Parse one memory file into entries; missing file → empty list (not an error). */
export function parseHotMemoryFile(text) {
  const entries = [];
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const m = rawLine.match(ENTRY_RE);
    if (!m) continue;
    let rule = m[4].trim();
    let backref = '';
    const back = rule.match(BACKREF_RE);
    if (back) {
      backref = back[1];
      rule = rule.slice(0, back.index).trim();
    }
    entries.push({
      confirmed: m[1].toLowerCase() === 'x',
      date: m[2],
      task_key: m[3].trim(),
      rule,
      backref,
      line: rawLine
    });
  }
  return entries;
}

function serializeEntry(entry) {
  const flag = entry.confirmed ? 'x' : ' ';
  const backref = entry.backref ? ' @ ' + entry.backref : '';
  return `- [${flag}] ${entry.date} · ${entry.task_key} · ${String(entry.rule || '').trim()}${backref}`;
}

export function readHotMemoryEntries(projectKey, { home = null } = {}) {
  const file = hotMemoryFilePath(projectKey, { home });
  if (!fs.existsSync(file)) return { file, entries: [] };
  return { file, entries: parseHotMemoryFile(fs.readFileSync(file, 'utf8')) };
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const token of a) if (b.has(token)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function latinWords(text) {
  return new Set(String(text || '').toLowerCase().match(/[a-z0-9]{2,}/g) || []);
}

function multiCharTokens(text) {
  const out = new Set();
  for (const token of indexTokens(text).keys()) {
    if ([...token].length >= 2) out.add(token);
  }
  return out;
}

function isDuplicateRule(rule, entries) {
  const needle = normalizeCmp(rule);
  if (!needle) return true;
  const latinA = latinWords(rule);
  const multiA = multiCharTokens(rule);
  return entries.some((entry) => {
    if (normalizeCmp(entry.rule) === needle) return true;
    const latinB = latinWords(entry.rule);
    if (latinA.size && latinB.size && jaccard(latinA, latinB) < 0.72) return false;
    const multiB = multiCharTokens(entry.rule);
    if (multiA.size && multiB.size) return jaccard(multiA, multiB) >= 0.85;
    return similarText(rule, entry.rule);
  });
}

/**
 * Append entries (dedupe: same normalized rule, or high multi-char overlap; latin-word mismatch keeps both).
 * Hard cap: drop oldest unconfirmed to make room; all-confirmed at cap refuses new writes.
 */
export function appendHotMemoryEntries(projectKey, entries, { home = null } = {}) {
  if (!String(projectKey || '').trim()) {
    return { file: null, added: 0, skipped: 0, dropped_for_cap: 0, reason: 'no project_key' };
  }
  const clean = (Array.isArray(entries) ? entries : [])
    .map((entry) => ({
      date: String(entry?.date || new Date().toISOString().slice(0, 10)),
      task_key: String(entry?.task_key || '').trim() || 'unknown-task',
      rule: String(entry?.rule || '').trim(),
      backref: String(entry?.backref || '').trim(),
      confirmed: false
    }))
    .filter((entry) => entry.rule);
  if (!clean.length) {
    const { file } = readHotMemoryEntries(projectKey, { home });
    return { file, added: 0, skipped: 0, dropped_for_cap: 0, reason: 'no entries' };
  }

  const { file, entries: existing } = readHotMemoryEntries(projectKey, { home });
  const kept = [...existing];
  let added = 0;
  let skipped = 0;
  for (const entry of clean) {
    if (isDuplicateRule(entry.rule, kept)) {
      skipped += 1;
      continue;
    }
    if (kept.length >= HOT_MEMORY_MAX_ENTRIES) {
      const idx = kept.findIndex((item) => !item.confirmed);
      if (idx === -1) {
        skipped += 1;
        continue;
      }
      kept.splice(idx, 1);
    }
    kept.push(entry);
    added += 1;
  }
  if (!added) return { file, added, skipped, dropped_for_cap: 0 };

  const header = [
    `# Hot memory · ${slugProjectKey(projectKey)}`,
    '',
    '> Append-only one-line rules promoted from ralph findings (## 可复用结论).',
    '> Confirmed (`[x]`) entries rank first on injection; full context lives at the @ backref.',
    ''
  ].join('\n');
  const body = kept.map(serializeEntry).join('\n') + '\n';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, header + body, 'utf8');
  return { file, added, skipped, dropped_for_cap: existing.length + added - kept.length };
}

function entryToRow(entry, projectKey, ordinal) {
  return {
    id: `${entry.date}#${entry.task_key}#${ordinal}`,
    title: entry.rule,
    whenToInject: entry.date,
    body: [entry.rule, entry.backref].filter(Boolean).join(' '),
    sourceProjectId: slugProjectKey(projectKey),
    familyId: '',
    status: entry.confirmed ? 'confirmed' : 'active',
    scope: 'project',
    layer: '',
    adoptCount: entry.confirmed ? 1 : 0,
    score: 0,
    entry
  };
}

/**
 * Lexical retrieve over the project hot layer; confirmed entries rank before
 * unconfirmed at equal pool, both pass only above MIN_RELATED_SCORE (no padding).
 */
export function retrieveHotMemory({
  projectKey,
  query = '',
  limit = INJECT_SOFT_CAP,
  home = null
} = {}) {
  if (!String(projectKey || '').trim()) {
    return { status: 'skipped', file: null, hits: [], reason: 'no project_key' };
  }
  const { file, entries } = readHotMemoryEntries(projectKey, { home });
  if (!entries.length) return { status: 'empty', file, hits: [] };
  const rows = entries.map((entry, i) => entryToRow(entry, projectKey, i));
  const cap = Math.max(1, Number(limit) || INJECT_SOFT_CAP);
  const rankedHits = [
    ...rankIndexHits({ text: String(query || ''), projectId: slugProjectKey(projectKey) }, rows.filter((row) => row.status === 'confirmed')),
    ...rankIndexHits({ text: String(query || ''), projectId: slugProjectKey(projectKey) }, rows.filter((row) => row.status !== 'confirmed'))
  ];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const hits = [];
  const seen = new Set();
  for (const hit of rankedHits) {
    const id = hit?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const row = byId.get(id);
    if (row) hits.push({ ...row.entry, id: row.id, confirmed: row.entry.confirmed });
    if (hits.length >= cap) break;
  }
  return { status: hits.length ? 'ok' : 'empty', file, hits };
}

export function formatHotMemoryMarkdown(hits) {
  const lines = ['## hot_memory'];
  if (!hits?.length) {
    lines.push('- (none)');
    return lines.join('\n');
  }
  for (const hit of hits) {
    const back = hit.backref ? ' @ ' + hit.backref : '';
    const mark = hit.confirmed ? '[x] ' : '';
    lines.push(`- ${mark}${hit.rule}${back}`);
  }
  return lines.join('\n');
}

export function formatHotMemoryProgressLine(hits) {
  if (!hits?.length) return '- hot_memory: (none)';
  return '- hot_memory: ' + hits.map((hit) => {
    const back = hit.backref ? ' @ ' + hit.backref : '';
    return String(hit.rule || '').trim() + back;
  }).filter(Boolean).join('; ');
}

/** Flip `- [ ]` → `- [x]` for the entry best matching needle (substring, rule text, or 1-based index). */
export function confirmHotMemoryEntry(projectKey, needle, { home = null } = {}) {
  const { file, entries } = readHotMemoryEntries(projectKey, { home });
  if (!entries.length) return { file, confirmed: null, reason: 'no entries' };
  const wanted = String(needle || '').trim();
  const idx = /^\d+$/.test(wanted)
    ? Number(wanted) - 1
    : entries.findIndex((entry) => entry.rule.includes(wanted) || entry.line.includes(wanted));
  if (idx < 0 || idx >= entries.length) {
    return { file, confirmed: null, reason: 'no entry matches: ' + (wanted || '(empty)') };
  }
  if (entries[idx].confirmed) return { file, confirmed: entries[idx], already: true };
  entries[idx] = { ...entries[idx], confirmed: true };
  const header = String(fs.readFileSync(file, 'utf8')).split(/^-\s+\[/m)[0];
  fs.writeFileSync(file, header + entries.map(serializeEntry).join('\n') + '\n', 'utf8');
  return { file, confirmed: entries[idx] };
}

/** Enforce the per-project cap: drop oldest unconfirmed, keep confirmed. */
export function pruneHotMemory(projectKey, { home = null, maxEntries = HOT_MEMORY_MAX_ENTRIES } = {}) {
  const { file, entries } = readHotMemoryEntries(projectKey, { home });
  if (!entries.length) return { file, dropped: 0, kept: 0 };
  const confirmed = entries.filter((entry) => entry.confirmed);
  const unconfirmed = entries.filter((entry) => !entry.confirmed);
  const kept = [...confirmed, ...unconfirmed.slice(Math.max(0, unconfirmed.length - Math.max(0, maxEntries - confirmed.length)))];
  const dropped = entries.length - kept.length;
  if (!dropped) return { file, dropped: 0, kept: kept.length };
  const header = String(fs.readFileSync(file, 'utf8')).split(/^-\s+\[/m)[0];
  fs.writeFileSync(file, header + kept.map(serializeEntry).join('\n') + '\n', 'utf8');
  return { file, dropped, kept: kept.length };
}

/** Parse findings.md `## 可复用结论` bullets into hot-memory entries (backref from F-00N ref). */
export function extractReusableRulesFromFindings(text, { taskKey = '', backrefBase = '' } = {}) {
  const section = String(text || '').split(/^##\s+/m)
    .find((chunk) => chunk.startsWith(FINDINGS_RULES_HEADING.slice(3)) || chunk.startsWith('可复用结论'));
  if (!section) return [];
  const body = section.split(/\r?\n/).slice(1).join('\n').split(/^#\s/m)[0];
  const out = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const m = rawLine.match(/^-\s+(.+)$/);
    if (!m) continue;
    const rule = m[1].trim();
    if (!rule || /^\(none\)$/.test(rule)) continue;
    const trailing = rule.match(/（(F-\d+)）\s*$/);
    const ids = [...rule.matchAll(/F-\d+/g)].map((hit) => hit[0]);
    const fRef = trailing?.[1] || ids.at(-1) || '';
    out.push({
      task_key: taskKey,
      rule,
      backref: backrefBase && fRef ? `${backrefBase}#${fRef}` : backrefBase || ''
    });
  }
  return out;
}

export function defaultFindingsStub({ taskKey = 'findings' } = {}) {
  return [
    `# ${taskKey} — findings`,
    '',
    '> Status: draft',
    '',
    '## 改动摘要',
    '',
    '| 文件 | 变更 |',
    '| --- | --- |',
    '',
    '## 行为',
    '',
    '| 场景 | 决策 |',
    '| --- | --- |',
    '',
    '## 踩坑',
    '',
    '## 可复用结论',
    '- (none)',
    '',
    '## 验证',
    ''
  ].join('\n');
}

export function nextFindingId(text) {
  let max = 0;
  for (const match of String(text || '').matchAll(/^###\s+F-(\d+)/gm)) {
    max = Math.max(max, Number(match[1]));
  }
  return 'F-' + String(max + 1).padStart(3, '0');
}

export function countFindingHeadings(text) {
  return (String(text || '').match(/^###\s+F-\d+/gm) || []).length;
}

export function parseProgressDraft(progressText) {
  const parsed = String(progressText || '').split(/\r?\n/).map((line) => {
    const must = line.match(/^\s*-\s+failed_must:\s*(.+)$/);
    if (must) return { kind: 'must', value: must[1].trim() };
    const over = line.match(/^\s*-\s+over_claimed:\s*(.+)$/);
    if (over) return { kind: 'over', value: over[1].trim() };
    return { kind: 'other' };
  });
  let failed_must = '';
  let over_claimed = '';
  for (let i = parsed.length - 1; i >= 0; i -= 1) {
    if (parsed[i].kind !== 'must') continue;
    let paired = '';
    for (let j = i + 1; j < parsed.length; j += 1) {
      if (parsed[j].kind === 'must') break;
      if (parsed[j].kind === 'over') {
        paired = parsed[j].value;
        break;
      }
    }
    if (!paired) continue;
    failed_must = parsed[i].value;
    over_claimed = paired;
    break;
  }
  return { failed_must, over_claimed };
}

export function appendFindingsEntry(text, {
  id,
  title,
  phenomenon,
  cause,
  action,
  scope,
  cost = '',
  evidence = '',
  rule = ''
} = {}) {
  let body = String(text || '');
  if (!body.trim()) body = defaultFindingsStub();
  const findingId = id || nextFindingId(body);
  const heading = String(title || '').trim() ? `${findingId} ${String(title).trim()}` : findingId;
  const block = [
    `### ${heading}`,
    `- 现象: ${String(phenomenon || '').trim()}`,
    `- 原因: ${String(cause || '').trim()}`,
    `- 对策: ${String(action || '').trim()}`,
    `- 适用范围: ${String(scope || '').trim()}`,
    ...(String(cost || '').trim() ? [`- 代价: ${String(cost).trim()}`] : []),
    `- 证据: ${String(evidence || '').trim()}`,
    ''
  ].join('\n');

  if (/^##\s+可复用结论/m.test(body)) {
    body = body.replace(/^##\s+可复用结论/m, block + '## 可复用结论');
  } else if (/^##\s+踩坑(?:与因果)?/m.test(body)) {
    body = body.replace(/^##\s+踩坑(?:与因果)?[^\n]*\n/, (match) => match + '\n' + block);
  } else {
    body = body.replace(/\s*$/, '\n\n## 踩坑\n\n' + block);
  }

  const ruleText = String(rule || '').trim();
  if (ruleText) {
    const bullet = `- ${ruleText}（${findingId}）`;
    if (/^##\s+可复用结论/m.test(body)) {
      body = body.replace(
        /(^##\s+可复用结论\n)(?:- \(none\)\n)?/m,
        `$1${bullet}\n`
      );
    } else {
      body = body.replace(/\s*$/, '\n\n## 可复用结论\n' + bullet + '\n');
    }
  }
  return { text: body, id: findingId };
}
