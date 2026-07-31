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
export const REVIEW_SCOPES = ['working_tree', 'commit'];
/** Provenance for host-first jj-review adapter; optional on REV reports. */
export const REVIEW_SOURCES = ['host_builtin', 'user_provided', 'fallback_inline'];
export const HOST_REVIEW_METHODS = ['skill', 'command', 'subagent', 'user_provided', 'fallback_inline'];
export const HOST_IDS = ['codex', 'grok-build', 'claude', 'qoder', 'other'];

/** Run intensity tiers: speed/quality tradeoff without multi-agent runtime. */
export const RALPH_INTENSITIES = Object.freeze(['tiny', 'standard', 'strict']);
export const ACCEPT_LAYER_STATUSES = Object.freeze(['PENDING', 'PASS', 'FAIL', 'SKIPPED']);
export const JUDGMENT_MODES = Object.freeze(['none', 'review', 'recheck', 'adversarial_note']);
export const GATE_ISSUE_CLASSES = Object.freeze(['error', 'warning', 'info']);
export const INTENSITY_DEFAULTS = Object.freeze({
  tiny: Object.freeze({
    max_iterations: 8,
    budget: Object.freeze({ max_deliver_loops: 8, max_accept_rechecks: 1, max_same_strategy_failures: 2 }),
    stagnation_patience: 2,
    judgment_policy: 'auto'
  }),
  standard: Object.freeze({
    max_iterations: 20,
    budget: Object.freeze({ max_deliver_loops: 20, max_accept_rechecks: 2, max_same_strategy_failures: 2 }),
    stagnation_patience: 2,
    judgment_policy: 'if_review'
  }),
  strict: Object.freeze({
    max_iterations: 12,
    budget: Object.freeze({ max_deliver_loops: 12, max_accept_rechecks: 3, max_same_strategy_failures: 2 }),
    stagnation_patience: 2,
    judgment_policy: 'required'
  })
});

export function normalizeIntensity(intensity) {
  const value = String(intensity == null || intensity === '' ? 'standard' : intensity).toLowerCase();
  if (!RALPH_INTENSITIES.includes(value)) {
    throw new Error('intensity must be one of ' + RALPH_INTENSITIES.join('|'));
  }
  return value;
}

export function buildBudgetForIntensity(intensity, overrides = null) {
  const base = INTENSITY_DEFAULTS[normalizeIntensity(intensity)].budget;
  const o = overrides && typeof overrides === 'object' ? overrides : {};
  const pick = (key) => {
    if (o[key] == null) return base[key];
    const n = Number(o[key]);
    if (!Number.isInteger(n) || n < 1) throw new Error('budget.' + key + ' must be integer >= 1');
    return n;
  };
  return {
    max_deliver_loops: pick('max_deliver_loops'),
    max_accept_rechecks: pick('max_accept_rechecks'),
    max_same_strategy_failures: pick('max_same_strategy_failures')
  };
}

export function createEmptyStagnation(intensity = 'standard') {
  const patience = INTENSITY_DEFAULTS[normalizeIntensity(intensity)].stagnation_patience;
  return { patience, unchanged_count: 0, last_signal: null, last_score: null, last_fingerprint: null };
}

export function createEmptyAcceptLayers(intensity = 'standard') {
  const policy = INTENSITY_DEFAULTS[normalizeIntensity(intensity)].judgment_policy;
  return {
    mechanical: 'PENDING',
    judgment: policy === 'required' ? 'PENDING' : 'SKIPPED',
    judgment_mode: 'none',
    recheck_count: 0
  };
}

function hydrateIntensityFields(run) {
  if (!run || typeof run !== 'object') return run;
  const intensity = run.intensity != null ? normalizeIntensity(run.intensity) : 'standard';
  if (run.intensity == null) run.intensity = intensity;
  if (!run.budget || typeof run.budget !== 'object') run.budget = buildBudgetForIntensity(intensity);
  else {
    const d = INTENSITY_DEFAULTS[intensity].budget;
    run.budget = {
      max_deliver_loops: run.budget.max_deliver_loops ?? d.max_deliver_loops,
      max_accept_rechecks: run.budget.max_accept_rechecks ?? d.max_accept_rechecks,
      max_same_strategy_failures: run.budget.max_same_strategy_failures ?? d.max_same_strategy_failures
    };
  }
  if (!run.stagnation || typeof run.stagnation !== 'object') run.stagnation = createEmptyStagnation(intensity);
  else {
    const empty = createEmptyStagnation(intensity);
    run.stagnation = {
      patience: run.stagnation.patience ?? empty.patience,
      unchanged_count: run.stagnation.unchanged_count ?? 0,
      last_signal: run.stagnation.last_signal ?? null,
      last_score: run.stagnation.last_score ?? null,
      last_fingerprint: run.stagnation.last_fingerprint ?? null
    };
  }
  if (!run.accept_layers || typeof run.accept_layers !== 'object') run.accept_layers = createEmptyAcceptLayers(intensity);
  else {
    const empty = createEmptyAcceptLayers(intensity);
    run.accept_layers = {
      mechanical: run.accept_layers.mechanical || empty.mechanical,
      judgment: run.accept_layers.judgment || empty.judgment,
      judgment_mode: run.accept_layers.judgment_mode || empty.judgment_mode,
      recheck_count: Number.isInteger(run.accept_layers.recheck_count) ? run.accept_layers.recheck_count : 0
    };
  }
  if (!Array.isArray(run.gate_issues)) run.gate_issues = [];
  if (run.plan_options === undefined) run.plan_options = null;
  return run;
}

export function ralphRoot(cwd = process.cwd()) { return path.join(cwd, RALPH_ROOT_REL); }
export function ralphsDir(cwd = process.cwd()) { return path.join(cwd, RALPHS_DIR_REL); }
export function archiveDir(cwd = process.cwd()) { return path.join(cwd, RALPH_ARCHIVE_DIR_REL); }
export function mapPath(cwd = process.cwd()) { return path.join(cwd, RALPH_MAP_REL); }
export function runDir(runId, cwd = process.cwd()) { return path.join(ralphsDir(cwd), runId); }
export function runJsonPath(runId, cwd = process.cwd()) { return path.join(runDir(runId, cwd), 'run.json'); }
export function nowIso() { return new Date().toISOString(); }
export function createEmptyMap() { return { schema_version: RALPH_MAP_SCHEMA_VERSION, updated_at: nowIso(), capabilities: [] }; }
function unique(items) { return [...new Set((items || []).filter(Boolean))]; }

export function createRunSkeleton({
  run_id,
  title,
  goal,
  scope = { in: [], out: [] },
  capability_ids = [],
  knowledge_refs = [],
  knowledge_summary = [],
  max_iterations = null,
  intensity = 'standard',
  budget = null,
  host = null,
  created_at = nowIso()
} = {}) {
  if (!run_id || !/^RALPH-[A-Za-z0-9][A-Za-z0-9_-]{1,80}$/.test(run_id)) throw new Error('run_id must match RALPH-<slug> pattern');
  if (!title) throw new Error('title is required');
  if (!goal) throw new Error('goal is required');
  const intensityNorm = normalizeIntensity(intensity);
  const defaults = INTENSITY_DEFAULTS[intensityNorm];
  const maxIter = max_iterations != null ? max_iterations : defaults.max_iterations;
  if (!Number.isInteger(maxIter) || maxIter < 1) throw new Error('max_iterations must be >= 1');
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
    max_iterations: maxIter,
    intensity: intensityNorm,
    budget: buildBudgetForIntensity(intensityNorm, budget),
    stagnation: createEmptyStagnation(intensityNorm),
    accept_layers: createEmptyAcceptLayers(intensityNorm),
    gate_issues: [],
    plan_options: null,
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
    host: normalizeHostMeta(host),
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
  // Optional intensity / budget / dual-accept fields (legacy runs omit them).
  if (run.intensity != null && !RALPH_INTENSITIES.includes(String(run.intensity).toLowerCase())) {
    errors.push('intensity must be tiny|standard|strict');
  }
  if (run.budget != null) {
    if (typeof run.budget !== 'object' || Array.isArray(run.budget)) errors.push('budget must be object when present');
    else {
      for (const key of ['max_deliver_loops', 'max_accept_rechecks', 'max_same_strategy_failures']) {
        if (run.budget[key] != null && (!Number.isInteger(run.budget[key]) || run.budget[key] < 1)) {
          errors.push('budget.' + key + ' must be integer >= 1');
        }
      }
    }
  }
  if (run.stagnation != null) {
    if (typeof run.stagnation !== 'object' || Array.isArray(run.stagnation)) errors.push('stagnation must be object when present');
    else {
      if (run.stagnation.patience != null && (!Number.isInteger(run.stagnation.patience) || run.stagnation.patience < 1)) {
        errors.push('stagnation.patience must be integer >= 1');
      }
      if (run.stagnation.unchanged_count != null && (!Number.isInteger(run.stagnation.unchanged_count) || run.stagnation.unchanged_count < 0)) {
        errors.push('stagnation.unchanged_count must be integer >= 0');
      }
    }
  }
  if (run.accept_layers != null) {
    if (typeof run.accept_layers !== 'object' || Array.isArray(run.accept_layers)) errors.push('accept_layers must be object when present');
    else {
      for (const key of ['mechanical', 'judgment']) {
        if (run.accept_layers[key] != null && !ACCEPT_LAYER_STATUSES.includes(run.accept_layers[key])) {
          errors.push('accept_layers.' + key + ' invalid');
        }
      }
      if (run.accept_layers.judgment_mode != null && !JUDGMENT_MODES.includes(run.accept_layers.judgment_mode)) {
        errors.push('accept_layers.judgment_mode must be one of ' + JUDGMENT_MODES.join('|'));
      }
      if (run.accept_layers.recheck_count != null && (!Number.isInteger(run.accept_layers.recheck_count) || run.accept_layers.recheck_count < 0)) {
        errors.push('accept_layers.recheck_count must be integer >= 0');
      }
    }
  }
  if (run.gate_issues != null) {
    if (!Array.isArray(run.gate_issues)) errors.push('gate_issues must be array when present');
    else {
      for (const [i, issue] of run.gate_issues.entries()) {
        if (!issue || typeof issue !== 'object') errors.push('gate_issues[' + i + '] must be object');
        else if (issue.class != null && !GATE_ISSUE_CLASSES.includes(issue.class)) {
          errors.push('gate_issues[' + i + '].class invalid');
        }
      }
    }
  }
  if (run.plan_options != null) {
    if (typeof run.plan_options !== 'object' || Array.isArray(run.plan_options)) {
      errors.push('plan_options must be object or null');
    }
  }
  if (run.host != null) {
    if (typeof run.host !== 'object' || Array.isArray(run.host)) errors.push('host must be object or null');
    else {
      if (run.host.host_id != null && !HOST_IDS.includes(run.host.host_id)) errors.push('invalid host.host_id');
      for (const key of ['handle_kind', 'thread_id', 'session_handle', 'model_id', 'export_path']) {
        if (run.host[key] != null && (typeof run.host[key] !== 'string' || !String(run.host[key]).trim())) errors.push('host.' + key + ' must be non-empty string or null');
      }
    }
  }
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
  if (report.fix_commit != null && (typeof report.fix_commit !== 'string' || report.fix_commit.length < 7)) errors.push('fix_commit must be null or >= 7 chars');
  if (report.review_scope != null && !REVIEW_SCOPES.includes(report.review_scope)) errors.push('review_scope must be working_tree|commit');
  if (report.review_scope === 'commit' && !(report.fix_commit || report.reviewed_commit)) errors.push('review_scope=commit requires fix_commit or reviewed_commit');
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
  if (report.source != null && !REVIEW_SOURCES.includes(report.source)) {
    errors.push('source must be one of ' + REVIEW_SOURCES.join(', '));
  }
  if (report.host_review != null) {
    if (typeof report.host_review !== 'object' || Array.isArray(report.host_review)) {
      errors.push('host_review must be an object when present');
    } else {
      if (report.host_review.method != null && !HOST_REVIEW_METHODS.includes(report.host_review.method)) {
        errors.push('host_review.method must be one of ' + HOST_REVIEW_METHODS.join(', '));
      }
      if (report.host_review.artifact_paths != null && !Array.isArray(report.host_review.artifact_paths)) {
        errors.push('host_review.artifact_paths must be array when present');
      }
    }
  }
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
    'progress.md': '# Progress' + nl + nl + '- ' + nowIso() + ' init ' + run.run_id + nl
      + '- intensity: ' + (run.intensity || 'standard') + nl
      + '- max_iterations: ' + run.max_iterations + nl
      + '- knowledge_refs: ' + ((run.knowledge_refs || []).join(', ') || '(none)') + nl,
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

export function archiveRun(runId, { cwd = process.cwd(), slug, force = false, diff_paths = null } = {}) {
  const run = loadRun(runId, cwd);
  if (run.gates.accept !== 'PASS') throw new Error('archive requires gates.accept=PASS');
  const consistency = evaluateAcceptArchiveGate(run, { cwd, force, diff_paths, gate: 'archive' });
  if (!consistency.ok) throw new Error('archive blocked by product-consistency gate: ' + consistency.reasons.join('; '));
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
export function finalizeRun(runId, { cwd = process.cwd(), slug, modules = [], lessons = [], keywords = [], acceptance = [], status = 'done', force = false, diff_paths = null } = {}) {
  const runBefore = loadRun(runId, cwd);
  if (shouldMaintainHandoff(runBefore)) {
    applyHandoffState(runBefore, { cwd, write_file: true });
    saveRun(runBefore, cwd);
  }
  const merged = mapMergeFromRun(runId, { modules, lessons, keywords, acceptance, status, force }, cwd);
  const archived = archiveRun(runId, { cwd, slug, force, diff_paths });
  return {
    run: archived.run,
    archive_path: archived.archive_path,
    manifest: archived.manifest,
    capability: merged.capability,
    map_path: RALPH_MAP_REL.replaceAll(String.fromCharCode(92), String.fromCharCode(47)),
    handoff: archived.run.handoff || null
  };
}

/**
 * Weak "pheromone" lessons from run ledger (stagnation / budget / intensity).
 * Merged into business-map on map-merge so map-find can surface past pain.
 */
export function deriveAutoLessonsFromRun(run, cwd = process.cwd()) {
  if (!run || typeof run !== 'object') return [];
  const out = [];
  const kind = run.intervention_needed?.kind;
  if (kind === 'STAGNATION') {
    out.push(
      'STAGNATION on ' + run.run_id
      + ': deliver loop stalled'
      + (run.stagnation?.last_signal ? (' (signal=' + run.stagnation.last_signal + ')') : '')
      + '; change strategy or narrow scope'
    );
  }
  if (kind === 'MAX_ITERATIONS') {
    out.push('MAX_ITERATIONS on ' + run.run_id + ': raise budget or split scope');
  }
  if (run.intensity === 'strict') {
    out.push('intensity=strict on ' + run.run_id + ': required judgment layer before accept');
  }
  try {
    const progress = readRunArtifactText(run, 'progress', cwd);
    if (progress && /BLOCKED kind=STAGNATION|kind=STAGNATION/i.test(progress) && kind !== 'STAGNATION') {
      out.push('prior STAGNATION signals on ' + run.run_id + ': avoid repeating the same failed approach');
    }
  } catch {
    // progress optional
  }
  return unique(out);
}

export function capabilityFromRun(run, { modules = [], lessons = [], keywords = [], acceptance = [], status = 'done', cwd = process.cwd() } = {}) {
  const id = run.capability_ids?.[0] || ('CAP-' + run.run_id.replace(/^RALPH-/, '').toLowerCase());
  const defaultAcceptance = path.join(RALPHS_DIR_REL, run.run_id, 'acceptance.md').replaceAll(String.fromCharCode(92), String.fromCharCode(47));
  const autoLessons = deriveAutoLessonsFromRun(run, cwd);
  return {
    id,
    title: run.title,
    status,
    summary: run.goal,
    modules,
    lessons: unique([...(lessons || []), ...autoLessons]),
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
  const capability = capabilityFromRun(run, { ...options, cwd });
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


export function normalizeHostMeta(host = null) {
  if (host == null || host === undefined) return null;
  if (typeof host !== 'object' || Array.isArray(host)) throw new Error('host must be object or null');
  const normalized = {
    host_id: host.host_id || null,
    handle_kind: host.handle_kind || null,
    thread_id: host.thread_id || null,
    session_handle: host.session_handle || null,
    model_id: host.model_id || null,
    export_path: host.export_path || null
  };
  if (normalized.host_id != null && !HOST_IDS.includes(normalized.host_id)) throw new Error('invalid host_id: ' + normalized.host_id);
  for (const key of ['handle_kind', 'thread_id', 'session_handle', 'model_id', 'export_path']) {
    if (normalized[key] != null) {
      const value = String(normalized[key]).trim();
      normalized[key] = value || null;
    }
  }
  if (!normalized.host_id && !normalized.thread_id && !normalized.session_handle && !normalized.model_id && !normalized.export_path && !normalized.handle_kind) return null;
  return normalized;
}

export function recordHostMeta(runId, hostPatch = {}, cwd = process.cwd()) {
  const run = loadRun(runId, cwd);
  run.host = normalizeHostMeta({ ...(run.host || {}), ...(hostPatch || {}) });
  run.updated_at = nowIso();
  saveRun(run, cwd);
  return { run, host: run.host };
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

export function normalizeHostReview(host_review = null) {
  if (host_review == null || host_review === '') return null;
  if (typeof host_review === 'string') {
    try {
      host_review = JSON.parse(host_review);
    } catch {
      throw new Error('host_review must be a JSON object or object string');
    }
  }
  if (typeof host_review !== 'object' || Array.isArray(host_review)) {
    throw new Error('host_review must be an object when present');
  }
  const method = host_review.method != null && String(host_review.method).trim()
    ? String(host_review.method).trim()
    : null;
  if (method && !HOST_REVIEW_METHODS.includes(method)) {
    throw new Error('host_review.method must be one of ' + HOST_REVIEW_METHODS.join(', '));
  }
  return {
    method,
    entry: host_review.entry != null && String(host_review.entry).trim() ? String(host_review.entry).trim() : null,
    artifact_paths: unique(Array.isArray(host_review.artifact_paths) ? host_review.artifact_paths.map(String) : []),
    note: host_review.note != null && String(host_review.note).trim() ? String(host_review.note) : null
  };
}

export function recordReview(runId, {
  cwd = process.cwd(),
  outcome,
  reviewed_commit = null,
  fix_commit = null,
  review_scope = null,
  task_thread_id = null,
  review_thread_id = null,
  summary = '',
  findings = [],
  evidence_refs = [],
  review_id,
  source = null,
  host_review = null
} = {}) {
  if (!REVIEW_OUTCOMES.includes(outcome)) throw new Error('outcome must be one of ' + REVIEW_OUTCOMES.join(', '));
  if (source != null && source !== '' && !REVIEW_SOURCES.includes(source)) {
    throw new Error('source must be one of ' + REVIEW_SOURCES.join(', '));
  }
  const run = hydrateIntensityFields(loadRun(runId, cwd));
  const id = review_id || nextReviewId(run);
  if (review_id && run.review?.reviews?.some((item) => item.review_id === review_id)) throw new Error('review already exists: ' + review_id);
  const resolvedFix = fix_commit || null;
  const resolvedReviewed = reviewed_commit || null;
  const resolvedScope = resolveReviewScope({ review_scope, fix_commit: resolvedFix, reviewed_commit: resolvedReviewed });
  const resolvedSource = source != null && source !== '' ? source : null;
  const resolvedHostReview = normalizeHostReview(host_review);
  const report = {
    schema_version: RALPH_REVIEW_SCHEMA_VERSION,
    review_id: id,
    run_id: run.run_id,
    outcome,
    reviewed_commit: resolvedReviewed,
    fix_commit: resolvedFix || (resolvedScope === 'commit' ? resolvedReviewed : null),
    review_scope: resolvedScope,
    task_thread_id: task_thread_id || run.review?.task_thread_id || null,
    review_thread_id: review_thread_id || null,
    summary: summary || '',
    findings: normalizeFindings(findings),
    evidence_refs: unique(evidence_refs),
    recorded_at: nowIso()
  };
  if (resolvedSource) report.source = resolvedSource;
  if (resolvedHostReview) report.host_review = resolvedHostReview;
  const errors = validateReviewReport(report);
  if (errors.length) throw new Error('invalid review: ' + errors.join('; '));
  const relPath = path.join('reviews', id + '.json').replaceAll(String.fromCharCode(92), String.fromCharCode(47));
  writeJson(path.join(runDir(runId, cwd), relPath), report);
  const entry = {
    review_id: id,
    path: relPath,
    outcome: report.outcome,
    reviewed_commit: report.reviewed_commit,
    fix_commit: report.fix_commit,
    review_scope: report.review_scope,
    task_thread_id: report.task_thread_id,
    review_thread_id: report.review_thread_id,
    recorded_at: report.recorded_at
  };
  if (report.source) entry.source = report.source;
  const previous = run.review && typeof run.review === 'object' ? run.review : { latest_review_id: null, task_thread_id: null, reviews: [] };
  const reviews = Array.isArray(previous.reviews) ? [...previous.reviews, entry] : [entry];
  run.review = { latest_review_id: id, task_thread_id: report.task_thread_id || previous.task_thread_id || null, reviews };
  run.artifact_refs = { ...run.artifact_refs, latest_review_ref: relPath };
  // Dual-layer accept: review outcome drives judgment layer (strict needs this before gate accept).
  run.accept_layers = run.accept_layers || createEmptyAcceptLayers(run.intensity || 'standard');
  if (outcome === 'PASS') {
    run.accept_layers.judgment = 'PASS';
    run.accept_layers.judgment_mode = 'review';
  } else if (outcome === 'NEEDS_CHANGES' || outcome === 'BLOCKED') {
    run.accept_layers.judgment = 'FAIL';
    run.accept_layers.judgment_mode = 'review';
  }
  run.updated_at = nowIso();
  saveRun(run, cwd);
  const progressPath = path.join(runDir(runId, cwd), 'progress.md');
  const nl = String.fromCharCode(10);
  let line = '- ' + report.recorded_at + ' review ' + id + ' ' + outcome;
  if (report.reviewed_commit) line += ' commit=' + report.reviewed_commit;
  if (report.fix_commit) line += ' fix_commit=' + report.fix_commit;
  if (report.review_scope) line += ' scope=' + report.review_scope;
  if (report.source) line += ' source=' + report.source;
  if (report.task_thread_id) line += ' task_thread=' + report.task_thread_id;
  if (report.review_thread_id) line += ' review_thread=' + report.review_thread_id;
  line += ' accept_layers.judgment=' + run.accept_layers.judgment;
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

const LEDGER_CODE_EXT_RE = /\.(?:vue|ts|tsx|js|jsx|mjs|cjs|css|scss|less|sass|json|mdx?)$/i;
const LEDGER_PATH_EXCLUDE = new Set([
  'analyze.md', 'plan.md', 'acceptance.md', 'progress.md', 'run.json', 'handoff.json',
  'archive-manifest.json', 'business-map.json', 'package.json', 'package-lock.json',
  'pnpm-lock.yaml', 'yarn.lock', 'tsconfig.json', 'jsconfig.json', 'readme.md'
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

function readRunArtifactText(run, key, cwd) {
  const rel = run?.artifact_refs?.[key];
  if (!rel) return '';
  const abs = path.join(runDir(run.run_id, cwd), rel);
  if (!fs.existsSync(abs)) return '';
  return fs.readFileSync(abs, 'utf8');
}

export function collectClaimedImplementationPaths(run, cwd = process.cwd()) {
  const claimed = [];
  if (Array.isArray(run?.scope?.in)) {
    for (const item of run.scope.in) {
      const normalized = normalizeLedgerPathRef(item);
      if (normalized) claimed.push(normalized);
    }
  }
  claimed.push(...extractLedgerPathRefs(readRunArtifactText(run, 'plan', cwd)));
  claimed.push(...extractLedgerPathRefs(readRunArtifactText(run, 'acceptance', cwd)));
  return unique(claimed);
}

export function getLatestReviewRecord(run, cwd = process.cwd()) {
  if (!run?.review?.latest_review_id) return null;
  const entry = Array.isArray(run.review.reviews)
    ? run.review.reviews.find((item) => item.review_id === run.review.latest_review_id) || run.review.reviews[run.review.reviews.length - 1]
    : null;
  if (!entry) return null;
  if (entry.path) {
    const abs = path.join(runDir(run.run_id, cwd), entry.path);
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
      unblock: 'Raise budget.max_deliver_loops or change approach',
      at: nowIso()
    };
  } else if (!resolvedImproved && stag.unchanged_count >= (stag.patience || 2)) {
    blocked = true;
    intervention = {
      kind: 'STAGNATION',
      reason: 'no improvement for ' + stag.unchanged_count + ' deliver attempts (patience=' + (stag.patience || 2) + ')'
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
  return {
    run,
    blocked,
    improved: resolvedImproved,
    improved_source: improvedSource,
    fingerprint: fp.fingerprint,
    iteration: run.iteration,
    stagnation: run.stagnation,
    intervention_needed: run.intervention_needed,
    status: run.status
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

/**
 * Product-consistency gate for ACCEPT/ARCHIVE PASS.
 * Blocks false completes when latest review is NEEDS_CHANGES/BLOCKED, when
 * plan/acceptance implementation paths diverge from the current diff set,
 * when deliver work is observed while gates.deliver is still pending, or when
 * ARCHIVE would treat a working_tree review PASS as landed commit evidence.
 */
export function evaluateAcceptArchiveGate(run, { cwd = process.cwd(), force = false, diff_paths = null, check_paths = true, gate = 'accept' } = {}) {
  const details = {
    review_outcome: null,
    review_id: null,
    review_scope: null,
    fix_commit: null,
    claimed_paths: [],
    actual_paths: [],
    path_check: 'skipped',
    deliver_outside_ledger: null
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

  return { ok: reasons.length === 0, forced: false, reasons, details };
}

/** Update one gate; on PASS optionally advance phase (default true). */
export function setGate(runId, { gate, status, cwd = process.cwd(), advance = true, force = false, diff_paths = null } = {}) {
  if (!GATE_KEYS.includes(gate)) throw new Error('invalid gate: ' + gate + ' (expected ' + GATE_KEYS.join('|') + ')');
  if (!GATE_STATUS.includes(status)) throw new Error('invalid gate status: ' + status);
  const run = hydrateIntensityFields(loadRun(runId, cwd));
  if (status === 'PASS' && (gate === 'accept' || gate === 'archive')) {
    const consistency = evaluateAcceptArchiveGate(run, { cwd, force, diff_paths, gate });
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
  if ((gate === 'accept' || gate === 'archive') && shouldMaintainHandoff(run)) {
    applyHandoffState(run, { cwd, write_file: true });
  }
  run.updated_at = nowIso();
  saveRun(run, cwd);
  appendProgressLine(runId, cwd, '- ' + run.updated_at + ' gate ' + gate + '=' + status + ' phase=' + run.phase + ' status=' + run.status);
  return { run, gate, status, phase: run.phase, handoff: run.handoff || null };
}

/** Adjacent phase rollback edges only (ARCHIVE cannot roll back). */
export const PHASE_ROLLBACK_EDGES = Object.freeze({
  PLAN: 'ANALYZE',
  DELIVER: 'PLAN',
  ACCEPT: 'DELIVER'
});

const PHASE_TO_GATE = Object.freeze({
  ANALYZE: 'analyze',
  PLAN: 'plan',
  DELIVER: 'deliver',
  ACCEPT: 'accept',
  ARCHIVE: 'archive'
});

/**
 * Roll back phase along an allowed adjacent edge (e.g. ACCEPT → DELIVER).
 * COMPLETED runs must open a new run; ARCHIVE is not reopenable in place.
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
  if (run.status === 'COMPLETED') {
    throw new Error(
      'COMPLETED run cannot rollbackPhase in place; init a new run and chain supersedes_run_id in progress.md (not run.json)'
    );
  }
  if (run.phase === 'ARCHIVE') {
    throw new Error(
      'ARCHIVE phase cannot rollback; init a new run and chain supersedes_run_id in progress.md (not run.json)'
    );
  }
  const expectedFrom = Object.entries(PHASE_ROLLBACK_EDGES).find(([, to]) => to === toPhase)?.[0];
  const allowedTo = PHASE_ROLLBACK_EDGES[run.phase];
  if (allowedTo !== toPhase) {
    throw new Error(
      'rollbackPhase only allows adjacent edges (got ' + run.phase + '→' + toPhase
        + '; allowed from ' + run.phase + ': ' + (allowedTo || 'none')
        + (expectedFrom ? '; ' + toPhase + ' is reached from ' + expectedFrom : '') + ')'
    );
  }

  const fromPhase = run.phase;
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
  if (resumeInProgress && (run.status === 'BLOCKED' || run.status === 'PAUSED' || run.status === 'READY_FOR_USER_TEST')) {
    run.status = 'IN_PROGRESS';
  }
  run.updated_at = nowIso();
  saveRun(run, cwd);
  appendProgressLine(
    runId,
    cwd,
    '- ' + run.updated_at + ' rollbackPhase ' + fromPhase + '→' + toPhase + ' reason=' + reason.trim()
  );
  return { run, fromPhase, toPhase, status: run.status, reason: reason.trim() };
}

/**
 * Formal status transitions: IN_PROGRESS ↔ PAUSED/BLOCKED; reject COMPLETED reopen.
 */
export function setRunStatus(runId, { status, reason, cwd = process.cwd() } = {}) {
  const allowed = ['IN_PROGRESS', 'READY_FOR_USER_TEST', 'BLOCKED', 'PAUSED'];
  if (!allowed.includes(status)) {
    throw new Error('setRunStatus status must be one of ' + allowed.join('|') + ' (COMPLETED requires a new run)');
  }
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new Error('reason is required for setRunStatus');
  }
  const run = loadRun(runId, cwd);
  if (run.status === 'COMPLETED') {
    throw new Error(
      'COMPLETED run cannot change status in place; init a new run and chain supersedes_run_id in progress.md (not run.json)'
    );
  }
  if (run.phase === 'ARCHIVE' && run.status === 'COMPLETED') {
    throw new Error('archived COMPLETED run cannot change status');
  }
  const from = run.status;
  run.status = status;
  run.updated_at = nowIso();
  if (status === 'BLOCKED' || status === 'PAUSED') {
    run.intervention_needed = {
      kind: status === 'PAUSED' ? 'PAUSED' : 'BLOCKED',
      reason: reason.trim(),
      at: run.updated_at
    };
  } else if (from === 'BLOCKED' || from === 'PAUSED') {
    run.intervention_needed = null;
  }
  saveRun(run, cwd);
  appendProgressLine(
    runId,
    cwd,
    '- ' + run.updated_at + ' setRunStatus ' + from + '→' + status + ' reason=' + reason.trim()
  );
  return { run, from, status, reason: reason.trim() };
}

/** Suggest metadata for a new run that supersedes a COMPLETED/ARCHIVE run (does not create files). */
export function suggestReopenAsNew(oldRun, { newRunId } = {}) {
  if (!oldRun || typeof oldRun !== 'object') throw new Error('oldRun required');
  return {
    supersedes_run_id: oldRun.run_id || null,
    suggested_run_id: newRunId || null,
    title: oldRun.title || null,
    goal: oldRun.goal || null,
    scope: oldRun.scope ? { in: [...(oldRun.scope.in || [])], out: [...(oldRun.scope.out || [])] } : null,
    note: 'Do not un-archive or mutate COMPLETED run status; init a new run and chain supersedes_run_id in progress.md (not run.json; not family).'
  };
}

function appendProgressLine(runId, cwd, line) {
  const nl = '\n';
  const progressPath = path.join(runDir(runId, cwd), 'progress.md');
  const text = String(line || '').endsWith(nl) ? String(line) : String(line) + nl;
  if (fs.existsSync(progressPath)) fs.appendFileSync(progressPath, text, 'utf8');
  else fs.writeFileSync(progressPath, '# Progress' + nl + nl + text, 'utf8');
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
      'intensity: ' + (run.intensity || 'standard'),
      'iteration: ' + run.iteration + '/' + run.max_iterations,
      'gates: analyze=' + run.gates.analyze + ' plan=' + run.gates.plan + ' deliver=' + run.gates.deliver + ' accept=' + run.gates.accept + ' archive=' + run.gates.archive,
      run.accept_layers
        ? ('accept_layers: mechanical=' + run.accept_layers.mechanical + ' judgment=' + run.accept_layers.judgment + ' mode=' + (run.accept_layers.judgment_mode || 'none'))
        : 'accept_layers: (legacy)',
      run.stagnation
        ? ('stagnation: unchanged=' + (run.stagnation.unchanged_count ?? 0) + '/' + (run.stagnation.patience ?? 2))
        : 'stagnation: (legacy)',
      'capabilities: ' + ((run.capability_ids || []).join(', ') || '(none)'),
      'knowledge_refs: ' + ((run.knowledge_refs || []).join(', ') || '(none)'),
      latestReview ? ('review: ' + latestReview.review_id + ' ' + latestReview.outcome + (latestReview.review_scope ? (' scope=' + latestReview.review_scope) : '') + ((latestReview.fix_commit || latestReview.reviewed_commit) ? (' @' + (latestReview.fix_commit || latestReview.reviewed_commit)) : '')) : 'review: none',
      run.host ? ('host: ' + [run.host.host_id, run.host.thread_id || run.host.session_handle, run.host.model_id].filter(Boolean).join(' / ')) : 'host: none',
      run.intervention_needed ? ('intervention: ' + (run.intervention_needed.kind ? (run.intervention_needed.kind + ' ') : '') + run.intervention_needed.reason) : 'intervention: none',
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
