import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  approveDispatch,
  bindThread,
  createControlPlane,
  validateControlPlane
} from '../src/dispatchControlPlane.mjs';
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
const NOW = '2026-07-18T00:00:00.000Z';

function makeRuntimePlane({ targetIds = ['A', 'B'], leadProject = 'C' } = {}) {
  const input = structuredClone(fixture);
  const delivery = input.deliveries[0];
  delivery.lead_project = leadProject;
  delivery.targets = delivery.targets.filter((target) => targetIds.includes(target.project_id));
  if (targetIds.includes(leadProject)) delivery.lead_responsibilities = [];
  for (const target of delivery.targets) {
    const analysisKey = `DEL-001/${target.project_id}/analysis/1`;
    const developmentKey = `DEL-001/${target.project_id}/development/1`;
    target.responsibilities = [
      { name: 'analysis', access: 'read', phase: 'planning', status: 'PENDING', attempt: 1, depends_on: [] },
      { name: 'development', access: 'write', phase: 'development', status: 'PENDING', attempt: 1, depends_on: [analysisKey] }
    ];
    if (target.project_id === 'A') {
      target.responsibilities.push({
        name: 'test',
        access: 'read',
        phase: 'verification',
        status: 'PENDING',
        attempt: 1,
        depends_on: [developmentKey]
      });
    }
  }
  return createControlPlane(input);
}

function approve(plane, decisionRef = 'decision:test') {
  return approveDispatch(plane, { deliveryId: 'DEL-001', decisionRef, approvedAt: NOW });
}

function firstTick(plane) {
  return tickDispatch(approve(plane), {
    deliveryId: 'DEL-001',
    capabilities: CAPABILITIES,
    now: NOW
  });
}

function bindAnalysis(plane, projectId) {
  return bindThread(plane, {
    taskKey: `DEL-001/${projectId}/analysis/1`,
    threadId: `thread-${projectId}`,
    projectId,
    hostId: 'host-1',
    agentName: 'jj-workflow-reviewer',
    sandboxMode: 'read-only',
    environment: 'project-read',
    effectiveSandboxMode: 'read-only',
    sandboxEvidenceRef: `sandbox-${projectId}`,
    worktree: null
  });
}

function analysisPayload(projectId, decision = 'DIRECT', { auto = false, unresolved = [] } = {}) {
  return {
    analysis_ref: `ANL-TARGET:${projectId}:1`,
    evidence_ref: `ANL-TARGET:${projectId}:1`,
    difference_ref: `DIFF:${projectId}:1`,
    knowledge_refs: [`spec:project:${projectId}`],
    decision,
    decision_status: auto ? 'APPROVED' : 'PENDING',
    decision_origin: auto ? 'AUTO' : null,
    decision_ref: auto ? `AUTO:${projectId}:1` : null,
    decided_at: auto ? NOW : null,
    attempt: 1,
    source_head: 'source123',
    target_head: `target${projectId}123`,
    reference_commit: null,
    confidence: auto ? 'HIGH' : 'MEDIUM',
    unresolved
  };
}

function analysisReceipt(projectId, decision = 'DIRECT', options = {}) {
  const payload = analysisPayload(projectId, decision, options);
  return buildReceipt({
    receiptId: `RCPT-ANL-${projectId}-${decision}`,
    taskKey: `DEL-001/${projectId}/analysis/1`,
    attempt: 1,
    kind: 'TASK_RESULT',
    status: decision === 'BLOCKED' ? 'BLOCKED' : 'COMPLETED',
    evidenceRef: payload.evidence_ref,
    targetAnalysis: payload,
    recordedAt: NOW
  });
}

test('runtime tick rejects stale revision without mutating the plane', () => {
  const plane = makeRuntimePlane();
  const result = tickDispatch(plane, {
    deliveryId: 'DEL-001',
    expectedRevision: plane.revision + 1
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'REVISION_CONFLICT');
  assert.equal(result.state_changed, false);
  assert.equal(result.plane.revision, plane.revision);
});

test('missing target analysis dispatches only analysis tasks and reports per-target decisions', () => {
  const result = firstTick(makeRuntimePlane({ leadProject: 'A' }));
  assert.equal(result.ok, true);
  assert.equal(result.status, 'DISPATCHING_WITH_DECISIONS');
  assert.deepEqual(result.decision_required.map((item) => item.project_id).sort(), ['A', 'B']);
  assert.ok(result.actions.some((action) => action.task_key === 'DEL-001/A/analysis/1'));
  assert.ok(result.actions.some((action) => action.task_key === 'DEL-001/B/analysis/1'));
  assert.equal(result.actions.some((action) => action.responsibility === 'development'), false);
});

test('analysis receipt is consumed before gating and one ready target can advance independently', () => {
  const initial = firstTick(makeRuntimePlane({ leadProject: 'A' }));
  const bound = bindAnalysis(initial.plane, 'A');
  const result = tickDispatch(bound, {
    deliveryId: 'DEL-001',
    expectedRevision: bound.revision,
    receipts: [analysisReceipt('A', 'DIRECT', { auto: true })],
    capabilities: CAPABILITIES,
    now: NOW
  });
  assert.equal(result.ok, true);
  assert.ok(result.applied_receipts.includes('RCPT-ANL-A-DIRECT'));
  assert.ok(result.actions.some((action) => action.task_key === 'DEL-001/A/development/1'));
  assert.equal(result.actions.some((action) => action.task_key === 'DEL-001/B/development/1'), false);
  assert.ok(result.decision_required.some((item) => item.project_id === 'B'));
  assert.equal(validateControlPlane(result.plane).ok, true);
});

test('human ADAPT decision pauses only that target until scheduler approval', () => {
  const initial = firstTick(makeRuntimePlane({ leadProject: 'A' }));
  const bound = bindAnalysis(initial.plane, 'A');
  const pending = tickDispatch(bound, {
    deliveryId: 'DEL-001',
    expectedRevision: bound.revision,
    receipts: [analysisReceipt('A', 'ADAPT')],
    capabilities: CAPABILITIES,
    now: NOW
  });
  assert.ok(pending.decision_required.some((item) => item.type === 'TARGET_DIFFERENCE_APPROVAL_REQUIRED' && item.project_id === 'A'));
  assert.equal(pending.actions.some((action) => action.task_key === 'DEL-001/A/development/1'), false);

  const approved = tickDispatch(pending.plane, {
    deliveryId: 'DEL-001',
    expectedRevision: pending.plane.revision,
    targetApprovals: [{ project_id: 'A', decision_ref: 'user:approve:A', approved_at: NOW }],
    capabilities: CAPABILITIES,
    now: NOW
  });
  assert.equal(approved.ok, true);
  assert.ok(approved.actions.some((action) => action.task_key === 'DEL-001/A/development/1'));
  assert.equal(approved.plane.deliveries[0].targets[0].analysis.decision_origin, 'HUMAN');
});

test('NO_CHANGE_REQUIRED closes a target without creating development or review work', () => {
  const initial = firstTick(makeRuntimePlane({ targetIds: ['A'], leadProject: 'A' }));
  const bound = bindAnalysis(initial.plane, 'A');
  const pending = tickDispatch(bound, {
    deliveryId: 'DEL-001',
    expectedRevision: bound.revision,
    receipts: [analysisReceipt('A', 'NO_CHANGE_REQUIRED')],
    capabilities: CAPABILITIES,
    now: NOW
  });
  const approved = tickDispatch(pending.plane, {
    deliveryId: 'DEL-001',
    expectedRevision: pending.plane.revision,
    targetApprovals: [{ project_id: 'A', decision_ref: 'user:no-change:A', approved_at: NOW }],
    capabilities: CAPABILITIES,
    now: NOW
  });
  const target = approved.plane.deliveries[0].targets[0];
  assert.equal(target.status, 'NO_CHANGE_REQUIRED');
  assert.equal(target.last_result.commit, null);
  assert.equal(target.responsibilities.find((item) => item.name === 'development').status, 'SKIPPED');
  assert.equal(approved.actions.some((action) => action.responsibility === 'development'), false);
});

test('BLOCKED analysis blocks its target and never dispatches development', () => {
  const initial = firstTick(makeRuntimePlane({ targetIds: ['A'], leadProject: 'A' }));
  const bound = bindAnalysis(initial.plane, 'A');
  const result = tickDispatch(bound, {
    deliveryId: 'DEL-001',
    expectedRevision: bound.revision,
    receipts: [analysisReceipt('A', 'BLOCKED', { unresolved: ['business-rule'] })],
    capabilities: CAPABILITIES,
    now: NOW
  });
  assert.equal(result.plane.deliveries[0].targets[0].status, 'BLOCKED');
  assert.equal(result.actions.some((action) => action.responsibility === 'development'), false);
  assert.ok(result.decision_required.some((item) => item.project_id === 'A'));
});

test('resume reconciles persisted pending intents instead of blindly creating duplicate threads', () => {
  const first = firstTick(makeRuntimePlane({ leadProject: 'A' }));
  const resumed = resumeDispatch(first.plane, {
    deliveryId: 'DEL-001',
    expectedRevision: first.plane.revision,
    capabilities: CAPABILITIES,
    now: NOW
  });
  assert.equal(resumed.actions.some((action) => action.type === 'CREATE_THREAD'), false);
  assert.ok(resumed.actions.some((action) => action.type === 'RECONCILE_THREAD'));
});

test('receipt attempt must match task_key and live intent attempt', () => {
  const initial = firstTick(makeRuntimePlane({ leadProject: 'A' }));
  const bound = bindAnalysis(initial.plane, 'A');
  const receipt = analysisReceipt('A', 'DIRECT', { auto: true });
  receipt.attempt = 99;
  const rejected = tickDispatch(bound, {
    deliveryId: 'DEL-001',
    expectedRevision: bound.revision,
    receipts: [receipt],
    capabilities: CAPABILITIES,
    now: NOW
  });
  assert.equal(rejected.ok, false);
  assert.match(rejected.decision_required[0].errors.join(' '), /attempt/);
});

test('receipt ids are idempotent and conflicting replays fail closed', () => {
  const initial = firstTick(makeRuntimePlane({ leadProject: 'A' }));
  const bound = bindAnalysis(initial.plane, 'A');
  const receipt = analysisReceipt('A', 'DIRECT', { auto: true });
  const applied = tickDispatch(bound, {
    deliveryId: 'DEL-001',
    expectedRevision: bound.revision,
    receipts: [receipt],
    capabilities: CAPABILITIES,
    now: NOW
  });
  const replayed = tickDispatch(applied.plane, {
    deliveryId: 'DEL-001',
    expectedRevision: applied.plane.revision,
    receipts: [receipt],
    capabilities: CAPABILITIES,
    now: NOW
  });
  assert.deepEqual(replayed.applied_receipts, []);

  const conflict = structuredClone(receipt);
  conflict.task_key = 'DEL-001/B/analysis/1';
  const rejected = tickDispatch(applied.plane, {
    deliveryId: 'DEL-001',
    expectedRevision: applied.plane.revision,
    receipts: [conflict],
    capabilities: CAPABILITIES,
    now: NOW
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.decision_required[0].type, 'RECEIPT_REPLAY_CONFLICT');
});

test('review receipt builder emits the fields required by review consumption', () => {
  const receipt = buildReceipt({
    receiptId: 'RCPT-REV-1',
    taskKey: 'DEL-001/A/review/1',
    attempt: 1,
    kind: 'REVIEW_RESULT',
    status: 'COMPLETED',
    evidenceRef: 'REV-EVIDENCE-1',
    reviewedCommit: 'abcdef1',
    outcome: 'PASS',
    findings: [],
    recordedAt: NOW
  });
  assert.equal(validateReceipt(receipt).ok, true);
  assert.equal(receipt.outcome, 'PASS');
  const blocked = structuredClone(receipt);
  blocked.status = 'BLOCKED';
  assert.equal(validateReceipt(blocked).ok, false);
});

test('createControlPlane preserves persisted runtime replay state', () => {
  const input = structuredClone(fixture);
  input.runtime = {
    processed_receipt_ids: ['RCPT-1'],
    processed_receipts: [{ receipt_id: 'RCPT-1', task_key: 'DEL-001/A/development/1', attempt: 1, kind: 'TASK_RESULT' }],
    deliveries: {
      'DEL-001': { run_id: 'RUN-1', updated_at: NOW, resume_cursor: 'DEL-001:1', last_tick_revision: 1 }
    }
  };
  const plane = createControlPlane(input);
  assert.deepEqual(plane.runtime, input.runtime);
});

test('persistPlaneCas rejects stale revision and an existing writer lock', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-cas-'));
  const file = path.join(dir, 'control-plane.json');
  const plane = makeRuntimePlane();
  fs.writeFileSync(file, `${JSON.stringify(plane, null, 2)}\n`);
  const next = structuredClone(plane);
  next.revision += 1;
  const stale = persistPlaneCas({ manifestPath: file, expectedRevision: 99, nextPlane: next });
  assert.equal(stale.status, 'REVISION_CONFLICT');
  fs.writeFileSync(`${file}.lock`, 'held');
  const locked = persistPlaneCas({ manifestPath: file, expectedRevision: plane.revision, nextPlane: next });
  assert.equal(locked.status, 'LOCKED');
  fs.unlinkSync(`${file}.lock`);
});

test('persistPlaneCas writes under lock and removes temporary lock state', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-cas-'));
  const file = path.join(dir, 'control-plane.json');
  const plane = makeRuntimePlane();
  fs.writeFileSync(file, `${JSON.stringify(plane, null, 2)}\n`);
  const next = structuredClone(plane);
  next.revision += 1;
  const result = persistPlaneCas({ manifestPath: file, expectedRevision: plane.revision, nextPlane: next });
  assert.equal(result.ok, true);
  assert.equal(result.persisted, true);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).revision, next.revision);
  assert.equal(fs.existsSync(`${file}.lock`), false);
});
