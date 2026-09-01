/**
 * Grok Mode W selection and PREFLIGHT #5 (pure; no git).
 *
 * Mode S = project-branch at project.path.
 * Mode W = exclusive-worktree on a named branch tip.
 * Mode P is deferred and fail-closed.
 *
 * Isolation is an explicit signal (dirty main / active write / user request).
 * This module does not close Host Wave 2.
 */

export const EXECUTION_MODES = Object.freeze(['S', 'W', 'P']);

export const ISOLATION_REASONS = Object.freeze([
  'same-project-active-write',
  'dirty-main-unrelated',
  'user-isolation'
]);

export function normalizeWorkspacePath(value) {
  if (value == null || value === '') return '';
  return String(value).replace(/\\/g, '/').replace(/\/+$/, '');
}

export function workspacePathsEqual(left, right) {
  const a = normalizeWorkspacePath(left);
  const b = normalizeWorkspacePath(right);
  if (!a || !b) return false;
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

export function isolationRequired(signals = {}) {
  return collectIsolationReasons(signals).length > 0;
}

export function collectIsolationReasons(signals = {}) {
  const reasons = [];
  if (signals.sameProjectActiveWrite) reasons.push('same-project-active-write');
  if (signals.dirtyMainUnrelated) reasons.push('dirty-main-unrelated');
  if (signals.userRequestsIsolation) reasons.push('user-isolation');
  if (Array.isArray(signals.reasons)) {
    for (const reason of signals.reasons) {
      if (ISOLATION_REASONS.includes(reason) && !reasons.includes(reason)) reasons.push(reason);
    }
  }
  return reasons;
}

export function executionModeForEnvironment(environment, access = 'write') {
  if (access === 'read') return 'S';
  if (environment === 'exclusive-worktree') return 'W';
  return 'S';
}

export function environmentForExecutionMode(mode, access = 'write') {
  if (access === 'read') return 'project-read';
  if (mode === 'W') return 'exclusive-worktree';
  return 'project-branch';
}

/**
 * Select write workspace / Grok execution mode.
 * Read tasks are never Mode W.
 *
 * @param {object} signals
 * @param {'S'|'W'|'P'|null} [signals.requestedMode]
 * @param {boolean} [signals.dirtyMainUnrelated]
 * @param {boolean} [signals.sameProjectActiveWrite]
 * @param {boolean} [signals.userRequestsIsolation]
 * @param {'read'|'write'} [signals.access]
 */
export function selectWriteWorkspaceMode(signals = {}) {
  const access = signals.access || 'write';
  if (access === 'read') {
    return readyDecision({
      execution_mode: 'S',
      workspace: 'project-read',
      environment: 'project-read',
      worktree_policy: 'forbidden',
      reasons: []
    });
  }

  const requested = normalizeRequestedMode(signals.requestedMode);
  if (requested === 'P') {
    return {
      ok: false,
      status: 'BLOCKED',
      execution_mode: 'P',
      proposed_mode: 'P',
      workspace: null,
      environment: null,
      worktree_policy: null,
      reasons: [],
      reason: 'Mode P is deferred until RECONCILE/attestation land (Phase 2c)'
    };
  }

  const reasons = collectIsolationReasons(signals);
  const isolation = reasons.length > 0;

  if (requested === 'S' && isolation) {
    return {
      ok: false,
      status: 'BLOCKED',
      execution_mode: 'S',
      proposed_mode: 'S',
      workspace: 'project-branch',
      environment: 'project-branch',
      worktree_policy: 'project-branch-default',
      reasons,
      reason: 'PREFLIGHT #5: Mode S is inconsistent with isolation'
    };
  }

  if (requested === 'W' && !isolation) {
    return {
      ok: false,
      status: 'NEEDS_CONFIRM',
      execution_mode: 'W',
      proposed_mode: 'W',
      workspace: 'exclusive-worktree',
      environment: 'exclusive-worktree',
      worktree_policy: 'exclusive-worktree-when-isolation',
      reasons,
      reason: 'PREFLIGHT #5: Mode W requested without isolation reason'
    };
  }

  if (isolation || requested === 'W') {
    return readyDecision({
      execution_mode: 'W',
      workspace: 'exclusive-worktree',
      environment: 'exclusive-worktree',
      worktree_policy: 'exclusive-worktree-when-isolation',
      reasons
    });
  }

  return readyDecision({
    execution_mode: 'S',
    workspace: 'project-branch',
    environment: 'project-branch',
    worktree_policy: 'project-branch-default',
    reasons: []
  });
}

/**
 * PREFLIGHT #5: execution mode must match isolation + environment.
 */
export function validateModeIsolationConsistency({
  executionMode = null,
  environment = null,
  access = 'write',
  isolation = false,
  worktree = null,
  projectPath = null
} = {}) {
  const errors = [];
  const mode = normalizeRequestedMode(executionMode) || executionModeForEnvironment(environment, access);

  if (mode && !EXECUTION_MODES.includes(mode)) {
    errors.push(`unknown execution_mode ${mode}`);
  }
  if (mode === 'P') {
    errors.push('Mode P is deferred (Phase 2c)');
  }
  if (access === 'read' && mode === 'W') {
    errors.push('read tasks cannot use Mode W');
  }
  if (mode === 'S' && isolation) {
    errors.push('PREFLIGHT #5: Mode S is inconsistent with isolation');
  }
  if (mode === 'W' && !isolation) {
    errors.push('PREFLIGHT #5: Mode W requires an isolation reason');
  }
  if (mode === 'W' && environment && environment !== 'exclusive-worktree') {
    errors.push('Mode W requires environment=exclusive-worktree');
  }
  if (mode === 'S' && access === 'write' && environment === 'exclusive-worktree') {
    errors.push('Mode S cannot use exclusive-worktree');
  }
  if (access === 'write') {
    const bind = validateExclusiveWorktreeBind({
      environment: environment || environmentForExecutionMode(mode, access),
      worktree,
      projectPath,
      access
    });
    errors.push(...bind.errors);
  }

  return { ok: errors.length === 0, errors, execution_mode: mode };
}

export function validateExclusiveWorktreeBind({
  environment,
  worktree = null,
  projectPath = null,
  access = 'write'
} = {}) {
  const errors = [];
  if (access !== 'write' || environment !== 'exclusive-worktree') {
    return { ok: true, errors };
  }
  if (!isNonEmptyString(worktree)) {
    errors.push('Mode W write bind requires exclusive worktree path');
    return { ok: false, errors };
  }
  if (isNonEmptyString(projectPath) && workspacePathsEqual(worktree, projectPath)) {
    errors.push('Mode W exclusive-worktree cannot bind project.path');
  }
  return { ok: errors.length === 0, errors };
}

export function validateAttestationExecutionMode(payload = {}) {
  const errors = [];
  const mode = payload.execution_mode;
  if (mode != null && mode !== '' && !EXECUTION_MODES.includes(mode)) {
    errors.push(`attestation execution_mode must be S|W|P, got ${mode}`);
  }
  if (mode === 'P') {
    errors.push('attestation execution_mode=P is deferred');
  }
  const access = payload.access || (payload.agent_name && String(payload.agent_name).includes('reviewer') ? 'read' : 'write');
  const isolation = mode === 'W' || payload.environment === 'exclusive-worktree';
  const consistency = validateModeIsolationConsistency({
    executionMode: mode || executionModeForEnvironment(payload.environment, access),
    environment: payload.environment,
    access,
    isolation: mode === 'W' ? true : isolation && mode !== 'S',
    worktree: payload.worktree,
    projectPath: payload.project_path
  });
  // Mode W attestation is itself the isolation declaration.
  if (mode === 'W') {
    const bind = validateExclusiveWorktreeBind({
      environment: payload.environment,
      worktree: payload.worktree,
      projectPath: payload.project_path,
      access
    });
    if (payload.environment !== 'exclusive-worktree' && access === 'write') {
      errors.push('Mode W attestation requires environment=exclusive-worktree');
    }
    errors.push(...bind.errors);
    return { ok: errors.length === 0, errors };
  }
  if (mode === 'S' && access === 'write') {
    if (payload.environment === 'exclusive-worktree') {
      errors.push('Mode S attestation cannot use exclusive-worktree');
    }
    if (payload.worktree && payload.project_path && !workspacePathsEqual(payload.worktree, payload.project_path)) {
      errors.push('Mode S write attestation worktree must equal project_path');
    }
  }
  errors.push(...consistency.errors.filter((item) => !errors.includes(item)));
  return { ok: errors.length === 0, errors };
}

function readyDecision({ execution_mode, workspace, environment, worktree_policy, reasons }) {
  return {
    ok: true,
    status: 'READY',
    execution_mode,
    proposed_mode: execution_mode,
    workspace,
    environment,
    worktree_policy,
    reasons,
    reason: null
  };
}

function normalizeRequestedMode(value) {
  if (value == null || value === '') return null;
  const mode = String(value).trim().toUpperCase();
  if (mode === 'S' || mode === 'W' || mode === 'P') return mode;
  if (value === 'exclusive-worktree') return 'W';
  if (value === 'project-branch') return 'S';
  throw new Error(`unknown requestedMode ${value}`);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
