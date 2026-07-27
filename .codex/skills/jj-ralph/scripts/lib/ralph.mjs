import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { assertStrictRalphRunId, buildArchiveDirNameFromRunId, loadNamingConfig } from './namingConfig.mjs';
import { attachKnowledgeRefs, formatKnowledgeRefsMarkdown } from './portfolioKnowledge.mjs';

export const RALPH_RUN_SCHEMA_VERSION = 'jj-flow/ralph-run/1.0';
export const RALPH_MAP_SCHEMA_VERSION = 'jj-flow/ralph-business-map/1.0';
export const RALPH_REVIEW_SCHEMA_VERSION = 'jj-flow/ralph-review/1.0';
export const RALPH_ROOT_REL = path.join('.workflow', 'ralph');
// Runs live directly under .workflow/ralph/RALPH-*/. Reserved siblings: business-map.json, archive/
export const RALPHS_DIR_REL = RALPH_ROOT_REL;
export const RALPH_ARCHIVE_DIR_REL = path.join(RALPH_ROOT_REL, 'archive');
export const RALPH_MAP_REL = path.join(RALPH_ROOT_REL, 'business-map.json');
export const RALPH_HANDOFF_SCHEMA_VERSION = 'jj-flow/ralph-handoff/1.1';
/** @deprecated external handoffs dir; new handoffs live under the run */
export const HANDOFF_ROOT_REL = path.join('.workflow', 'handoffs');

const PHASES = ['ANALYZE', 'PLAN', 'DELIVER', 'ACCEPT', 'ARCHIVE'];
const GATE_KEYS = ['analyze', 'plan', 'deliver', 'accept', 'archive'];
const REVIEW_OUTCOMES = ['PASS', 'NEEDS_CHANGES', 'BLOCKED'];
const FINDING_SEVERITIES = ['high', 'medium', 'low', 'info'];
const FINDING_STATUSES = ['OPEN', 'RESOLVED', 'WAIVED'];

export function ralphRoot(cwd = process.cwd()) { return path.join(cwd, RALPH_ROOT_REL); }
export function ralphsDir(cwd = process.cwd()) { return path.join(cwd, RALPHS_DIR_REL); }
export function archiveDir(cwd = process.cwd()) { return path.join(cwd, RALPH_ARCHIVE_DIR_REL); }
export function mapPath(cwd = process.cwd()) { return path.join(cwd, RALPH_MAP_REL); }
export function runDir(runId, cwd = process.cwd()) { return path.join(ralphsDir(cwd), runId); }
export function runJsonPath(runId, cwd = process.cwd()) { return path.join(runDir(runId, cwd), 'run.json'); }
export function nowIso() { return new Date().toISOString(); }
export function createEmptyMap() { return { schema_version: RALPH_MAP_SCHEMA_VERSION, updated_at: nowIso(), capabilities: [] }; }
function unique(items) { return [...new Set((items || []).filter(Boolean))]; }

export function createRunSkeleton({ run_id, title, goal, scope = { in: [], out: [] }, capability_ids = [], knowledge_refs = [], knowledge_summary = [], max_iterations = 20, created_at = nowIso() } = {}) {
  if (!run_id || !/^RALPH-[A-Za-z0-9][A-Za-z0-9_-]{1,80}$/.test(run_id)) throw new Error('run_id must match RALPH-<slug> pattern');
  if (!title) throw new Error('title is required');
  if (!goal) throw new Error('goal is required');
  return {
    schema_version: RALPH_RUN_SCHEMA_VERSION,
    run_id,
    title,
    phase: 'ANALYZE',
    status: 'IN_PROGRESS',
    goal,
    scope: { in: [...(scope.in || [])], out: [...(scope.out || [])] },
    assumptions: [],
    iteration: 0,
    max_iterations,
    tasks: [],
    gates: { analyze: 'PENDING', plan: 'PENDING', deliver: 'PENDING', accept: 'PENDING', archive: 'PENDING' },
    intervention_needed: null,
    capability_ids: [...capability_ids],
    knowledge_refs: unique(knowledge_refs),
    knowledge_summary: [...(knowledge_summary || [])],
    artifact_refs: { analyze: 'analyze.md', plan: 'plan.md', acceptance: 'acceptance.md', progress: 'progress.md', handoff_ref: null, dispatch_snapshot_ref: null, latest_review_ref: null },
    review: null,
    family: null,
    handoff: null,
    dispatch_recommendation: null,
    created_at,
    updated_at: created_at
  };
}

export function validateRun(run) {
  const errors = [];
  if (!run || typeof run !== 'object') return ['run must be an object'];
  if (run.schema_version !== RALPH_RUN_SCHEMA_VERSION) errors.push('schema_version must be ' + RALPH_RUN_SCHEMA_VERSION);
  if (!run.run_id || !/^RALPH-[A-Za-z0-9][A-Za-z0-9_-]{1,80}$/.test(run.run_id)) errors.push('invalid run_id');
  if (!run.title) errors.push('title required');
  if (!run.goal) errors.push('goal required');
  if (!PHASES.includes(run.phase)) errors.push('invalid phase: ' + run.phase);
  if (!['IN_PROGRESS', 'READY_FOR_USER_TEST', 'BLOCKED', 'PAUSED', 'COMPLETED'].includes(run.status)) errors.push('invalid status: ' + run.status);
  if (!run.scope || !Array.isArray(run.scope.in) || !Array.isArray(run.scope.out)) errors.push('scope.in and scope.out must be arrays');
  if (!Number.isInteger(run.iteration) || run.iteration < 0) errors.push('iteration must be >= 0');
  if (!Number.isInteger(run.max_iterations) || run.max_iterations < 1) errors.push('max_iterations must be >= 1');
  if (!Array.isArray(run.tasks)) errors.push('tasks must be array');
  if (!run.gates || typeof run.gates !== 'object') errors.push('gates required');
  else for (const key of GATE_KEYS) if (!run.gates[key]) errors.push('gates.' + key + ' required');
  if (!Array.isArray(run.capability_ids)) errors.push('capability_ids must be array');
  if (run.knowledge_refs != null && !Array.isArray(run.knowledge_refs)) errors.push('knowledge_refs must be array when present');
  if (Array.isArray(run.knowledge_refs) && run.knowledge_refs.some((ref) => typeof ref !== 'string' || !ref.trim())) errors.push('knowledge_refs must be non-empty strings');
  if (run.knowledge_summary != null && !Array.isArray(run.knowledge_summary)) errors.push('knowledge_summary must be array when present');
  if (!run.artifact_refs?.analyze || !run.artifact_refs?.plan || !run.artifact_refs?.acceptance || !run.artifact_refs?.progress) errors.push('artifact_refs incomplete');
  if (run.review != null) {
    if (typeof run.review !== 'object' || Array.isArray(run.review)) errors.push('review must be object or null');
    else {
      if (!run.review.latest_review_id) errors.push('review.latest_review_id required');
      if (!Array.isArray(run.review.reviews)) errors.push('review.reviews must be array');
    }
  }
  if (!run.created_at || !run.updated_at) errors.push('created_at and updated_at required');
  return errors;
}

export function validateMap(map) {
  const errors = [];
  if (!map || typeof map !== 'object') return ['map must be an object'];
  if (map.schema_version !== RALPH_MAP_SCHEMA_VERSION) errors.push('schema_version must be ' + RALPH_MAP_SCHEMA_VERSION);
  if (!map.updated_at) errors.push('updated_at required');
  if (!Array.isArray(map.capabilities)) errors.push('capabilities must be array');
  else {
    for (const [i, cap] of map.capabilities.entries()) {
      if (!cap?.id?.startsWith('CAP-')) errors.push('capabilities[' + i + '].id invalid');
      if (!cap?.title) errors.push('capabilities[' + i + '].title required');
      if (!['active', 'done', 'deprecated'].includes(cap?.status)) errors.push('capabilities[' + i + '].status invalid');
      if (!Array.isArray(cap?.run_refs) || !cap.run_refs.length) errors.push('capabilities[' + i + '].run_refs required');
    }
  }
  return errors;
}

export function validateReviewReport(report) {
  const errors = [];
  if (!report || typeof report !== 'object') return ['review must be an object'];
  if (report.schema_version !== RALPH_REVIEW_SCHEMA_VERSION) errors.push('schema_version must be ' + RALPH_REVIEW_SCHEMA_VERSION);
  if (!report.review_id || !/^REV-[1-9][0-9]*$/.test(report.review_id)) errors.push('review_id must match REV-<n>');
  if (!report.run_id || !/^RALPH-[A-Za-z0-9][A-Za-z0-9_-]{1,80}$/.test(report.run_id)) errors.push('invalid run_id');
  if (!REVIEW_OUTCOMES.includes(report.outcome)) errors.push('invalid outcome');
  if (report.reviewed_commit != null && (typeof report.reviewed_commit !== 'string' || report.reviewed_commit.length < 7)) errors.push('reviewed_commit must be null or >= 7 chars');
  if (!Array.isArray(report.findings)) errors.push('findings must be array');
  else {
    for (const [i, finding] of report.findings.entries()) {
      if (!finding?.id) errors.push('findings[' + i + '].id required');
      if (!FINDING_SEVERITIES.includes(finding?.severity)) errors.push('findings[' + i + '].severity invalid');
      if (!finding?.file) errors.push('findings[' + i + '].file required');
      if (!Number.isInteger(finding?.line) || finding.line < 1) errors.push('findings[' + i + '].line must be positive integer');
      if (!finding?.description) errors.push('findings[' + i + '].description required');
      if (!FINDING_STATUSES.includes(finding?.status)) errors.push('findings[' + i + '].status invalid');
      if (!finding?.acceptance) errors.push('findings[' + i + '].acceptance required');
    }
  }
  if (report.outcome === 'PASS' && report.findings?.some((item) => item.status === 'OPEN')) errors.push('PASS cannot keep OPEN findings');
  if (report.outcome === 'NEEDS_CHANGES' && !report.findings?.some((item) => item.status === 'OPEN')) errors.push('NEEDS_CHANGES requires at least one OPEN finding');
  if (!report.recorded_at) errors.push('recorded_at required');
  return errors;
}

export function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + String.fromCharCode(10), 'utf8');
}

export function loadRun(runId, cwd = process.cwd()) {
  const filePath = runJsonPath(runId, cwd);
  if (!fs.existsSync(filePath)) throw new Error('run not found: ' + runId);
  const run = readJson(filePath);
  const errors = validateRun(run);
  if (errors.length) throw new Error('invalid run.json: ' + errors.join('; '));
  return run;
}

export function saveRun(run, cwd = process.cwd()) {
  const errors = validateRun(run);
  if (errors.length) throw new Error('invalid run: ' + errors.join('; '));
  writeJson(runJsonPath(run.run_id, cwd), run);
  return runJsonPath(run.run_id, cwd);
}

export function loadMap(cwd = process.cwd()) {
  const filePath = mapPath(cwd);
  if (!fs.existsSync(filePath)) return createEmptyMap();
  const map = readJson(filePath);
  const errors = validateMap(map);
  if (errors.length) throw new Error('invalid business-map.json: ' + errors.join('; '));
  return map;
}

export function saveMap(map, cwd = process.cwd()) {
  const errors = validateMap(map);
  if (errors.length) throw new Error('invalid map: ' + errors.join('; '));
  writeJson(mapPath(cwd), map);
  return mapPath(cwd);
}

export function listRuns(cwd = process.cwd()) {
  const root = ralphsDir(cwd);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('RALPH-'))
    .map((entry) => {
      const filePath = path.join(root, entry.name, 'run.json');
      if (!fs.existsSync(filePath)) return { run_id: entry.name, phase: null, status: null, title: null };
      try {
        const run = readJson(filePath);
        return { run_id: run.run_id || entry.name, phase: run.phase || null, status: run.status || null, title: run.title || null, updated_at: run.updated_at || null };
      } catch {
        return { run_id: entry.name, phase: null, status: null, title: null };
      }
    })
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
}

export function initRun(options, cwd = process.cwd()) {
  const naming = loadNamingConfig();
  if (options?.strict_naming !== false && naming.ralph?.legacy_tolerance?.create_must_follow_config !== false) {
    assertStrictRalphRunId(options.run_id || options.runId, naming);
  }
  const runOptions = { ...options };
  if (options?.attach_knowledge !== false && !(options?.knowledge_refs?.length)) {
    const pack = attachKnowledgeRefs({
      title: options.title,
      goal: options.goal,
      project: options.project || options.project_key || null,
      q: options.knowledge_query || '',
      cwd,
      limit: options.knowledge_limit || 12
    });
    runOptions.knowledge_refs = pack.knowledge_refs || [];
    runOptions.knowledge_summary = pack.knowledge_summary || [];
    runOptions._knowledge_attach = pack;
  } else {
    runOptions.knowledge_refs = options.knowledge_refs || [];
    runOptions.knowledge_summary = options.knowledge_summary || [];
  }
  const run = createRunSkeleton(runOptions);
  const dir = runDir(run.run_id, cwd);
  if (fs.existsSync(dir) && !options.force) throw new Error('run already exists: ' + run.run_id + ' (use --force to overwrite skeleton)');
  fs.mkdirSync(dir, { recursive: true });
  saveRun(run, cwd);
  const nl = String.fromCharCode(10);
  const knowledgeMd = formatKnowledgeRefsMarkdown({
    knowledge_refs: run.knowledge_refs || [],
    knowledge_summary: run.knowledge_summary || []
  });
  const stubs = {
    'analyze.md': '# Analyze' + nl + nl + 'run_id: ' + run.run_id + nl + nl + knowledgeMd + nl + nl + '## MUST' + nl + nl + '## OUT' + nl + nl + '## Acceptance' + nl + nl + '## UNRESOLVED' + nl,
    'plan.md': '# Plan' + nl + nl + 'run_id: ' + run.run_id + nl + nl + knowledgeMd + nl + nl + '## Tasks' + nl + nl + '## Out of scope' + nl,
    'progress.md': '# Progress' + nl + nl + '- ' + nowIso() + ' init ' + run.run_id + nl + '- knowledge_refs: ' + ((run.knowledge_refs || []).join(', ') || '(none)') + nl,
    'acceptance.md': '# Acceptance' + nl + nl + 'run_id: ' + run.run_id + nl + nl + '| item | result | evidence |' + nl + '| --- | --- | --- |' + nl
  };
  for (const [name, bodyText] of Object.entries(stubs)) {
    const filePath = path.join(dir, name);
    if (!fs.existsSync(filePath) || options.force) fs.writeFileSync(filePath, bodyText, 'utf8');
  }
  if (runOptions._knowledge_attach) {
    writeJson(path.join(dir, 'knowledge-attach.json'), {
      ...runOptions._knowledge_attach,
      attached_at: nowIso(),
      run_id: run.run_id
    });
  }
  return run;
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else fs.copyFileSync(from, to);
  }
}


/** Prefer archive dir `YYYY-MM-DD-{name}` without duplicating trailing YYYYMMDD from run_id. */
export function defaultArchiveDirName(runId, now = new Date()) {
  return buildArchiveDirNameFromRunId(runId, now, loadNamingConfig());
}

export function archiveRun(runId, { cwd = process.cwd(), slug } = {}) {
  const run = loadRun(runId, cwd);
  if (run.gates.accept !== 'PASS') throw new Error('archive requires gates.accept=PASS');
  const folder = slug || defaultArchiveDirName(run.run_id);
  const destRel = path.join(RALPH_ARCHIVE_DIR_REL, folder);
  const destAbs = path.join(cwd, destRel);
  if (fs.existsSync(destAbs)) throw new Error('archive already exists: ' + destRel.replaceAll(String.fromCharCode(92), String.fromCharCode(47)));
  const sourceAbs = runDir(runId, cwd);
  // Finalize active run first so the frozen archive copy includes COMPLETED state.
  run.phase = 'ARCHIVE';
  run.status = 'COMPLETED';
  run.gates.archive = 'PASS';
  run.updated_at = nowIso();
  saveRun(run, cwd);
  copyTree(sourceAbs, destAbs);
  const files = [];
  function walk(dir, rel = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const nextRel = rel ? rel + '/' + entry.name : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, nextRel);
      else files.push({ path: nextRel.replaceAll(String.fromCharCode(92), String.fromCharCode(47)), sha256: sha256File(full) });
    }
  }
  walk(destAbs);
  const manifest = {
    schema_version: 'jj-flow/ralph-archive/1.0',
    run_id: run.run_id,
    archived_at: nowIso(),
    archive_path: destRel.replaceAll(String.fromCharCode(92), String.fromCharCode(47)),
    files
  };
  writeJson(path.join(sourceAbs, 'archive-manifest.json'), manifest);
  writeJson(path.join(destAbs, 'archive-manifest.json'), manifest);
  // refresh in-memory run after manifest write (active tree now has manifest)
  const latest = loadRun(runId, cwd);
  return { run: latest, archive_path: destRel.replaceAll(String.fromCharCode(92), String.fromCharCode(47)), manifest };
}

/** map-merge then archive; default accept-PASS closeout. */
export function finalizeRun(runId, { cwd = process.cwd(), slug, modules = [], lessons = [], keywords = [], acceptance = [], status = 'done', force = false } = {}) {
  const runBefore = loadRun(runId, cwd);
  if (shouldMaintainHandoff(runBefore)) {
    applyHandoffState(runBefore, { cwd, write_file: true });
    saveRun(runBefore, cwd);
  }
  const merged = mapMergeFromRun(runId, { modules, lessons, keywords, acceptance, status, force }, cwd);
  const archived = archiveRun(runId, { cwd, slug });
  return {
    run: archived.run,
    archive_path: archived.archive_path,
    manifest: archived.manifest,
    capability: merged.capability,
    map_path: RALPH_MAP_REL.replaceAll(String.fromCharCode(92), String.fromCharCode(47)),
    handoff: archived.run.handoff || null
  };
}

export function capabilityFromRun(run, { modules = [], lessons = [], keywords = [], acceptance = [], status = 'done' } = {}) {
  const id = run.capability_ids?.[0] || ('CAP-' + run.run_id.replace(/^RALPH-/, '').toLowerCase());
  const defaultAcceptance = path.join(RALPHS_DIR_REL, run.run_id, 'acceptance.md').replaceAll(String.fromCharCode(92), String.fromCharCode(47));
  return {
    id,
    title: run.title,
    status,
    summary: run.goal,
    modules,
    lessons,
    keywords: unique([...(keywords || []), ...tokenize(run.title), ...tokenize(run.goal)]),
    acceptance: unique([...(acceptance || []), defaultAcceptance]),
    run_refs: [run.run_id]
  };
}

export function mergeCapabilityIntoMap(map, capability) {
  const next = { schema_version: RALPH_MAP_SCHEMA_VERSION, updated_at: nowIso(), capabilities: [...(map.capabilities || [])] };
  const index = next.capabilities.findIndex((item) => item.id === capability.id);
  if (index < 0) next.capabilities.push(normalizeCapability(capability));
  else {
    const existing = next.capabilities[index];
    next.capabilities[index] = normalizeCapability({
      ...existing,
      ...capability,
      modules: unique([...(existing.modules || []), ...(capability.modules || [])]),
      lessons: unique([...(existing.lessons || []), ...(capability.lessons || [])]),
      keywords: unique([...(existing.keywords || []), ...(capability.keywords || [])]),
      acceptance: unique([...(existing.acceptance || []), ...(capability.acceptance || [])]),
      run_refs: unique([...(existing.run_refs || []), ...(capability.run_refs || [])])
    });
  }
  return next;
}

function normalizeCapability(capability) {
  return { id: capability.id, title: capability.title, status: capability.status, summary: capability.summary || '', modules: unique(capability.modules || []), lessons: unique(capability.lessons || []), keywords: unique(capability.keywords || []), acceptance: unique(capability.acceptance || []), run_refs: unique(capability.run_refs || []) };
}

export function mapMergeFromRun(runId, options = {}, cwd = process.cwd()) {
  const run = loadRun(runId, cwd);
  if (run.gates?.accept !== 'PASS' && !options.force) {
    throw new Error('map-merge requires gates.accept=PASS (pass force:true or --force to override)');
  }
  const map = loadMap(cwd);
  const capability = capabilityFromRun(run, options);
  const next = mergeCapabilityIntoMap(map, capability);
  saveMap(next, cwd);
  return { map: next, capability };
}

export function tokenize(text = '') {
  return String(text).toLowerCase().split(/[^a-z0-9\u4e00-\u9fff]+/i).map((item) => item.trim()).filter((item) => item.length >= 2);
}

export function findInMap(map, query, { limit = 10 } = {}) {
  const tokens = tokenize(query);
  const matches = [];
  for (const cap of map.capabilities || []) {
    const hay = [cap.id, cap.title, cap.summary, ...(cap.keywords || []), ...(cap.modules || []), ...(cap.lessons || []), ...(cap.run_refs || [])].join(' ').toLowerCase();
    let score = 0;
    for (const token of tokens) if (hay.includes(token)) score += 1;
    if (!tokens.length && query && hay.includes(String(query).toLowerCase())) score = 1;
    if (score > 0) {
      const run_refs = cap.run_refs || [];
      const sep = String.fromCharCode(92);
      const discover_paths = [];
      for (const runId of run_refs) {
        for (const name of ['run.json', 'progress.md', 'analyze.md', 'plan.md', 'acceptance.md']) {
          discover_paths.push(path.join(RALPHS_DIR_REL, runId, name).split(sep).join('/'));
        }
      }
      matches.push({ id: cap.id, title: cap.title, score, status: cap.status, run_refs, lessons: cap.lessons || [], discover_paths });
    }
  }
  matches.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return matches.slice(0, limit);
}

export function mapFind(query, { cwd = process.cwd(), limit = 10 } = {}) {
  const map = loadMap(cwd);
  return { query, matches: findInMap(map, query, { limit }), map_path: fs.existsSync(mapPath(cwd)) ? RALPH_MAP_REL.replaceAll(String.fromCharCode(92), String.fromCharCode(47)) : null };
}

function readGitSourceFacts(cwd = process.cwd()) {
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

function shouldMaintainHandoff(run, { force = false, targets_hint = [] } = {}) {
  if (force) return true;
  if (run.handoff) return true;
  if (run.family?.enabled) return true;
  if (Array.isArray(run.family?.targets) && run.family.targets.length) return true;
  if (Array.isArray(targets_hint) && targets_hint.length) return true;
  const scopeText = [...(run.scope?.in || []), ...(run.scope?.out || []), run.goal || '', run.title || ''].join(' ');
  return new RegExp('兑接|承载|sibling|交接|迁移|三端|同源').test(scopeText);
}

export function applyHandoffState(run, { cwd = process.cwd(), targets_hint = [], thread_id = null, must = null, do_not_port = null, mode = null, write_file = true } = {}) {
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
  const handoff_id = run.handoff?.handoff_id || ('HOF-' + run.run_id.replace(/^RALPH-/, ''));
  const relDir = path.join(RALPH_ROOT_REL, run.run_id, 'handoff').replaceAll(String.fromCharCode(92), String.fromCharCode(47));
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
  const snapId = 'SNAP-' + run.run_id.replace(/^RALPH-/, '');
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

function nextReviewId(run) {
  const existing = Array.isArray(run.review?.reviews) ? run.review.reviews : [];
  let max = 0;
  for (const item of existing) {
    const match = String(item.review_id || '').match(/^REV-([1-9][0-9]*)$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return 'REV-' + (max + 1);
}

function normalizeFindings(findings = []) {
  return findings.map((finding, index) => ({
    id: finding.id || ('F-' + (index + 1)),
    severity: finding.severity || 'medium',
    file: finding.file || 'unknown',
    line: Number.isInteger(finding.line) ? finding.line : 1,
    description: finding.description || '',
    status: finding.status || 'OPEN',
    acceptance: finding.acceptance || '待确认'
  }));
}

export function recordReview(runId, { cwd = process.cwd(), outcome, reviewed_commit = null, task_thread_id = null, review_thread_id = null, summary = '', findings = [], evidence_refs = [], review_id } = {}) {
  if (!REVIEW_OUTCOMES.includes(outcome)) throw new Error('outcome must be one of ' + REVIEW_OUTCOMES.join(', '));
  const run = loadRun(runId, cwd);
  const id = review_id || nextReviewId(run);
  if (review_id && run.review?.reviews?.some((item) => item.review_id === review_id)) throw new Error('review already exists: ' + review_id);
  const report = {
    schema_version: RALPH_REVIEW_SCHEMA_VERSION,
    review_id: id,
    run_id: run.run_id,
    outcome,
    reviewed_commit: reviewed_commit || null,
    task_thread_id: task_thread_id || run.review?.task_thread_id || null,
    review_thread_id: review_thread_id || null,
    summary: summary || '',
    findings: normalizeFindings(findings),
    evidence_refs: unique(evidence_refs),
    recorded_at: nowIso()
  };
  const errors = validateReviewReport(report);
  if (errors.length) throw new Error('invalid review: ' + errors.join('; '));
  const relPath = path.join('reviews', id + '.json').replaceAll(String.fromCharCode(92), String.fromCharCode(47));
  writeJson(path.join(runDir(runId, cwd), relPath), report);
  const entry = { review_id: id, path: relPath, outcome: report.outcome, reviewed_commit: report.reviewed_commit, task_thread_id: report.task_thread_id, review_thread_id: report.review_thread_id, recorded_at: report.recorded_at };
  const previous = run.review && typeof run.review === 'object' ? run.review : { latest_review_id: null, task_thread_id: null, reviews: [] };
  const reviews = Array.isArray(previous.reviews) ? [...previous.reviews, entry] : [entry];
  run.review = { latest_review_id: id, task_thread_id: report.task_thread_id || previous.task_thread_id || null, reviews };
  run.artifact_refs = { ...run.artifact_refs, latest_review_ref: relPath };
  run.updated_at = nowIso();
  saveRun(run, cwd);
  const progressPath = path.join(runDir(runId, cwd), 'progress.md');
  const nl = String.fromCharCode(10);
  let line = '- ' + report.recorded_at + ' review ' + id + ' ' + outcome;
  if (report.reviewed_commit) line += ' commit=' + report.reviewed_commit;
  if (report.task_thread_id) line += ' task_thread=' + report.task_thread_id;
  if (report.review_thread_id) line += ' review_thread=' + report.review_thread_id;
  line += nl;
  if (fs.existsSync(progressPath)) fs.appendFileSync(progressPath, line, 'utf8');
  else fs.writeFileSync(progressPath, '# Progress' + nl + nl + line, 'utf8');
  return { run, report, path: path.join(RALPHS_DIR_REL, runId, relPath).replaceAll(String.fromCharCode(92), String.fromCharCode(47)) };
}


const GATE_STATUS = ['PENDING', 'PASS', 'FAIL', 'N/A', 'BLOCKED'];
const GATE_TO_PHASE = {
  analyze: 'PLAN',
  plan: 'DELIVER',
  deliver: 'ACCEPT',
  accept: 'ACCEPT',
  archive: 'ARCHIVE'
};

/** Update one gate; on PASS optionally advance phase (default true). */
export function setGate(runId, { gate, status, cwd = process.cwd(), advance = true } = {}) {
  if (!GATE_KEYS.includes(gate)) throw new Error('invalid gate: ' + gate + ' (expected ' + GATE_KEYS.join('|') + ')');
  if (!GATE_STATUS.includes(status)) throw new Error('invalid gate status: ' + status);
  const run = loadRun(runId, cwd);
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
  if ((gate === 'accept' || gate === 'archive') && shouldMaintainHandoff(run)) {
    applyHandoffState(run, { cwd, write_file: true });
  }
  run.updated_at = nowIso();
  saveRun(run, cwd);
  return { run, gate, status, phase: run.phase, handoff: run.handoff || null };
}

export function commitPrep(runId, cwd = process.cwd()) {
  const run = loadRun(runId, cwd);
  const base = path.join(RALPHS_DIR_REL, runId).replaceAll(String.fromCharCode(92), String.fromCharCode(47));
  const files = [
    path.join(base, 'run.json').replaceAll(String.fromCharCode(92), String.fromCharCode(47)),
    path.join(base, run.artifact_refs.analyze).replaceAll(String.fromCharCode(92), String.fromCharCode(47)),
    path.join(base, run.artifact_refs.plan).replaceAll(String.fromCharCode(92), String.fromCharCode(47)),
    path.join(base, run.artifact_refs.progress).replaceAll(String.fromCharCode(92), String.fromCharCode(47)),
    path.join(base, run.artifact_refs.acceptance).replaceAll(String.fromCharCode(92), String.fromCharCode(47))
  ];
  if (run.artifact_refs?.latest_review_ref) files.push(path.join(base, run.artifact_refs.latest_review_ref).replaceAll(String.fromCharCode(92), String.fromCharCode(47)));
  if (Array.isArray(run.review?.reviews)) for (const item of run.review.reviews) if (item?.path) files.push(path.join(base, item.path).replaceAll(String.fromCharCode(92), String.fromCharCode(47)));
  if (run.handoff?.path) {
    files.push(path.join(run.handoff.path, 'handoff.json').replaceAll(String.fromCharCode(92), String.fromCharCode(47)));
    files.push(path.join(run.handoff.path, 'source.md').replaceAll(String.fromCharCode(92), String.fromCharCode(47)));
  }
  if (run.artifact_refs?.dispatch_snapshot_ref) files.push(run.artifact_refs.dispatch_snapshot_ref);
  const uniqueFiles = unique(files);
  const nl = String.fromCharCode(10);
  const message = ['chore(ralph): ' + run.title, '', 'run_id: ' + run.run_id, 'phase: ' + run.phase, 'status: ' + run.status, 'capabilities: ' + ((run.capability_ids || []).join(', ') || 'n/a')].join(nl);
  return { run_id: run.run_id, title: run.title, phase: run.phase, status: run.status, suggested_message: message, files: uniqueFiles, note: '默认不执行 git commit/push；仅生成可提交清单与建议 message。' };
}

export function renderRalphStatusText(payload) {
  if (payload.run) {
    const run = payload.run;
    const latestReview = run.review?.latest_review_id ? run.review.reviews?.find((item) => item.review_id === run.review.latest_review_id) || null : null;
    const nl = String.fromCharCode(10);
    return [
      'Ralph run: ' + run.run_id,
      'title: ' + run.title,
      'phase: ' + run.phase,
      'status: ' + run.status,
      'iteration: ' + run.iteration + '/' + run.max_iterations,
      'gates: analyze=' + run.gates.analyze + ' plan=' + run.gates.plan + ' deliver=' + run.gates.deliver + ' accept=' + run.gates.accept + ' archive=' + run.gates.archive,
      'capabilities: ' + ((run.capability_ids || []).join(', ') || '(none)'),
      'knowledge_refs: ' + ((run.knowledge_refs || []).join(', ') || '(none)'),
      latestReview ? ('review: ' + latestReview.review_id + ' ' + latestReview.outcome + (latestReview.reviewed_commit ? (' @' + latestReview.reviewed_commit) : '')) : 'review: none',
      run.intervention_needed ? ('intervention: ' + run.intervention_needed.reason) : 'intervention: none',
      'path: ' + (payload.path || '')
    ].join(nl);
  }
  const nl = String.fromCharCode(10);
  const lines = ['Ralph runs:', ...(payload.runs || []).map((item) => '- ' + item.run_id + ' · ' + (item.phase || '?') + ' · ' + (item.status || '?') + (item.title ? (' · ' + item.title) : ''))];
  if (payload.map_path) lines.push('business-map: ' + payload.map_path);
  if (payload.map_capabilities != null) lines.push('capabilities: ' + payload.map_capabilities);
  return lines.join(nl);
}

export function getStatus({ runId, cwd = process.cwd() } = {}) {
  if (runId) {
    const run = loadRun(runId, cwd);
    return { run, path: path.relative(cwd, runDir(runId, cwd)).replaceAll(String.fromCharCode(92), String.fromCharCode(47)) };
  }
  const runs = listRuns(cwd);
  const mapExists = fs.existsSync(mapPath(cwd));
  const map = mapExists ? loadMap(cwd) : createEmptyMap();
  return { runs, map_path: mapExists ? RALPH_MAP_REL.replaceAll(String.fromCharCode(92), String.fromCharCode(47)) : null, map_capabilities: map.capabilities.length };
}

export { loadNamingConfig, buildArchiveDirNameFromRunId, assertStrictRalphRunId, normalizeRalphSlug, buildRalphRunId } from './namingConfig.mjs';
