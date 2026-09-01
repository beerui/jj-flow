import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import {
  bindGrokSessionTask,
  evaluateGrokWave2Evidence,
  grokSkillInstalled,
  inspectGitIdentity,
  inspectGrokWave2Milestone,
  inspectProjectRegistry,
  reconcileGrokSession
} from '../src/grokHostAdapter.mjs';
import {
  approveDispatch,
  createControlPlane,
  dispatchTasks,
  markDispatchUnknown
} from '../src/dispatchControlPlane.mjs';
import { inspectHarnessRepository } from '../src/harnessDoctor.mjs';
import { createExclusiveWorktree } from '../src/dispatchWorktree.mjs';

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

test('project registry records path + git identity without network', () => {
  const { repo, temp } = makeRepo();
  try {
    const registry = inspectProjectRegistry([
      { id: 'A', name: 'A', path: repo, status: 'active' },
      { id: 'missing', name: 'gone', path: path.join(temp, 'nope'), status: 'active' }
    ]);
    assert.equal(registry[0].git.ok, true);
    assert.equal(registry[0].git.detached, false);
    assert.ok(registry[0].git.head);
    assert.equal(registry[1].git.ok, false);
    assert.equal(registry[1].git.exists, false);
    const identity = inspectGitIdentity(repo);
    assert.equal(identity.ok, true);
    assert.equal(identity.branch, 'main');
  } finally {
    rmTemp(temp);
  }
});

test('bindGrokSessionTask writes attestation and binds Mode S session', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-wave2-bind-'));
  try {
    const approved = approveDispatch(createControlPlane(fixture), {
      deliveryId: 'DEL-001',
      decisionRef: 'decision:wave2-bind'
    });
    const dispatched = dispatchTasks(approved, 'DEL-001', { capabilities: appCapabilities });
    const result = bindGrokSessionTask({
      plane: dispatched.plane,
      controlRoot: root,
      deliveryId: 'DEL-001',
      taskKey: 'DEL-001/A/development/1',
      sessionId: '019fwave2-0000-7000-8000-aaaaaaaaaaaa',
      projectId: 'A',
      projectPath: 'D:/A',
      worktreePath: 'D:/A',
      intendedBranch: 'feat/wave2',
      environment: 'project-branch',
      access: 'write'
    });
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.wave2_closed, false);
    assert.equal(result.host_id, 'grok-build');
    const intent = result.plane.deliveries[0].dispatch_intents
      .find((item) => item.task_key === 'DEL-001/A/development/1');
    assert.equal(intent.status, 'BOUND');
    assert.equal(intent.handle_kind, 'session');
    assert.ok(fs.existsSync(path.join(root, result.attestation_ref)));
  } finally {
    rmTemp(root);
  }
});

test('bindGrokSessionTask Mode W requires named-branch exclusive worktree', () => {
  const { repo, temp } = makeRepo();
  try {
    const worktree = path.join(temp, 'worktrees', 'feat-w');
    const created = createExclusiveWorktree({
      repoPath: repo,
      worktreePath: worktree,
      branch: 'feat/wave2-w',
      startPoint: 'main'
    });
    assert.equal(created.ok, true, created.reason);

    const approved = approveDispatch(createControlPlane(fixture), {
      deliveryId: 'DEL-001',
      decisionRef: 'decision:wave2-w'
    });
    const dispatched = dispatchTasks(approved, 'DEL-001', {
      capabilities: appCapabilities,
      workspaceSignals: { A: { userRequestsIsolation: true } }
    });
    const result = bindGrokSessionTask({
      plane: dispatched.plane,
      controlRoot: temp,
      deliveryId: 'DEL-001',
      taskKey: 'DEL-001/A/development/1',
      sessionId: '019fwave2-1111-7000-8000-bbbbbbbbbbbb',
      projectId: 'A',
      projectPath: repo,
      worktreePath: created.worktree,
      intendedBranch: 'feat/wave2-w',
      environment: 'exclusive-worktree',
      access: 'write'
    });
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.wave2_closed, false);
    const intent = result.plane.deliveries[0].dispatch_intents
      .find((item) => item.task_key === 'DEL-001/A/development/1');
    assert.equal(intent.environment, 'exclusive-worktree');
    assert.equal(intent.worktree, created.worktree);
  } finally {
    rmTemp(temp);
  }
});

test('bindGrokSessionTask Mode P requires distinct child sessions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-mode-p-bind-'));
  try {
    const approved = approveDispatch(createControlPlane(fixture), {
      deliveryId: 'DEL-001',
      decisionRef: 'decision:mode-p-adapter'
    });
    const dispatched = dispatchTasks(approved, 'DEL-001', {
      capabilities: appCapabilities,
      workspaceSignals: { requestedMode: 'P' }
    });
    const first = bindGrokSessionTask({
      plane: dispatched.plane,
      controlRoot: root,
      deliveryId: 'DEL-001',
      taskKey: 'DEL-001/A/development/1',
      sessionId: '019fmodep-aaaa-7000-8000-aaaaaaaaaaaa',
      projectId: 'A',
      projectPath: 'D:/A',
      worktreePath: 'D:/A',
      intendedBranch: 'feat/mode-p-a',
      environment: 'project-branch',
      access: 'write'
    });
    assert.equal(first.ok, true, first.reason);
    const intentA = first.plane.deliveries[0].dispatch_intents
      .find((item) => item.task_key === 'DEL-001/A/development/1');
    assert.equal(intentA.execution_mode, 'P');

    const shared = bindGrokSessionTask({
      plane: first.plane,
      controlRoot: root,
      deliveryId: 'DEL-001',
      taskKey: 'DEL-001/B/development/1',
      sessionId: '019fmodep-aaaa-7000-8000-aaaaaaaaaaaa',
      projectId: 'B',
      projectPath: 'D:/B',
      worktreePath: 'D:/B',
      intendedBranch: 'feat/mode-p-b',
      environment: 'project-branch',
      access: 'write'
    });
    assert.equal(shared.ok, false);
    assert.match(shared.reason, /already bound/);

    const placeholder = bindGrokSessionTask({
      plane: first.plane,
      controlRoot: root,
      deliveryId: 'DEL-001',
      taskKey: 'DEL-001/B/development/1',
      sessionId: 'session-mode-p-20260901',
      projectId: 'B',
      projectPath: 'D:/B',
      worktreePath: 'D:/B',
      intendedBranch: 'feat/mode-p-b',
      environment: 'project-branch',
      access: 'write'
    });
    assert.equal(placeholder.ok, false);
    assert.match(placeholder.reason, /placeholder/);

    const second = bindGrokSessionTask({
      plane: first.plane,
      controlRoot: root,
      deliveryId: 'DEL-001',
      taskKey: 'DEL-001/B/development/1',
      sessionId: '019fmodep-bbbb-7000-8000-bbbbbbbbbbbb',
      projectId: 'B',
      projectPath: 'D:/B',
      worktreePath: 'D:/B',
      intendedBranch: 'feat/mode-p-b',
      environment: 'project-branch',
      access: 'write'
    });
    assert.equal(second.ok, true, second.reason);
  } finally {
    rmTemp(root);
  }
});

test('reconcileGrokSession stays unique-candidate and does not close Wave 2', () => {
  const approved = approveDispatch(createControlPlane(fixture), {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:wave2-rec'
  });
  const dispatched = dispatchTasks(approved, 'DEL-001', { capabilities: appCapabilities });
  const unknown = markDispatchUnknown(dispatched.plane, {
    taskKey: 'DEL-001/A/development/1'
  });
  const rec = reconcileGrokSession(unknown, {
    taskKey: 'DEL-001/A/development/1',
    candidates: [{
      task_key: 'DEL-001/A/development/1',
      thread_id: '019fwave2-2222-7000-8000-cccccccccccc',
      project_id: 'A',
      host_id: 'grok-build',
      handle_kind: 'session',
      agent_name: 'jj-workflow-developer',
      sandbox_mode: 'workspace-write',
      effective_sandbox_mode: 'workspace-write',
      sandbox_evidence_ref: '.workflow/dispatch/DEL-001/attestations/a.json',
      environment: 'project-branch',
      worktree: 'D:/A'
    }]
  });
  assert.equal(rec.ok, true, rec.reason);
  assert.equal(rec.wave2_closed, false);
});

test('lab-harness, host:trial, skill install, and Mode W cannot close Wave 2', () => {
  const lab = evaluateGrokWave2Evidence({
    host_id: 'lab-harness',
    handle_kind: 'session',
    session_id: '019f00aa-1111-7000-8000-labfamily0001',
    sandbox_evidence_ref: '.workflow/dispatch/DEL-001/attestations/dev.json',
    gym: true,
    reconcile: true,
    duplicate_create_count: 0,
    review_rework: true,
    status: 'PASS'
  });
  assert.equal(lab.ok, false);
  assert.equal(lab.closed, false);
  assert.ok(lab.errors.some((error) => /lab-harness|gym/.test(error)));

  const trial = evaluateGrokWave2Evidence({
    host_id: 'grok-build',
    handle_kind: 'session',
    session_id: '019fwave2-3333-7000-8000-dddddddddddd',
    sandbox_evidence_ref: 'SANDBOX:H4',
    mode: 'semi-real',
    adapter: 'local-git-worktree',
    reconcile: true,
    duplicate_create_count: 0,
    review_rework: true,
    status: 'PASS'
  });
  assert.equal(trial.ok, false);
  assert.ok(trial.errors.some((error) => /semi-real|host:trial/.test(error)));

  const skill = evaluateGrokWave2Evidence({
    host_id: 'grok-build',
    handle_kind: 'session',
    session_id: '019fwave2-4444-7000-8000-eeeeeeeeeeee',
    sandbox_evidence_ref: '.workflow/dispatch/DEL/attestations/x.json',
    skill_install: true,
    reconcile: true,
    duplicate_create_count: 0,
    review_rework: true,
    status: 'PASS'
  });
  assert.equal(skill.ok, false);

  const placeholder = evaluateGrokWave2Evidence({
    host_id: 'grok-build',
    handle_kind: 'session',
    session_id: 'session-readme-pnpm-20260731',
    sandbox_evidence_ref: 'attestations/x.json',
    reconcile: true,
    duplicate_create_count: 0,
    review_rework: true,
    status: 'PASS'
  });
  assert.equal(placeholder.ok, false);

  const isolated = inspectGrokWave2Milestone({ cwd: os.tmpdir() });
  assert.equal(isolated.closed, false);
  assert.ok(['pending', 'evaluable', 'blocked'].includes(isolated.status));
});

test('doctor lists grok without raising available_level above manifest max', () => {
  const result = inspectHarnessRepository();
  assert.ok(result.host_capabilities.some((item) => item.id === 'grok'));
  assert.equal(result.autonomy.max_unattended, 'A2');
  assert.equal(result.autonomy.available_level, 'A2');
  assert.equal(result.autonomy.declared_default, 'A1');
  assert.equal(result.autonomy.grok_does_not_raise_level, true);
  assert.equal(result.grok.wave2_closed, true);
  assert.equal(result.grok.wave2_status, 'completed');
  const skill = grokSkillInstalled({ cwd: process.cwd() });
  assert.equal(typeof skill.installed, 'boolean');
  const milestone = inspectGrokWave2Milestone({ cwd: process.cwd() });
  assert.equal(milestone.closed, true);
  assert.equal(milestone.status, 'completed');
  assert.equal(milestone.max_unattended_level, 'A2');
});

function makeRepo() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-wave2-reg-'));
  const repo = path.join(temp, 'repo');
  fs.mkdirSync(repo, { recursive: true });
  git(repo, ['init', '--initial-branch=main']);
  git(repo, ['config', 'user.name', 'jj-flow wave2']);
  git(repo, ['config', 'user.email', 'wave2@jj-flow.invalid']);
  git(repo, ['config', 'core.autocrlf', 'false']);
  fs.writeFileSync(path.join(repo, 'README.md'), 'wave2\n');
  git(repo, ['add', 'README.md']);
  git(repo, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'chore: seed']);
  return { repo, temp };
}

function git(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function rmTemp(temp) {
  try {
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 8, retryDelay: 25 });
  } catch {
    // Windows EBUSY on git worktrees is leftover temp, not a product failure.
  }
}
