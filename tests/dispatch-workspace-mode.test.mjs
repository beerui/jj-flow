import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  EXECUTION_MODES,
  collectIsolationReasons,
  executionModeForEnvironment,
  isolationRequired,
  selectWriteWorkspaceMode,
  validateAttestationExecutionMode,
  validateExclusiveWorktreeBind,
  validateModeIsolationConsistency,
  workspacePathsEqual
} from '../src/dispatchWorkspaceMode.mjs';
import {
  approveDispatch,
  bindThread,
  createControlPlane,
  dispatchTasks,
  previewDispatch
} from '../src/dispatchControlPlane.mjs';
import { buildGrokAttestation } from '../src/dispatchAttestation.mjs';

const fixture = JSON.parse(
  fs.readFileSync(new URL('./fixtures/jj-dispatch-control-plane.json', import.meta.url), 'utf8')
);
const appCapabilities = [
  'list_projects',
  'list_threads',
  'create_thread',
  'read_thread',
  'send_message_to_thread',
  'worktree',
  'sandbox'
];

test('default write workspace is Mode S project-branch', () => {
  const decision = selectWriteWorkspaceMode();
  assert.equal(decision.ok, true);
  assert.equal(decision.status, 'READY');
  assert.equal(decision.execution_mode, 'S');
  assert.equal(decision.proposed_mode, 'S');
  assert.equal(decision.workspace, 'project-branch');
  assert.equal(decision.environment, 'project-branch');
  assert.deepEqual(EXECUTION_MODES, ['S', 'W', 'P']);
});

test('dirty main, active write, or user isolation selects Mode W', () => {
  for (const signals of [
    { dirtyMainUnrelated: true },
    { sameProjectActiveWrite: true },
    { userRequestsIsolation: true }
  ]) {
    const decision = selectWriteWorkspaceMode(signals);
    assert.equal(decision.ok, true, JSON.stringify(signals));
    assert.equal(decision.execution_mode, 'W');
    assert.equal(decision.workspace, 'exclusive-worktree');
    assert.equal(decision.environment, 'exclusive-worktree');
    assert.equal(decision.worktree_policy, 'exclusive-worktree-when-isolation');
    assert.ok(decision.reasons.length > 0);
  }
});

test('PREFLIGHT #5 blocks Mode S when isolation is required', () => {
  const decision = selectWriteWorkspaceMode({
    requestedMode: 'S',
    dirtyMainUnrelated: true
  });
  assert.equal(decision.ok, false);
  assert.equal(decision.status, 'BLOCKED');
  assert.match(decision.reason, /PREFLIGHT #5/);
  assert.equal(isolationRequired({ dirtyMainUnrelated: true }), true);
  assert.deepEqual(collectIsolationReasons({ dirtyMainUnrelated: true }), ['dirty-main-unrelated']);
});

test('PREFLIGHT #5 Mode W without isolation is NEEDS_CONFIRM', () => {
  const decision = selectWriteWorkspaceMode({ requestedMode: 'W' });
  assert.equal(decision.ok, false);
  assert.equal(decision.status, 'NEEDS_CONFIRM');
  assert.match(decision.reason, /without isolation reason/);
});

test('Mode P is opt-in child-session 1:1 on project-branch', () => {
  const decision = selectWriteWorkspaceMode({ requestedMode: 'P' });
  assert.equal(decision.ok, true);
  assert.equal(decision.status, 'READY');
  assert.equal(decision.execution_mode, 'P');
  assert.equal(decision.proposed_mode, 'P');
  assert.equal(decision.workspace, 'project-branch');
  assert.equal(decision.environment, 'project-branch');
  assert.equal(decision.session_policy, 'child-session-1-1');
});

test('PREFLIGHT #5 blocks Mode P when isolation is required', () => {
  const decision = selectWriteWorkspaceMode({
    requestedMode: 'P',
    dirtyMainUnrelated: true
  });
  assert.equal(decision.ok, false);
  assert.equal(decision.status, 'BLOCKED');
  assert.match(decision.reason, /cannot satisfy isolation/);
});

test('read tasks stay Mode S project-read', () => {
  const decision = selectWriteWorkspaceMode({
    access: 'read',
    dirtyMainUnrelated: true,
    requestedMode: 'W'
  });
  assert.equal(decision.ok, true);
  assert.equal(decision.execution_mode, 'S');
  assert.equal(decision.environment, 'project-read');
});

test('exclusive-worktree bind cannot reuse project.path', () => {
  const clash = validateExclusiveWorktreeBind({
    environment: 'exclusive-worktree',
    worktree: 'D:/A',
    projectPath: 'D:\\A',
    access: 'write'
  });
  assert.equal(clash.ok, false);
  const ok = validateExclusiveWorktreeBind({
    environment: 'exclusive-worktree',
    worktree: 'D:/A/.jj-worktrees/feat-x',
    projectPath: 'D:/A',
    access: 'write'
  });
  assert.equal(ok.ok, true);
  assert.equal(workspacePathsEqual('D:/A/', 'D:\\A'), true);
});

test('Mode W attestation requires exclusive path; Mode S requires project.path', () => {
  const modeW = validateAttestationExecutionMode({
    execution_mode: 'W',
    environment: 'exclusive-worktree',
    access: 'write',
    worktree: '/tmp/wt-a',
    project_path: '/tmp/project-a'
  });
  assert.equal(modeW.ok, true, JSON.stringify(modeW.errors));

  const modeWOnMain = validateAttestationExecutionMode({
    execution_mode: 'W',
    environment: 'exclusive-worktree',
    access: 'write',
    worktree: '/tmp/project-a',
    project_path: '/tmp/project-a'
  });
  assert.equal(modeWOnMain.ok, false);

  const modeS = validateAttestationExecutionMode({
    execution_mode: 'S',
    environment: 'project-branch',
    access: 'write',
    worktree: '/tmp/project-a',
    project_path: '/tmp/project-a'
  });
  assert.equal(modeS.ok, true, JSON.stringify(modeS.errors));

  const modeSOnWt = validateAttestationExecutionMode({
    execution_mode: 'S',
    environment: 'exclusive-worktree',
    access: 'write',
    worktree: '/tmp/wt-a',
    project_path: '/tmp/project-a'
  });
  assert.equal(modeSOnWt.ok, false);

  const modeP = validateAttestationExecutionMode({
    execution_mode: 'P',
    environment: 'project-branch',
    access: 'write',
    worktree: '/tmp/project-a',
    project_path: '/tmp/project-a'
  });
  assert.equal(modeP.ok, true, JSON.stringify(modeP.errors));

  const modePOnWt = validateAttestationExecutionMode({
    execution_mode: 'P',
    environment: 'exclusive-worktree',
    access: 'write',
    worktree: '/tmp/wt-a',
    project_path: '/tmp/project-a'
  });
  assert.equal(modePOnWt.ok, false);
});

test('validateModeIsolationConsistency matches environment to mode', () => {
  const blocked = validateModeIsolationConsistency({
    executionMode: 'S',
    environment: 'project-branch',
    access: 'write',
    isolation: true
  });
  assert.equal(blocked.ok, false);
  const ready = validateModeIsolationConsistency({
    executionMode: 'W',
    environment: 'exclusive-worktree',
    access: 'write',
    isolation: true,
    worktree: '/tmp/wt',
    projectPath: '/tmp/repo'
  });
  assert.equal(ready.ok, true, JSON.stringify(ready.errors));
  assert.equal(executionModeForEnvironment('exclusive-worktree'), 'W');
});

test('PREVIEW workspace_table defaults to Mode S and upgrades on isolation signals', () => {
  const plane = createControlPlane(fixture);
  const preview = previewDispatch(plane, 'DEL-001');
  assert.equal(preview.status, 'PREVIEW_ONLY');
  assert.ok(Array.isArray(preview.workspace_table));
  assert.ok(preview.workspace_table.length > 0);
  assert.ok(preview.workspace_table.every((row) => row.proposed_mode === 'S'));

  const isolated = previewDispatch(plane, 'DEL-001', {
    workspaceSignals: { A: { dirtyMainUnrelated: true } }
  });
  const rowA = isolated.workspace_table.find((row) => row.project_id === 'A');
  const rowC = isolated.workspace_table.find((row) => row.project_id === 'C');
  assert.equal(rowA.proposed_mode, 'W');
  assert.equal(rowA.workspace, 'exclusive-worktree');
  assert.equal(rowA.action, 'READY');
  assert.equal(rowC.proposed_mode, 'S');
});

test('DISPATCH PREFLIGHT #5 leaves plane unchanged when Mode S meets isolation', () => {
  const approved = approveDispatch(createControlPlane(fixture), {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:mode-w-preflight'
  });
  const before = JSON.stringify(approved);
  const blocked = dispatchTasks(approved, 'DEL-001', {
    capabilities: appCapabilities,
    workspaceSignals: { A: { requestedMode: 'S', dirtyMainUnrelated: true } }
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 'BLOCKED');
  assert.match(blocked.reason, /PREFLIGHT #5/);
  assert.equal(JSON.stringify(approved), before);
  assert.equal(blocked.plane.revision, approved.revision);
});

test('DISPATCH isolation signal writes exclusive-worktree intent', () => {
  const approved = approveDispatch(createControlPlane(fixture), {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:mode-w-dispatch'
  });
  const dispatched = dispatchTasks(approved, 'DEL-001', {
    capabilities: appCapabilities,
    workspaceSignals: { A: { dirtyMainUnrelated: true } }
  });
  assert.equal(dispatched.ok, true, dispatched.reason);
  const intentA = dispatched.plane.deliveries[0].dispatch_intents
    .find((item) => item.task_key === 'DEL-001/A/development/1');
  const intentC = dispatched.plane.deliveries[0].dispatch_intents
    .find((item) => item.task_key === 'DEL-001/C/development/1');
  assert.equal(intentA.environment, 'exclusive-worktree');
  assert.equal(intentC.environment, 'project-branch');
});

test('PREVIEW and DISPATCH persist Mode P when requested', () => {
  const plane = createControlPlane(fixture);
  const preview = previewDispatch(plane, 'DEL-001', { workspaceSignals: { requestedMode: 'P' } });
  assert.ok(preview.workspace_table.every((row) => row.proposed_mode === 'P'));
  assert.ok(preview.workspace_table.every((row) => row.session_policy === 'child-session-1-1'));

  const approved = approveDispatch(plane, {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:mode-p-dispatch'
  });
  const dispatched = dispatchTasks(approved, 'DEL-001', {
    capabilities: appCapabilities,
    workspaceSignals: { requestedMode: 'P' }
  });
  assert.equal(dispatched.ok, true, dispatched.reason);
  const writes = dispatched.plane.deliveries[0].dispatch_intents.filter((item) => item.access === 'write');
  assert.ok(writes.length > 0);
  assert.ok(writes.every((item) => item.execution_mode === 'P'));
  assert.ok(writes.every((item) => item.environment === 'project-branch'));
});

test('DISPATCH Mode P + isolation leaves plane unchanged', () => {
  const approved = approveDispatch(createControlPlane(fixture), {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:mode-p-preflight'
  });
  const before = JSON.stringify(approved);
  const blocked = dispatchTasks(approved, 'DEL-001', {
    capabilities: appCapabilities,
    workspaceSignals: { requestedMode: 'P', A: { dirtyMainUnrelated: true } }
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 'BLOCKED');
  assert.match(blocked.reason, /cannot satisfy isolation/);
  assert.equal(JSON.stringify(approved), before);
});

test('Mode P write bind rejects a shared session', () => {
  const approved = approveDispatch(createControlPlane(fixture), {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:mode-p-bind'
  });
  const dispatched = dispatchTasks(approved, 'DEL-001', {
    capabilities: appCapabilities,
    workspaceSignals: { requestedMode: 'P' }
  });
  const sessionA = '019fmodep-0000-7000-8000-aaaaaaaaaaaa';
  const boundA = bindThread(dispatched.plane, {
    taskKey: 'DEL-001/A/development/1',
    threadId: sessionA,
    projectId: 'A',
    hostId: 'grok-build',
    handleKind: 'session',
    agentName: 'jj-workflow-developer',
    sandboxMode: 'workspace-write',
    environment: 'project-branch',
    effectiveSandboxMode: 'workspace-write',
    sandboxEvidenceRef: '.workflow/dispatch/DEL-001/attestations/a.json',
    worktree: 'D:/A'
  });
  const intentA = boundA.deliveries[0].dispatch_intents
    .find((item) => item.task_key === 'DEL-001/A/development/1');
  assert.equal(intentA.execution_mode, 'P');
  assert.throws(() => bindThread(boundA, {
    taskKey: 'DEL-001/C/development/1',
    threadId: sessionA,
    projectId: 'C',
    hostId: 'grok-build',
    handleKind: 'session',
    agentName: 'jj-workflow-developer',
    sandboxMode: 'workspace-write',
    environment: 'project-branch',
    effectiveSandboxMode: 'workspace-write',
    sandboxEvidenceRef: '.workflow/dispatch/DEL-001/attestations/c.json',
    worktree: 'D:/C'
  }), /already bound/);

  const boundC = bindThread(boundA, {
    taskKey: 'DEL-001/C/development/1',
    threadId: '019fmodep-0000-7000-8000-cccccccccccc',
    projectId: 'C',
    hostId: 'grok-build',
    handleKind: 'session',
    agentName: 'jj-workflow-developer',
    sandboxMode: 'workspace-write',
    environment: 'project-branch',
    effectiveSandboxMode: 'workspace-write',
    sandboxEvidenceRef: '.workflow/dispatch/DEL-001/attestations/c.json',
    worktree: 'D:/C'
  });
  const intentC = boundC.deliveries[0].dispatch_intents
    .find((item) => item.task_key === 'DEL-001/C/development/1');
  assert.equal(intentC.status, 'BOUND');
  assert.equal(intentC.execution_mode, 'P');
  assert.notEqual(intentC.thread_id, intentA.thread_id);
});

test('bindThread Mode W rejects project.path and accepts exclusive path', () => {
  const approved = approveDispatch(createControlPlane(fixture), {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:mode-w-bind'
  });
  const dispatched = dispatchTasks(approved, 'DEL-001', {
    capabilities: appCapabilities,
    workspaceSignals: { A: { userRequestsIsolation: true } }
  });
  assert.throws(() => bindThread(dispatched.plane, {
    taskKey: 'DEL-001/A/development/1',
    threadId: '019fmodew-0000-7000-8000-aaaaaaaaaaaa',
    projectId: 'A',
    hostId: 'grok-build',
    handleKind: 'session',
    agentName: 'jj-workflow-developer',
    sandboxMode: 'workspace-write',
    environment: 'exclusive-worktree',
    effectiveSandboxMode: 'workspace-write',
    sandboxEvidenceRef: '.workflow/dispatch/DEL-001/attestations/a.json',
    worktree: 'D:/A'
  }), /cannot bind project.path/);

  const bound = bindThread(dispatched.plane, {
    taskKey: 'DEL-001/A/development/1',
    threadId: '019fmodew-0000-7000-8000-aaaaaaaaaaaa',
    projectId: 'A',
    hostId: 'grok-build',
    handleKind: 'session',
    agentName: 'jj-workflow-developer',
    sandboxMode: 'workspace-write',
    environment: 'exclusive-worktree',
    effectiveSandboxMode: 'workspace-write',
    sandboxEvidenceRef: '.workflow/dispatch/DEL-001/attestations/a.json',
    worktree: 'D:/A/.jj-worktrees/feat-mode-w'
  });
  const intent = bound.deliveries[0].dispatch_intents
    .find((item) => item.task_key === 'DEL-001/A/development/1');
  assert.equal(intent.status, 'BOUND');
  assert.equal(intent.environment, 'exclusive-worktree');
  assert.equal(intent.worktree, 'D:/A/.jj-worktrees/feat-mode-w');
});

test('buildGrokAttestation derives Mode W from exclusive-worktree environment', () => {
  const payload = buildGrokAttestation({
    task_key: 'DEL-w/project-a/development/1',
    session_id: '019fmodew-1111-7000-8000-bbbbbbbbbbbb',
    environment: 'exclusive-worktree',
    worktree: '/tmp/wt-a',
    project_path: '/tmp/project-a',
    access: 'write'
  });
  assert.equal(payload.execution_mode, 'W');
  assert.throws(() => buildGrokAttestation({
    task_key: 'DEL-w/project-a/development/1',
    session_id: '019fmodew-1111-7000-8000-bbbbbbbbbbbb',
    execution_mode: 'S',
    environment: 'exclusive-worktree',
    worktree: '/tmp/wt-a',
    project_path: '/tmp/project-a',
    access: 'write'
  }), /execution_mode invalid/);
});
