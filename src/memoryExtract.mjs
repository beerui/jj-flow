/**
 * Memory extract quality gates — port of jj-multica Gate B
 * (internal/experience/score.go + extract.go hasRealLesson).
 *
 * Prefer 0 candidates over dirty ones. Discard below 60.
 * Process narration / this-time-only / task-only never become durable lessons.
 */

import { clipRunes } from './memoryRetrieve.mjs';

export const SCORE_MAX = 100;
export const SCORE_DISCARD_BELOW = 60;
export const SCORE_LOW_BELOW = 75;
export const MIN_LESSON_RUNES = 12;
export const MAX_TITLE_RUNES = 80;
export const MAX_BODY_RUNES = 400;

const DIM_REUSE = 'reuse';
const DIM_ACTIONABLE = 'actionable';
const DIM_SETTLED = 'settled';
const DIM_EVIDENCE = 'evidence';
const DIM_NOVELTY = 'novelty';

const MAX_REUSE = 35;
const MAX_ACTIONABLE = 25;
const MAX_SETTLED = 20;
const MAX_EVIDENCE = 10;
const MAX_NOVELTY = 10;

const EMPTYISH = new Set([
  'none', 'n/a', 'na', 'nil', 'null', '无', '无。', '-', '--', 'ok', 'pass', 'lgtm',
  'unit', 'n/a.', 'none.', '无风险', '暂无', '没有'
]);

const THIS_TIME_ONLY = ['仅本次', 'this time only', '只限本次', '本次专用'];
const TASK_ONLY = [
  'this card only', 'task-only', 'task only',
  '仅本卡', '只限本卡', '本卡专用',
  '仅本任务', '只限本任务', '本任务专用'
];

const PROCESS_NARRATION = [
  '不用再改', '不用再做', '不用再跑', '不用重复', '不必再改',
  '已经落地', '已经按现有做法', '已经按', '已经在用', '已经做完', '已经改好',
  '这张卡不改', '这张卡已经', '本卡已经',
  '这一任务不改', '这一任务已经', '本任务已经', '本轮已经',
  '先核对', '无需改动', '无需再', '没有新增',
  '上次', '上一轮', '本轮收口', '这一轮'
];

const UNSETTLED = ['上次', '暂时', '先这样', '已回滚', '回滚了', '改回', '待定', '试试', '中间态', '临时'];
const RULE_SIGNALS = [
  '必须', '不要', '禁止', '要先', '应当', '只能', '只有', '默认',
  '放在', '入口', '权限', '谁能', '规范', '约定', '统一', '一律'
];
/** Constraint that still binds a later card. Human-locked 2026-08-29: keep 必须/不要/勿/协议; drop this-change nits and field/how-to memos without a transferable rule (tests/fixtures/extract-future-reuse.golden.json). */
const TRANSFER_SIGNALS = [
  '必须', '不要', '禁止', '要先', '应当', '只能', '勿', '不得', '务必',
  '一律', '约定', '协议', '规范', '不要把', '不要用', '勿与', '勿再',
  '而不是', '而非', '不是', '避免',
  'fail-open', 'fail-closed',
  'must not', 'must ', "don't", 'do not', 'never', 'avoid ',
  'should not', 'forbid', 'prefer ', ' not '
];
const THIS_CHANGE_NITS = [
  '只加结尾', '只加「！」', '只加!', '补上感叹号', '只加感叹号',
  '往下挪', '下移'
];
const STEP_SIGNALS = ['→', '->', '点击', '打开', '选择', '执行', '运行', '改成', '设置', '确认'];

const NO_NTH_ITEM_RE = /没有第\s*[0-9一二三四五六七八九十]+\s*[条项个点]/;
const STEP_LIST_RE = /^\s*[0-9]+[.、)]\s*\S/m;
const SENTENCE_SPLIT_RE = /[。；;\n]+/;
const LATIN_PATH_RE = /[A-Za-z_][A-Za-z0-9_-]*([./][A-Za-z0-9_./-]+)+|[a-z]+[A-Z][A-Za-z0-9]*/;
const UNIT_RE = /[0-9]+\s*(px|rem|em|ms|s|kb|mb|字|行|条|次)/i;

function containsAny(s, keys) {
  for (const key of keys) {
    if (s.includes(key)) return true;
  }
  return false;
}

function clampDim(n, max) {
  if (n < 0) return 0;
  if (n > max) return max;
  return n;
}

function clampScore(n) {
  if (n < 0) return 0;
  if (n > SCORE_MAX) return SCORE_MAX;
  return n;
}

export function isThisTimeOnly(s) {
  const text = String(s || '').trim();
  if (!text) return false;
  const low = text.toLowerCase();
  return THIS_TIME_ONLY.some((k) => low.includes(k.toLowerCase()) || text.includes(k));
}

export function isTaskOnly(s) {
  const text = String(s || '').trim();
  if (!text) return false;
  const low = text.toLowerCase();
  return TASK_ONLY.some((k) => low.includes(k.toLowerCase()) || text.includes(k));
}

export function isProcessNarration(s) {
  const text = String(s || '').trim();
  if (!text) return false;
  if (NO_NTH_ITEM_RE.test(text)) return true;
  return containsAny(text, PROCESS_NARRATION);
}

export function stripNarration(s) {
  const parts = String(s || '').replaceAll('\r\n', '\n').split(SENTENCE_SPLIT_RE);
  const kept = [];
  for (const part of parts) {
    const p = part.trim();
    if (!p || isProcessNarration(p)) continue;
    kept.push(p);
  }
  return kept.join('。');
}

function emptyish(s) {
  const text = String(s || '').trim();
  if (!text) return true;
  return EMPTYISH.has(text.toLowerCase());
}

function isTestCommand(s) {
  const low = String(s || '').trim().toLowerCase();
  if (low === 'unit' || low === 'test' || low === 'tests') return true;
  return ['go test', 'pnpm test', 'npm test', 'yarn test', 'pytest', 'cargo test']
    .some((p) => low.startsWith(p));
}

function isGenericCloseoutNote(s) {
  const text = String(s || '').trim();
  if (!text) return false;
  // Template chrome only. A rule *about* Closeout ("不要自动 Closeout") must survive.
  if (/^自动\s*Closeout/.test(text) && text.includes('需 Leader')) return true;
  if (text.includes('自动 Closeout：需 Leader') || text.includes('自动 Closeout:需 Leader')) return true;
  if (text.includes('自动交付') && text.includes('需 Leader')) return true;
  if (text.includes('需 Leader') && (text.includes('done') || text.includes('确认')) && [...text].length < 40) return true;
  if (text.includes('完成任务') && (text.toLowerCase().includes('agent ') || text.includes('智能体'))) return true;
  if (text.includes('结束运行，但未取得可核查结论')) return true;
  return false;
}

function isAgentSummaryTemplate(s) {
  const low = String(s || '').toLowerCase();
  if (low.includes('## summary') || low.includes('## 总结')) return true;
  const enVerify = low.includes('how to verify') && low.includes('changed');
  const zhVerify = low.includes('如何验证') && (low.includes('修改:') || low.includes('修改：') || low.includes('- 修改'));
  if (enVerify || zhVerify) return true;
  return low.includes('remaining risk / follow-up')
    || low.includes('风险 / 跟进')
    || low.includes('风险 / 需跟进');
}

export function looksLikeFullDump(s) {
  const text = String(s || '').trim();
  if (!text) return false;
  if ([...text].length > MAX_BODY_RUNES) return true;
  let markers = 0;
  for (const p of ['WHAT_CHANGED', 'VERIFICATION', 'RESIDUAL_RISK', 'VERDICT:', '```', 'tool_use', 'function_call', 'stdout:']) {
    if (text.includes(p)) markers += 1;
  }
  return markers >= 2;
}

export function hasRealLesson(s) {
  const text = String(s || '').trim();
  if (
    !text
    || emptyish(text)
    || isThisTimeOnly(text)
    || isTaskOnly(text)
    || looksLikeFullDump(text)
    || isTestCommand(text)
    || isGenericCloseoutNote(text)
  ) {
    return false;
  }
  let n = 0;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (
      !trimmed
      || emptyish(trimmed)
      || isThisTimeOnly(trimmed)
      || isTaskOnly(trimmed)
      || isTestCommand(trimmed)
      || isGenericCloseoutNote(trimmed)
    ) continue;
    n += [...trimmed].length;
  }
  return n >= MIN_LESSON_RUNES;
}

function hasConcreteIdentifier(s) {
  return LATIN_PATH_RE.test(s) || UNIT_RE.test(String(s).toLowerCase());
}

export function hasTransferableConstraint(blob) {
  const text = String(blob || '');
  const low = text.toLowerCase();
  for (const k of TRANSFER_SIGNALS) {
    if (text.includes(k) || low.includes(k.toLowerCase())) return true;
  }
  return false;
}

export function isThisChangeNit(blob) {
  const text = String(blob || '').trim();
  if (!text) return false;
  return containsAny(text, THIS_CHANGE_NITS);
}

/**
 * jj-multica: 换一张卡还该不该看. Changelog of this edit / a page-local observation
 * without a transferable constraint is not a memory.
 */
export function futureReuseVeto(blob) {
  const text = String(blob || '').trim();
  if (!text) return '没有可复用内容';
  if (isThisChangeNit(text) && !hasTransferableConstraint(text)) {
    return '本轮改动点，换一张卡不必看';
  }
  if (!hasTransferableConstraint(text)) {
    return '没有可迁移约束（必须/不要/勿/协议/not），只是本卡现象或改动记录';
  }
  return '';
}

function scoreReuse(blob) {
  if (!hasTransferableConstraint(blob)) return 8;
  let n = 25;
  if (containsAny(blob, RULE_SIGNALS)) n += 8;
  return clampDim(n, MAX_REUSE);
}

function scoreActionable(blob) {
  let n = 12;
  if (containsAny(blob, STEP_SIGNALS) || STEP_LIST_RE.test(blob)) n += 7;
  if (hasConcreteIdentifier(blob)) n += 6;
  return clampDim(n, MAX_ACTIONABLE);
}

function scoreSettled(blob) {
  if (containsAny(blob, UNSETTLED)) return 6;
  return 16;
}

function scoreEvidence(body) {
  if ([...String(body || '')].length >= 30) return MAX_EVIDENCE;
  return 5;
}

function vetoReason(blob) {
  if (!hasRealLesson(blob)) return '没有可复用内容';
  if (isAgentSummaryTemplate(blob)) return 'Agent 收口模板，不是教训';
  if (isThisTimeOnly(blob) || isTaskOnly(blob)) return '仅本次/仅本卡/仅本任务';
  if (!hasRealLesson(stripNarration(blob))) return '过程/状态叙述，不是跨任务教训';
  return '';
}

export function scoreDraft({ title = '', body = '' } = {}) {
  const t = String(title || '').trim();
  const b = String(body || '').trim();
  const blob = `${t}\n${b}`.trim();
  const sc = { total: 0, scored_by: 'heuristic', breakdown: {}, reason: '' };
  const veto = vetoReason(blob);
  if (veto) {
    sc.reason = veto;
    for (const dim of [DIM_REUSE, DIM_ACTIONABLE, DIM_SETTLED, DIM_EVIDENCE, DIM_NOVELTY]) {
      sc.breakdown[dim] = 0;
    }
    return sc;
  }
  sc.breakdown[DIM_REUSE] = scoreReuse(blob);
  sc.breakdown[DIM_ACTIONABLE] = scoreActionable(blob);
  sc.breakdown[DIM_SETTLED] = scoreSettled(blob);
  sc.breakdown[DIM_EVIDENCE] = scoreEvidence(b || t);
  sc.breakdown[DIM_NOVELTY] = MAX_NOVELTY;
  for (const v of Object.values(sc.breakdown)) sc.total += v;
  sc.total = clampScore(sc.total);
  return sc;
}

export function scorePasses(sc) {
  return (sc?.total || 0) >= SCORE_DISCARD_BELOW;
}

export function splitTitleBody(text) {
  const raw = String(text || '').trim();
  if (!raw) return { title: '', body: '' };
  const oneLine = raw.replaceAll('\n', ' ').trim();
  // Do not split on `.` inside `.t-dialog` / `file.md`. Sentence end is 。！ or ". "/"! ".
  const cut = oneLine.search(/[。！]|\.\s|!\s|；/);
  if (cut >= 1 && cut <= MAX_TITLE_RUNES) {
    const title = oneLine.slice(0, cut).trim();
    const body = oneLine.slice(cut + 1).trim() || raw;
    return { title: clipRunes(title, MAX_TITLE_RUNES), body };
  }
  return { title: clipRunes(oneLine, MAX_TITLE_RUNES), body: raw };
}

export function normalizeCmp(s) {
  return [...String(s || '').toLowerCase()].filter((ch) => /[\p{L}\p{N}\p{Script=Han}]/u.test(ch)).join('');
}

function extractTokens(s) {
  const out = new Set();
  let cur = '';
  const flush = () => {
    if ([...cur].length >= 2) out.add(cur);
    cur = '';
  };
  for (const ch of String(s || '').toLowerCase()) {
    if (/\p{Script=Han}/u.test(ch)) {
      flush();
      out.add(ch);
      continue;
    }
    if (/\p{L}|\p{N}/u.test(ch)) {
      cur += ch;
      continue;
    }
    flush();
  }
  flush();
  return out;
}

export function tokenOverlap(a, b) {
  const ta = extractTokens(a);
  const tb = extractTokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union <= 0 ? 0 : inter / union;
}

export function similarText(a, b) {
  if (!String(a || '').trim() || !String(b || '').trim()) return false;
  if (normalizeCmp(a) === normalizeCmp(b)) return true;
  return tokenOverlap(a, b) >= 0.72;
}

/**
 * Gate a durable lesson string. Empty / narration / below 60 / task restatement / near-dup → discard.
 */
export function gateLesson(lesson, { taskTexts = [], existing = [] } = {}) {
  const text = String(lesson || '').trim();
  const { title, body } = splitTitleBody(text);
  const blob = body || text;
  const score = scoreDraft({ title, body: blob });
  const base = {
    title: title || clipRunes(text, MAX_TITLE_RUNES),
    body: blob,
    score
  };
  if (!scorePasses(score)) {
    return { keep: false, ...base };
  }
  const reuseVeto = futureReuseVeto(blob);
  if (reuseVeto) {
    return { keep: false, ...base, score: { ...score, total: 0, reason: reuseVeto } };
  }
  for (const task of taskTexts) {
    if (similarText(blob, task) || similarText(title, task)) {
      return { keep: false, ...base, score: { ...score, total: 0, reason: '任务复述，不是跨任务教训' } };
    }
  }
  for (const prev of existing) {
    if (similarText(blob, prev) || similarText(title, prev)) {
      return { keep: false, ...base, score: { ...score, total: 0, reason: '与已有教训近重' } };
    }
  }
  return { keep: true, ...base };
}
