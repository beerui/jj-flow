/** P1a split from src/ralph.mjs — move not rewrite.
 * DAG: state ← gates ← map ← knowledge ← archive.
 * Slightly over 600 lines: run.json IO, validation, and status helpers stay together.
 */
import fs from 'node:fs';
import path from 'node:path';

export const RALPH_RUN_SCHEMA_VERSION = 'jj-flow/ralph-run/1.2';
export const RALPH_RUN_SCHEMA_VERSION_1_1 = 'jj-flow/ralph-run/1.1';
export const RALPH_RUN_SCHEMA_VERSION_LEGACY = 'jj-flow/ralph-run/1.0';
export const RALPH_RUN_SCHEMA_VERSIONS = Object.freeze([
  RALPH_RUN_SCHEMA_VERSION_LEGACY,
  RALPH_RUN_SCHEMA_VERSION_1_1,
  RALPH_RUN_SCHEMA_VERSION
]);
export const TASK_RUN_ID_RE = /^task-[a-z0-9][a-z0-9-]{1,80}$/;
export const LEGACY_RUN_ID_RE = /^RALPH-[A-Za-z0-9][A-Za-z0-9_-]{1,80}$/;
export const TASK_PLAN_REL = 'task_plan.md';
export const FINDINGS_REL = 'findings.md';
export const PROGRESS_REL = 'progress.md';
/** full = analyze/plan/deliver/accept/archive; lite = brief/deliver/close over the same five ledger keys (P2+). */
export const GATE_SETS = Object.freeze(['full', 'lite']);
/** Neutral status warning when phase=ARCHIVE but the run is not parked under completed/. */
export const ARCHIVE_CLOSEOUT_WARNING = 'phase=ARCHIVE 未完成收尾——先跑 gate/status 核对';
/** lite budget: max_deliver_loops = min(intensity default or override, 3). */
export const LITE_MAX_DELIVER_LOOPS = 3;
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
export const STATE_REL = '.state';
export const EVENTS_JSONL_REL = path.join(STATE_REL, 'events.jsonl');
export const INDEX_MD_REL = path.join(RALPH_ROOT_REL, 'index.md');
/** Soft cap for live `task-*` rows in index.md. Overflow or stale rows emit a prompt, never auto-archive. */
export const INDEX_ACTIVE_CAP = 5;
export const INDEX_STALE_MS = 5 * 24 * 60 * 60 * 1000;
/** @deprecated P2 nested live dir; Scheme A lifts live runs to ralph root. Kept for migrate lift. */
export const RALPH_TASKS_DIR_REL = path.join(RALPH_ROOT_REL, 'tasks');
export const RALPH_COMPLETED_DIR_REL = path.join(RALPH_ROOT_REL, 'completed');
export const RALPH_MIGRATED_DIR_REL = path.join(RALPH_ROOT_REL, 'migrated');
// Scheme A: live runs sit flat at .workflow/ralph/<task_key>/. Reserved siblings: business-map.json, completed/, migrated/, archive/, tasks/ (legacy), index.md
export const RALPHS_DIR_REL = RALPH_ROOT_REL;
export const RALPH_ARCHIVE_DIR_REL = path.join(RALPH_ROOT_REL, 'archive');
export const RALPH_MAP_REL = path.join(RALPH_ROOT_REL, 'business-map.json');
export const RALPH_ROOT_RESERVED = Object.freeze([
  'archive', 'completed', 'migrated', 'tasks', 'index.md', 'business-map.json'
]);
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

/** Default full; only an explicit flag selects lite. Orthogonal to intensity (tiny never implies lite). */
export function normalizeGateSet(gateSet) {
  const value = String(gateSet == null || gateSet === '' ? 'full' : gateSet).toLowerCase();
  if (!GATE_SETS.includes(value)) {
    throw new Error('gate_set must be one of ' + GATE_SETS.join('|'));
  }
  return value;
}

export function applyLiteBudget(budget) {
  return { ...budget, max_deliver_loops: Math.min(budget.max_deliver_loops, LITE_MAX_DELIVER_LOOPS) };
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

export function isTaskRunId(runId) { return TASK_RUN_ID_RE.test(String(runId || '')); }
export function isLegacyRalphRunId(runId) { return LEGACY_RUN_ID_RE.test(String(runId || '')); }
export function stripRunIdPrefix(runId) {
  return String(runId || '').replace(/^(?:RALPH|task)-/i, '');
}
export function migrateHint(runId) {
  return 'legacy RALPH run layout for ' + runId + '; run `jj ralph migrate` (or ralph_ops.mjs migrate)';
}

export function ralphRoot(cwd = process.cwd()) { return path.join(cwd, RALPH_ROOT_REL); }
export function ralphsDir(cwd = process.cwd()) { return path.join(cwd, RALPHS_DIR_REL); }
export function completedDir(cwd = process.cwd()) { return path.join(cwd, RALPH_COMPLETED_DIR_REL); }
export function migratedDir(cwd = process.cwd()) { return path.join(cwd, RALPH_MIGRATED_DIR_REL); }
export function legacyTasksDir(cwd = process.cwd()) { return path.join(cwd, RALPH_TASKS_DIR_REL); }
export function archiveDir(cwd = process.cwd()) { return path.join(cwd, RALPH_ARCHIVE_DIR_REL); }
export function mapPath(cwd = process.cwd()) { return path.join(cwd, RALPH_MAP_REL); }
export function indexMdPath(cwd = process.cwd()) { return path.join(cwd, INDEX_MD_REL); }
export function activeRunDir(runId, cwd = process.cwd()) { return path.join(ralphRoot(cwd), runId); }
export function completedRunDir(runId, cwd = process.cwd()) { return path.join(completedDir(cwd), runId); }
function runJsonUnder(dir) { return path.join(dir, STATE_REL, 'run.json'); }
/** Resolve live (root) → completed/ → legacy tasks/ → default live path for create. */
export function runDir(runId, cwd = process.cwd()) {
  const live = activeRunDir(runId, cwd);
  if (fs.existsSync(runJsonUnder(live))) return live;
  const done = completedRunDir(runId, cwd);
  if (fs.existsSync(runJsonUnder(done))) return done;
  const legacy = path.join(legacyTasksDir(cwd), runId);
  if (fs.existsSync(runJsonUnder(legacy))) return legacy;
  return live;
}
export function runLayoutOf(runId, cwd = process.cwd()) {
  const abs = runDir(runId, cwd);
  const root = ralphRoot(cwd);
  const rel = path.relative(root, abs).replaceAll(String.fromCharCode(92), String.fromCharCode(47));
  if (rel === runId) return 'active';
  if (rel === path.join('completed', runId).replaceAll(String.fromCharCode(92), String.fromCharCode(47))) return 'completed';
  if (rel === path.join('tasks', runId).replaceAll(String.fromCharCode(92), String.fromCharCode(47))) return 'legacy-tasks';
  return 'other';
}
export function runStateDir(runId, cwd = process.cwd()) { return path.join(runDir(runId, cwd), STATE_REL); }
export function runJsonPath(runId, cwd = process.cwd()) { return path.join(runStateDir(runId, cwd), 'run.json'); }
export function eventsJsonlPath(runId, cwd = process.cwd()) { return path.join(runDir(runId, cwd), EVENTS_JSONL_REL); }
export function legacyActiveRunJsonPath(runId, cwd = process.cwd()) {
  return path.join(ralphRoot(cwd), runId, 'run.json');
}
/** Live tasks dir, or leftover archive snapshot dir when `_readonly_archive_path` is set. */
export function runWorkspaceDir(run, cwd = process.cwd()) {
  if (run?._readonly_archive_path) return path.dirname(run._readonly_archive_path);
  return runDir(run.run_id, cwd);
}
export function assertWritableRun(run) {
  if (run?._readonly_archive_path) throw new Error('refusing to mutate read-only archive snapshot ' + run.run_id);
}
export function runMachineFile(runId, rel, cwd = process.cwd()) {
  const underState = path.join(runStateDir(runId, cwd), rel);
  if (fs.existsSync(underState)) return underState;
  return path.join(runDir(runId, cwd), rel);
}
export function runMachineFileFor(run, rel, cwd = process.cwd()) {
  const root = runWorkspaceDir(run, cwd);
  const underState = path.join(root, STATE_REL, rel);
  if (fs.existsSync(underState)) return underState;
  return path.join(root, rel);
}
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
  gate_set = 'full',
  host = null,
  created_at = nowIso()
} = {}) {
  if (!isTaskRunId(run_id)) throw new Error('run_id must match task-<slug> pattern');
  if (!title) throw new Error('title is required');
  if (!goal) throw new Error('goal is required');
  const intensityNorm = normalizeIntensity(intensity);
  const gateSetNorm = normalizeGateSet(gate_set);
  const defaults = INTENSITY_DEFAULTS[intensityNorm];
  const maxIter = max_iterations != null ? max_iterations : defaults.max_iterations;
  if (!Number.isInteger(maxIter) || maxIter < 1) throw new Error('max_iterations must be >= 1');
  const budgetForIntensity = buildBudgetForIntensity(intensityNorm, budget);
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
    budget: gateSetNorm === 'lite' ? applyLiteBudget(budgetForIntensity) : budgetForIntensity,
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
    gate_set: gateSetNorm,
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
  if (run.schema_version === RALPH_RUN_SCHEMA_VERSION) {
    if (!isTaskRunId(run.run_id)) errors.push('invalid run_id');
  } else if (!isLegacyRalphRunId(run.run_id) && !isTaskRunId(run.run_id)) {
    errors.push('invalid run_id');
  }
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
  if (run.schema_version === RALPH_RUN_SCHEMA_VERSION || run.schema_version === RALPH_RUN_SCHEMA_VERSION_1_1) {
    if (!run.artifact_refs?.findings) errors.push('artifact_refs.findings required on schema 1.1+');
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
  if (!isTaskRunId(report.run_id) && !isLegacyRalphRunId(report.run_id)) errors.push('invalid run_id');
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

function findArchiveRunJson(runId, cwd) {
  const root = archiveDir(cwd);
  if (!fs.existsSync(root)) return null;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name === 'run.json') {
        try {
          const run = readJson(full);
          if (run && run.run_id === runId) return full;
        } catch { /* skip unreadable leftover */ }
      }
    }
  }
  return null;
}

export function loadRun(runId, cwd = process.cwd()) {
  if (isLegacyRalphRunId(runId)) {
    const active = legacyActiveRunJsonPath(runId, cwd);
    if (fs.existsSync(active)) throw new Error(migrateHint(runId));
    const archived = findArchiveRunJson(runId, cwd);
    if (!archived) throw new Error('run not found: ' + runId);
    const run = readJson(archived);
    const errors = validateRun(run);
    if (errors.length) throw new Error('invalid run.json: ' + errors.join('; '));
    run._readonly_archive_path = archived;
    return run;
  }
  const filePath = runJsonPath(runId, cwd);
  if (!fs.existsSync(filePath)) throw new Error('run not found: ' + runId);
  const run = readJson(filePath);
  const errors = validateRun(run);
  if (errors.length) throw new Error('invalid run.json: ' + errors.join('; '));
  return run;
}

export function saveRun(run, cwd = process.cwd()) {
  assertWritableRun(run);
  if (isLegacyRalphRunId(run.run_id)) throw new Error(migrateHint(run.run_id));
  const errors = validateRun(run);
  if (errors.length) throw new Error('invalid run: ' + errors.join('; '));
  const copy = { ...run };
  delete copy._readonly_archive_path;
  const saved = runJsonPath(copy.run_id, cwd);
  writeJson(saved, copy);
  try {
    writeRalphIndex(cwd);
  } catch {
    // index.md is a derived view; a refresh miss must not roll back run.json
  }
  return saved;
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

function peekLatestReviewSummary(run) {
  const reviews = Array.isArray(run?.review?.reviews) ? run.review.reviews : [];
  if (!reviews.length) {
    if (run?.latest_review_outcome) {
      return { outcome: run.latest_review_outcome, review_scope: run.latest_review_scope || null };
    }
    return null;
  }
  const lid = run.review?.latest_review_id;
  return reviews.find((item) => item.review_id === lid) || reviews[reviews.length - 1] || null;
}

function gatesOf(run) {
  if (run?.gates && typeof run.gates === 'object') return run.gates;
  return {
    analyze: run?.analyze || null,
    plan: run?.plan || null,
    deliver: run?.deliver || null,
    accept: run?.accept || null,
    archive: run?.archive || null
  };
}

function attachNext(row) {
  const { next } = computeRalphNext(row, { layout: row.layout || null });
  return { ...row, next };
}

function isIndexStale(updatedAt, now) {
  if (!updatedAt) return true;
  const ts = Date.parse(updatedAt);
  if (Number.isNaN(ts)) return true;
  return (now - ts) >= INDEX_STALE_MS;
}

function classifyIndexArchiveAction(row) {
  const status = row.status;
  if (status === 'PAUSED' || status === 'BLOCKED' || status === 'ABANDONED') return 'ask';
  const accept = gatesOf(row).accept;
  const latest = peekLatestReviewSummary(row);
  const outcome = latest?.outcome || null;
  const scope = latest?.review_scope || null;
  if (accept === 'PASS' && outcome !== 'NEEDS_CHANGES' && outcome !== 'BLOCKED') {
    if (outcome === 'PASS' && scope !== 'commit') return 'commit-scoped-review';
    return 'finalize';
  }
  return 'ask';
}

function suggestionLabel(action) {
  if (action === 'finalize') return 'finalize';
  if (action === 'commit-scoped-review') return 'commit-scoped-review（先问用户是否提交后再复审）';
  return '询问用户（finalize / abandon / 保留）';
}

const REVIEW_SLICE_RE = /审查修复|按审查|三点修复|review-fix|review_fix/i;

export function isReviewSliceText(text) {
  return REVIEW_SLICE_RE.test(String(text || ''));
}

function liveActiveRows(rows) {
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (row.layout && row.layout !== 'active' && row.layout !== 'legacy-tasks') return false;
    return row.status !== 'COMPLETED' && row.status !== 'ABANDONED';
  });
}

function rowThreadIds(row) {
  return [...new Set([row?.task_thread_id, row?.host_thread_id].filter(Boolean).map(String))];
}

/** Refuse init of a review-slice slug/title, or of a new run while a same-session live run exists. */
export function findRalphInitConflict({ cwd, title, goal, runId, threadIds } = {}) {
  const blob = [runId, title, goal].filter(Boolean).join(' ');
  const live = liveActiveRows(listRuns(cwd)).filter((row) => row.run_id !== runId);
  if (isReviewSliceText(blob)) {
    return {
      reason: 'review-slice',
      candidates: live,
      message:
        'review-fix / 审查修复 is not a new requirement; resume the live feature run '
        + '(or init with the real requirement title, not a review-slice slug)'
        + (live.length ? ('; live: ' + live.map((row) => row.run_id).join(', ')) : '')
    };
  }
  if (threadIds && threadIds.size) {
    const hits = live.filter((row) => rowThreadIds(row).some((id) => threadIds.has(id)));
    if (hits.length) {
      return {
        reason: 'same-session',
        candidates: hits,
        message: 'same session already has live Ralph ' + hits.map((row) => row.run_id).join(', ') + '; resume, do not init'
      };
    }
  }
  return null;
}

/** Prompt-only: same session or a review-slice sitting next to another live run. Never merge/abandon. */
export function collectSameRequirementHints(activeRows) {
  const live = liveActiveRows(activeRows);
  const items = [];
  const byThread = new Map();
  for (const row of live) {
    for (const tid of rowThreadIds(row)) {
      if (!byThread.has(tid)) byThread.set(tid, []);
      const bucket = byThread.get(tid);
      if (!bucket.some((existing) => existing.run_id === row.run_id)) bucket.push(row);
    }
  }
  for (const [threadId, rows] of byThread) {
    if (rows.length < 2) continue;
    items.push({
      kind: 'same-session',
      thread_id: threadId,
      run_ids: rows.map((row) => row.run_id),
      suggestion: '询问用户保留哪一条（同需求同一 run_id；不自动合并）'
    });
  }
  const slices = live.filter((row) => isReviewSliceText([row.run_id, row.title, row.goal].join(' ')));
  if (slices.length && live.length > slices.length) {
    items.push({
      kind: 'review-slice',
      thread_id: null,
      run_ids: slices.map((row) => row.run_id),
      suggestion: '审查修复 / 按审查 / review-fix 不是新任务，resume 另一条活跃 run'
    });
  }
  return {
    triggered: items.length > 0,
    items
  };
}

/** Prompt-only index hygiene. Never finalize / abandon from here. */
export function collectIndexArchiveHints(activeRows, { now = Date.now() } = {}) {
  const rows = Array.isArray(activeRows) ? activeRows : [];
  const overflow = rows.length > INDEX_ACTIVE_CAP;
  const stale = rows.filter((row) => isIndexStale(row.updated_at, now));
  if (!overflow && !stale.length) {
    return {
      triggered: false,
      overflow: false,
      auto_archive: false,
      active_count: rows.length,
      stale_ids: [],
      items: []
    };
  }
  const candidates = overflow ? rows : stale;
  const items = candidates.map((row) => {
    const reasons = [];
    if (isIndexStale(row.updated_at, now)) reasons.push('5天未更新');
    if (overflow) reasons.push('活跃超过' + INDEX_ACTIVE_CAP + '条');
    const action = classifyIndexArchiveAction(row);
    return {
      run_id: row.run_id,
      status: row.status || null,
      phase: row.phase || null,
      title: row.title || null,
      reasons,
      action,
      suggestion: suggestionLabel(action)
    };
  });
  return {
    triggered: true,
    overflow,
    auto_archive: false,
    active_count: rows.length,
    stale_ids: stale.map((row) => row.run_id),
    items
  };
}

function summarizeRunFile(filePath, fallbackId, extra = {}) {
  if (!fs.existsSync(filePath)) return { run_id: fallbackId, phase: null, status: null, title: null, ...extra };
  try {
    const run = readJson(filePath);
    const latest = peekLatestReviewSummary(run);
    return {
      run_id: run.run_id || fallbackId,
      phase: run.phase || null,
      status: run.status || null,
      title: run.title || null,
      goal: run.goal || null,
      task_thread_id: run.review?.task_thread_id || null,
      host_thread_id: run.host?.thread_id || null,
      updated_at: run.updated_at || null,
      analyze: run.gates?.analyze || null,
      plan: run.gates?.plan || null,
      deliver: run.gates?.deliver || null,
      accept: run.gates?.accept || null,
      archive: run.gates?.archive || null,
      latest_review_outcome: latest?.outcome || null,
      latest_review_scope: latest?.review_scope || null,
      archived_at: run.archive?.archived_at || null,
      ...extra
    };
  } catch {
    return { run_id: fallbackId, phase: null, status: null, title: null, ...extra };
  }
}

function pushTaskRow(rows, absDir, runId, layout, relPath) {
  rows.push(summarizeRunFile(path.join(absDir, STATE_REL, 'run.json'), runId, {
    layout,
    path: relPath.replaceAll(String.fromCharCode(92), String.fromCharCode(47))
  }));
}

export function listRuns(cwd = process.cwd()) {
  const rows = [];
  const root = ralphRoot(cwd);
  if (fs.existsSync(root)) {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.migrated-')) continue;
      if (RALPH_ROOT_RESERVED.includes(entry.name)) continue;
      if (isTaskRunId(entry.name)) {
        pushTaskRow(rows, path.join(root, entry.name), entry.name, 'active', path.join(RALPH_ROOT_REL, entry.name));
        continue;
      }
      if (!entry.name.startsWith('RALPH-')) continue;
      rows.push(summarizeRunFile(path.join(root, entry.name, 'run.json'), entry.name, {
        layout: 'legacy-active',
        needs_migrate: true,
        path: path.join(RALPH_ROOT_REL, entry.name).replaceAll(String.fromCharCode(92), String.fromCharCode(47))
      }));
    }
  }
  const completedRoot = completedDir(cwd);
  if (fs.existsSync(completedRoot)) {
    for (const entry of fs.readdirSync(completedRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !isTaskRunId(entry.name)) continue;
      pushTaskRow(
        rows,
        path.join(completedRoot, entry.name),
        entry.name,
        'completed',
        path.join(RALPH_COMPLETED_DIR_REL, entry.name)
      );
    }
  }
  const legacyRoot = legacyTasksDir(cwd);
  if (fs.existsSync(legacyRoot)) {
    for (const entry of fs.readdirSync(legacyRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !isTaskRunId(entry.name)) continue;
      pushTaskRow(
        rows,
        path.join(legacyRoot, entry.name),
        entry.name,
        'legacy-tasks',
        path.join(RALPH_TASKS_DIR_REL, entry.name)
      );
    }
  }
  return rows.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || ''))).map(attachNext);
}

export function locateRalphRuns(cwd = process.cwd()) {
  const rows = listRuns(cwd).map((row) => ({ ...row, readonly: Boolean(row.needs_migrate) }));
  const archiveRoot = archiveDir(cwd);
  if (fs.existsSync(archiveRoot)) {
    const stack = [archiveRoot];
    while (stack.length) {
      const dir = stack.pop();
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (entry.name === 'run.json') {
          const rel = path.relative(cwd, full).replaceAll(String.fromCharCode(92), String.fromCharCode(47));
          const summary = summarizeRunFile(full, path.basename(path.dirname(full)), {
            layout: 'archive',
            readonly: true,
            path: rel
          });
          rows.push(summary);
        }
      }
    }
  }
  return rows
    .map((row) => annotateLocateRow(row, cwd))
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
}

function annotateLocateRow(row, cwd) {
  if (row.needs_migrate || row.layout === 'legacy-tasks' || row.layout === 'legacy-active') {
    return { ...row, next: 'migrate', warning: null, closeout: 'migrate' };
  }
  if (row.readonly || row.layout === 'archive') {
    return { ...row, next: null, warning: null, closeout: null };
  }
  try {
    const run = loadRun(row.run_id, cwd);
    const { next, warning } = computeRalphNext(run, { layout: row.layout });
    let closeout = null;
    if (next === 'finalize') closeout = 'finalize';
    else if (warning && row.layout !== 'completed') closeout = 'check';
    return { ...row, next, warning, closeout };
  } catch {
    return { ...row, next: null, warning: null, closeout: null };
  }
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

/** Soft-close half-done work as ABANDONED, then park under completed/ (same as COMPLETED). */
export function abandonRun(runId, { reason, cwd = process.cwd() } = {}) {
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new Error('reason is required for abandonRun');
  }
  const result = setRunStatus(runId, { status: 'ABANDONED', reason: reason.trim(), cwd });
  const moved = moveRunToCompleted(runId, cwd);
  writeRalphIndex(cwd);
  return { ...result, action: 'abandon', moved };
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

/** Append one JSONL machine event under .state/events.jsonl (append-only). */
export function appendEvent(runId, cwd, event) {
  const filePath = eventsJsonlPath(runId, cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const payload = {
    ts: event?.ts || nowIso(),
    type: event?.type || 'note',
    ...(event && typeof event === 'object' ? event : {})
  };
  if (!payload.ts) payload.ts = nowIso();
  if (!payload.type) payload.type = 'note';
  fs.appendFileSync(filePath, JSON.stringify(payload) + '\n', 'utf8');
  return payload;
}

function inferEventFromProgressLine(line) {
  const text = String(line || '').replace(/^\s*-\s*/, '').trim();
  const tsMatch = text.match(/^(\d{4}-\d{2}-\d{2}T[^\s]+)\s+(.*)$/);
  const ts = tsMatch ? tsMatch[1] : nowIso();
  const rest = tsMatch ? tsMatch[2] : text;
  let type = 'note';
  if (/^gate\b/i.test(rest) || /\bgate\s+\w+=/.test(rest)) type = 'gate';
  else if (/^promoted\b/i.test(rest)) type = 'promoted';
  else if (/^scope\b/i.test(rest)) type = 'scope';
  else if (/^archive\b/i.test(rest)) type = 'archive';
  else if (/^finding\b/i.test(rest)) type = 'finding';
  else if (/^rollbackPhase\b/i.test(rest)) type = 'rollback';
  else if (/^setRunStatus\b/i.test(rest) || /^status\b/i.test(rest)) type = 'status';
  else if (/deliver-attempt|deliver_attempt/i.test(rest)) type = 'deliver_attempt';
  else if (/instruction-correction|instruction_correction/i.test(rest)) type = 'instruction_correction';
  else if (/hot_memory|hot-memory/i.test(rest)) type = 'hot_memory';
  else if (/^init\b/i.test(rest)) type = 'init';
  else if (/^resume\b/i.test(rest)) type = 'resume';
  return { ts, type, message: rest, line: String(line || '').trim() };
}

/**
 * Machine-track writer. events.jsonl is the SSOT.
 * Do not mirror into progress.md — that file is dated human narrative only.
 */
export function appendProgressLine(runId, cwd, line) {
  const event = inferEventFromProgressLine(line);
  appendEvent(runId, cwd, event);
  return event;
}

/** Concatenate event `line` fields (legacy markdown bullets) for parsers/tests. */
export function readRunEventsText(runId, cwd = process.cwd()) {
  return readEvents(runId, cwd).map((row) => {
    if (row?.line) return String(row.line);
    const ts = row?.ts ? String(row.ts) + ' ' : '';
    return '- ' + ts + String(row?.message || '').trim();
  }).filter(Boolean).join('\n');
}

/** Human-track only: append a dated section (never rewrites prior days). */
export function appendProgressRound(runId, cwd, { title, goal, result = null, findingHint = null } = {}) {
  const progressPath = path.join(runDir(runId, cwd), 'progress.md');
  const nl = '\n';
  const at = nowIso();
  const day = at.slice(0, 10);
  const heading = title ? ('## ' + day + ' — ' + title) : ('## ' + day);
  const block = [
    '',
    heading,
    '',
    goal ? ('- ' + goal) : null,
    '- ' + (result || '进行中'),
    findingHint ? ('> finding 软提示：' + findingHint) : null,
    ''
  ].filter((row) => row !== null).join(nl);
  if (fs.existsSync(progressPath)) fs.appendFileSync(progressPath, block, 'utf8');
  else fs.writeFileSync(progressPath, '# ' + runId + ' — progress' + nl + block, 'utf8');
  appendEvent(runId, cwd, { ts: at, type: 'round', title: title || 'resume', goal: goal || null });
  return { path: progressPath, heading };
}

export function readEvents(runId, cwd = process.cwd()) {
  const filePath = eventsJsonlPath(runId, cwd);
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { return { ts: null, type: 'parse_error', line }; }
  });
}

export function moveRunToCompleted(runId, cwd = process.cwd()) {
  const from = runDir(runId, cwd);
  const to = completedRunDir(runId, cwd);
  if (path.resolve(from) === path.resolve(to)) return { moved: false, path: to };
  if (!fs.existsSync(from)) throw new Error('run dir not found: ' + runId);
  if (fs.existsSync(to)) throw new Error('completed run already exists: ' + runId);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  return { moved: true, from, path: to };
}

export function moveRunToActive(runId, cwd = process.cwd()) {
  const from = runDir(runId, cwd);
  const to = activeRunDir(runId, cwd);
  if (path.resolve(from) === path.resolve(to)) return { moved: false, path: to };
  if (!fs.existsSync(from)) throw new Error('run dir not found: ' + runId);
  if (fs.existsSync(to)) throw new Error('active run already exists: ' + runId);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  return { moved: true, from, path: to };
}

export function writeRalphIndex(cwd = process.cwd(), { now = Date.now() } = {}) {
  const dest = indexMdPath(cwd);
  try {
    const rows = listRuns(cwd);
    const active = rows.filter((r) => r.layout === 'active' || r.layout === 'legacy-tasks');
    const completed = rows.filter((r) => r.layout === 'completed');
    const legacy = rows.filter((r) => r.needs_migrate);
    const hints = collectIndexArchiveHints(active, { now });
    const sameHints = collectSameRequirementHints(active);
    let migratedCount = 0;
    const mig = migratedDir(cwd);
    if (fs.existsSync(mig)) {
      migratedCount = fs.readdirSync(mig, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
    }
    let archiveCount = 0;
    const arch = archiveDir(cwd);
    if (fs.existsSync(arch)) {
      archiveCount = fs.readdirSync(arch, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
    }
    const nl = '\n';
    const line = (row) => '| `' + row.run_id + '` | ' + (row.status || '?') + ' | ' + (row.phase || '?') + ' | ' + (row.title || '') + ' |';
    const hintLine = (item) => '| `' + item.run_id + '` | ' + item.reasons.join(' · ') + ' | ' + item.suggestion + ' |';
    const hintBlock = hints.triggered
      ? [
        '## 归档提示',
        '',
        '> 活跃 ' + hints.active_count + ' 条（软上限 ' + INDEX_ACTIVE_CAP + '）。超过 5 天未更新 ' + hints.stale_ids.length + ' 条。**只提示，不自动 finalize / abandon**。能确定的写出建议；其余先问用户。',
        '',
        '| 任务 | 原因 | 建议 |',
        '| --- | --- | --- |',
        ...hints.items.map(hintLine),
        ''
      ]
      : [];
    const sameBlock = sameHints.triggered
      ? [
        '## 同需求提示',
        '',
        '> 同一需求出现了两条活跃 Ralph（同会话或「审查修复」切片）。**只提示，不自动合并 / abandon**。',
        '',
        '| 任务 | 原因 | 建议 |',
        '| --- | --- | --- |',
        ...sameHints.items.map((item) => {
          const reason = item.kind === 'same-session' ? ('同会话 ' + item.thread_id) : '审查切片不是新任务';
          return '| `' + item.run_ids.join('` `') + '` | ' + reason + ' | ' + item.suggestion + ' |';
        }),
        ''
      ]
      : [];
    const md = [
      '# Ralph 工作区索引',
      '',
      '> CLI 派生视图；以各 run 的 `.state/run.json` 为准。',
      '',
      '## 活跃（根目录 `task-*`）',
      '',
      '| 任务 | 状态 | 阶段 | 标题 |',
      '| --- | --- | --- | --- |',
      ...(active.length ? active.map(line) : ['| （无） | | | |']),
      '',
      ...sameBlock,
      ...hintBlock,
      '## 已完成（`completed/`，含 ABANDONED）',
      '',
      '| 任务 | 状态 | 阶段 | 标题 |',
      '| --- | --- | --- | --- |',
      ...(completed.length ? completed.map(line) : ['| （无） | | | |']),
      '',
      '## 指针',
      '',
      '- 待迁移 RALPH-*：' + legacy.length,
      '- migrated/ 残骸目录：' + migratedCount,
      '- archive/ 1.0 快照目录：' + archiveCount + '（`jj ralph migrate --prune-archive` 可清理）',
      ''
    ].join(nl);
    fs.mkdirSync(ralphRoot(cwd), { recursive: true });
    fs.writeFileSync(dest, md, 'utf8');
    return {
      ok: true,
      path: dest,
      active: active.length,
      completed: completed.length,
      migrated: migratedCount,
      archive: archiveCount,
      hints,
      same_requirement_hints: sameHints
    };
  } catch (err) {
    return { ok: false, degraded: true, error: String(err.message || err), path: dest };
  }
}

/** Legacy runs without gate_set behave as full. */
export function effectiveGateSet(run) {
  return run?.gate_set == null ? 'full' : normalizeGateSet(run.gate_set);
}

/**
 * Next mechanical step + optional ARCHIVE closeout warning.
 * Values: review | commit-scoped-review | finalize | check | migrate | resume | gate * | null
 */
export function computeRalphNext(run, { layout = null } = {}) {
  if (!run || typeof run !== 'object') return { next: null, warning: null };
  const layoutName = layout || run.layout || null;
  const warning = run.phase === 'ARCHIVE' && layoutName !== 'completed' ? ARCHIVE_CLOSEOUT_WARNING : null;
  const parked = layoutName === 'completed';
  const needsMigrate = Boolean(run.needs_migrate) || layoutName === 'legacy-active' || isLegacyRalphRunId(run.run_id);
  if (needsMigrate) return { next: 'migrate', warning };
  if (run.status === 'COMPLETED' && parked) return { next: null, warning: null };
  if (run.status === 'ABANDONED') return { next: 'resume', warning };
  if (run.status === 'BLOCKED' || run.status === 'PAUSED') return { next: 'check', warning };

  const latest = peekLatestReviewSummary(run);
  const outcome = latest?.outcome || null;
  const scope = latest?.review_scope || null;
  const gates = gatesOf(run);
  const archived = Boolean(run.archive?.archived_at || run.archived_at);

  if (outcome === 'NEEDS_CHANGES' || outcome === 'BLOCKED') return { next: 'review', warning };

  if (gates.accept === 'PASS') {
    if (archived && run.status === 'IN_PROGRESS') return { next: 'check', warning };
    if (outcome === 'PASS' && scope !== 'commit') return { next: 'commit-scoped-review', warning };
    if (!parked) return { next: 'finalize', warning };
  }

  if (run.phase === 'ARCHIVE' && parked && run.status === 'COMPLETED' && archived) {
    return { next: null, warning: null };
  }
  if (run.phase === 'ARCHIVE') return { next: 'check', warning };
  if (run.status === 'COMPLETED' && !parked) return { next: 'check', warning };

  if (effectiveGateSet(run) === 'lite') {
    if (gates.analyze !== 'PASS' || gates.plan !== 'PASS') return { next: 'gate brief', warning };
    if (gates.deliver !== 'PASS') return { next: 'gate deliver', warning };
    return { next: 'gate close', warning };
  }
  if (gates.analyze !== 'PASS') return { next: 'gate analyze', warning };
  if (gates.plan !== 'PASS') return { next: 'gate plan', warning };
  if (gates.deliver !== 'PASS') return { next: 'gate deliver', warning };
  return { next: 'gate accept', warning };
}

/**
 * lite → full fallback (in-memory; caller saves). Same run_id, same task dir, no gate is
 * reset — only gate_set flips and max_deliver_loops returns to the intensity default
 * (never below iterations already used). No-op when the run is already full.
 *
 * lift_budget_stop: when the run is BLOCKED only because deliver-attempt hit the lite cap
 * (intervention MAX_ITERATIONS) and the restored cap now exceeds the iterations used, the
 * block is lifted so the run really can "continue with the five gates". A STAGNATION block,
 * a max_iterations ceiling, or a gate the caller is writing BLOCKED still stands.
 */
export function promoteGateSetToFull(run, { reason = null, lift_budget_stop = false } = {}) {
  if (!run || typeof run !== 'object') throw new Error('run required');
  if (effectiveGateSet(run) !== 'lite') return { promoted: false, gate_set: effectiveGateSet(run), reason: null };
  hydrateIntensityFields(run);
  const intensity = normalizeIntensity(run.intensity);
  const defaultLoops = INTENSITY_DEFAULTS[intensity].budget.max_deliver_loops;
  const used = Number.isInteger(run.iteration) ? run.iteration : 0;
  const before = run.budget.max_deliver_loops;
  run.gate_set = 'full';
  run.budget = { ...run.budget, max_deliver_loops: Math.max(defaultLoops, used, before) };
  let unblocked = false;
  if (
    lift_budget_stop
    && run.status === 'BLOCKED'
    && run.intervention_needed?.kind === 'MAX_ITERATIONS'
    && used < run.budget.max_deliver_loops
    && used < run.max_iterations
  ) {
    run.status = 'IN_PROGRESS';
    run.intervention_needed = null;
    unblocked = true;
  }
  return {
    promoted: true,
    gate_set: 'full',
    reason: reason ? String(reason).trim() : null,
    max_deliver_loops: { from: before, to: run.budget.max_deliver_loops },
    unblocked
  };
}

export function promotionProgressLine(at, promotion) {
  return '- ' + at + ' promoted lite→full'
    + (promotion?.reason ? (' reason=' + promotion.reason) : '')
    + (promotion?.max_deliver_loops
      ? (' max_deliver_loops=' + promotion.max_deliver_loops.from + '→' + promotion.max_deliver_loops.to)
      : '')
    + (promotion?.unblocked ? ' status=BLOCKED→IN_PROGRESS' : '');
}

function normalizeScopeItems(items) {
  if (items == null) return [];
  const list = Array.isArray(items) ? items : [items];
  return unique(list.map((item) => String(item == null ? '' : item).trim()));
}

/**
 * Append scope entries (the only sanctioned scope.in writer after init).
 * On a lite run, any new scope.in entry counts as scope growth → promote to full.
 */
export function updateRunScope(runId, { add_in = [], add_out = [], cwd = process.cwd() } = {}) {
  const addIn = normalizeScopeItems(add_in);
  const addOut = normalizeScopeItems(add_out);
  if (!addIn.length && !addOut.length) throw new Error('updateRunScope needs add_in and/or add_out');
  const run = loadRun(runId, cwd);
  assertWritableRun(run);
  const currentIn = Array.isArray(run.scope?.in) ? run.scope.in : [];
  const currentOut = Array.isArray(run.scope?.out) ? run.scope.out : [];
  const addedIn = addIn.filter((item) => !currentIn.includes(item));
  const addedOut = addOut.filter((item) => !currentOut.includes(item));
  run.scope = { in: [...currentIn, ...addedIn], out: [...currentOut, ...addedOut] };
  const promotion = addedIn.length
    ? promoteGateSetToFull(run, { reason: 'scope.in expanded: ' + addedIn.join(', '), lift_budget_stop: true })
    : { promoted: false, gate_set: effectiveGateSet(run), reason: null };
  run.updated_at = nowIso();
  saveRun(run, cwd);
  appendProgressLine(
    runId,
    cwd,
    '- ' + run.updated_at + ' scope in+=[' + addedIn.join(', ') + '] out+=[' + addedOut.join(', ') + '] gate_set=' + run.gate_set
  );
  if (promotion.promoted) appendProgressLine(runId, cwd, promotionProgressLine(run.updated_at, promotion));
  return { run, added_in: addedIn, added_out: addedOut, promotion, gate_set: run.gate_set };
}

export function commitPrep(runId, cwd = process.cwd()) {
  const run = loadRun(runId, cwd);
  const base = path.join(RALPHS_DIR_REL, runId).replaceAll(String.fromCharCode(92), String.fromCharCode(47));
  const stateBase = path.join(base, STATE_REL).replaceAll(String.fromCharCode(92), String.fromCharCode(47));
  const files = [
    path.join(stateBase, 'run.json').replaceAll(String.fromCharCode(92), String.fromCharCode(47)),
    path.join(base, run.artifact_refs.analyze).replaceAll(String.fromCharCode(92), String.fromCharCode(47)),
    path.join(base, run.artifact_refs.plan).replaceAll(String.fromCharCode(92), String.fromCharCode(47)),
    path.join(base, run.artifact_refs.progress).replaceAll(String.fromCharCode(92), String.fromCharCode(47)),
    path.join(base, run.artifact_refs.acceptance).replaceAll(String.fromCharCode(92), String.fromCharCode(47))
  ];
  if (run.artifact_refs?.findings) {
    files.push(path.join(base, run.artifact_refs.findings).replaceAll(String.fromCharCode(92), String.fromCharCode(47)));
  }
  if (run.artifact_refs?.latest_review_ref) {
    files.push(path.join(stateBase, run.artifact_refs.latest_review_ref).replaceAll(String.fromCharCode(92), String.fromCharCode(47)));
  }
  if (Array.isArray(run.review?.reviews)) {
    for (const item of run.review.reviews) {
      if (item?.path) files.push(path.join(stateBase, item.path).replaceAll(String.fromCharCode(92), String.fromCharCode(47)));
    }
  }
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
      'gate_set: ' + (run.gate_set == null ? 'undefined' : run.gate_set),
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
      'path: ' + (payload.path || ''),
      'next: ' + (payload.next || '(none)'),
      payload.warning ? ('warning: ' + payload.warning) : null
    ].filter(Boolean).join(nl);
  }
  const nl = String.fromCharCode(10);
  const lines = ['Ralph runs:', ...(payload.runs || []).map((item) => '- ' + item.run_id + ' · ' + (item.phase || '?') + ' · ' + (item.status || '?') + (item.next ? (' · next=' + item.next) : '') + (item.needs_migrate ? ' · needs_migrate' : '') + (item.title ? (' · ' + item.title) : ''))];
  if (payload.map_path) lines.push('business-map: ' + payload.map_path);
  if (payload.map_capabilities != null) lines.push('capabilities: ' + payload.map_capabilities);
  const hints = payload.index_hints;
  if (hints?.triggered) {
    lines.push(
      '归档提示: 活跃 ' + hints.active_count + '/' + INDEX_ACTIVE_CAP
      + (hints.stale_ids.length ? ('；5天未更新 ' + hints.stale_ids.join(', ')) : '')
      + '；不要自动归档'
    );
  }
  const same = payload.same_requirement_hints;
  if (same?.triggered) {
    lines.push(
      '同需求提示: ' + same.items.map((item) => (item.kind || 'same') + ' ' + (item.run_ids || []).join(',')).join('；')
      + '；不自动合并'
    );
  }
  return lines.join(nl);
}
