/** P1a split from src/ralph.mjs — move not rewrite.
 * Over 600 lines because ledger, dual-accept gates, metrics, and handoff share one
 * module (handoff cannot live in knowledge: setGate must not import knowledge).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { countFindingHeadings, extractReusableRulesFromFindings } from '../memoryHotLayer.mjs';
import {
  ACCEPT_LAYER_STATUSES,
  GATE_ISSUE_CLASSES,
  GATE_KEYS,
  INSTRUCTION_CORRECTION_REL,
  INTENSITY_DEFAULTS,
  JUDGMENT_MODES,
  PHASES,
  RALPH_HANDOFF_SCHEMA_VERSION,
  RALPH_MAP_REL,
  RALPH_ROOT_REL,
  RALPH_TASKS_DIR_REL,
  RALPHS_DIR_REL,
  STATE_REL,
  stripRunIdPrefix,
  appendProgressLine,
  createEmptyAcceptLayers,
  createEmptyMap,
  effectiveGateSet,
  hydrateIntensityFields,
  listRuns,
  loadMap,
  loadRun,
  mapPath,
  normalizeIntensity,
  nowIso,
  promoteGateSetToFull,
  promotionProgressLine,
  readJson,
  runDir,
  runMachineFileFor,
  runWorkspaceDir,
  assertWritableRun,
  saveRun,
  unique,
  writeJson
} from './state.mjs';

export const FINDING_HINT = '这次失败的原因记下来了吗（ralph_ops finding）';

function maybeFindingHint(runId, cwd) {
  const findingsPath = path.join(runDir(runId, cwd), 'findings.md');
  if (!fs.existsSync(findingsPath)) return FINDING_HINT;
  const text = fs.readFileSync(findingsPath, 'utf8');
  if (countFindingHeadings(text) < 1) return FINDING_HINT;
  if (!extractReusableRulesFromFindings(text).length) return FINDING_HINT;
  return null;
}

export function readGitSourceFacts(cwd = process.cwd()) {
  try {
    const head = execSync('git rev-parse HEAD', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const ref = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const dirty = execSync('git status --porcelain', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().length > 0;
    return { head: head || null, ref: ref || null, commit_stable: Boolean(head) && !dirty, working_tree: dirty ? 'dirty' : 'clean' };
  } catch {
    return { head: null, ref: null, commit_stable: false, working_tree: 'unknown' };
  }
}

function normalizeHandoffTargets(targets_hint = [], existingFamily = null) {
  if (Array.isArray(existingFamily?.targets) && existingFamily.targets.length) {
    return existingFamily.targets.map((t) => ({ role: t.role, repo: t.repo || null, planned_branch: t.planned_branch || null, decision_hint: t.decision_hint || null, status: t.status || 'NOT_STARTED' }));
  }
  return (targets_hint || []).filter(Boolean).map((item) => {
    if (typeof item === 'string') return { role: item, repo: null, planned_branch: null, decision_hint: null, status: 'NOT_STARTED' };
    return { role: item.role || String(item), repo: item.repo || null, planned_branch: item.planned_branch || null, decision_hint: item.decision_hint || null, status: item.status || 'NOT_STARTED' };
  });
}

export function shouldMaintainHandoff(run, { force = false, targets_hint = [] } = {}) {
  if (force) return true;
  if (run.handoff) return true;
  if (run.family?.enabled) return true;
  if (Array.isArray(run.family?.targets) && run.family.targets.length) return true;
  if (Array.isArray(targets_hint) && targets_hint.length) return true;
  const scopeText = [...(run.scope?.in || []), ...(run.scope?.out || []), run.goal || '', run.title || ''].join(' ');
  return new RegExp('项目A|项目B|项目C|sibling|交接|迁移|三端|同源').test(scopeText);
}

export function applyHandoffState(run, { cwd = process.cwd(), targets_hint = [], thread_id = null, must = null, do_not_port = null, mode = null, write_file = true } = {}) {
  if (write_file) assertWritableRun(run);
  const git = readGitSourceFacts(cwd);
  const acceptPass = run.gates?.accept === 'PASS';
  const targets = normalizeHandoffTargets(targets_hint, run.family);
  const family = {
    enabled: targets.length > 0 || Boolean(run.family?.enabled),
    lead_role: run.family?.lead_role || null,
    lead_repo: run.family?.lead_repo || cwd.replaceAll(String.fromCharCode(92), String.fromCharCode(47)),
    order: Array.isArray(run.family?.order) && run.family.order.length ? run.family.order : targets.map((t) => t.role).filter(Boolean),
    targets
  };
  const mustList = Array.isArray(must) && must.length ? must : (Array.isArray(run.handoff?.must) && run.handoff.must.length ? run.handoff.must : [run.goal].filter(Boolean));
  const dnpList = Array.isArray(do_not_port) ? do_not_port : (Array.isArray(run.handoff?.do_not_port) ? run.handoff.do_not_port : [...(run.scope?.out || [])]);
  const blocked_reasons = [];
  if (!acceptPass) blocked_reasons.push('accept!=PASS');
  if (!git.commit_stable) blocked_reasons.push('commit_stable=false');
  if (!git.head) blocked_reasons.push('source_head_missing');
  const ready = blocked_reasons.length === 0;
  const handoff_id = run.handoff?.handoff_id || ('HOF-' + stripRunIdPrefix(run.run_id));
  const relDir = path.join(RALPH_TASKS_DIR_REL, run.run_id, STATE_REL).replaceAll(String.fromCharCode(92), String.fromCharCode(47));
  const portMode = mode || run.handoff?.mode || 'LITE';
  const updated_at = nowIso();
  run.family = family.enabled || targets.length ? family : (run.family || null);
  run.handoff = {
    handoff_id, path: relDir, ready, blocked_reasons,
    source_head: git.head, source_ref: git.ref, working_tree: git.working_tree,
    targets: targets.map((t) => t.role), must: mustList, do_not_port: dnpList,
    mode: portMode === 'FULL' ? 'FULL' : 'LITE',
    thread_id: thread_id || run.handoff?.thread_id || null, updated_at,
    status: ready ? 'READY' : 'DRAFT',
    execution_readiness: ready ? 'READY' : 'BLOCKED',
    handoff_status: ready ? 'READY_FOR_HANDOFF' : (acceptPass ? 'PARTIAL_HANDOFF' : 'DRAFT')
  };
  run.artifact_refs = { ...run.artifact_refs, handoff_ref: path.join(relDir, 'handoff.json').replaceAll(String.fromCharCode(92), String.fromCharCode(47)) };
  run.updated_at = updated_at;
  const packageBody = {
    schema_version: RALPH_HANDOFF_SCHEMA_VERSION, run_id: run.run_id, handoff_id, ready, blocked_reasons,
    source_head: git.head, source_ref: git.ref, must: mustList, do_not_port: dnpList, targets,
    mode: run.handoff.mode, thread_id: run.handoff.thread_id, updated_at,
    execution_readiness: run.handoff.execution_readiness, handoff_status: run.handoff.handoff_status
  };
  if (write_file) {
    const abs = path.join(cwd, relDir);
    fs.mkdirSync(abs, { recursive: true });
    writeJson(path.join(abs, 'handoff.json'), packageBody);
  }
  return { handoff: run.handoff, path: relDir, package: packageBody, next_user_prompt: ready ? '交接到 <目标角色>' : '提交后说：交接到 <目标角色>' };
}

export function writeHandoffPackage(runId, { cwd = process.cwd(), handoff_id, targets_hint = [], thread_id = null, parent_handoff_id = null, port_mode = 'LITE', requirement_ledger = null, source_change_map = null, must = null, do_not_port = null } = {}) {
  const run = loadRun(runId, cwd);
  assertWritableRun(run);
  if (handoff_id) run.handoff = { ...(run.handoff || {}), handoff_id };
  const mustFromLedger = Array.isArray(requirement_ledger?.must) ? requirement_ledger.must.map((item) => item.summary || item.id || String(item)).filter(Boolean) : must;
  const dnpFromLedger = Array.isArray(requirement_ledger?.do_not_port) ? requirement_ledger.do_not_port.map((item) => item.summary || item.id || String(item)).filter(Boolean) : do_not_port;
  void parent_handoff_id; void source_change_map;
  const result = applyHandoffState(run, { cwd, targets_hint, thread_id, must: mustFromLedger, do_not_port: dnpFromLedger, mode: port_mode, write_file: true });
  saveRun(run, cwd);
  return result;
}

export function writeDispatchSnapshot(runId, { cwd = process.cwd(), targets_hint = [] } = {}) {
  const run = loadRun(runId, cwd);
  assertWritableRun(run);
  const snapId = 'SNAP-' + stripRunIdPrefix(run.run_id);
  const rel = path.join('.workflow', 'dispatch', 'recommendations', snapId);
  const abs = path.join(cwd, rel);
  fs.mkdirSync(abs, { recursive: true });
  const snapshot = { schema_version: 'jj-flow/dispatch-recommendation/1.0', snapshot_id: snapId, run_id: run.run_id, title: run.title, goal: run.goal, targets_hint, created_at: nowIso() };
  writeJson(path.join(abs, 'snapshot.json'), snapshot);
  run.dispatch_recommendation = { snapshot_path: path.join(rel, 'snapshot.json').replaceAll(String.fromCharCode(92), String.fromCharCode(47)), targets_hint };
  run.artifact_refs.dispatch_snapshot_ref = run.dispatch_recommendation.snapshot_path;
  run.updated_at = nowIso();
  saveRun(run, cwd);
  return { snapshot, path: run.dispatch_recommendation.snapshot_path };
}

export function resolveReviewScope({ review_scope = null, fix_commit = null, reviewed_commit = null } = {}) {
  if (review_scope === 'working_tree' || review_scope === 'commit') return review_scope;
  if (fix_commit || reviewed_commit) return 'commit';
  return 'working_tree';
}

export function detectDeliverOutsideLedger(run, cwd = process.cwd(), { diff_paths = null } = {}) {
  const signals = [];
  const progress = readRunArtifactText(run, 'progress', cwd);
  if (/(^|\n)\s*[-*]?\s.*\bDELIVER\b/i.test(progress) || /\bphase\s*[:=]\s*DELIVER\b/i.test(progress)) {
    signals.push('progress_mentions_deliver');
  }
  const actual = Array.isArray(diff_paths)
    ? unique(diff_paths.map((item) => String(item || '').replace(/\\/g, '/')))
    : collectGitDiffPaths(cwd);
  if (Array.isArray(actual) && actual.some((item) => item && !isWorkflowNoisePath(item) && LEDGER_CODE_EXT_RE.test(item))) {
    signals.push('implementation_diff_present');
  }
  const deliverGate = run?.gates?.deliver;
  const deliverPending = deliverGate !== 'PASS' && deliverGate !== 'N/A';
  return {
    observed: Boolean(deliverPending && signals.length),
    signals,
    phase: run?.phase || null,
    deliver_gate: deliverGate || null
  };
}

export function writeInstructionCorrection(runId, cwd, payload = {}) {
  const nl = String.fromCharCode(10);
  const dir = runDir(runId, cwd);
  fs.mkdirSync(dir, { recursive: true });
  const abs = path.join(dir, INSTRUCTION_CORRECTION_REL);
  const previous = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') + nl + '---' + nl : '';
  const count = payload.count != null ? payload.count : 2;
  const signal = payload.repeated_signal != null ? String(payload.repeated_signal) : '(none)';
  const rule = payload.proposed_rule
    || 'After two identical failures, change approach; do not retry the same strategy.';
  const body = previous
    + '# Instruction correction candidate' + nl
    + 'run_id: ' + runId + nl
    + 'count: ' + count + nl
    + 'repeated_signal: ' + signal + nl
    + 'recorded_at: ' + nowIso() + nl + nl
    + '## Proposed rule' + nl + nl
    + rule + nl + nl
    + 'Landing this into business-repo AGENTS.md ## Agent corrections is a Developer edit, not a reviewer write.' + nl;
  fs.writeFileSync(abs, body, 'utf8');
  appendProgressLine(runId, cwd, '- ' + nowIso() + ' instruction-correction count=' + count + ' signal=' + signal);
  return { path: path.join(RALPHS_DIR_REL, runId, INSTRUCTION_CORRECTION_REL).replaceAll(String.fromCharCode(92), String.fromCharCode(47)), count, repeated_signal: signal };
}

const GATE_STATUS = ['PENDING', 'PASS', 'FAIL', 'N/A', 'BLOCKED'];
const GATE_TO_PHASE = {
  analyze: 'PLAN',
  plan: 'DELIVER',
  deliver: 'ACCEPT',
  accept: 'ACCEPT',
  archive: 'ARCHIVE'
};

const LEDGER_CODE_EXT_RE = /\.(?:vue|ts|tsx|js|jsx|mjs|pas|css|scss|less|sass|json|mdx?)$/i;
const LEDGER_PATH_EXCLUDE = new Set([
  'analyze.md', 'plan.md', 'acceptance.md', 'progress.md', 'run.json', 'handoff.json',
  'archive-manifest.json', 'business-map.json', 'package.json', 'package-lock.json',
  'pnpm-lock.yaml', 'yarn.lock', 'tsconfig.json', 'jsconfig.json', 'readme.md',
  'findings.md', 'knowledge-attach.json', 'knowledge-contribution.json',
  'task_plan.md'
]);

function normalizeLedgerPathRef(value) {
  if (!value || typeof value !== 'string') return null;
  let token = value.trim().replace(/\\/g, '/');
  if (!token || token.includes('://')) return null;
  token = token.split(/\s+/)[0].replace(/^['"]|['"]$/g, '').replace(/[,:;]+$/g, '');
  if (!token || token.includes('=') || token.includes('(') || token.includes(')')) return null;
  token = token.replace(/^\.\//, '');
  const base = token.split('/').pop().toLowerCase();
  if (!base || LEDGER_PATH_EXCLUDE.has(base)) return null;
  if (!LEDGER_CODE_EXT_RE.test(base)) return null;
  return token;
}

function headingStartRe(heading, level) {
  const n = Number(level);
  if (!Number.isInteger(n) || n < 1) throw new Error('extractMarkdownSection level must be integer >= 1');
  const escaped = String(heading).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { n, start: new RegExp('^#{' + n + '}\\s+' + escaped + '\\s*$', 'im') };
}

function hasHeading(text, heading, level) {
  if (!text || typeof text !== 'string' || !heading) return false;
  return headingStartRe(heading, level).start.test(text);
}

/** Return the body of a heading at `level` until the next heading of the same or higher level. */
export function extractMarkdownSection(text, heading, level = 2) {
  if (!text || typeof text !== 'string' || !heading) return '';
  const { n, start } = headingStartRe(heading, level);
  const match = start.exec(text);
  if (!match) return '';
  const from = match.index + match[0].length;
  const rest = text.slice(from);
  const next = new RegExp('^#{1,' + n + '}\\s+', 'im').exec(rest);
  return (next ? rest.slice(0, next.index) : rest).trim();
}

/** First matching heading that exists (empty body is still a hit; missing heading is not). */
function firstPresentHeading(text, heading, levels) {
  for (const level of levels) {
    if (hasHeading(text, heading, level)) return extractMarkdownSection(text, heading, level);
  }
  return null;
}

/**
 * Current plan contract: `## 计划` → `### 当前`. Empty `### 当前` stays empty
 * (does not leak 已落地 / 已取代).
 */
export function extractPlanCurrentSection(text) {
  if (!text || typeof text !== 'string') return '';
  const plan = hasHeading(text, '计划', 2) ? extractMarkdownSection(text, '计划', 2) : null;
  const scope = plan != null ? plan : text;
  const current = firstPresentHeading(scope, '当前', [3, 2]);
  if (current != null) return current;
  return '';
}

function extractAcceptanceActiveText(text) {
  if (!text || typeof text !== 'string') return '';
  const accept = hasHeading(text, '验收', 2)
    ? extractMarkdownSection(text, '验收', 2)
    : text;
  const current = firstPresentHeading(accept, '当前', [3, 2]);
  const body = current != null ? current : accept;
  return body.split(/\r?\n/).filter((line) => !/(?:\bSUPERSEDED\b|已取代)/i.test(line)).join('\n');
}

/** Extract implementation path refs from plan/acceptance markdown. */
export function extractLedgerPathRefs(text) {
  if (!text || typeof text !== 'string') return [];
  const found = [];
  for (const match of text.matchAll(/`([^`\n]+)`/g)) {
    const normalized = normalizeLedgerPathRef(match[1]);
    if (normalized) found.push(normalized);
  }
  for (const match of text.matchAll(/(?<![A-Za-z0-9_./-])((?:src|lib|scripts|tests|packages|apps|components|views|pages)\/[A-Za-z0-9_./@-]+\.[A-Za-z0-9]+)/g)) {
    const normalized = normalizeLedgerPathRef(match[1]);
    if (normalized) found.push(normalized);
  }
  return unique(found);
}

function isWorkflowNoisePath(value) {
  const normalized = String(value || '').replace(/\\/g, '/');
  return normalized.startsWith('.workflow/') || normalized.includes('/.workflow/') || normalized.startsWith('.git/');
}

function pathMatchKeys(value) {
  const full = String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
  const base = full.split('/').pop();
  return { full, base };
}

function pathRefCovers(candidate, target) {
  const c = pathMatchKeys(candidate);
  const t = pathMatchKeys(target);
  if (!c.full || !t.full) return false;
  return c.full === t.full || c.base === t.base || t.full.endsWith('/' + c.full) || c.full.endsWith('/' + t.full) || t.full.endsWith('/' + c.base) || c.full.endsWith('/' + t.base);
}

/** Return human-readable mismatch or null when claimed/actual path sets are compatible. */
export function findImplementationPathMismatch(claimedPaths, actualPaths) {
  const claimed = unique((claimedPaths || []).map(normalizeLedgerPathRef).filter(Boolean));
  const actual = unique((actualPaths || []).map((item) => String(item || '').replace(/\\/g, '/')).filter((item) => item && !isWorkflowNoisePath(item)));
  if (!claimed.length || !actual.length) return null;
  const missingFromDiff = claimed.filter((item) => !actual.some((pathValue) => pathRefCovers(item, pathValue)));
  const missingFromLedger = actual.filter((item) => !claimed.some((pathValue) => pathRefCovers(pathValue, item)));
  if (!missingFromDiff.length && !missingFromLedger.length) return null;
  const parts = [];
  if (missingFromLedger.length) parts.push('actual not in plan/acceptance: ' + missingFromLedger.join(', '));
  if (missingFromDiff.length) parts.push('planned missing from diff: ' + missingFromDiff.join(', '));
  return parts.join('; ') + ' | claimed=[' + claimed.join(', ') + '] actual=[' + actual.join(', ') + ']';
}

export function collectGitDiffPaths(cwd = process.cwd()) {
  try {
    const output = execSync('git status --porcelain -uall', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const paths = [];
    for (const line of String(output || '').split(/\r?\n/)) {
      if (!line.trim()) continue;
      const body = line.length >= 4 ? line.slice(3).trim() : line.trim();
      if (!body) continue;
      const chosen = body.includes(' -> ') ? body.split(' -> ').pop() : body;
      const normalized = String(chosen || '').replace(/\\/g, '/').replace(/^"|"$/g, '');
      if (normalized && !isWorkflowNoisePath(normalized)) paths.push(normalized);
    }
    return unique(paths);
  } catch {
    return null;
  }
}

export function readRunArtifactText(run, key, cwd) {
  const rel = run?.artifact_refs?.[key];
  if (!rel) return '';
  const normalized = String(rel).replace(/\\/g, '/');
  if (normalized.includes('#')) {
    throw new Error('artifact_refs.' + key + ' must be a bare filename (no fragment): ' + rel);
  }
  const root = runWorkspaceDir(run, cwd);
  const abs = path.join(root, normalized);
  if (fs.existsSync(abs)) return fs.readFileSync(abs, 'utf8');
  const nested = path.join(root, STATE_REL, normalized);
  if (fs.existsSync(nested)) return fs.readFileSync(nested, 'utf8');
  throw new Error('artifact_refs.' + key + ' missing file: ' + normalized);
}

export function collectClaimedImplementationPaths(run, cwd = process.cwd()) {
  const claimed = [];
  if (Array.isArray(run?.scope?.in)) {
    for (const item of run.scope.in) {
      const normalized = normalizeLedgerPathRef(item);
      if (normalized) claimed.push(normalized);
    }
  }
  claimed.push(...extractLedgerPathRefs(extractPlanCurrentSection(readRunArtifactText(run, 'plan', cwd))));
  claimed.push(...extractLedgerPathRefs(extractAcceptanceActiveText(readRunArtifactText(run, 'acceptance', cwd))));
  return unique(claimed);
}

const REVIEW_SKIP_BASENAMES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'package.json',
  'run.json'
]);

export function isReviewSkipPath(file) {
  const normalized = String(file || '').replace(/\\/g, '/').toLowerCase();
  if (!normalized || normalized === 'unknown') return false;
  if (normalized.includes('/src/gen/') || normalized.startsWith('src/gen/')) return true;
  const base = normalized.split('/').pop();
  return REVIEW_SKIP_BASENAMES.has(base) || /\.(?:lock|generated)\./.test(base);
}

export function isTestPath(file) {
  const normalized = String(file || '').replace(/\\/g, '/');
  if (!normalized) return false;
  return /(?:^|\/)(?:tests?|__tests__)(?:\/|$)/i.test(normalized)
    || /\.(?:test|spec)\.(?:js|mjs|cjs|ts|tsx)$/i.test(normalized);
}

export function collectGitDeletedPaths(cwd = process.cwd()) {
  try {
    const output = execSync('git status --porcelain -uall', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const paths = [];
    for (const line of String(output || '').split(/\r?\n/)) {
      if (line.length < 4) continue;
      const code = line.slice(0, 2);
      if (!code.includes('D')) continue;
      const body = line.slice(3).trim();
      const chosen = body.includes(' -> ') ? body.split(' -> ')[0] : body;
      const normalized = String(chosen || '').replace(/\\/g, '/').replace(/^"|"$/g, '');
      if (normalized && !isWorkflowNoisePath(normalized)) paths.push(normalized);
    }
    return unique(paths);
  } catch {
    return [];
  }
}

function looksLikeFixRun(run, cwd) {
  const progress = readRunArtifactText(run, 'progress', cwd);
  if (/\bfailed_must\b/i.test(progress) || /\buser_correction\b/i.test(progress) || /\bover_claimed\b/i.test(progress)) {
    return true;
  }
  const latest = getLatestReviewRecord(run, cwd);
  return Boolean(latest && latest.outcome === 'NEEDS_CHANGES');
}

function testFileLooksEmptied(cwd, relPath) {
  const abs = path.join(cwd, relPath);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return true;
  const text = fs.readFileSync(abs, 'utf8');
  if (!text.trim()) return true;
  return !/\b(?:test|it|describe)\s*\(/.test(text);
}

/**
 * Bugfix runs may add/strengthen tests, not delete or empty them.
 * tiny presentational runs without failed_must do not trip this.
 */
export function detectTestIntegrityViolation(run, cwd = process.cwd(), { diff_paths = null, deleted_paths = null } = {}) {
  const result = { violated: false, paths: [], reason: null };
  if (!run) return result;
  if ((run.intensity || 'standard') === 'tiny' && !looksLikeFixRun(run, cwd)) return result;
  if (!looksLikeFixRun(run, cwd)) return result;
  const actual = Array.isArray(diff_paths)
    ? unique(diff_paths.map((item) => String(item || '').replace(/\\/g, '/')))
    : (collectGitDiffPaths(cwd) || []);
  const deleted = Array.isArray(deleted_paths)
    ? unique(deleted_paths.map((item) => String(item || '').replace(/\\/g, '/')))
    : collectGitDeletedPaths(cwd);
  const bad = [];
  for (const item of deleted) {
    if (isTestPath(item)) bad.push(item);
  }
  for (const item of actual) {
    if (!isTestPath(item)) continue;
    if (deleted.includes(item)) continue;
    if (testFileLooksEmptied(cwd, item)) bad.push(item);
  }
  if (!bad.length) return result;
  return {
    violated: true,
    paths: unique(bad),
    reason: 'bugfix must not delete or empty tests: ' + unique(bad).join(', ')
  };
}

export function buildPlanComplianceFindings(run, cwd = process.cwd(), { diff_paths = null } = {}) {
  const claimed = collectClaimedImplementationPaths(run, cwd);
  const actual = Array.isArray(diff_paths)
    ? unique(diff_paths.map((item) => String(item || '').replace(/\\/g, '/')))
    : collectGitDiffPaths(cwd);
  if (!claimed.length || !Array.isArray(actual) || !actual.length) return [];
  const mismatch = findImplementationPathMismatch(claimed, actual);
  if (!mismatch) return [];
  return [{
    id: 'F-COMPLIANCE-PLAN',
    severity: 'high',
    pass: 'compliance',
    importance: 'important',
    file: 'task_plan.md',
    line: 1,
    description: mismatch,
    status: 'OPEN',
    acceptance: '对齐 task_plan.md ## 计划 ### 当前（先把旧当前挪到已落地/已取代）'
  }];
}

export function getLatestReviewRecord(run, cwd = process.cwd()) {
  if (!run?.review?.latest_review_id) return null;
  const entry = Array.isArray(run.review.reviews)
    ? run.review.reviews.find((item) => item.review_id === run.review.latest_review_id) || run.review.reviews[run.review.reviews.length - 1]
    : null;
  if (!entry) return null;
  if (entry.path) {
    const abs = runMachineFileFor(run, entry.path, cwd);
    if (fs.existsSync(abs)) {
      try {
        return readJson(abs);
      } catch {
        // fall through to entry summary
      }
    }
  }
  return {
    review_id: entry.review_id,
    outcome: entry.outcome,
    reviewed_commit: entry.reviewed_commit || null,
    fix_commit: entry.fix_commit || null,
    review_scope: entry.review_scope || null,
    findings: []
  };
}

/**
 * Dual-layer ACCEPT judgment (layer 2). Mechanical layer is evaluateAcceptArchiveGate.
 * - tiny/auto: judgment may stay SKIPPED
 * - standard/if_review: existing review outcome rules apply (mechanical path)
 * - strict/required: accept_layers.judgment must be PASS
 * Error-class gate_issues always block unless waived or force.
 */
export function evaluateAcceptJudgment(run, { force = false } = {}) {
  if (force) return { ok: true, forced: true, reasons: [] };
  const reasons = [];
  const intensity = run?.intensity != null ? normalizeIntensity(run.intensity) : 'standard';
  const policy = INTENSITY_DEFAULTS[intensity].judgment_policy;
  const layers = run?.accept_layers || createEmptyAcceptLayers(intensity);

  if (policy === 'required') {
    if (layers.judgment !== 'PASS') {
      reasons.push(
        'strict intensity requires accept_layers.judgment=PASS (current='
        + (layers.judgment || 'missing')
        + '); use setAcceptLayer --layer judgment --status PASS after review/recheck'
      );
    }
  }

  const issues = Array.isArray(run?.gate_issues) ? run.gate_issues : [];
  for (const issue of issues) {
    if (!issue || issue.waived) continue;
    if (issue.class !== 'error') continue;
    const g = issue.gate || 'accept';
    if (g === 'accept' || g === 'archive' || g === '*') {
      reasons.push('gate_issue error' + (issue.code ? (' ' + issue.code) : '') + ': ' + (issue.message || 'blocking issue'));
    }
  }

  return { ok: reasons.length === 0, forced: false, reasons, policy, intensity, layers };
}

/**
 * Fingerprint of current deliver workspace state (diff paths + optional verify signal).
 * Used when --improved is omitted so agents cannot silently claim progress forever.
 */
export function fingerprintDeliverState(cwd = process.cwd(), { signal = null, paths = null } = {}) {
  let list = Array.isArray(paths) ? paths : collectGitDiffPaths(cwd);
  if (!Array.isArray(list)) list = [];
  const normalized = unique(
    list
      .map((item) => String(item || '').replace(/\\/g, '/'))
      .filter((item) => item && !isWorkflowNoisePath(item))
  ).sort();
  const payload = normalized.join('\n') + '\n#signal=' + (signal == null ? '' : String(signal));
  const fingerprint = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
  return { fingerprint, paths: normalized, signal: signal == null ? null : String(signal) };
}

/**
 * Record a DELIVER attempt for stagnation / budget tracking.
 * On no improvement for `stagnation.patience` attempts, or budget/max_iterations hit → BLOCKED.
 *
 * @param {boolean|null|undefined} improved - explicit true/false; if omitted, auto-compare fingerprint
 */
export function recordDeliverAttempt(runId, {
  improved = undefined,
  signal = null,
  score = null,
  paths = null,
  cwd = process.cwd()
} = {}) {
  const run = hydrateIntensityFields(loadRun(runId, cwd));
  run.iteration = (Number.isInteger(run.iteration) ? run.iteration : 0) + 1;

  const fp = fingerprintDeliverState(cwd, { signal, paths });
  let improvedSource = 'explicit';
  let resolvedImproved = improved;
  if (typeof improved !== 'boolean') {
    improvedSource = 'auto';
    const prevFp = run.stagnation?.last_fingerprint || null;
    if (prevFp == null) {
      // First attempt: establish baseline without counting as stagnation failure.
      resolvedImproved = true;
    } else {
      resolvedImproved = prevFp !== fp.fingerprint;
    }
  } else {
    resolvedImproved = improved;
  }

  const stag = run.stagnation;
  if (resolvedImproved) {
    stag.unchanged_count = 0;
  } else {
    stag.unchanged_count = (Number.isInteger(stag.unchanged_count) ? stag.unchanged_count : 0) + 1;
  }
  if (signal != null) stag.last_signal = String(signal);
  if (score != null) stag.last_score = score;
  stag.last_fingerprint = fp.fingerprint;
  run.stagnation = stag;

  const maxLoops = run.budget?.max_deliver_loops || run.max_iterations;
  const maxSame = run.budget?.max_same_strategy_failures || stag.patience || 2;
  const sameCap = Math.min(maxSame, stag.patience || maxSame);
  let blocked = false;
  let intervention = null;

  if (run.iteration >= run.max_iterations) {
    blocked = true;
    intervention = {
      kind: 'MAX_ITERATIONS',
      reason: 'iteration ' + run.iteration + ' reached max_iterations ' + run.max_iterations,
      unblock: 'Raise max_iterations, revise plan, or open a new run',
      at: nowIso()
    };
  } else if (run.iteration >= maxLoops) {
    blocked = true;
    intervention = {
      kind: 'MAX_ITERATIONS',
      reason: 'iteration ' + run.iteration + ' reached budget.max_deliver_loops ' + maxLoops,
      unblock: 'Raise budget.max_deliver_loops or change approach'
        + (effectiveGateSet(run) === 'lite' ? '; lite run: gate deliver FAIL (or scope growth) promotes to full and restores the intensity budget' : ''),
      at: nowIso()
    };
  } else if (!resolvedImproved && stag.unchanged_count >= sameCap) {
    blocked = true;
    intervention = {
      kind: 'STAGNATION',
      reason: 'no improvement for ' + stag.unchanged_count + ' deliver attempts (patience=' + (stag.patience || 2)
        + ', max_same_strategy_failures=' + maxSame + ')'
        + (stag.last_signal ? ('; signal=' + stag.last_signal) : '')
        + ' fp=' + fp.fingerprint,
      unblock: 'Change strategy, rollback-phase to PLAN, or set-status IN_PROGRESS after root-cause fix',
      at: nowIso()
    };
  }

  if (blocked) {
    run.status = 'BLOCKED';
    run.intervention_needed = intervention;
  }

  run.updated_at = nowIso();
  saveRun(run, cwd);
  if (blocked && intervention && intervention.kind === 'STAGNATION') {
    writeInstructionCorrection(runId, cwd, {
      count: stag.unchanged_count,
      repeated_signal: stag.last_signal || fp.fingerprint,
      proposed_rule: 'Do not retry the same deliver strategy after ' + sameCap + ' unchanged attempts; change approach and record the rule in AGENTS.md ## Agent corrections if it recurs.'
    });
  }
  appendProgressLine(
    runId,
    cwd,
    '- ' + run.updated_at
      + ' deliver-attempt improved=' + resolvedImproved
      + ' source=' + improvedSource
      + ' iteration=' + run.iteration
      + ' unchanged=' + stag.unchanged_count
      + ' fp=' + fp.fingerprint
      + (signal != null ? (' signal=' + String(signal)) : '')
      + (blocked ? (' BLOCKED kind=' + intervention.kind) : '')
  );
  const finding_hint = resolvedImproved === false ? maybeFindingHint(runId, cwd) : null;
  return {
    run,
    blocked,
    improved: resolvedImproved,
    improved_source: improvedSource,
    fingerprint: fp.fingerprint,
    iteration: run.iteration,
    stagnation: run.stagnation,
    intervention_needed: run.intervention_needed,
    status: run.status,
    finding_hint
  };
}

/**
 * Update accept dual-layer state (mechanical | judgment).
 * Does not set gates.accept; call setGate accept after layers are ready.
 */
export function setAcceptLayer(runId, {
  layer,
  status,
  mode = null,
  note = null,
  cwd = process.cwd()
} = {}) {
  if (layer !== 'mechanical' && layer !== 'judgment') {
    throw new Error('layer must be mechanical|judgment');
  }
  if (!ACCEPT_LAYER_STATUSES.includes(status)) {
    throw new Error('status must be one of ' + ACCEPT_LAYER_STATUSES.join('|'));
  }
  const run = hydrateIntensityFields(loadRun(runId, cwd));
  if (layer === 'judgment' && mode != null) {
    if (!JUDGMENT_MODES.includes(mode)) throw new Error('mode must be one of ' + JUDGMENT_MODES.join('|'));
    run.accept_layers.judgment_mode = mode;
    if (mode === 'recheck') {
      run.accept_layers.recheck_count = (run.accept_layers.recheck_count || 0) + 1;
      const maxRecheck = run.budget?.max_accept_rechecks || 2;
      if (run.accept_layers.recheck_count > maxRecheck) {
        throw new Error('accept recheck_count ' + run.accept_layers.recheck_count + ' exceeds budget.max_accept_rechecks ' + maxRecheck);
      }
    }
  }
  run.accept_layers[layer] = status;
  run.updated_at = nowIso();
  saveRun(run, cwd);
  appendProgressLine(
    runId,
    cwd,
    '- ' + run.updated_at
      + ' accept-layer ' + layer + '=' + status
      + (mode ? (' mode=' + mode) : '')
      + (note ? (' note=' + String(note).slice(0, 120)) : '')
  );
  return { run, layer, status, mode: run.accept_layers.judgment_mode, accept_layers: run.accept_layers };
}

/**
 * Append a structured gate issue (error blocks accept unless waived).
 */
export function addGateIssue(runId, {
  gate = 'accept',
  class: issueClass = 'warning',
  code = null,
  message,
  waived = false,
  cwd = process.cwd()
} = {}) {
  if (!GATE_ISSUE_CLASSES.includes(issueClass)) throw new Error('class must be error|warning|info');
  if (!message || typeof message !== 'string' || !message.trim()) throw new Error('message is required');
  const run = hydrateIntensityFields(loadRun(runId, cwd));
  const issue = {
    gate: gate || 'accept',
    class: issueClass,
    code: code || null,
    message: message.trim(),
    waived: Boolean(waived),
    at: nowIso()
  };
  run.gate_issues = [...(run.gate_issues || []), issue];
  run.updated_at = issue.at;
  saveRun(run, cwd);
  appendProgressLine(runId, cwd, '- ' + issue.at + ' gate-issue ' + issue.class + ' ' + (issue.code || '') + ' ' + issue.message);
  return { run, issue };
}

const STRONG_EVIDENCE_CLASSES = Object.freeze(['write-then-read', 'cross-path', 'runtime-env']);
const STRONG_EVIDENCE_ALLOW = Object.freeze({
  'write-then-read': /write_then_read:(mock_ok|runtime_ok)/,
  'cross-path': /cross_path:|write_then_read:(mock_ok|runtime_ok)/,
  'runtime-env': /runtime_env:|user_test:|uat:/i
});

function splitMarkdownTableCells(line) {
  return String(line || '').split('|').map((cell) => cell.trim()).filter((cell, index, all) => index > 0 && index < all.length);
}

/**
 * Parse acceptance.md evidence_class rows. Legacy 3-column stubs (no evidence_class
 * header) are skipped so older runs keep working. Over-claim is mechanical FAIL.
 */
export function inspectAcceptanceEvidence(run, cwd = process.cwd()) {
  const details = {
    path: null,
    header_has_class: false,
    weak_evidence_pass: false,
    rows: []
  };
  const runId = run?.run_id;
  if (!runId) return details;
  const rel = run?.artifact_refs?.acceptance;
  if (!rel) return details;
  details.path = path.join(runDir(runId, cwd), String(rel).replace(/\\/g, '/'));
  const raw = readRunArtifactText(run, 'acceptance', cwd);
  const body = extractAcceptanceActiveText(raw) || raw;
  const lines = body.split(/\r?\n/);
  const headerLine = lines.find((line) => line.includes('|') && /item|项/i.test(line) && !/^\|\s*---/.test(line));
  if (!headerLine) return details;
  const headers = splitMarkdownTableCells(headerLine).map((cell) => cell.toLowerCase());
  const classIdx = headers.indexOf('evidence_class');
  const resultIdx = headers.includes('result') ? headers.indexOf('result') : headers.indexOf('结果');
  const evidenceIdx = headers.includes('evidence') ? headers.indexOf('evidence') : headers.indexOf('证据');
  details.header_has_class = classIdx >= 0;
  if (classIdx < 0 || resultIdx < 0 || evidenceIdx < 0) return details;
  for (const line of lines) {
    if (!/^\|/.test(line) || /^\|\s*---/.test(line)) continue;
    const cells = splitMarkdownTableCells(line);
    if (!cells.length || /^(item|项)$/i.test(cells[0] || '')) continue;
    const evidenceClass = cells[classIdx] || '';
    const result = String(cells[resultIdx] || '').toUpperCase();
    const evidence = cells[evidenceIdx] || '';
    details.rows.push({ evidence_class: evidenceClass, result, evidence });
    if (result !== 'PASS' || !STRONG_EVIDENCE_CLASSES.includes(evidenceClass)) continue;
    const allow = STRONG_EVIDENCE_ALLOW[evidenceClass];
    const tokenOk = allow.test(evidence);
    const staticOnly = /^(diff|rg|static)$/i.test(evidence.trim())
      || (/\b(diff|rg|static)\b/i.test(evidence) && !tokenOk);
    if (!tokenOk || staticOnly) details.weak_evidence_pass = true;
  }
  return details;
}

/**
 * Product-consistency gate for ACCEPT/ARCHIVE PASS.
 * Blocks false completes when latest review is NEEDS_CHANGES/BLOCKED, when
 * plan/acceptance implementation paths diverge from the current diff set,
 * when deliver work is observed while gates.deliver is still pending, when
 * ARCHIVE would treat a working_tree review PASS as landed commit evidence,
 * or when acceptance.md over-claims a strong evidence_class with static proof.
 */
export function evaluateAcceptArchiveGate(run, { cwd = process.cwd(), force = false, diff_paths = null, deleted_paths = null, check_paths = true, gate = 'accept' } = {}) {
  const details = {
    review_outcome: null,
    review_id: null,
    review_scope: null,
    fix_commit: null,
    claimed_paths: [],
    actual_paths: [],
    path_check: 'skipped',
    deliver_outside_ledger: null,
    evidence_class: null
  };
  if (force) return { ok: true, forced: true, reasons: [], details: { ...details, path_check: 'forced' } };

  const reasons = [];
  const deliverGate = run?.gates?.deliver;
  if (deliverGate !== 'PASS' && deliverGate !== 'N/A') {
    reasons.push('accept/archive requires gates.deliver=PASS (or N/A); current=' + (deliverGate || 'missing'));
  }

  const deliverDrift = detectDeliverOutsideLedger(run, cwd, { diff_paths });
  details.deliver_outside_ledger = deliverDrift;
  if (deliverDrift.observed) {
    reasons.push('deliver work observed while gates.deliver is ' + (deliverDrift.deliver_gate || 'PENDING') + '; set deliver PASS or --force. signals=' + deliverDrift.signals.join(','));
  }

  const latest = getLatestReviewRecord(run, cwd);
  if (latest) {
    details.review_outcome = latest.outcome || null;
    details.review_id = latest.review_id || null;
    const scope = resolveReviewScope({
      review_scope: latest.review_scope,
      fix_commit: latest.fix_commit,
      reviewed_commit: latest.reviewed_commit
    });
    const fixSha = latest.fix_commit || latest.reviewed_commit || null;
    details.review_scope = scope;
    details.fix_commit = fixSha;
    if (latest.outcome === 'NEEDS_CHANGES' || latest.outcome === 'BLOCKED') {
      reasons.push('latest review ' + latest.review_id + ' is ' + latest.outcome + '; accept/archive PASS forbidden');
    }
    if (gate === 'archive' && latest.outcome === 'PASS') {
      if (scope !== 'commit' || !fixSha) {
        reasons.push('archive requires latest PASS review with review_scope=commit and fix_commit/reviewed_commit; got scope=' + scope + ' sha=' + (fixSha || 'null'));
      }
    }
  }

  if (check_paths) {
    const claimed = collectClaimedImplementationPaths(run, cwd);
    const actual = Array.isArray(diff_paths) ? unique(diff_paths.map((item) => String(item || '').replace(/\\/g, '/'))) : collectGitDiffPaths(cwd);
    details.claimed_paths = claimed;
    details.actual_paths = Array.isArray(actual) ? actual : [];
    if (claimed.length && Array.isArray(actual) && actual.length) {
      details.path_check = 'checked';
      const mismatch = findImplementationPathMismatch(claimed, actual);
      if (mismatch) reasons.push(mismatch);
    } else if (!claimed.length) {
      details.path_check = 'skipped_no_claims';
    } else if (actual === null) {
      details.path_check = 'skipped_no_git';
    } else {
      details.path_check = 'skipped_clean_tree';
    }
  }

  const evidence = inspectAcceptanceEvidence(run, cwd);
  details.evidence_class = evidence;
  if (evidence.weak_evidence_pass) {
    reasons.push('acceptance evidence_class over-claim: write-then-read/cross-path/runtime-env PASS requires class-minimum evidence (not diff/rg/static only)');
  }

  const integrity = detectTestIntegrityViolation(run, cwd, { diff_paths, deleted_paths });
  details.test_integrity = integrity;
  if (integrity.violated) reasons.push(integrity.reason);

  return { ok: reasons.length === 0, forced: false, reasons, details };
}

/**
 * lite aliases over the same five ledger keys (not schema keys):
 * brief = analyze+plan, close = accept+archive. deliver is shared.
 */
export const GATE_ALIASES = Object.freeze({
  brief: Object.freeze(['analyze', 'plan']),
  close: Object.freeze(['accept', 'archive'])
});

/** Aliases are only honoured on gate_set=lite; a promoted (full) run must walk the five gates. */
export function resolveGateKeys(gate, run) {
  if (GATE_KEYS.includes(gate)) return { alias: null, keys: [gate] };
  if (Object.hasOwn(GATE_ALIASES, gate)) {
    const gateSet = effectiveGateSet(run);
    if (gateSet !== 'lite') {
      throw new Error(
        'gate alias ' + gate + ' requires gate_set=lite (current=' + gateSet + '); use '
        + GATE_ALIASES[gate].join(' then ')
      );
    }
    return { alias: gate, keys: [...GATE_ALIASES[gate]] };
  }
  throw new Error(
    'invalid gate: ' + gate + ' (expected ' + GATE_KEYS.join('|')
    + '; lite aliases ' + Object.keys(GATE_ALIASES).join('|') + ')'
  );
}

/** One ledger key, in memory. close PASS reuses this for accept then archive, so no evidence gate is skipped. */
function applyGateKey(run, gate, status, { cwd, advance, force, diff_paths, deleted_paths }) {
  if (status === 'PASS' && (gate === 'accept' || gate === 'archive')) {
    const consistency = evaluateAcceptArchiveGate(run, { cwd, force, diff_paths, deleted_paths, gate });
    if (!consistency.ok) throw new Error('product-consistency gate blocked ' + gate + ' PASS: ' + consistency.reasons.join('; '));
    if (gate === 'accept') {
      const judgment = evaluateAcceptJudgment(run, { force });
      if (!judgment.ok) throw new Error('accept judgment layer blocked PASS: ' + judgment.reasons.join('; '));
      run.accept_layers.mechanical = 'PASS';
      // If judgment was SKIPPED under non-strict, leave it; if PASS already set, keep.
      if (run.accept_layers.judgment === 'PENDING' && INTENSITY_DEFAULTS[run.intensity || 'standard'].judgment_policy !== 'required') {
        run.accept_layers.judgment = 'SKIPPED';
      }
    }
  }
  if (status === 'FAIL' && gate === 'accept' && run.accept_layers) {
    run.accept_layers.mechanical = 'FAIL';
  }
  run.gates = { ...run.gates, [gate]: status };
  if (status === 'BLOCKED') {
    run.status = 'BLOCKED';
  } else if (run.status === 'BLOCKED' && status === 'PASS') {
    run.status = 'IN_PROGRESS';
  }
  if (advance && status === 'PASS') {
    const nextPhase = GATE_TO_PHASE[gate];
    if (nextPhase) run.phase = nextPhase;
    if (gate === 'archive') {
      run.status = 'COMPLETED';
      run.phase = 'ARCHIVE';
    }
  }
}

/**
 * Update one gate (or a lite alias); on PASS optionally advance phase (default true).
 * On a lite run any FAIL/BLOCKED promotes gate_set to full in the same task dir.
 */
export function setGate(runId, { gate, status, cwd = process.cwd(), advance = true, force = false, diff_paths = null, deleted_paths = null } = {}) {
  if (!GATE_KEYS.includes(gate) && !Object.hasOwn(GATE_ALIASES, gate)) {
    throw new Error('invalid gate: ' + gate + ' (expected ' + GATE_KEYS.join('|') + '; lite aliases ' + Object.keys(GATE_ALIASES).join('|') + ')');
  }
  if (!GATE_STATUS.includes(status)) throw new Error('invalid gate status: ' + status);
  const run = hydrateIntensityFields(loadRun(runId, cwd));
  const { alias, keys } = resolveGateKeys(gate, run);
  for (const key of keys) {
    applyGateKey(run, key, status, { cwd, advance, force, diff_paths, deleted_paths });
  }
  const promotion = (status === 'FAIL' || status === 'BLOCKED') && effectiveGateSet(run) === 'lite'
    ? promoteGateSetToFull(run, { reason: 'gate ' + gate + '=' + status })
    : { promoted: false, gate_set: effectiveGateSet(run), reason: null };
  if (keys.some((key) => key === 'accept' || key === 'archive') && shouldMaintainHandoff(run)) {
    applyHandoffState(run, { cwd, write_file: true });
  }
  run.updated_at = nowIso();
  saveRun(run, cwd);
  for (const key of keys) {
    appendProgressLine(
      runId,
      cwd,
      '- ' + run.updated_at + ' gate ' + key + '=' + status + ' phase=' + run.phase + ' status=' + run.status
        + (alias ? (' via=' + alias) : '')
    );
  }
  if (promotion.promoted) appendProgressLine(runId, cwd, promotionProgressLine(run.updated_at, promotion));
  return {
    run,
    gate,
    status,
    phase: run.phase,
    handoff: run.handoff || null,
    alias,
    gates_written: keys,
    gate_set: run.gate_set || 'full',
    promotion
  };
}

/** Apbacent phase rollback edges (ARCHIVE → ACCEPT allowed for same-run resume after soft archive). */
export const PHASE_ROLLBACK_EDGES = Object.freeze({
  PLAN: 'ANALYZE',
  DELIVER: 'PLAN',
  ACCEPT: 'DELIVER',
  ARCHIVE: 'ACCEPT'
});

const PHASE_TO_GATE = Object.freeze({
  ANALYZE: 'analyze',
  PLAN: 'plan',
  DELIVER: 'deliver',
  ACCEPT: 'accept',
  ARCHIVE: 'archive'
});

/**
 * Roll back phase along an allowed apbacent edge (e.g. ACCEPT → DELIVER, ARCHIVE → ACCEPT).
 * COMPLETED / ARCHIVE / ABANDONED are resumable in place (no terminal freeze).
 */
export function rollbackPhase(runId, {
  toPhase,
  reason,
  cwd = process.cwd(),
  leaveGateStatus = 'FAIL',
  resumeInProgress = true
} = {}) {
  if (!toPhase || !PHASES.includes(toPhase)) {
    throw new Error('toPhase must be one of ' + PHASES.join('|'));
  }
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new Error('reason is required for rollbackPhase');
  }
  if (!GATE_STATUS.includes(leaveGateStatus) && leaveGateStatus !== null) {
    throw new Error('leaveGateStatus must be a gate status or null');
  }
  const run = loadRun(runId, cwd);
  const expectedFrom = Object.entries(PHASE_ROLLBACK_EDGES).find(([, to]) => to === toPhase)?.[0];
  const allowedTo = PHASE_ROLLBACK_EDGES[run.phase];
  if (allowedTo !== toPhase) {
    throw new Error(
      'rollbackPhase only allows apbacent edges (got ' + run.phase + '→' + toPhase
        + '; allowed from ' + run.phase + ': ' + (allowedTo || 'none')
        + (expectedFrom ? '; ' + toPhase + ' is reached from ' + expectedFrom : '') + ')'
    );
  }

  const fromPhase = run.phase;
  const fromStatus = run.status;
  const toIdx = PHASES.indexOf(toPhase);
  const gates = { ...run.gates };
  // Leaving phase gate → FAIL (or leaveGateStatus); later phases → PENDING
  if (leaveGateStatus) {
    const leaveGate = PHASE_TO_GATE[toPhase];
    // Gate that advanced us into fromPhase is the gate of toPhase (e.g. deliver PASS → ACCEPT)
    if (leaveGate) gates[leaveGate] = leaveGateStatus;
  }
  for (let i = toIdx + 1; i < PHASES.length; i += 1) {
    const g = PHASE_TO_GATE[PHASES[i]];
    if (g) gates[g] = 'PENDING';
  }
  // Clear accept/archive when rolling back before them
  if (toIdx < PHASES.indexOf('ACCEPT')) {
    gates.accept = 'PENDING';
    gates.archive = 'PENDING';
  }

  run.gates = gates;
  run.phase = toPhase;
  if (
    resumeInProgress
    && (
      run.status === 'BLOCKED'
      || run.status === 'PAUSED'
      || run.status === 'READY_FOR_USER_TEST'
      || run.status === 'COMPLETED'
      || run.status === 'ABANDONED'
    )
  ) {
    run.status = 'IN_PROGRESS';
    run.intervention_needed = null;
  }
  // Rolling back writes a lite gate FAIL/BLOCKED → same fallback as setGate.
  const leaveGate = leaveGateStatus ? PHASE_TO_GATE[toPhase] : null;
  const promotion = leaveGate && (leaveGateStatus === 'FAIL' || leaveGateStatus === 'BLOCKED') && effectiveGateSet(run) === 'lite'
    ? promoteGateSetToFull(run, { reason: 'rollbackPhase ' + fromPhase + '→' + toPhase + ' ' + leaveGate + '=' + leaveGateStatus })
    : { promoted: false, gate_set: effectiveGateSet(run), reason: null };
  run.updated_at = nowIso();
  saveRun(run, cwd);
  appendProgressLine(
    runId,
    cwd,
    '- ' + run.updated_at + ' rollbackPhase ' + fromPhase + '→' + toPhase
      + (fromStatus !== run.status ? ' status=' + fromStatus + '→' + run.status : '')
      + ' reason=' + reason.trim()
  );
  if (promotion.promoted) appendProgressLine(runId, cwd, promotionProgressLine(run.updated_at, promotion));
  return {
    run,
    fromPhase,
    toPhase,
    status: run.status,
    reason: reason.trim(),
    promotion,
    finding_hint: maybeFindingHint(runId, cwd)
  };
}

function hoursBetween(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null;
  return Number(((to - from) / 3600000).toFixed(4));
}

function parseProgressEvents(progress) {
  const events = [];
  for (const line of String(progress || '').split(/\r?\n/)) {
    const gate = line.match(/(\d{4}-\d{2}-\d{2}T[^\s]+)\s+gate\s+(analyze|plan|deliver|accept|archive)=(PASS|FAIL|PENDING|N\/A|BLOCKED)/i);
    if (gate) {
      events.push({ kind: 'gate', at: gate[1], gate: gate[2].toLowerCase(), status: gate[3].toUpperCase() });
      continue;
    }
    const deliver = line.match(/(\d{4}-\d{2}-\d{2}T[^\s]+)\s+deliver-attempt\s+improved=(true|false)/i);
    if (deliver) {
      events.push({ kind: 'deliver-attempt', at: deliver[1], improved: deliver[2] === 'true' });
      continue;
    }
    const review = line.match(/(\d{4}-\d{2}-\d{2}T[^\s]+)\s+review\s+(REV-\d+)\s+(PASS|NEEDS_CHANGES|BLOCKED)/i);
    if (review) {
      events.push({ kind: 'review', at: review[1], review_id: review[2], outcome: review[3] });
    }
  }
  return events;
}

export function computeRunMetrics(run, cwd = process.cwd()) {
  const progress = readRunArtifactText(run, 'progress', cwd);
  const events = parseProgressEvents(progress);
  const first = (kind, extra) => events.find((item) => item.kind === kind && (!extra || extra(item)));
  const analyzePass = first('gate', (item) => item.gate === 'analyze' && item.status === 'PASS');
  const planPass = first('gate', (item) => item.gate === 'plan' && item.status === 'PASS');
  const deliverPass = first('gate', (item) => item.gate === 'deliver' && item.status === 'PASS');
  const firstDeliver = first('deliver-attempt');
  const deliverAttempts = events.filter((item) => item.kind === 'deliver-attempt');
  const falseDelivers = deliverAttempts.filter((item) => item.improved === false);
  const analyzeRework = /(?:\bSUPERSEDED\b|已取代)|\bfailed_must\b|\bover_claimed\b/i.test(progress)
    && Boolean(planPass);
  const latestReview = getLatestReviewRecord(run, cwd);
  const findings = Array.isArray(latestReview?.findings) ? latestReview.findings : [];
  const claimed = collectClaimedImplementationPaths(run, cwd);
  const actual = collectGitDiffPaths(cwd);
  let planDrift = null;
  if (claimed.length && Array.isArray(actual) && actual.length) {
    planDrift = Boolean(findImplementationPathMismatch(claimed, actual));
  }
  const hasClock = Boolean(run?.created_at && (analyzePass || planPass || run.updated_at));
  return {
    intent_to_analyze_hours: run?.artifact_refs?.intent && analyzePass
      ? hoursBetween(run.created_at, analyzePass.at)
      : null,
    analyze_to_plan_hours: hoursBetween(analyzePass?.at, planPass?.at),
    plan_to_first_deliver_hours: hoursBetween(planPass?.at, firstDeliver?.at || deliverPass?.at),
    first_pass_deliver: deliverAttempts.length ? falseDelivers.length === 0 && Boolean(deliverPass || firstDeliver?.improved) : null,
    deliver_rework_cycles: falseDelivers.length,
    analyze_rework_after_plan: Boolean(analyzeRework && planPass),
    plan_drift: planDrift,
    review_nit_count: findings.filter((item) => item.importance === 'nit' || item.severity === 'info').length,
    review_important_open: findings.filter((item) => item.status === 'OPEN' && item.importance === 'important').length,
    clock_quality: hasClock ? 'derived' : 'unknown'
  };
}

export function persistRunMetrics(runId, cwd = process.cwd()) {
  const run = loadRun(runId, cwd);
  assertWritableRun(run);
  run.metrics = computeRunMetrics(run, cwd);
  run.updated_at = nowIso();
  saveRun(run, cwd);
  return { run, metrics: run.metrics };
}

export function getStatus({ runId, cwd = process.cwd() } = {}) {
  if (runId) {
    const run = loadRun(runId, cwd);
    const metrics = computeRunMetrics(run, cwd);
    return { run, metrics, path: path.relative(cwd, runWorkspaceDir(run, cwd)).replaceAll(String.fromCharCode(92), String.fromCharCode(47)) };
  }
  const runs = listRuns(cwd);
  const mapExists = fs.existsSync(mapPath(cwd));
  const map = mapExists ? loadMap(cwd) : createEmptyMap();
  return { runs, map_path: mapExists ? RALPH_MAP_REL.replaceAll(String.fromCharCode(92), String.fromCharCode(47)) : null, map_capabilities: map.capabilities.length };
}
