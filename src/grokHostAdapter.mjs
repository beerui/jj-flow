/**
 * Grok Host Adapter Phase 2 (scriptable host boundary).
 *
 * Project registry + create/bind/reconcile helpers. Reuses CREATE_THREAD /
 * RECONCILE_THREAD type names; branches on host_id=grok-build + handle_kind=session.
 * Does not call Grok private APIs. Does not close Host Wave 2. Does not raise A2.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeGrokAttestation } from './dispatchAttestation.mjs';
import { bindThread, reconcileDispatch } from './dispatchControlPlane.mjs';
import { assertNamedBranchTip } from './dispatchWorktree.mjs';
import { executionModeForEnvironment } from './dispatchWorkspaceMode.mjs';

const PLACEHOLDER_SESSION = /^session-[a-z0-9-]+-\d{8}$/i;

export const GROK_HOST_ID = 'grok-build';
export const GROK_HANDLE_KIND = 'session';
export const WAVE2_TRIAL_REL = 'docs/milestones/real-host-trial-grok.json';

export function inspectProjectRegistry(projects = [], { runCommand = execFileSync } = {}) {
  return (Array.isArray(projects) ? projects : []).map((project) => ({
    id: project?.id || null,
    name: project?.name || null,
    status: project?.status || null,
    path: project?.path || null,
    git: inspectGitIdentity(project?.path, { runCommand })
  }));
}

export function inspectGitIdentity(repoPath, { runCommand = execFileSync } = {}) {
  if (!repoPath || typeof repoPath !== 'string') {
    return { ok: false, exists: false, reason: 'project path is required' };
  }
  if (!fs.existsSync(repoPath)) {
    return { ok: false, exists: false, path: repoPath, reason: 'path does not exist' };
  }
  try {
    const gitRoot = git(repoPath, ['rev-parse', '--show-toplevel'], runCommand);
    const head = git(repoPath, ['rev-parse', 'HEAD'], runCommand);
    const abbrev = git(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'], runCommand);
    let remotes = [];
    try {
      remotes = parseRemotes(git(repoPath, ['remote', '-v'], runCommand));
    } catch {
      remotes = [];
    }
    return {
      ok: true,
      exists: true,
      path: path.resolve(repoPath),
      git_root: gitRoot,
      head,
      branch: abbrev === 'HEAD' ? null : abbrev,
      detached: abbrev === 'HEAD',
      remotes
    };
  } catch (error) {
    return {
      ok: false,
      exists: true,
      path: repoPath,
      reason: error?.stderr ? String(error.stderr).trim() : error.message
    };
  }
}

export function grokSkillInstalled({
  cwd = process.cwd(),
  homedir = os.homedir()
} = {}) {
  const candidates = [
    path.join(cwd, '.grok', 'skills', 'jj-dispatch', 'SKILL.md'),
    path.join(homedir, '.grok', 'skills', 'jj-dispatch', 'SKILL.md')
  ];
  const found = candidates.filter((file) => fs.existsSync(file));
  return { installed: found.length > 0, paths: found };
}

/**
 * Scriptable BIND for a grok-build session. Writes attestation then bindThread.
 * Mode W callers must pass an exclusive worktree that already has a named branch.
 */
export function bindGrokSessionTask({
  plane,
  controlRoot,
  deliveryId,
  taskKey,
  sessionId,
  projectId,
  projectPath,
  worktreePath = null,
  intendedBranch = null,
  environment = 'project-branch',
  access = 'write',
  agentName = null,
  sandboxMode = null,
  gitHeadAtBind = null,
  effectiveBoundarySource = 'declared-coordinator',
  executionMode = null
} = {}) {
  if (!plane || !controlRoot || !deliveryId || !taskKey || !sessionId || !projectId) {
    return { ok: false, reason: 'bindGrokSessionTask requires plane, controlRoot, deliveryId, taskKey, sessionId, projectId', plane };
  }
  if (PLACEHOLDER_SESSION.test(sessionId)) {
    return { ok: false, reason: 'placeholder session-<slug>-YYYYMMDD cannot BIND', plane };
  }
  const existingIntent = (plane.deliveries || [])
    .flatMap((delivery) => delivery.dispatch_intents || [])
    .find((intent) => intent.task_key === taskKey);
  const derivedMode = executionModeForEnvironment(environment, access);
  const resolvedMode = executionMode
    || (derivedMode === 'W' ? 'W' : (existingIntent?.execution_mode || derivedMode));
  if (access === 'write' && environment === 'exclusive-worktree') {
    if (!worktreePath || !intendedBranch) {
      return { ok: false, reason: 'Mode W bind requires worktreePath and intendedBranch', plane };
    }
    const landing = assertNamedBranchTip({ worktreePath, intendedBranch });
    if (!landing.ok) return { ok: false, reason: landing.reason, plane };
  }

  const resolvedAccess = access;
  const resolvedAgent = agentName || (resolvedAccess === 'read' ? 'jj-workflow-reviewer' : 'jj-workflow-developer');
  const resolvedSandbox = sandboxMode || (resolvedAccess === 'read' ? 'read-only' : 'workspace-write');
  const workspace = resolvedAccess === 'write'
    ? (worktreePath || projectPath)
    : null;

  let attestation;
  try {
    attestation = writeGrokAttestation(controlRoot, {
      deliveryId,
      task_key: taskKey,
      session_id: sessionId,
      host_id: GROK_HOST_ID,
      agent_name: resolvedAgent,
      execution_mode: resolvedMode,
      sandbox_mode: resolvedSandbox,
      effective_sandbox_mode: resolvedSandbox,
      environment,
      worktree: workspace,
      intended_branch: intendedBranch,
      project_path: projectPath,
      git_head_at_bind: gitHeadAtBind,
      effective_boundary_source: effectiveBoundarySource,
      access: resolvedAccess
    });
  } catch (error) {
    return { ok: false, reason: error.message, plane };
  }

  try {
    const next = bindThread(plane, {
      taskKey,
      threadId: sessionId,
      projectId,
      hostId: GROK_HOST_ID,
      handleKind: GROK_HANDLE_KIND,
      agentName: resolvedAgent,
      sandboxMode: resolvedSandbox,
      environment,
      effectiveSandboxMode: resolvedSandbox,
      sandboxEvidenceRef: attestation.rel,
      worktree: workspace
    });
    return {
      ok: true,
      plane: next,
      attestation_ref: attestation.rel,
      wave2_closed: false,
      host_id: GROK_HOST_ID,
      handle_kind: GROK_HANDLE_KIND
    };
  } catch (error) {
    return { ok: false, reason: error.message, plane, attestation_ref: attestation.rel };
  }
}

export function reconcileGrokSession(plane, { taskKey, candidates } = {}) {
  return {
    ...reconcileDispatch(plane, { taskKey, candidates }),
    wave2_closed: false
  };
}

/**
 * Fail-closed evaluator for a future Grok real-host trial JSON.
 * Missing file, semi-real, lab-harness, Mode S skill-only, or host:trial
 * evidence never closes Wave 2.
 */
export function evaluateGrokWave2Evidence(input = {}) {
  const errors = [];
  if (!input || typeof input !== 'object') {
    return { ok: false, closed: false, errors: ['trial evidence must be an object'] };
  }
  if (input.host_id === 'lab-harness' || input.gym === true || input.lab === true) {
    errors.push('lab-harness / gym evidence cannot close Host Wave 2');
  }
  if (input.mode === 'semi-real' || input.adapter === 'local-git-worktree') {
    errors.push('semi-real host:trial cannot close Host Wave 2');
  }
  if (input.skill_only === true || input.skill_install === true) {
    errors.push('skill install / Mode S skill path cannot close Host Wave 2');
  }
  if (input.execution_mode === 'W' && input.wave2 === true && !input.session_id) {
    errors.push('Mode W workspace isolation is not Wave 2 attestation');
  }
  if (input.host_id && input.host_id !== GROK_HOST_ID && input.host_id !== 'codex-app') {
    errors.push(`unapproved host_id ${input.host_id}`);
  }
  if (input.host_id === GROK_HOST_ID && input.handle_kind !== GROK_HANDLE_KIND) {
    errors.push('grok-build Wave 2 requires handle_kind=session');
  }
  if (input.codex_app_threads === true && input.host_id === GROK_HOST_ID) {
    errors.push('grok-build must not claim codex_app_threads=true');
  }
  if (!isNonEmptyString(input.session_id) && !isNonEmptyString(input.thread_id)) {
    errors.push('real host session_id / thread_id required');
  }
  if (typeof input.session_id === 'string' && /^session-[a-z0-9-]+-\d{8}$/i.test(input.session_id)) {
    errors.push('placeholder session-<slug>-YYYYMMDD cannot close Wave 2');
  }
  if (!isNonEmptyString(input.sandbox_evidence_ref)) {
    errors.push('host-issued sandbox_evidence_ref required');
  }
  if (input.reconcile !== true && input.duplicate_create_count !== 0) {
    errors.push('Wave 2 requires a unique-candidate RECONCILE path');
  }
  if (input.review_rework !== true) {
    errors.push('Wave 2 requires a Review NEEDS_CHANGES → rework path');
  }
  if (input.status === 'PASS' && errors.length) {
    errors.push('trial JSON must not claim PASS while Wave 2 gates fail');
  }
  return {
    ok: errors.length === 0,
    closed: false,
    errors
  };
}

export function inspectGrokWave2Milestone({ cwd = process.cwd() } = {}) {
  const maxUnattended = readMaxUnattendedLevel(cwd);
  const trialPath = path.join(cwd, WAVE2_TRIAL_REL);
  if (!fs.existsSync(trialPath)) {
    return {
      closed: false,
      status: 'pending',
      path: WAVE2_TRIAL_REL,
      reason: 'no real-host-trial-grok.json; Mode W / Mode S / lab-harness / host:trial are not substitutes',
      max_unattended_level: maxUnattended
    };
  }
  let json;
  try {
    json = JSON.parse(fs.readFileSync(trialPath, 'utf8'));
  } catch (error) {
    return {
      closed: false,
      status: 'blocked',
      path: WAVE2_TRIAL_REL,
      reason: `trial JSON unreadable: ${error.message}`,
      max_unattended_level: maxUnattended
    };
  }
  const evaluation = evaluateGrokWave2Evidence(json);
  const evaluable = evaluation.ok && json.status === 'PASS';
  const humanClosed = isRealHostAcceptanceCompleted(cwd) && autonomyRank(maxUnattended) >= 2;
  const closed = evaluable && humanClosed;
  return {
    closed,
    evaluable,
    status: closed ? 'completed' : (evaluable ? 'evaluable' : 'pending'),
    path: WAVE2_TRIAL_REL,
    reason: closed
      ? 'Grok trial JSON PASS; real-host-acceptance completed and max_unattended_level >= A2'
      : (evaluable
        ? 'trial JSON is evaluable; Host Wave 2 still requires milestone completed + A2 policy (JSON cannot self-close)'
        : (evaluation.errors.join('; ') || 'trial JSON is not PASS')),
    errors: evaluation.errors,
    max_unattended_level: maxUnattended
  };
}

function parseRemotes(raw) {
  const seen = new Map();
  for (const line of String(raw || '').split(/\r?\n/).filter(Boolean)) {
    const match = line.match(/^(\S+)\s+(\S+)\s+\((\w+)\)$/);
    if (!match) continue;
    const [, name, url, role] = match;
    const current = seen.get(name) || { name, fetch: null, push: null };
    current[role] = url;
    seen.set(name, current);
  }
  return [...seen.values()];
}

function git(cwd, args, runCommand) {
  const result = runCommand('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const stdout = typeof result === 'string' ? result : result?.stdout || '';
  return String(stdout).trim();
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function readMaxUnattendedLevel(cwd) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(cwd, 'harness-manifest.json'), 'utf8'));
    const level = manifest?.autonomy?.max_unattended_level;
    return isNonEmptyString(level) ? level : 'A1';
  } catch {
    return 'A1';
  }
}

function isRealHostAcceptanceCompleted(cwd) {
  const file = path.join(cwd, 'docs/milestones/real-host-acceptance.md');
  if (!fs.existsSync(file)) return false;
  try {
    return /^>\s*状态：\*\*completed\*\*/m.test(fs.readFileSync(file, 'utf8'));
  } catch {
    return false;
  }
}

function autonomyRank(level) {
  const match = String(level || '').match(/^A([0-4])$/);
  return match ? Number(match[1]) : 0;
}
