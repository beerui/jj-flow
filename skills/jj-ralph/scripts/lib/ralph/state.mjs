/** P1a split from src/ralph.mjs — move not rewrite.
 * DAG: state ← gates ← map ← knowledge ← archive.
 * Slightly over 600 lines: run.json IO, validation, and status helpers stay together.
 */
import fs from 'node:fs';
import path from 'node:path';

export const RALPH_RUN_SCHEMA_VERSION = 'jj-flow/ralph-run/1.1';
export const RALPH_RUN_SCHEMA_VERSION_LEGACY = 'jj-flow/ralph-run/1.0';
export const RALPH_RUN_SCHEMA_VERSIONS = Object.freeze([
  RALPH_RUN_SCHEMA_VERSION_LEGACY,
  RALPH_RUN_SCHEMA_VERSION
]);
export const TASK_PLAN_REL = 'task_plan.md';
export const FINDINGS_REL = 'findings.md';
export const PROGRESS_REL = 'progress.md';
export const GATE_SETS = Object.freeze(['full', 'lite']);
export const SECTION_GOAL = '目标';
export const SECTION_ANALYZE = '分析';
export const SECTION_PLAN = '计划';
export const SECTION_ACCEPT = '验收';
export const SECTION_CURRENT = '当前';
export const SECTION_LANDED = '已落地';
export const SECTION_SUPERSEDED = '已取代';
export const SECTION_MUST = '必须项';
export const SECTION_OUT = '范围外';
export const SECTION_FLAGGED = '存疑事项';
export const SECTION_UNRESOLVED = '未解决';
export const SECTION_OPEN_QUESTIONS = '待答问题';
export const RALPH_MAP_SCHEMA_VERSION = 'jj-flow/ralph-business-map/1.0';
export const RALPH_KNOWLEDGE_CONTRIBUTION_SCHEMA = 'jj-flow/ralph-knowledge-contribution/0.1';
export const RALPH_REVIEW_SCHEMA_VERSION = 'jj-flow/ralph-review/1.0';
export const RALPH_ROOT_REL = path.join('.workflow', 'ralph');
// Runs live directly under .workflow/ralph/RALPH-*/. Reserved siblings: business-map.json, archive/
export const RALPHS_DIR_REL = RALPH_ROOT_REL;
export const RALPH_ARCHIVE_DIR_REL = path.join(RALPH_ROOT_REL, 'archive');
export const RALPH_MAP_REL = path.join(RALPH_ROOT_REL, 'business-map.json');
export const RALPH_HANDOFF_SCHEMA_VERSION = 'jj-flow/ralph-handoff/1.1';
/** @deprecated external handoffs dir; new handoffs live under the run */
export const HANDOFF_ROOT_REL = path.join('.workflow', 'handoffs');

export const PHASES = ['ANALYZE', 'PLAN', 'DELIVER', 'ACCEPT', 'ARCHIVE'];
export const GATE_KEYS = ['analyze', 'plan', 'deliver', 'accept', 'archive'];
export const REVIEW_OUTCOMES = ['PASS', 'NEEDS_CHANGES', 'BLOCKED'];
const FINDING_SEVERITIES = ['high', 'medium', 'low', 'info'];
const FINDING_STATUSES = ['OPEN', 'RESOLVED', 'WAIVED'];
export const REVIEW_SCOPES = ['working_tree', 'commit'];
/** Provenance for host-first jj-review adapter; optional on REV reports. */
export const REVIEW_SOURCES = ['host_builtin', 'user_provided', 'fallback_inline'];
export const HOST_REVIEW_METHODS = ['skill', 'command', 'subagent', 'user_provided', 'fallback_inline'];
export const HOST_IDS = ['codex', 'grok-build', 'claude', 'qoder', 'other'];
export const FINDING_PASSES = Object.freeze(['bugs', 'security', 'compliance']);
export const FINDING_IMPORTANCE = Object.freeze(['important', 'nit']);
export const REVIEW_NIT_CAP = 5;
export const INSTRUCTION_CORRECTION_REL = 'instruction-correction.md';

/** Run intensity tiers: speed/quality tradeoff without multi-agent runtime. */
export const RALPH_INTENSITIES = Object.freeze(['tiny', 'standard', 'strict']);
/** Soft lifecycle statuses — none permanently freezes same-run continue/resume. */
export const RUN_STATUSES = Object.freeze([
  'IN_PROGRESS',
  'READY_FOR_USER_TEST',
  'BLOCKED',
  'PAUSED',
  'ABANDONED',
  'COMPLETED'
]);
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

export function hydrateIntensityFields(run) {
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
export function unique(items) { return [...new Set((items || []).filter(Boolean))]; }

export function createRunSkeleton({
  run_id,
  title,
  goal,
  scope = { in: [], out: [] },
  capability_ids = [],
  knowledge_refs = [],
  knowledge_summary = [],
  project_key = null,
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
    project_key: project_key || null,
    knowledge_refs: unique(knowledge_refs),
    knowledge_summary: [...(knowledge_summary || [])],
    knowledge: { memory_refs: [] },
    gate_set: 'full',
    artifact_refs: {
      analyze: TASK_PLAN_REL,
      plan: TASK_PLAN_REL,
      acceptance: TASK_PLAN_REL,
      progress: PROGRESS_REL,
      findings: FINDINGS_REL,
      intent: null,
      handoff_ref: null,
      dispatch_snapshot_ref: null,
      latest_review_ref: null
    },
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
  if (!RALPH_RUN_SCHEMA_VERSIONS.includes(run.schema_version)) {
    errors.push('schema_version must be one of ' + RALPH_RUN_SCHEMA_VERSIONS.join('|'));
  }
  if (!run.run_id || !/^RALPH-[A-Za-z0-9][A-Za-z0-9_-]{1,80}$/.test(run.run_id)) errors.push('invalid run_id');
  if (!run.title) errors.push('title required');
  if (!run.goal) errors.push('goal required');
  if (!PHASES.includes(run.phase)) errors.push('invalid phase: ' + run.phase);
  if (!RUN_STATUSES.includes(run.status)) errors.push('invalid status: ' + run.status);
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
  if (run.artifact_refs && typeof run.artifact_refs === 'object') {
    for (const [key, value] of Object.entries(run.artifact_refs)) {
      if (typeof value === 'string' && value.includes('#')) {
        errors.push('artifact_refs.' + key + ' must be a bare filename (no fragment)');
      }
    }
  }
  if (run.schema_version === RALPH_RUN_SCHEMA_VERSION) {
    if (!run.artifact_refs?.findings) errors.push('artifact_refs.findings required on schema 1.1');
    if (run.gate_set != null && !GATE_SETS.includes(run.gate_set)) errors.push('gate_set must be full|lite');
    if (run.knowledge != null) {
      if (typeof run.knowledge !== 'object' || Array.isArray(run.knowledge)) errors.push('knowledge must be object when present');
      else if (run.knowledge.memory_refs != null && !Array.isArray(run.knowledge.memory_refs)) {
        errors.push('knowledge.memory_refs must be array when present');
      }
    }
  }
  if (run.archive != null) {
    if (typeof run.archive !== 'object' || Array.isArray(run.archive)) errors.push('archive must be object when present');
    else {
      if (typeof run.archive.archived_at !== 'string' || !run.archive.archived_at.trim()) {
        errors.push('archive.archived_at required');
      }
      if (!Array.isArray(run.archive.files)) errors.push('archive.files must be array');
      else {
        for (const [i, file] of run.archive.files.entries()) {
          if (!file || typeof file !== 'object' || Array.isArray(file)) {
            errors.push('archive.files[' + i + '] must be object');
          } else {
            if (typeof file.path !== 'string' || !file.path.trim()) errors.push('archive.files[' + i + '].path required');
            if (typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256)) {
              errors.push('archive.files[' + i + '].sha256 must be 64-hex');
            }
          }
        }
      }
    }
  }
  if (run.archive_history != null) {
    if (!Array.isArray(run.archive_history)) errors.push('archive_history must be array when present');
    else {
      for (const [i, event] of run.archive_history.entries()) {
        if (!event || typeof event !== 'object' || Array.isArray(event)) {
          errors.push('archive_history[' + i + '] must be object');
        } else if (typeof event.archived_at !== 'string' || !event.archived_at.trim()) {
          errors.push('archive_history[' + i + '].archived_at required');
        }
      }
    }
  }
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
      if (finding?.pass != null && !FINDING_PASSES.includes(finding.pass)) errors.push('findings[' + i + '].pass invalid');
      if (finding?.importance != null && !FINDING_IMPORTANCE.includes(finding.importance)) errors.push('findings[' + i + '].importance invalid');
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

/**
 * Formal status transitions. COMPLETED / ABANDONED are soft (same-run resume allowed).
 * Allowed: IN_PROGRESS, READY_FOR_USER_TEST, BLOCKED, PAUSED, ABANDONED, COMPLETED.
 */
export function setRunStatus(runId, { status, reason, cwd = process.cwd() } = {}) {
  if (!RUN_STATUSES.includes(status)) {
    throw new Error('setRunStatus status must be one of ' + RUN_STATUSES.join('|'));
  }
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new Error('reason is required for setRunStatus');
  }
  const run = loadRun(runId, cwd);
  const from = run.status;
  run.status = status;
  run.updated_at = nowIso();
  if (status === 'BLOCKED' || status === 'PAUSED') {
    run.intervention_needed = {
      kind: status === 'PAUSED' ? 'PAUSED' : 'BLOCKED',
      reason: reason.trim(),
      at: run.updated_at
    };
  } else if (status === 'ABANDONED') {
    run.intervention_needed = {
      kind: 'ABANDONED',
      reason: reason.trim(),
      at: run.updated_at
    };
  } else if (
    from === 'BLOCKED'
    || from === 'PAUSED'
    || from === 'ABANDONED'
    || from === 'COMPLETED'
    || status === 'IN_PROGRESS'
  ) {
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

/** Mark half-done discarded work as ABANDONED (soft; resumeRun can recover). */
export function abandonRun(runId, { reason, cwd = process.cwd() } = {}) {
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new Error('reason is required for abandonRun');
  }
  const result = setRunStatus(runId, { status: 'ABANDONED', reason: reason.trim(), cwd });
  return { ...result, action: 'abandon' };
}

/**
 * Optional helper for a true new-requirement run only (does not create files).
 * Primary path after archive/abandon is same-run resume — this does not forbid it.
 */
export function suggestReopenAsNew(oldRun, { newRunId } = {}) {
  if (!oldRun || typeof oldRun !== 'object') throw new Error('oldRun required');
  return {
    supersedes_run_id: oldRun.run_id || null,
    suggested_run_id: newRunId || null,
    title: oldRun.title || null,
    goal: oldRun.goal || null,
    scope: oldRun.scope ? { in: [...(oldRun.scope.in || [])], out: [...(oldRun.scope.out || [])] } : null,
    note:
      'Optional new-requirement helper only. Prefer same-run resume: resumeRun / setRunStatus → IN_PROGRESS '
      + '(rollbackPhase ARCHIVE→ACCEPT if needed). Use a new run_id only for a distinct requirement family; '
      + 'chain supersedes_run_id in progress.md when intentionally starting a new run (not run.json; not family).'
  };
}

export function appendProgressLine(runId, cwd, line) {
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
  if (run.artifact_refs?.findings) {
    files.push(path.join(base, run.artifact_refs.findings).replaceAll(String.fromCharCode(92), String.fromCharCode(47)));
  }
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
