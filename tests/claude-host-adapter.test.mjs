import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  bindClaudeSessionTask,
  CLAUDE_HOST_ID,
  resolveClaudeSessionId
} from '../src/claudeHostAdapter.mjs';
import { writeClaudeAttestation } from '../src/dispatchAttestation.mjs';
import { evaluateGrokWave2Evidence } from '../src/grokHostAdapter.mjs';
import {
  approveDispatch,
  createControlPlane,
  dispatchTasks
} from '../src/dispatchControlPlane.mjs';
import { isApprovedSessionHost } from '../src/dispatchHostContract.mjs';

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

test('claude-code is an approved session host', () => {
  assert.equal(CLAUDE_HOST_ID, 'claude-code');
  assert.equal(isApprovedSessionHost('claude-code'), true);
});

test('resolveClaudeSessionId prefers explicit id then env, rejects placeholders', () => {
  assert.equal(resolveClaudeSessionId({ sessionId: '', env: {} }).ok, false);
  const fromArg = resolveClaudeSessionId({
    sessionId: '019fclaude-0000-7000-8000-bbbbbbbbbbbb',
    env: {}
  });
  assert.equal(fromArg.ok, true);
  assert.equal(fromArg.host_id, 'claude-code');
  const fromEnv = resolveClaudeSessionId({
    env: { CLAUDE_SESSION_ID: '019fclaude-1111-7000-8000-cccccccccccc' }
  });
  assert.equal(fromEnv.ok, true);
  assert.equal(fromEnv.session_id, '019fclaude-1111-7000-8000-cccccccccccc');
  const placeholder = resolveClaudeSessionId({
    sessionId: 'session-acceptor-tag-20260730'
  });
  assert.equal(placeholder.ok, false);
  assert.match(placeholder.reason, /placeholder/);
});

test('bindClaudeSessionTask writes host_id=claude-code attestation and binds Mode S', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-claude-bind-'));
  try {
    const approved = approveDispatch(createControlPlane(fixture), {
      deliveryId: 'DEL-001',
      decisionRef: 'decision:claude-bind'
    });
    const dispatched = dispatchTasks(approved, 'DEL-001', { capabilities: appCapabilities });
    const result = bindClaudeSessionTask({
      plane: dispatched.plane,
      controlRoot: root,
      deliveryId: 'DEL-001',
      taskKey: 'DEL-001/A/development/1',
      sessionId: '019fclaude-0000-7000-8000-bbbbbbbbbbbb',
      projectId: 'A',
      projectPath: 'D:/A',
      worktreePath: 'D:/A',
      intendedBranch: 'feat/claude-mode-s',
      environment: 'project-branch',
      access: 'write'
    });
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.wave2_closed, false);
    assert.equal(result.host_id, 'claude-code');
    const intent = result.plane.deliveries[0].dispatch_intents
      .find((item) => item.task_key === 'DEL-001/A/development/1');
    assert.equal(intent.status, 'BOUND');
    assert.equal(intent.handle_kind, 'session');
    assert.equal(intent.host_id, 'claude-code');
    const abs = path.join(root, result.attestation_ref);
    assert.equal(fs.existsSync(abs), true);
    const payload = JSON.parse(fs.readFileSync(abs, 'utf8'));
    assert.equal(payload.host_id, 'claude-code');
    assert.equal(payload.handle_kind, 'session');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('writeClaudeAttestation persists host_id=claude-code', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-claude-att-'));
  try {
    const { rel, payload } = writeClaudeAttestation(root, {
      deliveryId: 'DEL-claude',
      task_key: 'DEL-claude/notes-beta/development/1',
      session_id: '019fclaude-2222-7000-8000-dddddddddddd',
      project_path: '/tmp/notes-beta'
    });
    assert.equal(payload.host_id, 'claude-code');
    const written = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
    assert.equal(written.host_id, 'claude-code');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Claude Mode S skill path cannot close Grok Wave 2', () => {
  const evaled = evaluateGrokWave2Evidence({
    host_id: 'claude-code',
    handle_kind: 'session',
    session_id: '019fclaude-0000-7000-8000-bbbbbbbbbbbb',
    sandbox_evidence_ref: '.workflow/dispatch/DEL-001/attestations/dev.json',
    skill_only: true
  });
  assert.equal(evaled.ok, false);
  assert.equal(evaled.closed, false);
});
