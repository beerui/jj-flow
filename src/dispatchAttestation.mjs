/**
 * C4 — Grok Mode S attestation path helpers (files, not host:string refs).
 * Pure path builders + optional write; does not touch control-plane status.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  executionModeForEnvironment,
  validateAttestationExecutionMode
} from './dispatchWorkspaceMode.mjs';

/**
 * DEL/a/b/1 → DEL__a__b__1
 * @param {string} taskKey
 */
export function taskKeyToSafeName(taskKey) {
  return String(taskKey || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .join('__');
}

/**
 * Relative to control_root (with leading .workflow/…).
 * @param {string} deliveryId
 * @param {string} taskKey
 */
export function attestationRelativePath(deliveryId, taskKey) {
  const del = String(deliveryId || '').trim();
  const safe = taskKeyToSafeName(taskKey);
  if (!del || !safe) throw new Error('deliveryId and taskKey are required');
  return `.workflow/dispatch/${del}/attestations/${safe}.json`;
}

/**
 * Absolute path under control root.
 */
export function attestationAbsolutePath(controlRoot, deliveryId, taskKey) {
  if (!controlRoot) throw new Error('controlRoot is required');
  return path.resolve(controlRoot, attestationRelativePath(deliveryId, taskKey));
}

/**
 * Build attestation JSON for grok-build BIND (development or review).
 */
export function buildGrokAttestation({
  task_key,
  session_id,
  host_id = 'grok-build',
  agent_name = null,
  execution_mode = null,
  sandbox_mode = null,
  effective_sandbox_mode = null,
  environment = null,
  worktree = null,
  intended_branch = null,
  git_head_at_bind = null,
  project_path = null,
  bound_at = new Date().toISOString(),
  access = null,
  effective_boundary_source = 'declared-coordinator'
} = {}) {
  if (!task_key) throw new Error('task_key is required');
  if (!session_id || typeof session_id !== 'string') throw new Error('session_id is required');
  if (host_id !== 'grok-build' && host_id !== 'lab-harness') {
    throw new Error('host_id must be grok-build or lab-harness');
  }
  const isRead = access === 'read'
    || (agent_name && String(agent_name).includes('reviewer'))
    || sandbox_mode === 'read-only';
  const resolvedAccess = access || (isRead ? 'read' : 'write');
  const resolvedEnvironment = environment || (isRead ? 'project-read' : 'project-branch');
  const resolvedMode = execution_mode || executionModeForEnvironment(resolvedEnvironment, resolvedAccess);
  const payload = {
    host_id,
    handle_kind: 'session',
    session_id,
    task_key,
    agent_name: agent_name || (isRead ? 'jj-workflow-reviewer' : 'jj-workflow-developer'),
    execution_mode: resolvedMode,
    sandbox_mode: sandbox_mode || (isRead ? 'read-only' : 'workspace-write'),
    effective_sandbox_mode: effective_sandbox_mode || sandbox_mode || (isRead ? 'read-only' : 'workspace-write'),
    effective_boundary_source,
    environment: resolvedEnvironment,
    worktree: worktree === undefined ? null : worktree,
    intended_branch: intended_branch || null,
    git_head_at_bind: git_head_at_bind || null,
    project_path: project_path || null,
    bound_at,
    access: resolvedAccess
  };
  const modeCheck = validateAttestationExecutionMode(payload);
  if (!modeCheck.ok) {
    throw new Error(`attestation execution_mode invalid: ${modeCheck.errors.join('; ')}`);
  }
  return payload;
}

/**
 * Write attestation file; returns { abs, rel, payload }.
 * Rel path is suitable for intent.sandbox_evidence_ref.
 */
export function writeGrokAttestation(controlRoot, {
  deliveryId,
  task_key,
  session_id,
  ...rest
} = {}) {
  const rel = attestationRelativePath(deliveryId, task_key);
  const abs = path.resolve(controlRoot, rel);
  const payload = buildGrokAttestation({ task_key, session_id, ...rest });
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return { abs, rel, payload };
}

/** Gym-only Mode S attestation. Does not close real-host Wave 2. */
export function writeLabAttestation(controlRoot, options = {}) {
  return writeGrokAttestation(controlRoot, { ...options, host_id: 'lab-harness' });
}

/** True if ref looks like an attestation file path (not host:session string). */
export function isAttestationFileRef(ref) {
  const s = String(ref || '').replace(/\\/g, '/');
  if (!s) return false;
  if (s.startsWith('host:')) return false;
  return s.includes('attestations/') || s.endsWith('.json');
}
