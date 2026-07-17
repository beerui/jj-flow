/**
 * Host-side, single-tick runtime for $jj-dispatch.
 *
 * This module intentionally does not start a timer or create a thread.
 * Persistence uses expected-revision compare-and-swap via persistPlaneCas.
 */
import fs from 'node:fs';
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
  if (Number.isNaN(Date.parse(receipt.recorded_at || ''))) {
    errors.push('receipt recorded_at must be a date-time');
  }
  if (receipt.findings !== undefined && !Array.isArray(receipt.findings)) errors.push('receipt findings must be an array');
  const keyAttempt = parseAttemptFromTaskKey(receipt.task_key);
  if (keyAttempt !== null && Number.isInteger(receipt.attempt) && keyAttempt !== receipt.attempt) {
    errors.push(`receipt attempt ${receipt.attempt} does not match task_key attempt ${keyAttempt}`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, receipt_id: receipt.receipt_id };
}

export function tickDispatch(plane, {
  deliveryId,
  expectedRevision = plane?.revision,
  receipts = [],
  capabilities = [],
  // Always enforce for targets. Kept for API compatibility; false is ignored.
  enforceTargetAnalysis = true
} = {}) {
  void enforceTargetAnalysis;
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

  const analysis = classifyTargetAnalysis(delivery);
  const eligibleProjects = buildEligibleProjects(delivery, analysis.readyProjectIds);
  // If no target is ready and at least one target exists, hard-stop with DECISION_REQUIRED.
  // Lead-only projects may still proceed when they are not targets.
  const hasTargets = (delivery.targets || []).length > 0;
  if (hasTargets && analysis.readyProjectIds.size === 0) {
    return {
      ok: false,
      status: 'DECISION_REQUIRED',
      plane: structuredClone(plane),
      decision_required: analysis.decisionRequired,
      actions: [],
      next_wait: []
    };
  }

  let next = structuredClone(plane);
  const processed = new Set(next.runtime?.processed_receipt_ids || []);
  const applied = [];
  for (const receipt of receipts) {
    const receiptValidation = validateReceipt(receipt);
    if (!receiptValidation.ok) return blocked(plane, 'RECEIPT_INVALID', receiptValidation.errors, receipt.receipt_id);
    if (processed.has(receipt.receipt_id)) continue;
    const attemptError = bindReceiptAttempt(next, deliveryId, receipt);
    if (attemptError) return blocked(plane, 'RECEIPT_REJECTED', [attemptError], receipt.receipt_id);
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

  const dispatch = dispatchTasks(next, deliveryId, {
    capabilities,
    eligibleProjects
  });
  if (!dispatch.ok) {
    return {
      ok: true,
      status: dispatch.status,
      plane: next,
      actions: [],
      applied_receipts: applied,
      decision_required: [
        ...analysis.decisionRequired,
        ...(dispatch.missing_capabilities?.length
          ? [{ type: 'CAPABILITY_REQUIRED', capabilities: dispatch.missing_capabilities }]
          : [])
      ],
      next_wait: pendingTaskKeys(next, deliveryId)
    };
  }
  next = dispatch.plane;
  const actions = collectCreateThreadActions(dispatch);
  return {
    ok: true,
    status: actions.length ? 'DISPATCHING' : (analysis.decisionRequired.length ? 'PARTIAL' : 'WAITING'),
    plane: next,
    actions,
    applied_receipts: applied,
    decision_required: analysis.decisionRequired,
    next_wait: pendingTaskKeys(next, deliveryId)
  };
}

export function resumeDispatch(plane, options = {}) {
  return tickDispatch(plane, options);
}

/**
 * Atomic file CAS for control-plane manifests.
 * Hosts should call this after a successful tick when they want durable writeback.
 */
export function persistPlaneCas({
  manifestPath,
  expectedRevision,
  nextPlane,
  readFile = fs.readFileSync,
  writeFile = fs.writeFileSync,
  rename = fs.renameSync,
  pid = process.pid
} = {}) {
  if (!manifestPath) throw new Error('manifestPath is required');
  if (!Number.isInteger(expectedRevision)) {
    return { ok: false, status: 'REVISION_CONFLICT', persisted: false, errors: ['expectedRevision must be an integer'] };
  }
  if (!nextPlane || typeof nextPlane !== 'object') {
    return { ok: false, status: 'BLOCKED', persisted: false, errors: ['nextPlane must be an object'] };
  }

  let current;
  try {
    current = JSON.parse(readFile(manifestPath, 'utf8'));
  } catch (error) {
    return { ok: false, status: 'BLOCKED', persisted: false, errors: [`failed to read manifest: ${error.message}`] };
  }

  if (!Number.isInteger(current.revision) || current.revision !== expectedRevision) {
    return {
      ok: false,
      status: 'REVISION_CONFLICT',
      persisted: false,
      plane: current,
      decision_required: [{
        type: 'REVISION_CONFLICT',
        expected_revision: expectedRevision,
        actual_revision: current.revision
      }]
    };
  }

  if (nextPlane.revision === expectedRevision) {
    return { ok: true, status: 'UNCHANGED', persisted: false, plane: current };
  }

  const temp = `${manifestPath}.tmp-${pid}`;
  writeFile(temp, `${JSON.stringify(nextPlane, null, 2)}\n`, 'utf8');
  // Re-read immediately before rename to shrink the race window.
  const latest = JSON.parse(readFile(manifestPath, 'utf8'));
  if (!Number.isInteger(latest.revision) || latest.revision !== expectedRevision) {
    try { fs.unlinkSync(temp); } catch { /* ignore */ }
    return {
      ok: false,
      status: 'REVISION_CONFLICT',
      persisted: false,
      plane: latest,
      decision_required: [{
        type: 'REVISION_CONFLICT',
        expected_revision: expectedRevision,
        actual_revision: latest.revision
      }]
    };
  }
  rename(temp, manifestPath);
  return { ok: true, status: 'PERSISTED', persisted: true, plane: nextPlane };
}

function classifyTargetAnalysis(delivery) {
  const decisionRequired = [];
  const readyProjectIds = new Set();
  for (const target of delivery.targets || []) {
    const analysis = target.analysis;
    if (!analysis) {
      decisionRequired.push({ type: 'TARGET_ANALYSIS_REQUIRED', project_id: target.project_id });
      continue;
    }
    if (!/^ANL-TARGET(?:-|:|$)/.test(analysis.analysis_ref || '')
      || !/^ANL-TARGET(?:-|:|$)/.test(analysis.evidence_ref || '')
      || typeof analysis.difference_ref !== 'string'
      || !analysis.difference_ref
      || !Array.isArray(analysis.knowledge_refs)
      || !analysis.knowledge_refs.length
      || !DIFFERENCE_DECISIONS.includes(analysis.decision)) {
      decisionRequired.push({ type: 'TARGET_ANALYSIS_INVALID', project_id: target.project_id });
      continue;
    }
    if (analysis.decision_status !== 'APPROVED') {
      decisionRequired.push({
        type: 'TARGET_DIFFERENCE_APPROVAL_REQUIRED',
        project_id: target.project_id,
        decision: analysis.decision
      });
      continue;
    }
    readyProjectIds.add(target.project_id);
  }
  return { decisionRequired, readyProjectIds };
}

function buildEligibleProjects(delivery, readyTargetIds) {
  const eligible = new Set(readyTargetIds);
  // Lead and non-target projects are not gated by target ANL-TARGET.
  if (delivery.lead_project && !(delivery.targets || []).some((target) => target.project_id === delivery.lead_project)) {
    eligible.add(delivery.lead_project);
  }
  return eligible;
}

function collectCreateThreadActions(dispatch) {
  const byKey = new Map();
  for (const intent of [...(dispatch.created || []), ...(dispatch.reused || [])]) {
    if (!intent || intent.status !== 'PENDING_THREAD') continue;
    byKey.set(intent.task_key, {
      type: 'CREATE_THREAD',
      task_key: intent.task_key,
      project_id: intent.project_id,
      responsibility: intent.responsibility,
      access: intent.access,
      worktree: intent.worktree || null
    });
  }
  return [...byKey.values()];
}

function bindReceiptAttempt(plane, deliveryId, receipt) {
  const keyAttempt = parseAttemptFromTaskKey(receipt.task_key);
  if (keyAttempt === null) return `receipt task_key is invalid: ${receipt.task_key}`;
  if (keyAttempt !== receipt.attempt) {
    return `receipt attempt ${receipt.attempt} does not match task_key attempt ${keyAttempt}`;
  }
  const delivery = plane.deliveries.find((item) => item.delivery_id === deliveryId);
  const intent = (delivery?.dispatch_intents || []).find((item) => item.task_key === receipt.task_key);
  if (intent && Number.isInteger(intent.attempt) && intent.attempt !== receipt.attempt) {
    return `receipt attempt ${receipt.attempt} does not match intent attempt ${intent.attempt}`;
  }
  return null;
}

function parseAttemptFromTaskKey(taskKey) {
  if (typeof taskKey !== 'string') return null;
  const parts = taskKey.split('/');
  if (parts.length < 4) return null;
  const attempt = Number(parts[parts.length - 1]);
  return Number.isInteger(attempt) && attempt > 0 ? attempt : null;
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
