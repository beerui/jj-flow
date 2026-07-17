/**
 * Host-side, single-tick runtime for $jj-dispatch.
 *
 * This module intentionally does not start a timer, create a thread, or write
 * a file. The host supplies snapshots and persists the returned plane using
 * an expected-revision compare-and-swap.
 */
import {
  dispatchTasks,
  recordReviewResult,
  recordTaskResult,
  validateControlPlane
} from './dispatchControlPlane.mjs';

export const RECEIPT_KINDS = Object.freeze(['TASK_RESULT', 'REVIEW_RESULT']);
export const DIFFERENCE_DECISIONS = Object.freeze([
  'DIRECT',
  'ADAPT',
  'SYNC',
  'NO_CHANGE_REQUIRED',
  'BLOCKED'
]);

export function buildReceipt({
  receiptId,
  taskKey,
  attempt,
  kind,
  status,
  evidenceRef,
  producedCommit = null,
  consumedCommit = null,
  reviewedCommit = null,
  findings = [],
  recordedAt = new Date().toISOString()
} = {}) {
  return {
    receipt_id: receiptId,
    task_key: taskKey,
    attempt,
    kind,
    status,
    evidence_ref: evidenceRef,
    produced_commit: producedCommit,
    consumed_commit: consumedCommit,
    reviewed_commit: reviewedCommit,
    findings,
    recorded_at: recordedAt
  };
}

export function validateReceipt(receipt) {
  const errors = [];
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return { ok: false, errors: ['receipt must be an object'] };
  }
  for (const field of ['receipt_id', 'task_key', 'evidence_ref', 'recorded_at']) {
    if (typeof receipt[field] !== 'string' || !receipt[field].trim()) {
      errors.push(`receipt requires ${field}`);
    }
  }
  if (!Number.isInteger(receipt.attempt) || receipt.attempt < 1) errors.push('receipt requires positive attempt');
  if (!RECEIPT_KINDS.includes(receipt.kind)) errors.push(`receipt kind must be ${RECEIPT_KINDS.join(' or ')}`);
  if (!['COMPLETED', 'BLOCKED'].includes(receipt.status)) errors.push('receipt status must be COMPLETED or BLOCKED');
  if (!Number.isNaN(Date.parse(receipt.recorded_at || ''))) {
    // Keep date parsing intentionally permissive; the control-plane validator
    // performs the stricter ISO date-time check after applying the receipt.
  } else {
    errors.push('receipt recorded_at must be a date-time');
  }
  if (receipt.findings !== undefined && !Array.isArray(receipt.findings)) errors.push('receipt findings must be an array');
  return errors.length ? { ok: false, errors } : { ok: true, receipt_id: receipt.receipt_id };
}

export function tickDispatch(plane, {
  deliveryId,
  expectedRevision = plane?.revision,
  receipts = [],
  capabilities = [],
  enforceTargetAnalysis = true
} = {}) {
  const validation = validateControlPlane(plane);
  if (!validation.ok) return blocked(plane, 'INVALID_CONTROL_PLANE', validation.errors);
  if (!Number.isInteger(expectedRevision) || expectedRevision !== plane.revision) {
    return {
      ok: false,
      status: 'REVISION_CONFLICT',
      plane: structuredClone(plane),
      decision_required: [{ type: 'REVISION_CONFLICT', expected_revision: expectedRevision, actual_revision: plane.revision }],
      actions: [],
      next_wait: []
    };
  }
  const delivery = plane.deliveries.find((item) => item.delivery_id === deliveryId);
  if (!delivery) return blocked(plane, 'UNKNOWN_DELIVERY', [`Unknown delivery_id: ${deliveryId}`]);
  if (enforceTargetAnalysis) {
    const required = targetAnalysisDecisions(delivery);
    if (required.length) {
      return {
        ok: false,
        status: 'DECISION_REQUIRED',
        plane: structuredClone(plane),
        decision_required: required,
        actions: [],
        next_wait: []
      };
    }
  }

  let next = structuredClone(plane);
  const processed = new Set(next.runtime?.processed_receipt_ids || []);
  const applied = [];
  for (const receipt of receipts) {
    const receiptValidation = validateReceipt(receipt);
    if (!receiptValidation.ok) return blocked(plane, 'RECEIPT_INVALID', receiptValidation.errors, receipt.receipt_id);
    if (processed.has(receipt.receipt_id)) continue;
    try {
      const common = {
        taskKey: receipt.task_key,
        evidenceRef: receipt.evidence_ref,
        recordedAt: receipt.recorded_at
      };
      next = receipt.kind === 'REVIEW_RESULT'
        ? recordReviewResult(next, {
          ...common,
          outcome: receipt.outcome,
          reviewedCommit: receipt.reviewed_commit,
          findings: receipt.findings || [],
          resolvedFindingIds: receipt.resolved_finding_ids || []
        })
        : recordTaskResult(next, {
          ...common,
          status: receipt.status,
          producedCommit: receipt.produced_commit,
          consumedCommit: receipt.consumed_commit
        });
    } catch (error) {
      return blocked(plane, 'RECEIPT_REJECTED', [error.message], receipt.receipt_id);
    }
    processed.add(receipt.receipt_id);
    applied.push(receipt.receipt_id);
  }

  if (applied.length) {
    next.runtime = {
      ...(next.runtime || {}),
      processed_receipt_ids: [...processed],
      last_tick_revision: next.revision
    };
  }
  const dispatch = dispatchTasks(next, deliveryId, { capabilities });
  if (!dispatch.ok) {
    return {
      ok: true,
      status: dispatch.status,
      plane: next,
      actions: [],
      applied_receipts: applied,
      decision_required: dispatch.missing_capabilities?.length
        ? [{ type: 'CAPABILITY_REQUIRED', capabilities: dispatch.missing_capabilities }]
        : [],
      next_wait: pendingTaskKeys(next, deliveryId)
    };
  }
  next = dispatch.plane;
  const actions = dispatch.created.map((task) => ({
    type: 'CREATE_THREAD',
    task_key: task.task_key,
    project_id: task.project_id,
    responsibility: task.responsibility,
    access: task.access,
    worktree: task.worktree || null
  }));
  return {
    ok: true,
    status: actions.length ? 'DISPATCHING' : 'WAITING',
    plane: next,
    actions,
    applied_receipts: applied,
    decision_required: [],
    next_wait: pendingTaskKeys(next, deliveryId)
  };
}

export function resumeDispatch(plane, options = {}) {
  return tickDispatch(plane, options);
}

function targetAnalysisDecisions(delivery) {
  return (delivery.targets || []).flatMap((target) => {
    const analysis = target.analysis;
    if (!analysis) return [{ type: 'TARGET_ANALYSIS_REQUIRED', project_id: target.project_id }];
    if (!/^ANL-TARGET(?:-|:|$)/.test(analysis.analysis_ref || '')
      || !/^ANL-TARGET(?:-|:|$)/.test(analysis.evidence_ref || '')
      || typeof analysis.difference_ref !== 'string'
      || !analysis.difference_ref
      || !Array.isArray(analysis.knowledge_refs)
      || !analysis.knowledge_refs.length
      || !DIFFERENCE_DECISIONS.includes(analysis.decision)) {
      return [{ type: 'TARGET_ANALYSIS_INVALID', project_id: target.project_id }];
    }
    if (analysis.decision_status !== 'APPROVED') {
      return [{ type: 'TARGET_DIFFERENCE_APPROVAL_REQUIRED', project_id: target.project_id, decision: analysis.decision }];
    }
    return [];
  });
}

function pendingTaskKeys(plane, deliveryId) {
  const delivery = plane.deliveries.find((item) => item.delivery_id === deliveryId);
  return (delivery?.dispatch_intents || [])
    .filter((intent) => ['PENDING_THREAD', 'UNKNOWN', 'BOUND', 'BLOCKED'].includes(intent.status))
    .map((intent) => intent.task_key);
}

function blocked(plane, type, errors, receiptId = null) {
  return {
    ok: false,
    status: 'BLOCKED',
    plane: structuredClone(plane),
    decision_required: [{ type, errors, ...(receiptId ? { receipt_id: receiptId } : {}) }],
    actions: [],
    next_wait: []
  };
}
