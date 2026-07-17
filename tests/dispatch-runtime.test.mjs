import assert from 'node:assert/strict';
import test from 'node:test';
import { approveDispatch, createControlPlane, validateControlPlane } from '../src/dispatchControlPlane.mjs';
import {
  buildReceipt,
  tickDispatch,
  validateReceipt
} from '../src/dispatchRuntime.mjs';
import fixture from './fixtures/jj-dispatch-control-plane.json' with { type: 'json' };

function makePlane() {
  return createControlPlane(structuredClone(fixture));
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
  assert.deepEqual(result.decision_required.map((item) => item.project_id), ['A', 'B']);
});

test('runtime tick accepts an approved DIRECT target analysis and emits dispatch actions', () => {
  const plane = makePlane();
  for (const target of plane.deliveries[0].targets) {
    target.analysis = {
      analysis_ref: `ANL-TARGET:${target.project_id}:1`,
      difference_ref: `DIFF:${target.project_id}:1`,
      knowledge_refs: [`spec:project:${target.project_id}`],
      decision: 'DIRECT',
      decision_status: 'APPROVED',
      evidence_ref: `ANL-TARGET:${target.project_id}:1`
    };
  }
  const approved = approveDispatch(plane, { deliveryId: 'DEL-001', decisionRef: 'decision:test' });
  const result = tickDispatch(approved, {
    deliveryId: 'DEL-001',
    capabilities: ['list_projects', 'list_threads', 'create_thread', 'read_thread', 'send_message_to_thread', 'worktree', 'sandbox']
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
