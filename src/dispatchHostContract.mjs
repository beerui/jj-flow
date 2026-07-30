export const HOST_ACTION_SCHEMA_VERSION = 'jj-flow/dispatch-host-action/1.0';

export const HOST_ACTION_TYPES = Object.freeze([
  'CREATE_THREAD',
  'RECONCILE_THREAD'
]);

export const RECEIPT_KINDS = Object.freeze(['TASK_RESULT', 'REVIEW_RESULT']);
export const RECEIPT_STATUSES = Object.freeze(['COMPLETED', 'BLOCKED']);

/** Approved host adapters. Trial/local hosts may use other host_id strings. */
export const HOST_IDS = Object.freeze(['codex-app', 'grok-build']);

/** External execution handle kinds carried in intent.thread_id. */
export const HANDLE_KINDS = Object.freeze(['thread', 'session']);

/**
 * Per-host profiles. Action type names stay CREATE_THREAD / RECONCILE_THREAD;
 * adapters branch on host_id + handle_kind (Grok is not a Codex simulator).
 */
export const HOST_PROFILES = Object.freeze({
  'codex-app': Object.freeze({
    host_id: 'codex-app',
    handle_kind: 'thread',
    create_action: 'CREATE_THREAD',
    reconcile_action: 'RECONCILE_THREAD',
    required_capabilities: Object.freeze([
      'list_projects',
      'list_threads',
      'create_thread',
      'read_thread',
      'send_message_to_thread',
      'worktree',
      'sandbox'
    ]),
    capability_equivalents: Object.freeze({
      list_projects: 'Codex App project registry (projectId + path)',
      list_threads: 'Codex App thread listing for the bound project',
      create_thread: 'CREATE_THREAD against Codex App',
      read_thread: 'read Codex thread messages / structured receipt',
      send_message_to_thread: 'send distribution_prompt into Codex thread',
      worktree: 'write workspace path: project root (project-branch default) or exclusive worktree when isolation required',
      sandbox: 'App runtime sandbox attestation fields'
    }),
    attestation_required_fields: Object.freeze([
      'host_id',
      'handle_kind',
      'thread_id',
      'task_key',
      'agent_name',
      'sandbox_mode',
      'effective_sandbox_mode',
      'sandbox_evidence_ref'
    ])
  }),
  'grok-build': Object.freeze({
    host_id: 'grok-build',
    handle_kind: 'session',
    create_action: 'CREATE_THREAD',
    reconcile_action: 'RECONCILE_THREAD',
    required_capabilities: Object.freeze([
      'list_projects',
      'list_threads',
      'create_thread',
      'read_thread',
      'send_message_to_thread',
      'worktree',
      'sandbox'
    ]),
    capability_equivalents: Object.freeze({
      list_projects: 'control-project path + git identity registry',
      list_threads: 'local/repo Grok session index or harness session metadata',
      create_thread: 'CREATE_SESSION_TASK: declare/bind session for task_key',
      read_thread: 'structured receipt or agreed artifact path for the session',
      send_message_to_thread: 'inject distribution_prompt into the bound session with audit ref',
      worktree: 'write workspace path: project root on named branch (default) or exclusive worktree when isolation required',
      sandbox: 'bound attestation JSON (effective boundary), not model prose'
    }),
    attestation_required_fields: Object.freeze([
      'host_id',
      'handle_kind',
      'thread_id',
      'task_key',
      'agent_name',
      'sandbox_mode',
      'effective_sandbox_mode',
      'sandbox_evidence_ref'
    ]),
    evidence_must_declare: Object.freeze(['handle_kind=session'])
  })
});

/**
 * Write default is project-branch (same-style: named feature branch at project path).
 * exclusive-worktree only when isolation is required (concurrent write / dirty main / user opt-in).
 * See jj-dispatch workspace_mode policy (EP-20260730 preference-modified transfer cost).
 */
export const HOST_ACCESS_PROFILES = Object.freeze({
  read: Object.freeze({
    agent_name: 'jj-workflow-reviewer',
    sandbox_mode: 'read-only',
    environment: 'project-read',
    worktree_policy: 'forbidden'
  }),
  write: Object.freeze({
    agent_name: 'jj-workflow-developer',
    sandbox_mode: 'workspace-write',
    environment: 'project-branch',
    worktree_policy: 'project-branch-default'
  })
});

export const WRITE_ENVIRONMENTS = Object.freeze(['project-branch', 'exclusive-worktree']);

export const HOST_ACTION_POLICIES = Object.freeze({
  CREATE_THREAD: Object.freeze({
    mode: 'external-write',
    required_capabilities: Object.freeze(['create_thread', 'sandbox']),
    write_access_capabilities: Object.freeze(['worktree'])
  }),
  RECONCILE_THREAD: Object.freeze({
    mode: 'read-only',
    required_capabilities: Object.freeze(['list_threads', 'read_thread', 'sandbox']),
    write_access_capabilities: Object.freeze(['worktree'])
  })
});

export function describeHostAction(type, access) {
  const policy = HOST_ACTION_POLICIES[type];
  const profile = HOST_ACCESS_PROFILES[access];
  if (!policy) throw new Error(`Unknown host action type: ${type}`);
  if (!profile) throw new Error(`Unknown host action access: ${access}`);
  const requiredCapabilities = [
    ...policy.required_capabilities,
    ...(access === 'write' ? policy.write_access_capabilities : [])
  ];
  return {
    host_action_schema_version: HOST_ACTION_SCHEMA_VERSION,
    mode: policy.mode,
    required_capabilities: requiredCapabilities,
    ...profile
  };
}

export function getHostProfile(hostId) {
  if (!isNonEmptyString(hostId)) return null;
  return HOST_PROFILES[hostId] || null;
}

/**
 * Resolve handle_kind for a host.
 * Known hosts force their profile kind; unknown hosts default to thread
 * (semi-real trial fixtures) unless an explicit valid kind is provided.
 */
export function resolveHandleKind(hostId, handleKind = null) {
  const profile = getHostProfile(hostId);
  if (profile) {
    if (handleKind != null && handleKind !== '' && handleKind !== profile.handle_kind) {
      throw new Error(
        `host ${hostId} requires handle_kind=${profile.handle_kind}, got ${handleKind}`
      );
    }
    return profile.handle_kind;
  }
  if (handleKind == null || handleKind === '') return 'thread';
  if (!HANDLE_KINDS.includes(handleKind)) {
    throw new Error(`Unknown handle_kind: ${handleKind}`);
  }
  return handleKind;
}

/**
 * Pure attestation gate for BIND. Fail-closed: missing evidence or host/kind
 * mismatch never counts as PASS. Does not call network or host APIs.
 */
export function validateHostBindAttestation(input = {}) {
  const errors = [];
  const {
    host_id: hostId,
    handle_kind: handleKindInput,
    thread_id: threadId,
    task_key: taskKey,
    agent_name: agentName,
    sandbox_mode: sandboxMode,
    effective_sandbox_mode: effectiveSandboxMode,
    sandbox_evidence_ref: sandboxEvidenceRef,
    worktree = null,
    access = null
  } = input;

  if (!isNonEmptyString(hostId)) errors.push('attestation requires host_id');
  if (!isNonEmptyString(threadId)) errors.push('attestation requires thread_id (external handle)');
  if (!isNonEmptyString(taskKey)) errors.push('attestation requires task_key');
  if (!isNonEmptyString(agentName)) errors.push('attestation requires agent_name');
  if (!isNonEmptyString(sandboxMode)) errors.push('attestation requires sandbox_mode');
  if (!isNonEmptyString(effectiveSandboxMode)) {
    errors.push('attestation requires effective_sandbox_mode (TOML defaults are not proof)');
  } else if (sandboxMode && effectiveSandboxMode !== sandboxMode) {
    errors.push('effective_sandbox_mode must match expected sandbox_mode');
  }
  if (!isNonEmptyString(sandboxEvidenceRef)) {
    errors.push('attestation requires sandbox_evidence_ref (model prose is not proof)');
  }

  let handleKind = null;
  try {
    handleKind = resolveHandleKind(hostId, handleKindInput);
  } catch (error) {
    errors.push(error.message);
  }

  const profile = getHostProfile(hostId);
  if (profile) {
    for (const field of profile.attestation_required_fields) {
      if (field === 'handle_kind') {
        if (!isNonEmptyString(handleKind)) errors.push(`attestation requires ${field}`);
        continue;
      }
      const value = field === 'thread_id' ? threadId : input[field];
      if (!isNonEmptyString(value)) errors.push(`attestation requires ${field}`);
    }
    if (hostId === 'grok-build' && handleKind !== 'session') {
      errors.push('grok-build requires handle_kind=session');
    }
    if (hostId === 'codex-app' && handleKind !== 'thread') {
      errors.push('codex-app requires handle_kind=thread');
    }
  }

  if (access === 'read' && worktree) {
    errors.push('read access cannot bind a worktree');
  }
  if (access === 'write' && !isNonEmptyString(worktree)) {
    errors.push('write access requires worktree at bind');
  }

  // Reject obvious fake Grok evidence that pretends to be a real host trial.
  if (hostId === 'grok-build') {
    if (typeof sandboxEvidenceRef === 'string') {
      if (/semi-real/i.test(sandboxEvidenceRef)) {
        errors.push('grok-build attestation must not reuse semi-real host trial evidence');
      }
      if (/codex_app_threads\s*[:=]\s*true/i.test(sandboxEvidenceRef)) {
        errors.push('grok-build attestation must not claim codex_app_threads=true');
      }
    }
    if (input.codex_app_threads === true) {
      errors.push('grok-build attestation must not claim codex_app_threads=true');
    }
    if (input.mode === 'semi-real') {
      errors.push('grok-build attestation must not use mode=semi-real');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    handle_kind: handleKind,
    host_id: hostId || null
  };
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
