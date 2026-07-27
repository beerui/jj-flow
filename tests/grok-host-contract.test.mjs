import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  approveDispatch,
  bindThread,
  createControlPlane,
  dispatchTasks,
  markDispatchUnknown,
  reconcileDispatch,
  REQUIRED_APP_CAPABILITIES,
  validateControlPlane
} from '../src/dispatchControlPlane.mjs';
import {
  HANDLE_KINDS,
  HOST_ACTION_TYPES,
  HOST_IDS,
  HOST_PROFILES,
  resolveHandleKind,
  validateHostBindAttestation
} from '../src/dispatchHostContract.mjs';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/jj-dispatch-control-plane.json', import.meta.url), 'utf8'));
const hostContract = JSON.parse(
  fs.readFileSync(new URL('../.codex/skills/jj-dispatch/references/host-action-contract.json', import.meta.url), 'utf8')
);
const controlPlaneSchema = JSON.parse(
  fs.readFileSync(new URL('../.codex/skills/jj-dispatch/references/control-plane.schema.json', import.meta.url), 'utf8')
);
const appCapabilities = [...REQUIRED_APP_CAPABILITIES];

test('host contract enumerates codex-app and grok-build with handle kinds', () => {
  assert.deepEqual(HOST_IDS, ['codex-app', 'grok-build']);
  assert.deepEqual(HANDLE_KINDS, ['thread', 'session']);
  assert.deepEqual(hostContract.host_ids, [...HOST_IDS]);
  assert.deepEqual(hostContract.handle_kinds, [...HANDLE_KINDS]);
  assert.equal(HOST_PROFILES['codex-app'].handle_kind, 'thread');
  assert.equal(HOST_PROFILES['grok-build'].handle_kind, 'session');
  assert.equal(HOST_PROFILES['grok-build'].create_action, 'CREATE_THREAD');
  assert.equal(HOST_PROFILES['grok-build'].reconcile_action, 'RECONCILE_THREAD');
  assert.deepEqual(HOST_ACTION_TYPES, ['CREATE_THREAD', 'RECONCILE_THREAD']);
  for (const capability of REQUIRED_APP_CAPABILITIES) {
    assert.ok(HOST_PROFILES['grok-build'].capability_equivalents[capability]);
    assert.ok(HOST_PROFILES['codex-app'].capability_equivalents[capability]);
  }
});

test('control-plane schema exposes handle_kind on intents', () => {
  assert.deepEqual(controlPlaneSchema.$defs.intent.properties.handle_kind.enum, ['thread', 'session', null]);
});

test('resolveHandleKind forces session for grok-build and thread for codex-app', () => {
  assert.equal(resolveHandleKind('grok-build'), 'session');
  assert.equal(resolveHandleKind('codex-app'), 'thread');
  assert.equal(resolveHandleKind('host-trial-local'), 'thread');
  assert.equal(resolveHandleKind('host-trial-local', 'session'), 'session');
  assert.throws(() => resolveHandleKind('grok-build', 'thread'), /handle_kind=session/);
  assert.throws(() => resolveHandleKind('codex-app', 'session'), /handle_kind=thread/);
});

test('validateHostBindAttestation fails closed without evidence', () => {
  const missing = validateHostBindAttestation({
    host_id: 'grok-build',
    handle_kind: 'session',
    thread_id: 'session-1',
    task_key: 'DEL-001/A/development/1',
    agent_name: 'jj-workflow-developer',
    sandbox_mode: 'workspace-write',
    effective_sandbox_mode: 'workspace-write',
    sandbox_evidence_ref: null,
    worktree: '/tmp/wt-a',
    access: 'write'
  });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some((error) => error.includes('sandbox_evidence_ref')));

  const proseOnly = validateHostBindAttestation({
    host_id: 'grok-build',
    handle_kind: 'session',
    thread_id: 'session-1',
    task_key: 'DEL-001/A/development/1',
    agent_name: 'jj-workflow-developer',
    sandbox_mode: 'workspace-write',
    effective_sandbox_mode: null,
    sandbox_evidence_ref: 'chat:said-sandbox',
    worktree: '/tmp/wt-a',
    access: 'write'
  });
  assert.equal(proseOnly.ok, false);
  assert.ok(proseOnly.errors.some((error) => error.includes('effective_sandbox_mode')));
});

test('validateHostBindAttestation rejects semi-real evidence for grok-build', () => {
  const result = validateHostBindAttestation({
    host_id: 'grok-build',
    handle_kind: 'session',
    thread_id: 'session-1',
    task_key: 'DEL-001/A/development/1',
    agent_name: 'jj-workflow-developer',
    sandbox_mode: 'workspace-write',
    effective_sandbox_mode: 'workspace-write',
    sandbox_evidence_ref: 'SANDBOX:semi-real:local',
    worktree: '/tmp/wt-a',
    access: 'write',
    mode: 'semi-real',
    codex_app_threads: true
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /semi-real|codex_app_threads/i.test(error)));
});

test('validateHostBindAttestation accepts a complete grok-build binding', () => {
  const result = validateHostBindAttestation({
    host_id: 'grok-build',
    handle_kind: 'session',
    thread_id: 'session-1',
    task_key: 'DEL-001/A/development/1',
    agent_name: 'jj-workflow-developer',
    sandbox_mode: 'workspace-write',
    effective_sandbox_mode: 'workspace-write',
    sandbox_evidence_ref: 'SANDBOX:GROK:session-1',
    worktree: '/tmp/wt-a',
    access: 'write'
  });
  assert.equal(result.ok, true, result.errors?.join('; '));
  assert.equal(result.handle_kind, 'session');
});

test('bindThread stores session handle for grok-build and rejects wrong kind', () => {
  let plane = approveDispatch(createControlPlane(fixture), {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:grok-bind'
  });
  plane = dispatchTasks(plane, 'DEL-001', { capabilities: appCapabilities }).plane;
  const taskKey = plane.deliveries[0].dispatch_intents.find(
    (intent) => intent.project_id === 'C' && intent.responsibility === 'development'
  ).task_key;

  assert.throws(() => bindThread(plane, {
    taskKey,
    threadId: 'session-c-dev-1',
    projectId: 'C',
    hostId: 'grok-build',
    handleKind: 'thread',
    agentName: 'jj-workflow-developer',
    sandboxMode: 'workspace-write',
    environment: 'exclusive-worktree',
    effectiveSandboxMode: 'workspace-write',
    sandboxEvidenceRef: 'SANDBOX:GROK:session-c-dev-1',
    worktree: '/tmp/wt-c'
  }), /handle_kind=session/);

  assert.throws(() => bindThread(plane, {
    taskKey,
    threadId: 'session-c-dev-1',
    projectId: 'C',
    hostId: 'grok-build',
    handleKind: 'session',
    agentName: 'jj-workflow-developer',
    sandboxMode: 'workspace-write',
    environment: 'exclusive-worktree',
    effectiveSandboxMode: 'workspace-write',
    sandboxEvidenceRef: null,
    worktree: '/tmp/wt-c'
  }), /sandboxEvidenceRef|attestation|sandbox_evidence_ref/i);

  const bound = bindThread(plane, {
    taskKey,
    threadId: 'session-c-dev-1',
    projectId: 'C',
    hostId: 'grok-build',
    handleKind: 'session',
    agentName: 'jj-workflow-developer',
    sandboxMode: 'workspace-write',
    environment: 'exclusive-worktree',
    effectiveSandboxMode: 'workspace-write',
    sandboxEvidenceRef: 'SANDBOX:GROK:session-c-dev-1',
    worktree: '/tmp/wt-c'
  });
  const intent = bound.deliveries[0].dispatch_intents.find((item) => item.task_key === taskKey);
  assert.equal(intent.status, 'BOUND');
  assert.equal(intent.host_id, 'grok-build');
  assert.equal(intent.handle_kind, 'session');
  assert.equal(intent.thread_id, 'session-c-dev-1');
  assert.equal(validateControlPlane(bound).ok, true, validateControlPlane(bound).errors?.join('; '));
});

test('reconcileDispatch accepts a unique grok session candidate and rejects fake evidence', () => {
  let plane = approveDispatch(createControlPlane(fixture), {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:grok-reconcile'
  });
  plane = dispatchTasks(plane, 'DEL-001', { capabilities: appCapabilities }).plane;
  const taskKey = plane.deliveries[0].dispatch_intents.find(
    (intent) => intent.project_id === 'C' && intent.responsibility === 'development'
  ).task_key;
  plane = markDispatchUnknown(plane, { taskKey });

  const blocked = reconcileDispatch(plane, {
    taskKey,
    candidates: [{
      task_key: taskKey,
      thread_id: 'session-c-dev-1',
      project_id: 'C',
      host_id: 'grok-build',
      handle_kind: 'session',
      agent_name: 'jj-workflow-developer',
      sandbox_mode: 'workspace-write',
      effective_sandbox_mode: 'workspace-write',
      environment: 'exclusive-worktree',
      sandbox_evidence_ref: 'SANDBOX:semi-real:fake',
      worktree: '/tmp/wt-c',
      mode: 'semi-real'
    }]
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 'BLOCKED');

  const resumed = reconcileDispatch(plane, {
    taskKey,
    candidates: [{
      task_key: taskKey,
      thread_id: 'session-c-dev-1',
      project_id: 'C',
      host_id: 'grok-build',
      handle_kind: 'session',
      agent_name: 'jj-workflow-developer',
      sandbox_mode: 'workspace-write',
      effective_sandbox_mode: 'workspace-write',
      environment: 'exclusive-worktree',
      sandbox_evidence_ref: 'SANDBOX:GROK:session-c-dev-1',
      worktree: '/tmp/wt-c'
    }]
  });
  assert.equal(resumed.ok, true, resumed.reason);
  assert.equal(resumed.status, 'BOUND');
  const intent = resumed.plane.deliveries[0].dispatch_intents.find((item) => item.task_key === taskKey);
  assert.equal(intent.handle_kind, 'session');
  assert.equal(intent.host_id, 'grok-build');
});

test('control plane rejects persisted grok bound intent without handle_kind=session', () => {
  let plane = approveDispatch(createControlPlane(fixture), {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:grok-validate'
  });
  plane = dispatchTasks(plane, 'DEL-001', { capabilities: appCapabilities }).plane;
  const intent = plane.deliveries[0].dispatch_intents.find(
    (item) => item.project_id === 'C' && item.responsibility === 'development'
  );
  intent.status = 'BOUND';
  intent.thread_id = 'session-c-dev-1';
  intent.host_id = 'grok-build';
  intent.handle_kind = 'thread';
  intent.agent_name = 'jj-workflow-developer';
  intent.sandbox_mode = 'workspace-write';
  intent.effective_sandbox_mode = 'workspace-write';
  intent.environment = 'exclusive-worktree';
  intent.sandbox_evidence_ref = 'SANDBOX:GROK:session-c-dev-1';
  intent.worktree = '/tmp/wt-c';
  intent.bound_at = '2026-07-27T00:00:00.000Z';
  const validation = validateControlPlane(plane);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => /handle_kind/i.test(error)));
});
