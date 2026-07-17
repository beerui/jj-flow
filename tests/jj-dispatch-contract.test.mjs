import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  approveDispatch,
  abandonDispatchUnknown,
  buildTaskKey,
  createControlPlane,
  dispatchTasks,
  markDispatchUnknown,
  previewDispatch,
  REQUIRED_APP_CAPABILITIES,
  reconcileDispatch,
  recordReviewResult,
  recordTaskResult,
  recordTargetResult,
  requestRework,
  setReferenceImplementation,
  validateControlPlane
} from '../src/dispatchControlPlane.mjs';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/jj-dispatch-control-plane.json', import.meta.url), 'utf8'));
const schema = JSON.parse(fs.readFileSync(new URL('../.codex/skills/jj-dispatch/references/control-plane.schema.json', import.meta.url), 'utf8'));
const appCapabilities = [...REQUIRED_APP_CAPABILITIES];

function makePlane() {
  return createControlPlane(fixture);
}

test('control plane keeps origin, owner, lead, reference, and targets independent', () => {
  const plane = makePlane();
  const validation = validateControlPlane(plane);

  assert.equal(validation.ok, true);
  assert.equal(plane.deliveries[0].origin_project, 'B');
  assert.equal(plane.deliveries[0].requirement_owner, 'B');
  assert.equal(plane.deliveries[0].lead_project, 'C');
  assert.equal(plane.deliveries[0].reference_implementation, null);
  assert.deepEqual(plane.deliveries[0].targets.map((target) => target.project_id), ['A', 'B']);
});

test('loading a persisted control plane preserves its audit events', () => {
  const plane = createControlPlane({ ...fixture, events: [{ event_id: '0-1', type: 'BOOTSTRAP' }] });
  assert.deepEqual(plane.events, [{ event_id: '0-1', type: 'BOOTSTRAP' }]);
  const withExtension = createControlPlane({
    ...fixture,
    deliveries: [{ ...fixture.deliveries[0], sync_key: 'SYNC-001' }]
  });
  assert.equal(withExtension.deliveries[0].sync_key, 'SYNC-001');
});

test('published schema exposes the same version and task responsibility contract', () => {
  assert.equal(schema.properties.schema_version.const, 'jj-flow/control-plane/1.0');
  assert.ok(schema.$defs.delivery.required.includes('reference_implementation'));
  assert.ok(schema.$defs.delivery.required.includes('lead_responsibilities'));
  assert.ok(schema.$defs.target.required.includes('responsibilities'));
  assert.deepEqual(schema.$defs.responsibility.properties.access.enum, ['read', 'write']);
  assert.match(schema.$defs.intent.properties.task_key.pattern, /\[1-9\]/);
  assert.deepEqual(schema.$defs.approval_task.properties.phase.enum, ['planning', 'development', 'verification', 'review']);
  assert.equal(schema.$defs.approval_task.properties.depends_on.type, 'array');
  assert.equal(validateControlPlane(fixture).ok, true);
  const leadTarget = createControlPlane({
    ...fixture,
    deliveries: [{ ...fixture.deliveries[0], lead_project: 'A', lead_responsibilities: [] }]
  });
  assert.equal(validateControlPlane(leadTarget).ok, true);
  assert.deepEqual(schema.$defs.intent.properties.sandbox_mode.enum, ['read-only', 'workspace-write']);
  assert.equal(schema.$defs.intent.properties.host_id.type.includes('null'), true);
  assert.deepEqual(schema.$defs.review.properties.outcome.enum, ['PASS', 'NEEDS_CHANGES']);
  const verifiedTargetRule = schema.$defs.target.allOf.find((rule) => rule.if?.properties?.status?.const === 'VERIFIED');
  assert.equal(verifiedTargetRule.then.properties.checkpoint.properties.commit.minLength, 7);
  const noChangeRule = schema.$defs.target.allOf.find((rule) => rule.if?.properties?.status?.const === 'NO_CHANGE_REQUIRED');
  assert.ok(noChangeRule.then.properties.last_result.required.includes('commit'));
  assert.equal(noChangeRule.then.properties.last_result.properties.unresolved.maxItems, 0);
  const skippedIntentRule = schema.$defs.intent.allOf.find((rule) => rule.if?.properties?.status?.const === 'SKIPPED');
  assert.deepEqual(skippedIntentRule.then.properties.thread_id, { type: 'null' });
  assert.ok(skippedIntentRule.then.properties.result.required.includes('reason'));
  assert.equal(schema.$defs.review.allOf.length, 2);
  const verifiedDeliveryRule = schema.$defs.delivery.allOf.find((rule) => rule.if?.properties?.status?.const === 'VERIFIED');
  assert.deepEqual(verifiedDeliveryRule.then.properties.targets.items.allOf[1].properties.status.enum, ['VERIFIED', 'NO_CHANGE_REQUIRED']);
});

test('persistent reviewer and developer agents declare distinct sandbox boundaries', () => {
  const reviewer = fs.readFileSync(new URL('../.codex/agents/jj-workflow-reviewer.toml', import.meta.url), 'utf8');
  const developer = fs.readFileSync(new URL('../.codex/agents/jj-workflow-developer.toml', import.meta.url), 'utf8');
  assert.match(reviewer, /name = "jj-workflow-reviewer"/);
  assert.match(reviewer, /model = "gpt-5\.6-sol"/);
  assert.match(reviewer, /model_reasoning_effort = "high"/);
  assert.match(reviewer, /sandbox_mode = "read-only"/);
  assert.match(reviewer, /\[mcp_servers\.openaiDeveloperDocs\]/);
  assert.match(reviewer, /https:\/\/developers\.openai\.com\/mcp/);
  assert.match(reviewer, /developer_instructions/);
  assert.match(developer, /name = "jj-workflow-developer"/);
  assert.match(developer, /model = "gpt-5\.6-sol"/);
  assert.match(developer, /sandbox_mode = "workspace-write"/);
});

test('approval and dispatch snapshots expose schema-complete task fields', () => {
  const approved = approveDispatch(makePlane(), { deliveryId: 'DEL-001', decisionRef: 'decision:schema' });
  assert.equal(validateControlPlane(approved).ok, true);
  for (const task of approved.deliveries[0].approval.tasks) {
    assert.equal(typeof task.phase, 'string');
    assert.ok(Array.isArray(task.depends_on));
  }
  const dispatched = dispatchTasks(approved, 'DEL-001', { capabilities: appCapabilities });
  assert.equal(validateControlPlane(dispatched.plane).ok, true);
  for (const intent of dispatched.plane.deliveries[0].dispatch_intents) {
    assert.equal(typeof intent.phase, 'string');
    assert.ok(Array.isArray(intent.depends_on));
  }
});

test('PREVIEW is read-only and creates stable task keys', () => {
  const plane = makePlane();
  const before = JSON.stringify(plane);
  const preview = previewDispatch(plane, 'DEL-001');

  assert.equal(preview.status, 'PREVIEW_ONLY');
  assert.equal(preview.tasks.length, 4);
  assert.equal(preview.tasks[0].task_key, 'DEL-001/C/development/1');
  assert.equal(preview.tasks[1].task_key, 'DEL-001/A/development/1');
  assert.equal(preview.tasks[2].task_key, 'DEL-001/A/test/1');
  assert.deepEqual(preview.tasks[2].depends_on, ['DEL-001/A/development/1']);
  assert.equal(preview.tasks[0].writer, true);
  assert.equal(preview.tasks[2].writer, false);
  assert.equal(JSON.stringify(plane), before);
  assert.equal(buildTaskKey({ deliveryId: 'D', projectId: 'P', responsibility: 'test', attempt: 2 }), 'D/P/test/2');
});

test('dispatch requires approval and App capabilities, and is idempotent by task_key', () => {
  const plane = makePlane();
  const notApproved = dispatchTasks(plane, 'DEL-001', {
    capabilities: appCapabilities
  });
  assert.equal(notApproved.status, 'BLOCKED');
  assert.equal(plane.deliveries[0].dispatch_intents.length, 0);

  const approved = approveDispatch(plane, { deliveryId: 'DEL-001', decisionRef: 'decision:1' });
  const missingCapability = dispatchTasks(approved, 'DEL-001', { capabilities: ['create_thread'] });
  assert.equal(missingCapability.status, 'BLOCKED');
  assert.deepEqual(missingCapability.missing_capabilities, ['list_projects', 'list_threads', 'read_thread', 'send_message_to_thread', 'worktree', 'sandbox']);

  const first = dispatchTasks(approved, 'DEL-001', {
    capabilities: appCapabilities,
    now: '2026-07-16T00:00:00.000Z'
  });
  assert.equal(first.created.length, 3);
  assert.equal(first.deferred.length, 1);
  assert.equal(first.deferred[0].task_key, 'DEL-001/A/test/1');
  assert.equal(validateControlPlane(first.plane).ok, true);
  const second = dispatchTasks(first.plane, 'DEL-001', {
    capabilities: appCapabilities,
    now: '2026-07-16T00:01:00.000Z'
  });
  assert.equal(second.created.length, 0);
  assert.equal(second.reused.length, 3);
  assert.equal(second.deferred.length, 1);
  assert.equal(second.plane.deliveries[0].dispatch_intents.length, 3);
  assert.equal(second.plane.revision, first.plane.revision);
  assert.equal(second.plane.events.length, first.plane.events.length);
});

test('changing the approved task set requires a new preview and approval', () => {
  const plane = makePlane();
  const approved = approveDispatch(plane, { deliveryId: 'DEL-001', decisionRef: 'decision:changed' });
  approved.deliveries[0].targets[1].responsibilities.push({
    name: 'review',
    access: 'read',
    phase: 'review',
    status: 'PENDING',
    attempt: 1,
    thread_id: null,
    depends_on: []
  });
  const result = dispatchTasks(approved, 'DEL-001', {
    capabilities: appCapabilities
  });
  assert.equal(result.status, 'BLOCKED');
  assert.match(result.reason, /重新 PREVIEW 并批准/);
  assert.equal(result.plane.deliveries[0].dispatch_intents.length, 0);
});

test('changing an approved responsibility from read to write is also blocked', () => {
  const plane = makePlane();
  const approved = approveDispatch(plane, { deliveryId: 'DEL-001', decisionRef: 'decision:access' });
  approved.deliveries[0].targets[0].responsibilities[0].access = 'read';
  approved.deliveries[0].targets[0].responsibilities[1].access = 'write';
  const result = dispatchTasks(approved, 'DEL-001', { capabilities: appCapabilities });
  assert.equal(result.status, 'BLOCKED');
  assert.match(result.reason, /权限或责任/);
});

test('invalid control state blocks without trying to build task plans', () => {
  const plane = makePlane();
  plane.deliveries[0].targets[0].responsibilities = [];
  const result = dispatchTasks(plane, 'DEL-001', { capabilities: appCapabilities });
  assert.equal(result.status, 'BLOCKED');
  assert.deepEqual(result.tasks, []);
  assert.match(result.reason, /requires responsibilities/);
});

test('cyclic task dependencies are rejected before dispatch', () => {
  const plane = makePlane();
  plane.deliveries[0].targets[0].responsibilities[0].depends_on = ['DEL-001/A/test/1'];
  const validation = validateControlPlane(plane);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes('dependency cycle')));
});

test('UNKNOWN dispatch can only be reconciled to one candidate thread', () => {
  const plane = makePlane();
  const approved = approveDispatch(plane, { deliveryId: 'DEL-001', decisionRef: 'decision:2' });
  const dispatched = dispatchTasks(approved, 'DEL-001', {
    capabilities: appCapabilities
  });
  const taskKey = dispatched.created[0].task_key;
  const unknown = markDispatchUnknown(dispatched.plane, { taskKey });
  const ambiguous = reconcileDispatch(unknown, {
    taskKey,
    candidates: [
      bindingCandidate(dispatched.created[0], { threadId: 'thread-1', worktree: 'D:/worktrees/C-1' }),
      bindingCandidate(dispatched.created[0], { threadId: 'thread-2', worktree: 'D:/worktrees/C-2' })
    ]
  });
  assert.equal(ambiguous.status, 'BLOCKED');

  const recovered = reconcileDispatch(unknown, {
    taskKey,
    candidates: [bindingCandidate(dispatched.created[0], { threadId: 'thread-1', worktree: 'D:/worktrees/C-1' })]
  });
  assert.equal(recovered.status, 'BOUND');
  assert.equal(recovered.plane.deliveries[0].dispatch_intents[0].thread_id, 'thread-1');
  assert.equal(recovered.plane.deliveries[0].dispatch_intents[0].worktree, 'D:/worktrees/C-1');
  assert.equal(recovered.plane.deliveries[0].status, 'DISPATCHING');

  const malformedCandidates = reconcileDispatch(unknown, { taskKey, candidates: {} });
  assert.equal(malformedCandidates.ok, false);
  assert.equal(malformedCandidates.status, 'BLOCKED');
});

test('an unresolved UNKNOWN dispatch can be explicitly abandoned before a new attempt', () => {
  const approved = approveDispatch(makePlane(), { deliveryId: 'DEL-001', decisionRef: 'decision:abandon' });
  const dispatched = dispatchTasks(approved, 'DEL-001', { capabilities: appCapabilities });
  const task = dispatched.created[0];
  const unknown = markDispatchUnknown(dispatched.plane, { taskKey: task.task_key });
  const blocked = abandonDispatchUnknown(unknown, { taskKey: task.task_key, reason: 'thread 不可确认' });
  assert.equal(blocked.deliveries[0].dispatch_intents.find((intent) => intent.task_key === task.task_key).status, 'BLOCKED');
  assert.equal(blocked.deliveries[0].status, 'BLOCKED');
  assert.match(blocked.events.at(-1).type, /ABANDONED/);
});

test('a blocked unknown task can be retried with a new attempt key', () => {
  const approved = approveDispatch(makePlane(), { deliveryId: 'DEL-001', decisionRef: 'decision:retry-1' });
  const dispatched = dispatchTasks(approved, 'DEL-001', { capabilities: appCapabilities });
  const task = dispatched.created.find((item) => item.project_id === 'A' && item.responsibility === 'development');
  const blocked = abandonDispatchUnknown(markDispatchUnknown(dispatched.plane, { taskKey: task.task_key }), {
    taskKey: task.task_key,
    reason: 'thread 丢失'
  });
  const delivery = blocked.deliveries[0];
  delivery.targets[0].responsibilities[0].attempt = 2;
  delivery.targets[0].responsibilities[0].status = 'PENDING';
  delivery.targets[0].responsibilities[0].thread_id = null;
  delivery.targets[0].responsibilities[1].depends_on = ['DEL-001/A/development/2'];
  const approvedRetry = approveDispatch(blocked, { deliveryId: 'DEL-001', decisionRef: 'decision:retry-2' });
  const retry = dispatchTasks(approvedRetry, 'DEL-001', { capabilities: appCapabilities });
  assert.ok(retry.created.some((item) => item.task_key === 'DEL-001/A/development/2'));
  assert.equal(retry.plane.deliveries[0].dispatch_intents.find((intent) => intent.task_key === task.task_key).status, 'BLOCKED');
  assert.throws(() => recordTaskResult(retry.plane, {
    taskKey: task.task_key,
    status: 'COMPLETED',
    evidenceRef: 'VRF:late-old',
    commit: 'abcdef1'
  }), /BOUND/);
});

test('blocked dispatch cannot be re-approved while reusing the old task key', () => {
  const approved = approveDispatch(makePlane(), { deliveryId: 'DEL-001', decisionRef: 'decision:reuse-1' });
  const dispatched = dispatchTasks(approved, 'DEL-001', { capabilities: appCapabilities });
  const task = dispatched.created[0];
  const blocked = abandonDispatchUnknown(markDispatchUnknown(dispatched.plane, { taskKey: task.task_key }), {
    taskKey: task.task_key,
    reason: 'thread 丢失'
  });
  assert.throws(() => approveDispatch(blocked, {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:reuse-2'
  }), /new attempt task_key/);
});

test('binding a dependent task before its prerequisite is completed is blocked', () => {
  const approved = approveDispatch(makePlane(), { deliveryId: 'DEL-001', decisionRef: 'decision:dependency-bypass' });
  const dispatched = dispatchTasks(approved, 'DEL-001', { capabilities: appCapabilities });
  const testPlan = previewDispatch(dispatched.plane, 'DEL-001').tasks.find((task) => task.responsibility === 'test');
  dispatched.plane.deliveries[0].dispatch_intents.push({
    ...testPlan,
    delivery_id: 'DEL-001',
    status: 'UNKNOWN',
    created_at: '2026-07-16T00:00:00.000Z',
    thread_id: null,
    host_id: null,
    agent_name: 'jj-workflow-reviewer',
    sandbox_mode: 'read-only',
    environment: 'project-read',
    worktree: null
  });
  const result = reconcileDispatch(dispatched.plane, {
    taskKey: testPlan.task_key,
    candidates: [bindingCandidate(testPlan, { threadId: 'thread-test-early' })]
  });
  assert.equal(result.status, 'BLOCKED');
  assert.match(result.reason, /depends on incomplete|before dependency/);
});

test('thread and worktree bindings are unique and write tasks require a worktree', () => {
  const plane = makePlane();
  const approved = approveDispatch(plane, { deliveryId: 'DEL-001', decisionRef: 'decision:binding' });
  const dispatched = dispatchTasks(approved, 'DEL-001', { capabilities: appCapabilities });
  const leadTask = dispatched.created[0];
  const blocked = reconcileDispatch(markDispatchUnknown(dispatched.plane, { taskKey: leadTask.task_key }), {
    taskKey: leadTask.task_key,
    candidates: [bindingCandidate(leadTask, { threadId: 'thread-no-worktree', worktree: null })]
  });
  assert.equal(blocked.status, 'BLOCKED');
  assert.match(blocked.reason, /唯一候选|worktree/);
});

test('reference implementation is gated by verification evidence', () => {
  const plane = makePlane();
  assert.throws(() => setReferenceImplementation(plane, {
    deliveryId: 'DEL-001',
    projectId: 'C',
    commit: '1234567',
    snapshotRef: 'snapshot:A',
    snapshotHash: 'sha256:a',
    verification: { status: 'PENDING', commit_stable: false, evidence_ref: 'VRF:A' }
  }), /PASS verification/);
  const verified = setReferenceImplementation(plane, {
    deliveryId: 'DEL-001',
    projectId: 'C',
    commit: '1234567',
    snapshotRef: 'snapshot:A',
    snapshotHash: 'sha256:a',
    verification: { status: 'PASS', commit_stable: true, evidence_ref: 'VRF:A', source_ref: 'REF:external-A' }
  });
  assert.equal(verified.deliveries[0].reference_implementation.project_id, 'C');
  assert.equal(verified.deliveries[0].reference_implementation.commit, '1234567');
  assert.throws(() => setReferenceImplementation(plane, {
    deliveryId: 'DEL-001',
    projectId: 'C',
    commit: 'short',
    snapshotRef: 'snapshot:A',
    snapshotHash: 'sha256:a',
    verification: { status: 'PASS', commit_stable: true, evidence_ref: 'VRF:A', source_ref: 'REF:external-A' }
  }), /at least 7/);
});

test('failed target does not advance its previous checkpoint', () => {
  const plane = makePlane();
  plane.deliveries[0].targets[0].checkpoint = {
    source_head: 'old-source',
    commit: 'old-commit',
    evidence_ref: 'VRF:old',
    recorded_at: '2026-07-15T00:00:00.000Z'
  };
  const approved = approveDispatch(plane, { deliveryId: 'DEL-001', decisionRef: 'decision:failure' });
  const dispatched = dispatchTasks(approved, 'DEL-001', { capabilities: appCapabilities });
  const targetTask = dispatched.created.find((task) => task.project_id === 'A' && task.responsibility === 'development');
  const bound = bindAndComplete(dispatched.plane, targetTask, { blocked: true });
  const failed = recordTargetResult(bound, {
    deliveryId: 'DEL-001',
    projectId: 'A',
    status: 'FAILED',
    evidenceRef: 'VRF:new-fail',
    commit: 'new-commit',
    sourceHead: 'new-source'
  });
  assert.equal(failed.deliveries[0].status, 'BLOCKED');
  assert.deepEqual(failed.deliveries[0].targets[0].checkpoint, plane.deliveries[0].targets[0].checkpoint);
});

test('successful target result advances only that target checkpoint', () => {
  const plane = createControlPlane(withTargetReview(fixture, 'A'));
  const approved = approveDispatch(plane, { deliveryId: 'DEL-001', decisionRef: 'decision:success' });
  const reviewed = completeTargetPipeline(approved, 'A');
  const next = recordTargetResult(reviewed, {
    deliveryId: 'DEL-001',
    projectId: 'A',
    status: 'VERIFIED',
    evidenceRef: 'VRF:A',
    commit: 'commit-A',
    sourceHead: 'source-1'
  });
  assert.equal(next.deliveries[0].targets[0].checkpoint.source_head, 'source-1');
  assert.equal(next.deliveries[0].targets[1].checkpoint, null);
  assert.equal(next.deliveries[0].status, 'DISPATCHING');
});

test('NO_CHANGE_REQUIRED does not require a fabricated commit', () => {
  const source = structuredClone(fixture);
  const target = source.deliveries[0].targets[0];
  target.responsibilities.unshift({
    name: 'analysis',
    access: 'read',
    phase: 'planning',
    status: 'PENDING',
    attempt: 1,
    depends_on: []
  });
  target.responsibilities[1].depends_on = ['DEL-001/A/analysis/1'];
  const plane = createControlPlane(source);
  const approved = approveDispatch(plane, { deliveryId: 'DEL-001', decisionRef: 'decision:no-change' });
  const dispatched = dispatchTasks(approved, 'DEL-001', { capabilities: appCapabilities });
  const analysis = dispatched.created.find((task) => task.task_key === 'DEL-001/A/analysis/1');
  const bound = reconcileDispatch(markDispatchUnknown(dispatched.plane, { taskKey: analysis.task_key }), {
    taskKey: analysis.task_key,
    candidates: [bindingCandidate(analysis, { threadId: 'thread-analysis-no-change' })]
  });
  const analyzed = recordTaskResult(bound.plane, {
    taskKey: analysis.task_key,
    evidenceRef: 'ANL-TARGET:A'
  });
  const result = recordTargetResult(analyzed, {
    deliveryId: 'DEL-001',
    projectId: 'A',
    status: 'NO_CHANGE_REQUIRED',
    evidenceRef: 'ANL-TARGET:A',
    analysisRef: 'ANL-TARGET:A',
    differenceRef: 'DIFF:A:no-change',
    sourceHead: 'source-a',
    targetHead: 'target-a',
    unresolved: []
  });
  assert.equal(result.deliveries[0].targets[0].checkpoint.commit, null);
  assert.equal(result.deliveries[0].targets[0].checkpoint.reviewed_commit, null);
  assert.equal(result.deliveries[0].targets[0].status, 'NO_CHANGE_REQUIRED');
  assert.deepEqual(result.deliveries[0].targets[0].last_result.unresolved, []);
  assert.deepEqual(result.deliveries[0].targets[0].responsibilities.map((item) => item.status), [
    'COMPLETED',
    'SKIPPED',
    'SKIPPED'
  ]);
});

test('malformed persisted containers fail closed instead of throwing', () => {
  const malformed = { ...fixture, projects: {}, deliveries: [] };
  assert.doesNotThrow(() => validateControlPlane(malformed));
  const validation = validateControlPlane(malformed);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes('projects must be an array')));

  const malformedDelivery = structuredClone(fixture);
  malformedDelivery.deliveries[0].dispatch_intents = {};
  assert.doesNotThrow(() => validateControlPlane(malformedDelivery));
  assert.equal(validateControlPlane(malformedDelivery).ok, false);
  assert.throws(() => createControlPlane({ ...fixture, projects: {} }), /projects must be an array/);
  assert.throws(() => createControlPlane({ ...fixture, deliveries: [null] }), /every delivery requires delivery_id/);
});

test('tampered dispatch intents are rejected against the task plan', () => {
  const approved = approveDispatch(makePlane(), { deliveryId: 'DEL-001', decisionRef: 'decision:tamper' });
  const dispatched = dispatchTasks(approved, 'DEL-001', { capabilities: appCapabilities });
  dispatched.plane.deliveries[0].dispatch_intents[0].phase = 'review';
  const validation = validateControlPlane(dispatched.plane);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes('differs from current task plan')));
});

test('late results from an earlier attempt cannot complete the current responsibility', () => {
  const approved = approveDispatch(makePlane(), { deliveryId: 'DEL-001', decisionRef: 'decision:stale' });
  const dispatched = dispatchTasks(approved, 'DEL-001', { capabilities: appCapabilities });
  const task = dispatched.created.find((item) => item.project_id === 'A' && item.responsibility === 'development');
  const bound = reconcileDispatch(markDispatchUnknown(dispatched.plane, { taskKey: task.task_key }), {
    taskKey: task.task_key,
    candidates: [bindingCandidate(task, { threadId: 'thread-stale', worktree: 'D:/worktrees/A-development' })]
  });
  bound.plane.deliveries[0].targets[0].responsibilities[0].attempt = 2;
  assert.throws(() => recordTaskResult(bound.plane, {
    taskKey: task.task_key,
    status: 'COMPLETED',
    evidenceRef: 'VRF:stale',
    commit: 'abcdef1'
  }), /stale/);
  assert.equal(bound.plane.deliveries[0].targets[0].responsibilities[0].status, 'RUNNING');
});

test('target verification cannot bypass missing dispatch task evidence', () => {
  const plane = makePlane();
  const delivery = plane.deliveries[0];
  delivery.status = 'RUNNING';
  delivery.targets[0].responsibilities.forEach((responsibility) => {
    responsibility.status = 'COMPLETED';
  });
  assert.throws(() => recordTargetResult(plane, {
    deliveryId: 'DEL-001',
    projectId: 'A',
    status: 'VERIFIED',
    evidenceRef: 'VRF:bypass',
    commit: 'abcdef1',
    sourceHead: 'source-bypass'
  }), /dispatch intent/);
});

test('delivery verification waits for a lead task when lead is outside targets', () => {
  let source = withTargetReview(fixture, 'A');
  source = withTargetReview(source, 'B');
  let plane = approveDispatch(createControlPlane(source), {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:lead-waits'
  });
  plane = completeTargetPipeline(plane, 'A');
  plane = completeTargetPipeline(plane, 'B');
  const afterA = recordTargetResult(plane, {
    deliveryId: 'DEL-001',
    projectId: 'A',
    status: 'VERIFIED',
    evidenceRef: 'VRF:A-final',
    commit: 'commit-A',
    sourceHead: 'source-a'
  });
  const afterB = recordTargetResult(afterA, {
    deliveryId: 'DEL-001',
    projectId: 'B',
    status: 'VERIFIED',
    evidenceRef: 'VRF:B-final',
    commit: 'commit-B',
    sourceHead: 'source-b'
  });
  // The target evidence is complete, but the lead responsibility is not.
  assert.notEqual(afterB.deliveries[0].status, 'VERIFIED');
});

test('verified deliveries cannot be re-approved in place', () => {
  let source = withTargetReview(fixture, 'A');
  source = withTargetReview(source, 'B');
  source.deliveries[0].lead_project = 'A';
  source.deliveries[0].lead_responsibilities = [];
  let plane = approveDispatch(createControlPlane(source), {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:verified'
  });
  plane = completeTargetPipeline(plane, 'A');
  plane = completeTargetPipeline(plane, 'B');
  plane = recordTargetResult(plane, {
    deliveryId: 'DEL-001',
    projectId: 'A',
    status: 'VERIFIED',
    evidenceRef: 'VRF:A-verified',
    commit: 'commit-A',
    sourceHead: 'source-a-verified'
  });
  plane = recordTargetResult(plane, {
    deliveryId: 'DEL-001',
    projectId: 'B',
    status: 'VERIFIED',
    evidenceRef: 'VRF:B-verified',
    commit: 'commit-B',
    sourceHead: 'source-b-verified'
  });
  assert.equal(plane.deliveries[0].status, 'VERIFIED');
  assert.throws(() => approveDispatch(plane, {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:reopen'
  }), /cannot be approved/);
});

test('abandoning a stale UNKNOWN attempt is rejected and does not mutate the new attempt', () => {
  const approved = approveDispatch(makePlane(), { deliveryId: 'DEL-001', decisionRef: 'decision:stale-abandon' });
  const dispatched = dispatchTasks(approved, 'DEL-001', { capabilities: appCapabilities });
  const task = dispatched.created.find((item) => item.project_id === 'A' && item.responsibility === 'development');
  const unknown = markDispatchUnknown(dispatched.plane, { taskKey: task.task_key });
  unknown.deliveries[0].targets[0].responsibilities[0].attempt = 2;
  assert.throws(() => abandonDispatchUnknown(unknown, { taskKey: task.task_key }), /stale/);
  assert.equal(unknown.deliveries[0].dispatch_intents.find((item) => item.task_key === task.task_key).status, 'UNKNOWN');
});

test('normalization preserves explicit invalid values for fail-closed validation', () => {
  const malformed = structuredClone(fixture);
  malformed.deliveries[0].targets[0].responsibilities[0].attempt = 0;
  malformed.deliveries[0].targets[0].responsibilities[0].access = '';
  malformed.deliveries[0].targets[0].responsibilities[0].depends_on = null;
  assert.throws(() => createControlPlane(malformed), /positive attempt|read or write|depends_on/);
});

test('reviewer NEEDS_CHANGES creates a new developer and review attempt', () => {
  const source = structuredClone(fixture);
  source.deliveries[0].targets[0].responsibilities.push({
    name: 'review',
    access: 'read',
    phase: 'review',
    status: 'PENDING',
    attempt: 1,
    depends_on: ['DEL-001/A/test/1']
  });
  source.deliveries[0].targets[0].responsibilities.push({
    name: 'post-review-test',
    access: 'read',
    phase: 'verification',
    status: 'PENDING',
    attempt: 1,
    depends_on: ['DEL-001/A/review/1']
  });
  let plane = createControlPlane(source);
  plane = approveDispatch(plane, { deliveryId: 'DEL-001', decisionRef: 'decision:review-loop' });
  let dispatched = dispatchTasks(plane, 'DEL-001', { capabilities: appCapabilities });
  const development = dispatched.created.find((task) => task.task_key === 'DEL-001/A/development/1');
  let bound = reconcileDispatch(markDispatchUnknown(dispatched.plane, { taskKey: development.task_key }), {
    taskKey: development.task_key,
    candidates: [bindingCandidate(development, { threadId: 'thread-dev', worktree: 'D:/worktrees/A-development' })]
  });
  bound.plane = recordTaskResult(bound.plane, {
    taskKey: development.task_key,
    evidenceRef: 'DEV:EVIDENCE',
    producedCommit: 'abcdef1'
  });
  dispatched = dispatchTasks(bound.plane, 'DEL-001', { capabilities: appCapabilities });
  const verification = dispatched.created.find((task) => task.task_key === 'DEL-001/A/test/1');
  const verificationBound = reconcileDispatch(markDispatchUnknown(dispatched.plane, { taskKey: verification.task_key }), {
    taskKey: verification.task_key,
    candidates: [bindingCandidate(verification, { threadId: 'thread-test' })]
  });
  const afterVerification = recordTaskResult(verificationBound.plane, {
    taskKey: verification.task_key,
    evidenceRef: 'TEST:EVIDENCE',
    consumedCommit: 'abcdef1'
  });
  dispatched = dispatchTasks(afterVerification, 'DEL-001', { capabilities: appCapabilities });
  const review = dispatched.created.find((task) => task.task_key === 'DEL-001/A/review/1');
  const reviewBound = reconcileDispatch(markDispatchUnknown(dispatched.plane, { taskKey: review.task_key }), {
    taskKey: review.task_key,
    candidates: [bindingCandidate(review, { threadId: 'thread-review' })]
  });
  const needsChanges = recordReviewResult(reviewBound.plane, {
    taskKey: review.task_key,
    outcome: 'NEEDS_CHANGES',
    reviewedCommit: 'abcdef1',
    evidenceRef: 'REV:EVIDENCE',
    findings: [{
      id: 'F-001',
      severity: 'P1',
      file: 'src/example.mjs',
      line: 10,
      description: '审查发现需要修复的问题。',
      status: 'OPEN',
      acceptance: '补充回归测试。'
    }]
  });
  assert.equal(needsChanges.deliveries[0].reviews[0].outcome, 'NEEDS_CHANGES');
  dispatched = dispatchTasks(needsChanges, 'DEL-001', { capabilities: appCapabilities });
  const postReview = dispatched.created.find((task) => task.task_key === 'DEL-001/A/post-review-test/1');
  const postReviewBound = reconcileDispatch(markDispatchUnknown(dispatched.plane, { taskKey: postReview.task_key }), {
    taskKey: postReview.task_key,
    candidates: [bindingCandidate(postReview, { threadId: 'thread-post-review' })]
  });
  assert.throws(() => requestRework(postReviewBound.plane, { reviewTaskKey: review.task_key }), /downstream task .* active/);
  const postReviewCompleted = recordTaskResult(postReviewBound.plane, {
    taskKey: postReview.task_key,
    evidenceRef: 'POST-REVIEW:EVIDENCE',
    consumedCommit: 'abcdef1'
  });
  const reworked = requestRework(postReviewCompleted, { reviewTaskKey: review.task_key });
  assert.equal(reworked.deliveries[0].targets[0].responsibilities.find((item) => item.name === 'development').attempt, 2);
  assert.equal(reworked.deliveries[0].targets[0].responsibilities.find((item) => item.name === 'review').attempt, 2);
  assert.deepEqual(reworked.deliveries[0].targets[0].responsibilities.find((item) => item.name === 'review').depends_on, ['DEL-001/A/test/2']);
  assert.deepEqual(previewDispatch(reworked, 'DEL-001').tasks.filter((task) => task.project_id === 'A').map((task) => task.task_key), [
    'DEL-001/A/development/2',
    'DEL-001/A/test/2',
    'DEL-001/A/review/2',
    'DEL-001/A/post-review-test/2'
  ]);
  assert.equal(reworked.deliveries[0].approval.status, 'PENDING');
  const reapproved = approveDispatch(reworked, { deliveryId: 'DEL-001', decisionRef: 'decision:review-loop-2' });
  assert.throws(() => completeTargetPipeline(reapproved, 'A'), /previous findings/);
});

test('read-only reviewer records consumed commit without fabricating produced commit', () => {
  const source = structuredClone(fixture);
  source.deliveries[0].targets[0].responsibilities.push({
    name: 'review',
    access: 'read',
    phase: 'review',
    status: 'PENDING',
    attempt: 1,
    depends_on: ['DEL-001/A/development/1']
  });
  let plane = approveDispatch(createControlPlane(source), { deliveryId: 'DEL-001', decisionRef: 'decision:read-commit' });
  let dispatched = dispatchTasks(plane, 'DEL-001', { capabilities: appCapabilities });
  const development = dispatched.created.find((task) => task.task_key === 'DEL-001/A/development/1');
  let devBound = reconcileDispatch(markDispatchUnknown(dispatched.plane, { taskKey: development.task_key }), {
    taskKey: development.task_key,
    candidates: [bindingCandidate(development, { threadId: 'thread-dev-commit', worktree: 'D:/worktrees/A-development' })]
  });
  devBound.plane = recordTaskResult(devBound.plane, { taskKey: development.task_key, evidenceRef: 'DEV:commit', producedCommit: 'abcdef2' });
  dispatched = dispatchTasks(devBound.plane, 'DEL-001', { capabilities: appCapabilities });
  const review = dispatched.created.find((task) => task.task_key === 'DEL-001/A/review/1');
  const reviewBound = reconcileDispatch(markDispatchUnknown(dispatched.plane, { taskKey: review.task_key }), {
    taskKey: review.task_key,
    candidates: [bindingCandidate(review, { threadId: 'thread-review-commit' })]
  });
  const passed = recordReviewResult(reviewBound.plane, {
    taskKey: review.task_key,
    outcome: 'PASS',
    reviewedCommit: 'abcdef2',
    evidenceRef: 'REV:pass',
    findings: []
  });
  const result = passed.deliveries[0].dispatch_intents.find((item) => item.task_key === review.task_key).result;
  assert.equal(result.consumed_commit, 'abcdef2');
  assert.equal(result.produced_commit, null);
});

test('target verification is fail-closed without a review and rejects an unreviewed commit', () => {
  let plane = approveDispatch(makePlane(), { deliveryId: 'DEL-001', decisionRef: 'decision:no-review' });
  plane = completeTargetPipeline(plane, 'A');
  assert.throws(() => recordTargetResult(plane, {
    deliveryId: 'DEL-001',
    projectId: 'A',
    status: 'VERIFIED',
    evidenceRef: 'VRF:no-review',
    commit: 'commit-A',
    sourceHead: 'source-no-review'
  }), /review responsibility/);

  plane = approveDispatch(createControlPlane(withTargetReview(fixture, 'A')), {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:commit-match'
  });
  plane = completeTargetPipeline(plane, 'A');
  assert.throws(() => recordTargetResult(plane, {
    deliveryId: 'DEL-001',
    projectId: 'A',
    status: 'VERIFIED',
    evidenceRef: 'VRF:wrong-commit',
    commit: 'wrong-commit',
    sourceHead: 'source-wrong-commit'
  }), /match the .*reviewed developer commit/);
});

test('synchronized target checkpoints require fresh handoff and complete branch/head evidence', () => {
  const source = withTargetReview(fixture, 'A');
  source.deliveries[0].sync_key = 'SYNC-001';
  source.deliveries[0].handoff_ref = 'HOF-001';
  let plane = approveDispatch(createControlPlane(source), { deliveryId: 'DEL-001', decisionRef: 'decision:sync' });
  plane = completeTargetPipeline(plane, 'A');
  const base = {
    deliveryId: 'DEL-001',
    projectId: 'A',
    status: 'VERIFIED',
    evidenceRef: 'VRF:sync',
    commit: 'commit-A',
    sourceHead: 'source-sync',
    sourceBranch: 'main',
    targetBranch: 'feature/sync',
    targetHead: 'commit-A',
    snapshotRef: 'snapshot:sync',
    snapshotHash: 'sha256:sync',
    handoffRef: 'HOF-001',
    differenceRef: 'DIFF:sync'
  };
  assert.throws(() => recordTargetResult(plane, { ...base, freshness: 'STALE' }), /FRESH/);
  const verified = recordTargetResult(plane, { ...base, freshness: 'FRESH' });
  assert.equal(verified.deliveries[0].targets[0].checkpoint.freshness, 'FRESH');
  assert.equal(verified.deliveries[0].targets[0].checkpoint.target_head, 'commit-A');
});

test('read task cannot produce a commit or consume the wrong developer commit', () => {
  let plane = approveDispatch(createControlPlane(withTargetReview(fixture, 'A')), {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:read-guard'
  });
  const dispatched = dispatchTasks(plane, 'DEL-001', { capabilities: appCapabilities });
  const development = dispatched.created.find((task) => task.task_key === 'DEL-001/A/development/1');
  plane = bindAndComplete(dispatched.plane, development);
  const nextWave = dispatchTasks(plane, 'DEL-001', { capabilities: appCapabilities });
  const verification = nextWave.created.find((task) => task.task_key === 'DEL-001/A/test/1');
  const bound = reconcileDispatch(markDispatchUnknown(nextWave.plane, { taskKey: verification.task_key }), {
    taskKey: verification.task_key,
    candidates: [bindingCandidate(verification, { threadId: 'thread-read-guard' })]
  });
  assert.throws(() => recordTaskResult(bound.plane, {
    taskKey: verification.task_key,
    evidenceRef: 'TEST:wrong-consumed',
    consumedCommit: 'wrong-commit'
  }), /current developer commit/);
  assert.throws(() => recordTaskResult(bound.plane, {
    taskKey: verification.task_key,
    evidenceRef: 'TEST:produced',
    consumedCommit: 'commit-A',
    producedCommit: 'unexpected-commit'
  }), /cannot produce a commit/);
});

test('reconcile derives role boundaries from access instead of persisted metadata', () => {
  const approved = approveDispatch(makePlane(), { deliveryId: 'DEL-001', decisionRef: 'decision:metadata' });
  const dispatched = dispatchTasks(approved, 'DEL-001', { capabilities: appCapabilities });
  const task = dispatched.created.find((item) => item.project_id === 'A' && item.responsibility === 'development');
  const unknown = markDispatchUnknown(dispatched.plane, { taskKey: task.task_key });
  const intent = unknown.deliveries[0].dispatch_intents.find((item) => item.task_key === task.task_key);
  intent.agent_name = 'jj-workflow-reviewer';
  intent.sandbox_mode = 'read-only';
  intent.environment = 'project-read';
  const result = reconcileDispatch(unknown, {
    taskKey: task.task_key,
    candidates: [bindingCandidate(task, { threadId: 'thread-tampered-meta', worktree: 'D:/worktrees/A-development' })]
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /requires agent jj-workflow-developer/);
});

test('persisted review records and completed intent results cannot be forged independently', () => {
  let plane = approveDispatch(createControlPlane(withTargetReview(fixture, 'A')), {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:integrity'
  });
  plane = completeTargetPipeline(plane, 'A');
  const review = plane.deliveries[0].reviews[0];
  review.outcome = 'NEEDS_CHANGES';
  review.findings = [{
    id: 'F-TAMPER',
    severity: 'P1',
    file: 'src/tampered.mjs',
    line: 1,
    description: '伪造的审查记录。',
    status: 'OPEN',
    acceptance: '不得通过一致性校验。'
  }];
  const reviewValidation = validateControlPlane(plane);
  assert.equal(reviewValidation.ok, false);
  assert.ok(reviewValidation.errors.some((error) => error.includes('differs from intent.result.review')));

  const completed = structuredClone(plane);
  const developer = completed.deliveries[0].dispatch_intents.find((intent) => intent.task_key === 'DEL-001/A/development/1');
  developer.result = null;
  const resultValidation = validateControlPlane(completed);
  assert.equal(resultValidation.ok, false);
  assert.ok(resultValidation.errors.some((error) => error.includes('result is required')));
});

test('malformed persisted reference, checkpoint, findings, and containers fail closed without throwing', () => {
  const malformed = structuredClone(fixture);
  malformed.deliveries[0].reference_implementation = {
    project_id: 'C',
    commit: 'abcdef1',
    snapshot_ref: {},
    snapshot_hash: 7,
    verified_at: '2026-07-16T00:00:00.000Z',
    verification_ref: {}
  };
  malformed.deliveries[0].targets[0].checkpoint = {
    source_head: {},
    evidence_ref: 4,
    recorded_at: '2026-07-16T00:00:00.000Z'
  };
  const validation = validateControlPlane(malformed);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes('snapshot_ref must be a string')));
  assert.ok(validation.errors.some((error) => error.includes('source_head must be a string')));

  const malformedContainers = structuredClone(fixture);
  malformedContainers.deliveries[0].reviews = [null];
  malformedContainers.deliveries[0].dispatch_intents = [null];
  assert.doesNotThrow(() => validateControlPlane(malformedContainers));
  assert.equal(validateControlPlane(malformedContainers).ok, false);
});

test('completed intent requires persisted runtime sandbox attestation', () => {
  let plane = approveDispatch(createControlPlane(withTargetReview(fixture, 'A')), {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:sandbox-attestation'
  });
  plane = completeTargetPipeline(plane, 'A');
  const completed = plane.deliveries[0].dispatch_intents.find((intent) => intent.project_id === 'A');
  completed.sandbox_evidence_ref = null;
  const validation = validateControlPlane(plane);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes('requires sandbox_evidence_ref')));
});

test('ANL-SOURCE evidence cannot prove NO_CHANGE_REQUIRED for a target', () => {
  const analyzed = completeNoChangeAnalysis('ANL-SOURCE:A');
  assert.throws(() => recordTargetResult(analyzed, {
    deliveryId: 'DEL-001',
    projectId: 'A',
    status: 'NO_CHANGE_REQUIRED',
    evidenceRef: 'ANL-SOURCE:A',
    analysisRef: 'ANL-SOURCE:A',
    differenceRef: 'DIFF:A:no-change',
    sourceHead: 'source-a',
    targetHead: 'target-a',
    unresolved: []
  }), /ANL-TARGET analysis evidence/);
});

test('review of a non-terminal writer cannot verify the target', () => {
  const source = withTargetReview(fixture, 'A');
  const target = source.deliveries[0].targets.find((item) => item.project_id === 'A');
  target.responsibilities.push({
    name: 'integration',
    access: 'write',
    phase: 'development',
    status: 'PENDING',
    attempt: 1,
    depends_on: ['DEL-001/A/development/1']
  });
  const review = target.responsibilities.find((item) => item.phase === 'review');
  review.depends_on = ['DEL-001/A/development/1'];
  let plane = approveDispatch(createControlPlane(source), {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:terminal-writer'
  });
  plane = completeTargetPipeline(plane, 'A');
  assert.throws(() => recordTargetResult(plane, {
    deliveryId: 'DEL-001',
    projectId: 'A',
    status: 'VERIFIED',
    evidenceRef: 'VRF:terminal-writer',
    commit: 'commit-A',
    sourceHead: 'source-terminal-writer'
  }), /downstream of terminal writer/);
});

test('a successful target result cannot be replayed in the same attempt', () => {
  let plane = approveDispatch(createControlPlane(withTargetReview(fixture, 'A')), {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:target-replay'
  });
  plane = completeTargetPipeline(plane, 'A');
  plane = recordTargetResult(plane, {
    deliveryId: 'DEL-001',
    projectId: 'A',
    status: 'VERIFIED',
    evidenceRef: 'VRF:first',
    commit: 'commit-A',
    sourceHead: 'source-first'
  });
  assert.throws(() => recordTargetResult(plane, {
    deliveryId: 'DEL-001',
    projectId: 'A',
    status: 'VERIFIED',
    evidenceRef: 'VRF:replay',
    commit: 'commit-A',
    sourceHead: 'source-replay'
  }), /already has a successful result/);
});

test('persisted target cannot forge VERIFIED without task and review evidence', () => {
  const plane = makePlane();
  const target = plane.deliveries[0].targets[0];
  target.status = 'VERIFIED';
  target.last_result = {
    status: 'VERIFIED',
    evidence_ref: 'VRF:forged',
    commit: 'commit-A',
    reviewed_commit: 'commit-A',
    source_head: 'source-forged',
    target_head: 'commit-A',
    unresolved: [],
    recorded_at: '2026-07-16T00:00:00.000Z'
  };
  target.checkpoint = {
    source_head: 'source-forged',
    source_branch: null,
    target_head: 'commit-A',
    target_branch: null,
    commit: 'commit-A',
    reviewed_commit: 'commit-A',
    evidence_ref: 'VRF:forged',
    recorded_at: '2026-07-16T00:00:00.000Z'
  };
  const validation = validateControlPlane(plane);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => /completed dispatch intent|review responsibility/.test(error)));
});

test('PASS review cannot carry an OPEN finding', () => {
  let plane = approveDispatch(createControlPlane(withTargetReview(fixture, 'A')), {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:open-pass'
  });
  plane = completeTargetPipeline(plane, 'A');
  const review = plane.deliveries[0].reviews[0];
  const intent = plane.deliveries[0].dispatch_intents.find((item) => item.task_key === review.task_key);
  const finding = {
    id: 'F-OPEN',
    severity: 'P1',
    file: 'src/example.mjs',
    line: 1,
    description: 'PASS 中不得保留 OPEN finding。',
    status: 'OPEN',
    acceptance: 'finding 必须解决或豁免。'
  };
  review.findings = [finding];
  intent.result.review.findings = [structuredClone(finding)];
  const validation = validateControlPlane(plane);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes('PASS cannot contain OPEN findings')));
});

test('a second writer in the same project is deferred until the first writer completes', () => {
  const source = structuredClone(fixture);
  const target = source.deliveries[0].targets.find((item) => item.project_id === 'A');
  target.responsibilities.push({
    name: 'integration',
    access: 'write',
    phase: 'development',
    status: 'PENDING',
    attempt: 1,
    depends_on: ['DEL-001/A/development/1']
  });
  const approved = approveDispatch(createControlPlane(source), {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:writer-chain'
  });
  const dispatched = dispatchTasks(approved, 'DEL-001', { capabilities: appCapabilities });
  assert.ok(dispatched.created.some((task) => task.task_key === 'DEL-001/A/development/1'));
  assert.ok(dispatched.deferred.some((task) => task.task_key === 'DEL-001/A/integration/1'));
});

test('a skipped dependency cannot bypass its incomplete analysis prerequisite', () => {
  const source = structuredClone(fixture);
  const target = source.deliveries[0].targets.find((item) => item.project_id === 'A');
  target.responsibilities = [
    {
      name: 'analysis',
      access: 'read',
      phase: 'planning',
      status: 'PENDING',
      attempt: 1,
      depends_on: []
    },
    {
      name: 'development',
      access: 'write',
      phase: 'development',
      status: 'SKIPPED',
      attempt: 1,
      depends_on: ['DEL-001/A/analysis/1'],
      skip_reason: '等待分析结论，不应放行下游。',
      skip_evidence_ref: 'ANL-TARGET:pending',
      skipped_at: '2026-07-16T00:00:00.000Z'
    },
    {
      name: 'test',
      access: 'read',
      phase: 'verification',
      status: 'PENDING',
      attempt: 1,
      depends_on: ['DEL-001/A/development/1']
    }
  ];
  const approved = approveDispatch(createControlPlane(source), {
    deliveryId: 'DEL-001',
    decisionRef: 'decision:skipped-dependency'
  });
  const dispatched = dispatchTasks(approved, 'DEL-001', { capabilities: appCapabilities });
  assert.ok(dispatched.created.some((task) => task.task_key === 'DEL-001/A/analysis/1'));
  assert.ok(dispatched.deferred.some((task) => task.task_key === 'DEL-001/A/test/1'));
  assert.equal(dispatched.created.some((task) => task.task_key === 'DEL-001/A/test/1'), false);
});

function withTargetReview(source, projectId) {
  const next = structuredClone(source);
  const delivery = next.deliveries[0];
  const target = delivery.targets.find((item) => item.project_id === projectId);
  if (!target) throw new Error(`missing target ${projectId}`);
  if (target.responsibilities.some((item) => item.phase === 'review')) return next;
  const dependency = target.responsibilities.at(-1);
  target.responsibilities.push({
    name: 'review',
    access: 'read',
    phase: 'review',
    status: 'PENDING',
    attempt: 1,
    depends_on: [buildTaskKey({
      deliveryId: delivery.delivery_id,
      projectId,
      responsibility: dependency.name,
      attempt: dependency.attempt
    })]
  });
  return next;
}

function completeNoChangeAnalysis(evidenceRef) {
  const source = structuredClone(fixture);
  const target = source.deliveries[0].targets[0];
  target.responsibilities.unshift({
    name: 'analysis',
    access: 'read',
    phase: 'planning',
    status: 'PENDING',
    attempt: 1,
    depends_on: []
  });
  target.responsibilities[1].depends_on = ['DEL-001/A/analysis/1'];
  const approved = approveDispatch(createControlPlane(source), {
    deliveryId: 'DEL-001',
    decisionRef: `decision:${evidenceRef}`
  });
  const dispatched = dispatchTasks(approved, 'DEL-001', { capabilities: appCapabilities });
  const analysis = dispatched.created.find((task) => task.task_key === 'DEL-001/A/analysis/1');
  const bound = reconcileDispatch(markDispatchUnknown(dispatched.plane, { taskKey: analysis.task_key }), {
    taskKey: analysis.task_key,
    candidates: [bindingCandidate(analysis, { threadId: `thread-${evidenceRef.replace(/[^a-z0-9]/gi, '-')}` })]
  });
  return recordTaskResult(bound.plane, { taskKey: analysis.task_key, evidenceRef });
}

function completeTargetPipeline(plane, projectId) {
  let next = plane;
  for (let step = 0; step < 10; step += 1) {
    const target = next.deliveries[0].targets.find((item) => item.project_id === projectId);
    if (target.responsibilities.every((item) => item.status === 'COMPLETED')) return next;
    const dispatched = dispatchTasks(next, 'DEL-001', { capabilities: appCapabilities });
    assert.equal(dispatched.ok, true, dispatched.reason);
    next = dispatched.plane;
    const intents = next.deliveries[0].dispatch_intents;
    const task = intents.find((intent) => intent.project_id === projectId
      && intent.status === 'PENDING_THREAD'
      && intent.depends_on.every((dependency) => intents.find((item) => item.task_key === dependency)?.status === 'COMPLETED'));
    if (!task) throw new Error(`no runnable task for target ${projectId}`);
    if (task.phase === 'review') {
      const bound = reconcileDispatch(markDispatchUnknown(next, { taskKey: task.task_key }), {
        taskKey: task.task_key,
        candidates: [bindingCandidate(task, { threadId: `thread-${projectId}-review-${task.attempt}` })]
      });
      assert.equal(bound.ok, true, bound.reason);
      next = recordReviewResult(bound.plane, {
        taskKey: task.task_key,
        outcome: 'PASS',
        reviewedCommit: `commit-${projectId}`,
        evidenceRef: `REV:${projectId}:${task.attempt}`,
        findings: []
      });
    } else {
      next = bindAndComplete(next, task, { index: step });
    }
  }
  throw new Error(`target ${projectId} did not complete`);
}

function bindAndComplete(plane, task, { blocked = false, index = 0 } = {}) {
  const worktree = task.writer ? `D:/worktrees/${task.project_id}-${task.responsibility}` : null;
  const bound = reconcileDispatch(markDispatchUnknown(plane, { taskKey: task.task_key }), {
    taskKey: task.task_key,
    candidates: [bindingCandidate(task, {
      threadId: `thread-${task.project_id}-${task.responsibility}-${index}`,
      worktree
    })]
  });
  if (!bound.ok || blocked) {
    if (blocked) {
      return recordTaskResult(bound.plane, {
        taskKey: task.task_key,
        status: 'BLOCKED',
        evidenceRef: `VRF:${task.task_key}:blocked`,
        commit: null
      });
    }
    throw new Error(bound.reason || 'failed to bind task');
  }
  return recordTaskResult(bound.plane, {
    taskKey: task.task_key,
    status: 'COMPLETED',
    evidenceRef: `VRF:${task.task_key}`,
    commit: task.writer || /^(test|qa|review|verification)$/i.test(task.responsibility) ? `commit-${task.project_id}` : null
  });
}

function bindingCandidate(task, { threadId, worktree = null } = {}) {
  const writer = task.access === 'write' || task.writer === true;
  const sandboxMode = writer ? 'workspace-write' : 'read-only';
  return {
    task_key: task.task_key,
    thread_id: threadId,
    project_id: task.project_id,
    host_id: 'host-main',
    agent_name: writer ? 'jj-workflow-developer' : 'jj-workflow-reviewer',
    sandbox_mode: sandboxMode,
    effective_sandbox_mode: sandboxMode,
    sandbox_evidence_ref: `APP-SANDBOX:${threadId}`,
    environment: writer ? 'exclusive-worktree' : 'project-read',
    worktree
  };
}
