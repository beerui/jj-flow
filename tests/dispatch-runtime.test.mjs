import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { approveDispatch, createControlPlane, validateControlPlane } from '../src/dispatchControlPlane.mjs';
import {
  buildReceipt,
  persistPlaneCas,
  resumeDispatch,
  tickDispatch,
  validateReceipt
} from '../src/dispatchRuntime.mjs';
import fixture from './fixtures/jj-dispatch-control-plane.json' with { type: 'json' };

const CAPABILITIES = [
  'list_projects',
  'list_threads',
  'create_thread',
  'read_thread',
  'send_message_to_thread',
  'worktree',
  'sandbox'
];

function makePlane() {
  return createControlPlane(structuredClone(fixture));
}

function approveAllTargets(plane, decisions = null) {
  for (const target of plane.deliveries[0].targets) {
    const decision = decisions?.[target.project_id] || 'DIRECT';
    target.analysis = {
      analysis_ref: `ANL-TARGET:${target.project_id}:1`,
      difference_ref: `DIFF:${target.project_id}:1`,
      knowledge_refs: [`spec:project:${target.project_id}`],
      decision,
      decision_status: 'APPROVED',
      evidence_ref: `ANL-TARGET:${target.project_id}:1`
    };
  }
  return approveDispatch(plane, { deliveryId: 'DEL-001', decisionRef: 'decision:test' });
}

test('runtime tick rejects stale revision without mutating the plane', () => {
  const plane = makePlane();
  const result = tickDispatch(plane, {
    deliveryId: 'DEL-001',
    expectedRevision: plane.revision + 1
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'REVISION_CONFLICT');
  assert.equal(result.plane.revision, plane.revision);
  assert.match(result.decision_required[0].type, /REVISION_CONFLICT/);
});

test('runtime tick blocks target dispatch until approved ANL-TARGET difference decisions exist', () => {
  const plane = makePlane();
  const result = tickDispatch(plane, { deliveryId: 'DEL-001' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'DECISION_REQUIRED');
  assert.equal(result.decision_required[0].type, 'TARGET_ANALYSIS_REQUIRED');
  assert.deepEqual(result.decision_required.map((item) => item.project_id).sort(), ['A', 'B']);
});

test('runtime tick accepts an approved DIRECT target analysis and emits dispatch actions', () => {
  const plane = makePlane();
  const approved = approveAllTargets(plane);
  const result = tickDispatch(approved, {
    deliveryId: 'DEL-001',
    capabilities: CAPABILITIES
  });
  assert.equal(result.ok, true);
  assert.ok(result.actions.some((action) => action.type === 'CREATE_THREAD'));
  assert.equal(validateControlPlane(result.plane).ok, true);
});

test('receipt envelope rejects missing identity and supports idempotent receipt ids', () => {
  assert.equal(validateReceipt({}).ok, false);
  const receipt = buildReceipt({
    receiptId: 'RCPT-1',
    taskKey: 'DEL-001/A/development/1',
    attempt: 1,
    kind: 'TASK_RESULT',
    status: 'COMPLETED',
    evidenceRef: 'EXC-A-1'
  });
  assert.equal(validateReceipt(receipt).ok, true);
  assert.equal(validateReceipt(receipt).receipt_id, 'RCPT-1');
});

test('resume re-emits CREATE_THREAD for pending intents instead of dropping actions', () => {
  const approved = approveAllTargets(makePlane());
  const first = tickDispatch(approved, {
    deliveryId: 'DEL-001',
    capabilities: CAPABILITIES
  });
  assert.equal(first.ok, true);
  assert.ok(first.actions.length > 0);

  const resumed = resumeDispatch(first.plane, {
    deliveryId: 'DEL-001',
    expectedRevision: first.plane.revision,
    capabilities: CAPABILITIES
  });
  assert.equal(resumed.ok, true);
  const pendingKeys = first.plane.deliveries[0].dispatch_intents
    .filter((intent) => intent.status === 'PENDING_THREAD')
    .map((intent) => intent.task_key)
    .sort();
  const actionKeys = resumed.actions
    .filter((action) => action.type === 'CREATE_THREAD')
    .map((action) => action.task_key)
    .sort();
  assert.deepEqual(actionKeys, pendingKeys);
  assert.ok(actionKeys.length > 0);
});

test('one target waiting for analysis does not block another ready target', () => {
  const plane = makePlane();
  const targetA = plane.deliveries[0].targets.find((target) => target.project_id === 'A');
  targetA.analysis = {
    analysis_ref: 'ANL-TARGET:A:1',
    difference_ref: 'DIFF:A:1',
    knowledge_refs: ['spec:project:A'],
    decision: 'DIRECT',
    decision_status: 'APPROVED',
    evidence_ref: 'ANL-TARGET:A:1'
  };
  const approved = approveDispatch(plane, { deliveryId: 'DEL-001', decisionRef: 'decision:partial' });
  const result = tickDispatch(approved, {
    deliveryId: 'DEL-001',
    capabilities: CAPABILITIES
  });
  assert.equal(result.ok, true);
  assert.ok(result.decision_required.some((item) => item.project_id === 'B' && item.type === 'TARGET_ANALYSIS_REQUIRED'));
  assert.ok(result.actions.some((action) => action.project_id === 'A'));
  assert.equal(result.actions.some((action) => action.project_id === 'B'), false);
});

test('target analysis cannot be bypassed for development dispatch', () => {
  const plane = makePlane();
  const approved = approveDispatch(plane, { deliveryId: 'DEL-001', decisionRef: 'decision:no-analysis' });
  const result = tickDispatch(approved, {
    deliveryId: 'DEL-001',
    capabilities: CAPABILITIES,
    enforceTargetAnalysis: false
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'DECISION_REQUIRED');
  assert.ok(result.decision_required.some((item) => item.type === 'TARGET_ANALYSIS_REQUIRED'));
  assert.equal(result.actions.length, 0);
});

test('receipt attempt must match task_key and live intent attempt', () => {
  const approved = approveAllTargets(makePlane());
  const dispatched = tickDispatch(approved, {
    deliveryId: 'DEL-001',
    capabilities: CAPABILITIES
  });
  const taskKey = dispatched.actions.find((action) => action.project_id === 'A' && action.responsibility === 'development').task_key;
  const mismatched = buildReceipt({
    receiptId: 'RCPT-mismatch',
    taskKey,
    attempt: 99,
    kind: 'TASK_RESULT',
    status: 'BLOCKED',
    evidenceRef: 'EV-1'
  });
  const rejected = tickDispatch(dispatched.plane, {
    deliveryId: 'DEL-001',
    expectedRevision: dispatched.plane.revision,
    capabilities: CAPABILITIES,
    receipts: [mismatched]
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.status, 'BLOCKED');
  assert.match(rejected.decision_required[0].errors.join(' '), /attempt/);
});

test('persistPlaneCas rejects stale expected revision without writing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-cas-'));
  const file = path.join(dir, 'control-plane.json');
  const plane = makePlane();
  fs.writeFileSync(file, `${JSON.stringify(plane, null, 2)}\n`);
  const next = structuredClone(plane);
  next.revision = plane.revision + 1;
  const result = persistPlaneCas({
    manifestPath: file,
    expectedRevision: plane.revision + 5,
    nextPlane: next
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'REVISION_CONFLICT');
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).revision, plane.revision);
});

test('persistPlaneCas writes only when expected revision still matches file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-cas-'));
  const file = path.join(dir, 'control-plane.json');
  const plane = makePlane();
  fs.writeFileSync(file, `${JSON.stringify(plane, null, 2)}\n`);
  const next = structuredClone(plane);
  next.revision = plane.revision + 1;
  next.events = [...(next.events || []), { type: 'TEST', at: new Date().toISOString() }];
  const result = persistPlaneCas({
    manifestPath: file,
    expectedRevision: plane.revision,
    nextPlane: next
  });
  assert.equal(result.ok, true);
  assert.equal(result.persisted, true);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).revision, plane.revision + 1);
});
