/**
 * Lexical memory retrieve — port of jj-multica internal/experience/retrieve.go.
 *
 * Measured on 133 real shorts / 19 real ralph cards (docs in jj-multica
 * memory-retrieval-quality.md): CJK bigram + skip-1 bigram, single-rune
 * weight 1, MinRelatedScore = weightBody (5), InjectSoftCap = 5.
 * Token overlap is a candidate list only; project-only dump is forbidden.
 */

export const WEIGHT_TITLE = 15;
export const WEIGHT_WHEN = 10;
export const WEIGHT_BODY = 5;
export const WEIGHT_SINGLE_RUNE = 1;
export const WEIGHT_SKIP_PAIR = 2;
export const MIN_RELATED_SCORE = WEIGHT_BODY;
export const INJECT_SOFT_CAP = 5;

export const STATUS_CONFIRMED = 'confirmed';
export const SCOPE_PROJECT = 'project';
export const SCOPE_USER = 'user';
export const SCOPE_GLOBAL = 'global';
export const LAYER_CARD = 'card';

const TOK_RUNE = 0;
const TOK_SKIP = 1;
const TOK_WORD = 2;

const HAN_RE = /\p{Script=Han}/u;
const LETTER_OR_NUMBER_RE = /\p{L}|\p{N}/u;

export function clipRunes(s, max) {
  const text = String(s || '').trim();
  if (max <= 0) return text;
  const runes = [...text];
  return runes.length <= max ? text : runes.slice(0, max).join('');
}

export function indexTokens(s) {
  s = String(s || '').toLowerCase();
  const out = new Map();
  const put = (token, kind) => {
    const prev = out.get(token);
    if (prev == null || kind > prev) out.set(token, kind);
  };
  let cur = '';
  const flush = () => {
    if ([...cur].length >= 2) put(cur, TOK_WORD);
    cur = '';
  };
  let prevHan = '';
  let prevPrevHan = '';
  for (const ch of s) {
    if (HAN_RE.test(ch)) {
      flush();
      put(ch, TOK_RUNE);
      if (prevHan) put(prevHan + ch, TOK_WORD);
      if (prevPrevHan) put(prevPrevHan + ch, TOK_SKIP);
      prevPrevHan = prevHan;
      prevHan = ch;
      continue;
    }
    prevHan = '';
    prevPrevHan = '';
    if (LETTER_OR_NUMBER_RE.test(ch)) {
      cur += ch;
      continue;
    }
    flush();
  }
  flush();
  return out;
}

export function relatedScore(row, qtok) {
  const titleTok = indexTokens(row.title || '');
  const whenTok = indexTokens(row.whenToInject || '');
  const bodyTok = indexTokens(clipRunes(row.body || '', 400));
  let total = 0;
  let strong = 0;
  for (const [token, qk] of qtok) {
    let w = 0;
    let rk = TOK_RUNE;
    if (titleTok.has(token)) {
      w = WEIGHT_TITLE;
      rk = titleTok.get(token);
    } else if (whenTok.has(token)) {
      w = WEIGHT_WHEN;
      rk = whenTok.get(token);
    } else if (bodyTok.has(token)) {
      w = WEIGHT_BODY;
      rk = bodyTok.get(token);
    }
    if (!w) continue;
    if (qk === TOK_RUNE || rk === TOK_RUNE) {
      total += WEIGHT_SINGLE_RUNE;
    } else if (qk === TOK_SKIP && rk === TOK_SKIP) {
      total += WEIGHT_SKIP_PAIR;
    } else {
      total += w;
      strong += w;
    }
  }
  return { total, strong };
}

export function relBand(strong) {
  if (strong >= WEIGHT_TITLE * 2) return 3;
  if (strong >= WEIGHT_TITLE) return 2;
  return 1;
}

export function sameProjectPool(row, projectId) {
  const pid = String(projectId || '').trim();
  if (!pid) return false;
  return String(row.sourceProjectId || '').trim() === pid;
}

export function projectInjectScope(scope) {
  const sc = String(scope || '').trim().toLowerCase();
  return sc === '' || sc === SCOPE_PROJECT;
}

function rowStatus(row) {
  return String(row.status || '').trim().toLowerCase();
}

function isConfirmed(row) {
  const status = rowStatus(row);
  return status === '' || status === STATUS_CONFIRMED || status === 'active';
}

export function rankIndexHits(query, rows) {
  const qtok = indexTokens(query?.text || '');
  if (qtok.size === 0) return [];
  const hits = [];
  const seen = new Set();
  for (const row of rows || []) {
    if (!row || !String(row.id || '').trim()) continue;
    if (!isConfirmed(row)) continue;
    if (String(row.layer || '').trim().toLowerCase() === LAYER_CARD) continue;
    if (seen.has(row.id)) continue;
    if (!sameProjectPool(row, query.projectId)) continue;
    if (!projectInjectScope(row.scope)) continue;
    const { total, strong } = relatedScore(row, qtok);
    if (strong < MIN_RELATED_SCORE) continue;
    seen.add(row.id);
    hits.push({
      id: row.id,
      rel: total,
      strong,
      adopt: Number(row.adoptCount) || 0,
      score: Number(row.score) || 0,
      row
    });
  }
  hits.sort((a, b) => {
    const band = relBand(b.strong) - relBand(a.strong);
    if (band) return band;
    if (a.adopt !== b.adopt) return b.adopt - a.adopt;
    if (a.rel !== b.rel) return b.rel - a.rel;
    if (a.score !== b.score) return b.score - a.score;
    return String(a.id).localeCompare(String(b.id));
  });
  return hits;
}

export function rankIndex(query, rows) {
  return rankIndexHits(query, rows).map((hit) => hit.id);
}

export function knowledgeItemToRow(item) {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.id || '').trim();
  if (!id) return null;
  const status = String(item.status || '').trim().toLowerCase();
  return {
    id,
    title: item.title || '',
    whenToInject: '',
    body: item.summary || '',
    sourceProjectId: item.project_key || item.project || item.source_project_id || '',
    status: status === 'active' ? STATUS_CONFIRMED : status,
    scope: item.scope || SCOPE_PROJECT,
    layer: item.layer || '',
    adoptCount: item.adopt_count || 0,
    score: item.extract_score || item.score || 0,
    item
  };
}
