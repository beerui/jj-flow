import fs from 'node:fs';
import { createControlPlane } from './dispatchControlPlane.mjs';
import { createTraceRecorder, replayTrace } from './dispatchTrace.mjs';

export const SCENARIO_REPORT_VERSION = 'jj-flow/scenario-report/1.0';
export const SCENARIO_IDS = Object.freeze([
  'dispatch-happy-path',
  'dispatch-interrupted-resume',
  'dispatch-partial-target-failure',
  'same-handoff-contract'
]);

const NOW = '2026-07-18T00:00:00.000Z';
const CAPABILITIES = Object.freeze([
  'list_projects',
  'list_threads',
  'create_thread',
  'read_thread',
  'send_message_to_thread',
  'worktree',
  'sandbox'
]);

export function runScenario(scenarioId) {
  const runner = SCENARIOS[scenarioId];
  if (!runner) {
    return {
      schema_version: SCENARIO_REPORT_VERSION,
      scenario: scenarioId,
      status: 'FAIL',
      isolated: true,
      side_effects: 'none',
      assertions: [],
      earliest_violation: {
        rule_id: 'SCN-UNKNOWN-001',
        reason: `Unknown scenario: ${scenarioId}`,
        next_action: `使用：${SCENARIO_IDS.join(', ')}`
      },
      trace: null
    };
  }
  try {
    const execution = runner();
    const replay = replayTrace(execution.trace);
    const assertions = [...execution.assertions];
    assertions.push(assertion('SCN-TRACE-REPLAY', replay.ok, {
      steps_replayed: replay.steps_replayed,
      external_actions_suppressed: replay.external_actions_suppressed,
      final_hash: replay.final_hash
    }));
    const failed = assertions.find((item) => item.status === 'FAIL');
    return {
      schema_version: SCENARIO_REPORT_VERSION,
      scenario: scenarioId,
      status: failed ? 'FAIL' : 'PASS',
      isolated: true,
      side_effects: 'none',
      summary: execution.summary,
      assertions,
      earliest_violation: failed ? {
        rule_id: failed.id,
        reason: failed.reason,
        next_action: failed.next_action
      } : null,
      replay: {
        status: replay.status,
        steps_replayed: replay.steps_replayed,
        external_actions_suppressed: replay.external_actions_suppressed,
        final_hash: replay.final_hash
      },
      trace: execution.trace
    };
  } catch (error) {
    return {
      schema_version: SCENARIO_REPORT_VERSION,
      scenario: scenarioId,
      status: 'FAIL',
      isolated: true,
      side_effects: 'none',
      assertions: [],
      earliest_violation: {
        rule_id: 'SCN-EXECUTION-001',
        reason: error.message,
        next_action: '从最早失败的纯状态转换检查 fixture、协议输入和 runtime invariant。'
      },
      trace: null
    };
  }
}

export function runAllScenarios({ includeTraces = true } = {}) {
  const reports = SCENARIO_IDS.map((id) => runScenario(id));
  return {
    schema_version: 'jj-flow/scenario-suite/1.0',
    status: reports.every((report) => report.status === 'PASS') ? 'PASS' : 'FAIL',
    isolated: true,
    side_effects: 'none',
    reports: includeTraces ? reports : reports.map((report) => ({ ...report, trace: null }))
  };
}

export function renderScenarioText(report) {
  if (Array.isArray(report.reports)) {
    const lines = [`scenario suite: ${report.status}`];
    for (const item of report.reports) lines.push(`- ${item.scenario}: ${item.status}`);
    return `${lines.join('\n')}\n`;
  }
  const lines = [
    `scenario ${report.scenario}: ${report.status}`,
    `isolated: ${report.isolated}`,
    `side effects: ${report.side_effects}`
  ];
  if (report.summary) lines.push(`summary: ${report.summary}`);
  for (const item of report.assertions || []) lines.push(`- [${item.status}] ${item.id}`);
  if (report.earliest_violation) {
    lines.push(`violation: [${report.earliest_violation.rule_id}] ${report.earliest_violation.reason}`);
    lines.push(`next: ${report.earliest_violation.next_action}`);
  }
  return `${lines.join('\n')}\n`;
}

function happyPathScenario() {
  const initial = makeDispatchPlane({ targets: ['project-a'] });
  const recorder = createTraceRecorder({
    runId: 'SCN-dispatch-happy-path-001',
    scenario: 'dispatch-happy-path',
    deliveryId: 'DEL-EXAMPLE-001',
    initialState: initial,
    createdAt: NOW
  });
  const assertions = [];
  const preview = recorder.apply('preview_dispatch', { deliveryId: 'DEL-EXAMPLE-001' });
  assertions.push(assertion('SCN-HAPPY-PREVIEW', preview.output.tasks.length === 4, { task_keys: preview.output.tasks.map((item) => item.task_key) }));
  recorder.apply('approve_dispatch', { deliveryId: 'DEL-EXAMPLE-001', decisionRef: 'decision:scenario:happy', approvedAt: NOW });

  const analysisTick = recorder.apply('tick_dispatch', tickInput());
  const analysis = requireAction(analysisTick.output, 'project-a', 'analysis');
  recorder.apply('bind_thread', bindingInput(analysis, 'analysis'));
  const developmentTick = recorder.apply('tick_dispatch', tickInput({ receipts: [analysisReceipt('project-a')] }));
  const development = requireAction(developmentTick.output, 'project-a', 'development');
  recorder.apply('bind_thread', bindingInput(development, 'dev'));
  recorder.apply('record_task_result', {
    taskKey: development.task_key,
    evidenceRef: 'VRF:scenario:development',
    producedCommit: 'abcdef1234567890',
    recordedAt: NOW
  });

  const verificationTick = recorder.apply('tick_dispatch', tickInput());
  const verification = requireAction(verificationTick.output, 'project-a', 'test');
  recorder.apply('bind_thread', bindingInput(verification, 'test'));
  recorder.apply('record_task_result', {
    taskKey: verification.task_key,
    evidenceRef: 'VRF:scenario:test',
    consumedCommit: 'abcdef1234567890',
    recordedAt: NOW
  });

  const reviewTick = recorder.apply('tick_dispatch', tickInput());
  const review = requireAction(reviewTick.output, 'project-a', 'review');
  recorder.apply('bind_thread', bindingInput(review, 'review'));
  recorder.apply('record_review_result', {
    taskKey: review.task_key,
    outcome: 'PASS',
    reviewedCommit: 'abcdef1234567890',
    evidenceRef: 'REV:scenario:pass',
    findings: [],
    recordedAt: NOW
  });
  recorder.apply('record_target_result', {
    deliveryId: 'DEL-EXAMPLE-001',
    projectId: 'project-a',
    status: 'VERIFIED',
    evidenceRef: 'VRF:scenario:target',
    commit: 'abcdef1234567890',
    sourceHead: 'source1234567890',
    recordedAt: NOW
  });
  const finished = recorder.finish();
  const delivery = finished.state.deliveries[0];
  assertions.push(assertion('SCN-HAPPY-TARGET-VERIFIED', delivery.targets[0].status === 'VERIFIED', { target_status: delivery.targets[0].status }));
  assertions.push(assertion('SCN-HAPPY-DELIVERY-VERIFIED', delivery.status === 'VERIFIED', { delivery_status: delivery.status }));
  return { trace: finished.trace, assertions, summary: '完整 dispatch 开发、验证、Review 和目标验收均由纯状态转换完成。' };
}

function interruptedResumeScenario() {
  const initial = makeDispatchPlane({ targets: ['project-a'], responsibilities: ['development'] });
  const recorder = createTraceRecorder({
    runId: 'SCN-dispatch-interrupted-resume-001',
    scenario: 'dispatch-interrupted-resume',
    deliveryId: 'DEL-EXAMPLE-001',
    initialState: initial,
    createdAt: NOW
  });
  const assertions = [];
  recorder.apply('approve_dispatch', { deliveryId: 'DEL-EXAMPLE-001', decisionRef: 'decision:scenario:resume', approvedAt: NOW });
  const firstTick = recorder.apply('tick_dispatch', tickInput());
  const action = requireAction(firstTick.output, 'project-a', 'analysis');
  recorder.apply('mark_dispatch_unknown', { taskKey: action.task_key });
  const resumed = recorder.apply('tick_dispatch', tickInput());
  const reconcileAction = resumed.output.actions.find((item) => item.type === 'RECONCILE_THREAD');
  assertions.push(assertion('SCN-RESUME-RECONCILE', Boolean(reconcileAction), { actions: resumed.output.actions.map((item) => item.type) }));
  recorder.apply('reconcile_dispatch', {
    taskKey: action.task_key,
    candidates: [bindingCandidate(action, 'recovered')]
  });
  const finished = recorder.finish();
  const intent = finished.state.deliveries[0].dispatch_intents.find((item) => item.task_key === action.task_key);
  assertions.push(assertion('SCN-RESUME-BOUND', intent.status === 'BOUND', { intent_status: intent.status, thread_id: intent.thread_id }));
  return { trace: finished.trace, assertions, summary: 'UNKNOWN intent 只输出 RECONCILE，并通过唯一候选恢复绑定。' };
}

function partialFailureScenario() {
  const initial = makeDispatchPlane({ targets: ['project-a', 'project-b'], responsibilities: ['development'] });
  const recorder = createTraceRecorder({
    runId: 'SCN-dispatch-partial-target-failure-001',
    scenario: 'dispatch-partial-target-failure',
    deliveryId: 'DEL-EXAMPLE-001',
    initialState: initial,
    createdAt: NOW
  });
  const assertions = [];
  recorder.apply('approve_dispatch', { deliveryId: 'DEL-EXAMPLE-001', decisionRef: 'decision:scenario:partial', approvedAt: NOW });
  const analysisTick = recorder.apply('tick_dispatch', tickInput());
  const analysisA = requireAction(analysisTick.output, 'project-a', 'analysis');
  const analysisB = requireAction(analysisTick.output, 'project-b', 'analysis');
  recorder.apply('bind_thread', bindingInput(analysisA, 'analysis-a'));
  recorder.apply('bind_thread', bindingInput(analysisB, 'analysis-b'));
  const tick = recorder.apply('tick_dispatch', tickInput({ receipts: [analysisReceipt('project-a'), analysisReceipt('project-b')] }));
  const failedAction = requireAction(tick.output, 'project-a', 'development');
  const healthyAction = requireAction(tick.output, 'project-b', 'development');
  recorder.apply('bind_thread', bindingInput(failedAction, 'failed'));
  recorder.apply('record_task_result', {
    taskKey: failedAction.task_key,
    status: 'BLOCKED',
    evidenceRef: 'VRF:scenario:blocked',
    recordedAt: NOW
  });
  recorder.apply('record_target_result', {
    deliveryId: 'DEL-EXAMPLE-001',
    projectId: 'project-a',
    status: 'FAILED',
    evidenceRef: 'VRF:scenario:target-failed',
    commit: null,
    sourceHead: 'source1234567890',
    recordedAt: NOW
  });
  recorder.apply('bind_thread', bindingInput(healthyAction, 'healthy'));
  recorder.apply('record_task_result', {
    taskKey: healthyAction.task_key,
    evidenceRef: 'VRF:scenario:healthy',
    producedCommit: 'bbbbbbb123456789',
    recordedAt: NOW
  });
  const finished = recorder.finish();
  const delivery = finished.state.deliveries[0];
  const failedTarget = delivery.targets.find((item) => item.project_id === 'project-a');
  const healthyIntent = delivery.dispatch_intents.find((item) => item.task_key === healthyAction.task_key);
  assertions.push(assertion('SCN-PARTIAL-FAILED-ISOLATED', failedTarget.status === 'FAILED' && failedTarget.checkpoint === null, { target_status: failedTarget.status, checkpoint: failedTarget.checkpoint }));
  assertions.push(assertion('SCN-PARTIAL-HEALTHY-PROGRESSED', healthyIntent.status === 'COMPLETED', { intent_status: healthyIntent.status, produced_commit: healthyIntent.result?.produced_commit }));
  return { trace: finished.trace, assertions, summary: '一个目标失败且不推进 checkpoint，另一个目标仍能完成已批准任务。' };
}

function handoffContractScenario() {
  const snapshot = readJson(new URL('../examples/scenarios/jj-same-handoff-snapshot.json', import.meta.url));
  const schema = readJson(new URL('../.codex/skills/jj-same/references/handoff-snapshot.schema.json', import.meta.url));
  const recorder = createTraceRecorder({
    runId: 'SCN-same-handoff-contract-001',
    scenario: 'same-handoff-contract',
    initialState: snapshot,
    createdAt: NOW,
    context: { schema: '.codex/skills/jj-same/references/handoff-snapshot.schema.json' }
  });
  const validation = recorder.apply('validate_handoff_snapshot', { schema });
  const assertions = [
    assertion('SCN-HANDOFF-CONTRACT', validation.output.ok, { findings: validation.output.findings }),
    assertion('SCN-HANDOFF-FRESH', snapshot.seal_freshness === 'FRESH', { seal_freshness: snapshot.seal_freshness })
  ];
  const finished = recorder.finish();
  return { trace: finished.trace, assertions, summary: 'Handoff snapshot 满足 schema 关键字段、READY 条件和 READY_FOR_HANDOFF 验收条件。' };
}

function makeDispatchPlane({ targets, responsibilities = null }) {
  const input = readJson(new URL('../examples/project-family-control/control-plane.json', import.meta.url));
  const delivery = input.deliveries[0];
  delivery.targets = delivery.targets.filter((target) => targets.includes(target.project_id));
  delivery.lead_project = targets[0];
  delivery.lead_responsibilities = [];
  for (const target of delivery.targets) {
    const selected = responsibilities
      ? target.responsibilities.filter((item) => responsibilities.includes(item.name))
      : target.responsibilities;
    const analysisKey = `DEL-EXAMPLE-001/${target.project_id}/analysis/1`;
    for (const responsibility of selected) {
      if (responsibility.name === 'development') responsibility.depends_on = [analysisKey];
    }
    target.responsibilities = [
      { name: 'analysis', access: 'read', phase: 'planning', status: 'PENDING', attempt: 1, depends_on: [] },
      ...selected
    ];
  }
  return createControlPlane(input);
}

function tickInput(extra = {}) {
  return { deliveryId: 'DEL-EXAMPLE-001', capabilities: [...CAPABILITIES], now: NOW, ...extra };
}

function analysisReceipt(projectId) {
  return {
    receipt_id: `RCPT-ANL-${projectId}`,
    task_key: `DEL-EXAMPLE-001/${projectId}/analysis/1`,
    attempt: 1,
    kind: 'TASK_RESULT',
    status: 'COMPLETED',
    evidence_ref: `ANL-TARGET:${projectId}:scenario`,
    produced_commit: null,
    consumed_commit: null,
    reviewed_commit: null,
    findings: [],
    target_analysis: {
      analysis_ref: `ANL-TARGET:${projectId}:scenario`,
      evidence_ref: `ANL-TARGET:${projectId}:scenario`,
      difference_ref: `DIFF:${projectId}:scenario`,
      knowledge_refs: [`spec:${projectId}:scenario`],
      decision: 'DIRECT',
      decision_status: 'APPROVED',
      decision_origin: 'AUTO',
      decision_ref: `AUTO:${projectId}:scenario`,
      decided_at: NOW,
      attempt: 1,
      source_head: 'source1234567890',
      target_head: `target-${projectId}-1234567`,
      reference_commit: null,
      confidence: 'HIGH',
      unresolved: []
    },
    recorded_at: NOW
  };
}

function bindingInput(action, suffix) {
  return {
    taskKey: action.task_key,
    threadId: `thread-${suffix}`,
    projectId: action.project_id,
    hostId: 'host-scenario',
    agentName: action.agent_name,
    sandboxMode: action.sandbox_mode,
    environment: action.environment,
    effectiveSandboxMode: action.sandbox_mode,
    sandboxEvidenceRef: `SANDBOX:${suffix}`,
    worktree: action.access === 'write' ? `D:/scenario-worktrees/${action.project_id}-${suffix}` : null
  };
}

function bindingCandidate(action, suffix) {
  const input = bindingInput(action, suffix);
  return {
    task_key: input.taskKey,
    thread_id: input.threadId,
    project_id: input.projectId,
    host_id: input.hostId,
    agent_name: input.agentName,
    sandbox_mode: input.sandboxMode,
    effective_sandbox_mode: input.effectiveSandboxMode,
    sandbox_evidence_ref: input.sandboxEvidenceRef,
    environment: input.environment,
    worktree: input.worktree
  };
}

function requireAction(output, projectId, responsibility) {
  const action = output.actions?.find((item) => item.project_id === projectId && item.responsibility === responsibility);
  if (!action) throw new Error(`Missing host action for ${projectId}/${responsibility}; status=${output.status}`);
  return action;
}

function assertion(id, passed, evidence) {
  return {
    id,
    status: passed ? 'PASS' : 'FAIL',
    evidence,
    reason: passed ? null : `${id} 未满足。`,
    next_action: passed ? null : '检查最早违反的状态机不变量和对应 trace step。'
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const SCENARIOS = Object.freeze({
  'dispatch-happy-path': happyPathScenario,
  'dispatch-interrupted-resume': interruptedResumeScenario,
  'dispatch-partial-target-failure': partialFailureScenario,
  'same-handoff-contract': handoffContractScenario
});
