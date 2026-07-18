import crypto from 'node:crypto';
import {
  approveDispatch,
  bindThread,
  markDispatchUnknown,
  previewDispatch,
  reconcileDispatch,
  recordReviewResult,
  recordTargetResult,
  recordTaskResult
} from './dispatchControlPlane.mjs';
import { tickDispatch } from './dispatchRuntime.mjs';
import { validateHandoffSnapshot } from './handoffContract.mjs';

export const TRACE_SCHEMA_VERSION = 'jj-flow/trace/1.0';

export function createTraceRecorder({ runId, scenario, deliveryId = null, initialState, createdAt, context = {} } = {}) {
  if (!runId || !scenario || !initialState || !createdAt) throw new Error('trace recorder requires runId, scenario, initialState, and createdAt');
  let state = structuredClone(initialState);
  const trace = {
    schema_version: TRACE_SCHEMA_VERSION,
    run_id: runId,
    scenario,
    delivery_id: deliveryId,
    created_at: createdAt,
    context: structuredClone(context),
    initial_state: structuredClone(initialState),
    initial_hash: semanticHash(initialState),
    steps: []
  };
  return {
    apply(operation, input = {}) {
      const beforeHash = semanticHash(state);
      const applied = applyTraceOperation(state, operation, input);
      const afterHash = semanticHash(applied.state);
      const outputHash = semanticHash(applied.output);
      const step = {
        sequence: trace.steps.length + 1,
        operation,
        input: structuredClone(input),
        revision_before: integerOrNull(state?.revision),
        revision_after: integerOrNull(applied.state?.revision),
        before_hash: beforeHash,
        after_hash: afterHash,
        output: structuredClone(applied.output),
        output_hash: outputHash,
        evidence_refs: collectEvidenceRefs(input)
      };
      trace.steps.push(step);
      state = structuredClone(applied.state);
      return { state: structuredClone(state), output: structuredClone(applied.output), step: structuredClone(step) };
    },
    finish() {
      return {
        trace: {
          ...structuredClone(trace),
          final_hash: semanticHash(state),
          external_actions_recorded: trace.steps.reduce((count, step) => count + (step.output?.actions?.length || 0), 0)
        },
        state: structuredClone(state)
      };
    }
  };
}

export function replayTrace(trace) {
  const findings = [];
  const add = (ruleId, step, reason, nextAction) => findings.push({
    rule_id: ruleId,
    step,
    reason,
    next_action: nextAction
  });
  if (!trace || trace.schema_version !== TRACE_SCHEMA_VERSION || !trace.initial_state || !Array.isArray(trace.steps)) {
    add('TRACE-STRUCTURE-001', 0, 'Trace envelope 结构或版本无效。', '使用当前 scenario runner 重新生成 trace。');
    return replayResult(findings, null, 0, 0);
  }
  let state = structuredClone(trace.initial_state);
  if (semanticHash(state) !== trace.initial_hash) {
    add('TRACE-HASH-001', 0, 'Initial state hash 不匹配。', '恢复未被修改的 trace initial_state。');
    return replayResult(findings, state, 0, 0);
  }
  let externalActionsSuppressed = 0;
  for (let index = 0; index < trace.steps.length; index += 1) {
    const step = trace.steps[index];
    const sequence = index + 1;
    if (step.sequence !== sequence) {
      add('TRACE-SEQUENCE-001', sequence, `Step sequence 应为 ${sequence}。`, '恢复连续且从 1 开始的 sequence。');
      break;
    }
    if (semanticHash(state) !== step.before_hash) {
      add('TRACE-HASH-002', sequence, 'Step before_hash 与当前状态不匹配。', '检查前一状态或 step 顺序是否被修改。');
      break;
    }
    let applied;
    try {
      applied = applyTraceOperation(state, step.operation, step.input);
    } catch (error) {
      add('TRACE-REPLAY-001', sequence, `纯重放失败：${error.message}`, '修复输入与协议版本，禁止用外部副作用绕过。');
      break;
    }
    if (semanticHash(applied.state) !== step.after_hash) {
      add('TRACE-HASH-003', sequence, 'Step after_hash 与纯状态转换结果不匹配。', '检查 runtime 漂移或 trace 篡改。');
      break;
    }
    if (semanticHash(applied.output) !== step.output_hash || semanticHash(step.output) !== step.output_hash) {
      add('TRACE-OUTPUT-001', sequence, 'Step output 与记录的 action/decision/report 不匹配。', '重新生成 trace 或调查 runtime 输出漂移。');
      break;
    }
    externalActionsSuppressed += applied.output?.actions?.length || 0;
    state = structuredClone(applied.state);
  }
  if (!findings.length && semanticHash(state) !== trace.final_hash) {
    add('TRACE-HASH-004', trace.steps.length, 'Final hash 不匹配。', '检查 trace 是否截断或被修改。');
  }
  return replayResult(findings, state, findings.length ? findings[0].step - 1 : trace.steps.length, externalActionsSuppressed);
}

export function renderTraceExplanation(trace, replay = replayTrace(trace)) {
  const lines = [
    `trace ${trace?.run_id || '(unknown)'}: ${replay.status}`,
    `scenario: ${trace?.scenario || '(unknown)'}`,
    `steps: ${replay.steps_replayed}/${trace?.steps?.length || 0}`,
    `external actions suppressed: ${replay.external_actions_suppressed}`
  ];
  for (const step of trace?.steps || []) {
    lines.push(`${step.sequence}. ${step.operation} r${step.revision_before ?? '-'} -> r${step.revision_after ?? '-'} (${step.output?.status || 'OK'})`);
  }
  for (const finding of replay.findings) {
    lines.push(`- [${finding.rule_id}] step ${finding.step}: ${finding.reason}`);
    lines.push(`  next: ${finding.next_action}`);
  }
  return `${lines.join('\n')}\n`;
}

export function semanticHash(value) {
  const canonical = canonicalize(value);
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex')}`;
}

function applyTraceOperation(state, operation, input) {
  switch (operation) {
    case 'preview_dispatch': {
      const output = previewDispatch(state, input.deliveryId);
      return { state: structuredClone(state), output: summarizePreview(output) };
    }
    case 'approve_dispatch': {
      const next = approveDispatch(state, input);
      return { state: next, output: { status: 'APPROVED', revision: next.revision, delivery_id: input.deliveryId } };
    }
    case 'tick_dispatch': {
      const result = tickDispatch(state, input);
      return { state: result.plane, output: summarizeTick(result) };
    }
    case 'bind_thread': {
      const next = bindThread(state, input);
      return { state: next, output: { status: 'BOUND', revision: next.revision, task_key: input.taskKey, thread_id: input.threadId } };
    }
    case 'mark_dispatch_unknown': {
      const next = markDispatchUnknown(state, input);
      return { state: next, output: { status: 'UNKNOWN', revision: next.revision, task_key: input.taskKey } };
    }
    case 'reconcile_dispatch': {
      const result = reconcileDispatch(state, input);
      return { state: result.plane, output: { status: result.status, action: result.action, task_key: result.task_key, reason: result.reason } };
    }
    case 'record_task_result': {
      const next = recordTaskResult(state, input);
      return { state: next, output: { status: input.status || 'COMPLETED', revision: next.revision, task_key: input.taskKey, evidence_ref: input.evidenceRef } };
    }
    case 'record_review_result': {
      const next = recordReviewResult(state, input);
      return { state: next, output: { status: input.outcome, revision: next.revision, task_key: input.taskKey, evidence_ref: input.evidenceRef } };
    }
    case 'record_target_result': {
      const next = recordTargetResult(state, input);
      return { state: next, output: { status: input.status, revision: next.revision, project_id: input.projectId, evidence_ref: input.evidenceRef } };
    }
    case 'validate_handoff_snapshot': {
      const validation = validateHandoffSnapshot(state, input.schema);
      return { state: structuredClone(state), output: validation };
    }
    default:
      throw new Error(`Unknown trace operation: ${operation}`);
  }
}

function summarizePreview(result) {
  return {
    status: result.status,
    delivery_id: result.delivery_id,
    tasks: (result.tasks || []).map(({ task_key, project_id, responsibility, access, phase, attempt, depends_on }) => ({
      task_key,
      project_id,
      responsibility,
      access,
      phase,
      attempt,
      depends_on
    }))
  };
}

function summarizeTick(result) {
  return {
    ok: result.ok,
    status: result.status,
    revision: result.plane?.revision ?? null,
    actions: structuredClone(result.actions || []),
    decision_required: structuredClone(result.decision_required || []),
    next_wait: structuredClone(result.next_wait || []),
    applied_receipts: structuredClone(result.applied_receipts || [])
  };
}

function replayResult(findings, state, stepsReplayed, externalActionsSuppressed) {
  return {
    ok: findings.length === 0,
    status: findings.length === 0 ? 'PASS' : 'FAIL',
    steps_replayed: Math.max(0, stepsReplayed),
    external_actions_suppressed: externalActionsSuppressed,
    final_hash: state ? semanticHash(state) : null,
    findings
  };
}

function canonicalize(value, key = '') {
  if (key === 'at' || key === 'bound_at') return '<volatile-time>';
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((item) => [item, canonicalize(value[item], item)]));
  }
  return value;
}

function collectEvidenceRefs(value) {
  const refs = [];
  visit(value, '', refs);
  return [...new Set(refs)].sort();
}

function visit(value, key, refs) {
  if (typeof value === 'string' && (key.endsWith('_ref') || key.endsWith('Ref'))) refs.push(value);
  else if (Array.isArray(value)) value.forEach((item) => visit(item, key, refs));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([childKey, child]) => visit(child, childKey, refs));
}

function integerOrNull(value) {
  return Number.isInteger(value) ? value : null;
}
