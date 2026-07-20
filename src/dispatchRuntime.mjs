/**
 * Host-side single-tick runtime for $jj-dispatch.
 *
 * It computes state transitions and host actions, but never starts a daemon or
 * creates a thread itself. Durable writes use persistPlaneCas().
 */
import fs from 'node:fs';
import {
  dispatchTasks,
  recordReviewResult,
  recordTargetResult,
  recordTaskResult,
  REVIEW_OUTCOMES,
  TARGET_DIFFERENCE_DECISIONS,
  validateControlPlane
} from './dispatchControlPlane.mjs';
import {
  describeHostAction,
  HOST_ACTION_TYPES,
  RECEIPT_KINDS,
  RECEIPT_STATUSES
} from './dispatchHostContract.mjs';

export { HOST_ACTION_TYPES, RECEIPT_KINDS, RECEIPT_STATUSES };
export const DIFFERENCE_DECISIONS = TARGET_DIFFERENCE_DECISIONS;

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
  outcome,
  findings = [],
  resolvedFindingIds = [],
  targetAnalysis = null,
  recordedAt = new Date().toISOString()
} = {}) {
  const receipt = {
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
  if (outcome !== undefined) receipt.outcome = outcome;
  if (resolvedFindingIds.length) receipt.resolved_finding_ids = resolvedFindingIds;
  if (targetAnalysis) receipt.target_analysis = structuredClone(targetAnalysis);
  return receipt;
}

export function validateReceipt(receipt) {
  const errors = [];
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return { ok: false, errors: ['receipt must be an object'] };
  }
  for (const field of ['receipt_id', 'task_key', 'evidence_ref', 'recorded_at']) {
    if (!isNonEmptyString(receipt[field])) errors.push(`receipt requires ${field}`);
  }
  if (!Number.isInteger(receipt.attempt) || receipt.attempt < 1) errors.push('receipt requires positive attempt');
  if (!RECEIPT_KINDS.includes(receipt.kind)) errors.push(`receipt kind must be ${RECEIPT_KINDS.join(' or ')}`);
  if (!RECEIPT_STATUSES.includes(receipt.status)) errors.push(`receipt status must be ${RECEIPT_STATUSES.join(' or ')}`);
  if (Number.isNaN(Date.parse(receipt.recorded_at || ''))) errors.push('receipt recorded_at must be a date-time');
  if (receipt.findings !== undefined && !Array.isArray(receipt.findings)) errors.push('receipt findings must be an array');

  const keyAttempt = parseAttemptFromTaskKey(receipt.task_key);
  if (keyAttempt === null) errors.push(`receipt task_key is invalid: ${receipt.task_key}`);
  else if (Number.isInteger(receipt.attempt) && keyAttempt !== receipt.attempt) {
    errors.push(`receipt attempt ${receipt.attempt} does not match task_key attempt ${keyAttempt}`);
  }

  if (receipt.kind === 'REVIEW_RESULT') {
    if (receipt.status !== 'COMPLETED') errors.push('REVIEW_RESULT status must be COMPLETED');
    if (!REVIEW_OUTCOMES.includes(receipt.outcome)) errors.push(`REVIEW_RESULT requires ${REVIEW_OUTCOMES.join(' or ')} outcome`);
    if (!isNonEmptyString(receipt.reviewed_commit) || receipt.reviewed_commit.length < 7) {
      errors.push('REVIEW_RESULT requires reviewed_commit');
    }
    if (receipt.target_analysis) errors.push('REVIEW_RESULT cannot contain target_analysis');
  }
  if (receipt.target_analysis !== undefined && receipt.target_analysis !== null
    && (!receipt.target_analysis || typeof receipt.target_analysis !== 'object' || Array.isArray(receipt.target_analysis))) {
    errors.push('receipt target_analysis must be an object or null');
  }
  return errors.length ? { ok: false, errors } : { ok: true, receipt_id: receipt.receipt_id };
}

export function tickDispatch(plane, {
  deliveryId,
  expectedRevision = plane?.revision,
  receipts = [],
  targetApprovals = [],
  capabilities = [],
  now = new Date().toISOString()
} = {}) {
  const validation = validateControlPlane(plane);
  if (!validation.ok) return blocked(plane, 'INVALID_CONTROL_PLANE', validation.errors);
  if (!Number.isInteger(expectedRevision) || expectedRevision !== plane.revision) {
    return {
      ok: false,
      status: 'REVISION_CONFLICT',
      state_changed: false,
      plane: structuredClone(plane),
      decision_required: [{ type: 'REVISION_CONFLICT', expected_revision: expectedRevision, actual_revision: plane.revision }],
      actions: [],
      applied_receipts: [],
      next_wait: []
    };
  }
  if (Number.isNaN(Date.parse(now || ''))) return blocked(plane, 'INVALID_TICK_TIME', ['now must be a date-time']);
  const sourceDelivery = plane.deliveries.find((item) => item.delivery_id === deliveryId);
  if (!sourceDelivery) return blocked(plane, 'UNKNOWN_DELIVERY', [`Unknown delivery_id: ${deliveryId}`]);

  let next = structuredClone(plane);
  const processedIds = new Set(next.runtime?.processed_receipt_ids || []);
  const processedEntries = new Map((next.runtime?.processed_receipts || []).map((entry) => [entry.receipt_id, entry]));
  const applied = [];

  for (const receipt of receipts) {
    const receiptValidation = validateReceipt(receipt);
    if (!receiptValidation.ok) return blocked(plane, 'RECEIPT_INVALID', receiptValidation.errors, receipt?.receipt_id);
    const identity = receiptIdentity(receipt);
    const previous = processedEntries.get(receipt.receipt_id);
    if (previous) {
      if (!sameReceiptIdentity(previous, identity)) {
        return blocked(plane, 'RECEIPT_REPLAY_CONFLICT', [`receipt_id ${receipt.receipt_id} was already used by another receipt`], receipt.receipt_id);
      }
      continue;
    }
    if (processedIds.has(receipt.receipt_id)) continue;

    const found = findDeliveryIntent(next, deliveryId, receipt.task_key);
    if (!found) {
      return blocked(plane, 'RECEIPT_REJECTED', [`receipt task ${receipt.task_key} does not belong to delivery ${deliveryId}`], receipt.receipt_id);
    }
    if (found.intent.attempt !== receipt.attempt) {
      return blocked(plane, 'RECEIPT_REJECTED', [`receipt attempt ${receipt.attempt} does not match intent attempt ${found.intent.attempt}`], receipt.receipt_id);
    }

    try {
      const common = {
        taskKey: receipt.task_key,
        evidenceRef: receipt.evidence_ref,
        recordedAt: receipt.recorded_at
      };
      if (receipt.kind === 'REVIEW_RESULT') {
        next = recordReviewResult(next, {
          ...common,
          outcome: receipt.outcome,
          reviewedCommit: receipt.reviewed_commit,
          findings: receipt.findings || [],
          resolvedFindingIds: receipt.resolved_finding_ids || []
        });
      } else {
        const analysisTask = isAnalysisResponsibility(found.intent);
        if (analysisTask && receipt.status === 'COMPLETED' && !receipt.target_analysis) {
          throw new Error(`analysis task ${receipt.task_key} requires target_analysis payload`);
        }
        if (!analysisTask && receipt.target_analysis) {
          throw new Error(`non-analysis task ${receipt.task_key} cannot produce target_analysis`);
        }
        if (receipt.target_analysis) validateTargetAnalysisReceipt(receipt, found.intent);
        next = recordTaskResult(next, {
          ...common,
          status: receipt.status,
          producedCommit: receipt.produced_commit,
          consumedCommit: receipt.consumed_commit
        });
        if (receipt.target_analysis) {
          const target = requireTarget(next, deliveryId, found.intent.project_id);
          target.analysis = structuredClone(receipt.target_analysis);
          appendRuntimeEvent(next, 'TARGET_ANALYSIS_RECORDED', {
            delivery_id: deliveryId,
            project_id: target.project_id,
            task_key: receipt.task_key,
            analysis_ref: receipt.target_analysis.analysis_ref,
            decision: receipt.target_analysis.decision
          }, receipt.recorded_at);
        }
      }
    } catch (error) {
      return blocked(plane, 'RECEIPT_REJECTED', [error.message], receipt.receipt_id);
    }
    processedIds.add(receipt.receipt_id);
    processedEntries.set(receipt.receipt_id, identity);
    applied.push(receipt.receipt_id);
  }

  for (const approval of targetApprovals) {
    try {
      next = approveTargetDecision(next, deliveryId, approval, now);
    } catch (error) {
      return blocked(plane, 'TARGET_APPROVAL_REJECTED', [error.message]);
    }
  }

  let gate;
  try {
    gate = buildTargetGate(next, deliveryId);
    for (const projectId of gate.noChangeProjectIds) {
      const target = requireTarget(next, deliveryId, projectId);
      if (['NO_CHANGE_REQUIRED', 'VERIFIED'].includes(target.status)) continue;
      const analysis = target.analysis;
      next = recordTargetResult(next, {
        deliveryId,
        projectId,
        status: 'NO_CHANGE_REQUIRED',
        evidenceRef: analysis.evidence_ref,
        sourceHead: analysis.source_head,
        sourceBranch: analysis.source_branch || null,
        targetBranch: analysis.target_branch || null,
        targetHead: analysis.target_head,
        snapshotRef: analysis.snapshot_ref || null,
        snapshotHash: analysis.snapshot_hash || null,
        handoffRef: analysis.handoff_ref || null,
        freshness: analysis.freshness || null,
        differenceRef: analysis.difference_ref,
        analysisRef: analysis.analysis_ref,
        unresolved: [],
        recordedAt: analysis.decided_at || now
      });
    }
    gate = buildTargetGate(next, deliveryId);
  } catch (error) {
    return blocked(plane, 'TARGET_ANALYSIS_REJECTED', [error.message]);
  }

  const postReceiptValidation = validateControlPlane(next);
  if (!postReceiptValidation.ok) return blocked(plane, 'INVALID_CONTROL_PLANE', postReceiptValidation.errors);

  const dispatch = dispatchTasks(next, deliveryId, {
    capabilities,
    now,
    allowedTaskKeys: gate.allowedTaskKeys
  });
  if (!dispatch.ok) {
    const changed = next.revision !== plane.revision;
    if (changed) next = updateRuntime(next, plane, deliveryId, processedIds, processedEntries, now);
    return {
      ok: false,
      status: dispatch.status,
      reason: dispatch.reason,
      state_changed: changed,
      plane: next,
      actions: [],
      applied_receipts: applied,
      decision_required: [
        ...gate.decisionRequired,
        ...(dispatch.missing_capabilities?.length
          ? [{ type: 'CAPABILITY_REQUIRED', capabilities: dispatch.missing_capabilities }]
          : [])
      ],
      next_wait: collectNextWait(next, deliveryId, dispatch.deferred || [])
    };
  }

  next = dispatch.plane;
  const actions = collectHostActions(dispatch, gate.allowedTaskKeys);
  const changed = next.revision !== plane.revision;
  if (changed) next = updateRuntime(next, plane, deliveryId, processedIds, processedEntries, now);
  const decisionRequired = gate.decisionRequired;
  const status = actions.length
    ? (decisionRequired.length ? 'DISPATCHING_WITH_DECISIONS' : 'DISPATCHING')
    : decisionRequired.length
      ? 'DECISION_REQUIRED'
      : dispatch.deferred?.length
        ? 'WAITING_DEPENDENCY'
        : 'WAITING';

  return {
    ok: true,
    status,
    state_changed: changed,
    plane: next,
    actions,
    applied_receipts: applied,
    decision_required: decisionRequired,
    next_wait: collectNextWait(next, deliveryId, dispatch.deferred || [])
  };
}

export function resumeDispatch(plane, options = {}) {
  return tickDispatch(plane, options);
}

/**
 * Cooperative file CAS. The lock makes compare + replace one critical section
 * for every jj-flow writer using this persistence boundary.
 */
export function persistPlaneCas({
  manifestPath,
  expectedRevision,
  nextPlane,
  readFile = fs.readFileSync,
  writeFile = fs.writeFileSync,
  rename = fs.renameSync,
  openFile = fs.openSync,
  closeFile = fs.closeSync,
  unlink = fs.unlinkSync,
  pid = process.pid
} = {}) {
  if (!manifestPath) throw new Error('manifestPath is required');
  if (!Number.isInteger(expectedRevision)) {
    return { ok: false, status: 'REVISION_CONFLICT', persisted: false, errors: ['expectedRevision must be an integer'] };
  }
  const validation = validateControlPlane(nextPlane);
  if (!validation.ok) return { ok: false, status: 'BLOCKED', persisted: false, errors: validation.errors };

  const lockPath = `${manifestPath}.lock`;
  const temp = `${manifestPath}.tmp-${pid}-${Date.now()}`;
  let lockFd = null;
  try {
    try {
      lockFd = openFile(lockPath, 'wx');
    } catch (error) {
      return { ok: false, status: 'LOCKED', persisted: false, errors: [`manifest lock unavailable: ${error.message}`] };
    }
    const current = JSON.parse(readFile(manifestPath, 'utf8'));
    if (!Number.isInteger(current.revision) || current.revision !== expectedRevision) {
      return revisionConflict(expectedRevision, current);
    }
    if (nextPlane.revision === expectedRevision) {
      return { ok: true, status: 'UNCHANGED', persisted: false, plane: current };
    }
    if (!Number.isInteger(nextPlane.revision) || nextPlane.revision <= expectedRevision) {
      return { ok: false, status: 'BLOCKED', persisted: false, errors: ['nextPlane revision must advance expectedRevision'] };
    }
    writeFile(temp, `${JSON.stringify(nextPlane, null, 2)}\n`, 'utf8');
    const latest = JSON.parse(readFile(manifestPath, 'utf8'));
    if (latest.revision !== expectedRevision) return revisionConflict(expectedRevision, latest);
    rename(temp, manifestPath);
    return { ok: true, status: 'PERSISTED', persisted: true, plane: nextPlane };
  } catch (error) {
    return { ok: false, status: 'BLOCKED', persisted: false, errors: [error.message] };
  } finally {
    // Only release a lock we acquired; never delete another writer's lock file.
    if (lockFd !== null) {
      try { closeFile(lockFd); } catch { /* ignore cleanup errors */ }
      try { unlink(lockPath); } catch { /* ignore cleanup errors */ }
    }
    try { unlink(temp); } catch { /* temp was renamed or never created */ }
  }
}

function buildTargetGate(plane, deliveryId) {
  const delivery = plane.deliveries.find((item) => item.delivery_id === deliveryId);
  const allowedTaskKeys = new Set();
  const decisionRequired = [];
  const noChangeProjectIds = new Set();

  if (delivery.lead_project && !(delivery.targets || []).some((target) => target.project_id === delivery.lead_project)) {
    for (const responsibility of delivery.lead_responsibilities || []) {
      allowedTaskKeys.add(taskKey(deliveryId, delivery.lead_project, responsibility));
    }
  }

  for (const target of delivery.targets || []) {
    const responsibilities = target.responsibilities || [];
    const analysisResponsibilities = responsibilities.filter(isAnalysisResponsibility);
    if (analysisResponsibilities.length !== 1) {
      decisionRequired.push({
        type: 'TARGET_ANALYSIS_TASK_REQUIRED',
        project_id: target.project_id,
        count: analysisResponsibilities.length
      });
      continue;
    }
    const analysisResponsibility = analysisResponsibilities[0];
    const analysisTaskKey = taskKey(deliveryId, target.project_id, analysisResponsibility);
    allowedTaskKeys.add(analysisTaskKey);
    if (analysisResponsibility.access !== 'read' || analysisResponsibility.phase !== 'planning') {
      decisionRequired.push({ type: 'TARGET_ANALYSIS_TASK_INVALID', project_id: target.project_id });
      continue;
    }
    const invalidDependency = responsibilities
      .filter((item) => item !== analysisResponsibility)
      .find((item) => !dependsTransitivelyOn(responsibilities, item, analysisTaskKey, deliveryId, target.project_id));
    if (invalidDependency) {
      decisionRequired.push({
        type: 'TARGET_ANALYSIS_DEPENDENCY_REQUIRED',
        project_id: target.project_id,
        responsibility: invalidDependency.name
      });
      continue;
    }
    if (!target.analysis) {
      decisionRequired.push({ type: 'TARGET_ANALYSIS_REQUIRED', project_id: target.project_id });
      continue;
    }
    const analysis = target.analysis;
    if (analysis.attempt !== analysisResponsibility.attempt) {
      decisionRequired.push({ type: 'TARGET_ANALYSIS_STALE', project_id: target.project_id });
      continue;
    }
    const currentReference = delivery.reference_implementation?.commit || null;
    if (currentReference && analysis.reference_commit !== currentReference) {
      decisionRequired.push({ type: 'TARGET_ANALYSIS_STALE', project_id: target.project_id, reference_commit: currentReference });
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
    if (analysis.decision === 'NO_CHANGE_REQUIRED') {
      noChangeProjectIds.add(target.project_id);
      continue;
    }
    if (analysis.decision === 'BLOCKED') {
      decisionRequired.push({ type: 'TARGET_BLOCKED', project_id: target.project_id, analysis_ref: analysis.analysis_ref });
      continue;
    }
    for (const responsibility of responsibilities) {
      allowedTaskKeys.add(taskKey(deliveryId, target.project_id, responsibility));
    }
  }
  return { allowedTaskKeys, decisionRequired, noChangeProjectIds };
}

function approveTargetDecision(plane, deliveryId, approval, fallbackNow) {
  if (!approval || typeof approval !== 'object' || Array.isArray(approval)) throw new Error('target approval must be an object');
  const target = requireTarget(plane, deliveryId, approval.project_id);
  if (!target.analysis) throw new Error(`target ${approval.project_id} has no analysis to approve`);
  if (target.analysis.decision_status === 'APPROVED') return plane;
  if (!isNonEmptyString(approval.decision_ref)) throw new Error('target approval requires decision_ref');
  const approvedAt = approval.approved_at || fallbackNow;
  if (Number.isNaN(Date.parse(approvedAt || ''))) throw new Error('target approval approved_at must be a date-time');
  const next = structuredClone(plane);
  const nextTarget = requireTarget(next, deliveryId, approval.project_id);
  nextTarget.analysis.decision_status = 'APPROVED';
  nextTarget.analysis.decision_origin = 'HUMAN';
  nextTarget.analysis.decision_ref = approval.decision_ref;
  nextTarget.analysis.decided_at = approvedAt;
  next.revision += 1;
  appendRuntimeEvent(next, 'TARGET_ANALYSIS_APPROVED', {
    delivery_id: deliveryId,
    project_id: approval.project_id,
    analysis_ref: nextTarget.analysis.analysis_ref,
    decision: nextTarget.analysis.decision,
    decision_ref: approval.decision_ref
  }, approvedAt);
  const validation = validateControlPlane(next);
  if (!validation.ok) throw new Error(`target approval produced invalid control plane: ${validation.errors.join('; ')}`);
  return next;
}

function validateTargetAnalysisReceipt(receipt, intent) {
  const analysis = receipt.target_analysis;
  for (const field of ['analysis_ref', 'evidence_ref', 'difference_ref', 'source_head', 'target_head']) {
    if (!isNonEmptyString(analysis[field])) throw new Error(`target_analysis requires ${field}`);
  }
  if (!/^ANL-TARGET(?:-|:|$)/.test(analysis.analysis_ref)
    || analysis.analysis_ref !== analysis.evidence_ref
    || analysis.evidence_ref !== receipt.evidence_ref) {
    throw new Error('target_analysis evidence must match receipt ANL-TARGET evidence');
  }
  if (!Array.isArray(analysis.knowledge_refs) || analysis.knowledge_refs.length === 0
    || analysis.knowledge_refs.some((ref) => !isNonEmptyString(ref))) {
    throw new Error('target_analysis requires knowledge_refs');
  }
  if (!DIFFERENCE_DECISIONS.includes(analysis.decision)) throw new Error(`invalid target_analysis decision ${analysis.decision}`);
  if (!['PENDING', 'APPROVED'].includes(analysis.decision_status)) throw new Error('invalid target_analysis decision_status');
  if (analysis.attempt !== receipt.attempt || analysis.attempt !== intent.attempt) {
    throw new Error('target_analysis attempt must match receipt and intent');
  }
  if (!['HIGH', 'MEDIUM', 'LOW'].includes(analysis.confidence)) throw new Error('target_analysis requires confidence');
  if (!Array.isArray(analysis.unresolved)) throw new Error('target_analysis requires unresolved array');
  if (analysis.decision === 'BLOCKED' && receipt.status !== 'BLOCKED') {
    throw new Error('BLOCKED target analysis requires BLOCKED task result');
  }
  if (analysis.decision !== 'BLOCKED' && receipt.status !== 'COMPLETED') {
    throw new Error(`${analysis.decision} target analysis requires COMPLETED task result`);
  }
  if (analysis.decision_status === 'APPROVED') {
    if (analysis.decision_origin !== 'AUTO') throw new Error('human target decisions must be approved by the scheduler, not the child receipt');
    if (analysis.decision !== 'DIRECT' || analysis.confidence !== 'HIGH' || analysis.unresolved.length) {
      throw new Error('AUTO approval only permits HIGH-confidence DIRECT with unresolved=[]');
    }
    if (!isNonEmptyString(analysis.decision_ref) || Number.isNaN(Date.parse(analysis.decided_at || ''))) {
      throw new Error('approved target_analysis requires decision_ref and decided_at');
    }
  }
}

function collectHostActions(dispatch, allowedTaskKeys) {
  const actions = [];
  for (const intent of dispatch.created || []) {
    if (!allowedTaskKeys.has(intent.task_key)) continue;
    actions.push(threadAction('CREATE_THREAD', intent));
  }
  for (const intent of dispatch.reused || []) {
    if (!allowedTaskKeys.has(intent.task_key)) continue;
    if (['PENDING_THREAD', 'UNKNOWN'].includes(intent.status)) {
      actions.push(threadAction('RECONCILE_THREAD', intent));
    }
  }
  return actions;
}

function threadAction(type, intent) {
  return {
    ...describeHostAction(type, intent.access),
    type,
    action_id: `${type}:${intent.task_key}`,
    task_key: intent.task_key,
    project_id: intent.project_id,
    responsibility: intent.responsibility,
    access: intent.access,
    worktree: intent.worktree || null,
    distribution_prompt: intent.distribution_prompt || null,
    initial_prompt: renderInitialPrompt(intent)
  };
}

function renderInitialPrompt(intent) {
  const prompt = intent.distribution_prompt;
  if (!prompt || typeof prompt !== 'object') return null;
  return [
    `任务：${prompt.task_title || prompt.summary || intent.task_key}`,
    `任务 ID：${prompt.task_id || intent.task_key}`,
    `职责：${intent.responsibility}（${intent.phase}）`,
    '',
    '这是一个由 jj-flow 分发的任务。结构化分发上下文已随 action 传入，请直接消费，不要重新询问已确认的源需求、目标或风险。',
    '开始时只需确认任务标题；完成时只回报结构化证据、验证结果、未解决项和下一步。'
  ].join('\n');
}

function collectNextWait(plane, deliveryId, deferred) {
  const delivery = plane.deliveries.find((item) => item.delivery_id === deliveryId);
  const keys = new Set((delivery?.dispatch_intents || [])
    .filter((intent) => ['PENDING_THREAD', 'UNKNOWN', 'BOUND', 'BLOCKED'].includes(intent.status))
    .map((intent) => intent.task_key));
  for (const task of deferred) keys.add(task.task_key);
  return [...keys].sort();
}

function updateRuntime(next, previous, deliveryId, processedIds, processedEntries, now) {
  const prior = previous.runtime || {};
  const priorDelivery = prior.deliveries?.[deliveryId] || {};
  next.runtime = {
    ...prior,
    processed_receipt_ids: [...processedIds],
    processed_receipts: [...processedEntries.values()],
    deliveries: {
      ...(prior.deliveries || {}),
      [deliveryId]: {
        run_id: priorDelivery.run_id || `RUN-${deliveryId}-${previous.revision}`,
        updated_at: now,
        resume_cursor: `${deliveryId}:${next.revision}`,
        last_tick_revision: next.revision
      }
    }
  };
  return next;
}

function findDeliveryIntent(plane, deliveryId, taskKeyValue) {
  const delivery = plane.deliveries.find((item) => item.delivery_id === deliveryId);
  const intent = (delivery?.dispatch_intents || []).find((item) => item.task_key === taskKeyValue);
  return intent ? { delivery, intent } : null;
}

function requireTarget(plane, deliveryId, projectId) {
  const delivery = plane.deliveries.find((item) => item.delivery_id === deliveryId);
  if (!delivery) throw new Error(`Unknown delivery_id: ${deliveryId}`);
  const target = (delivery.targets || []).find((item) => item.project_id === projectId);
  if (!target) throw new Error(`project ${projectId} is not a target of ${deliveryId}`);
  return target;
}

function isAnalysisResponsibility(value = {}) {
  return value.phase === 'planning' || /^(analysis|planning|product|requirement)$/i.test(value.responsibility || value.name || '');
}

function dependsTransitivelyOn(responsibilities, responsibility, requiredTaskKey, deliveryId, projectId, seen = new Set()) {
  const currentKey = taskKey(deliveryId, projectId, responsibility);
  if (seen.has(currentKey)) return false;
  seen.add(currentKey);
  const dependencies = responsibility.depends_on || [];
  if (dependencies.includes(requiredTaskKey)) return true;
  return dependencies.some((dependency) => {
    const dependencyResponsibility = responsibilities.find((item) => taskKey(deliveryId, projectId, item) === dependency);
    return dependencyResponsibility
      ? dependsTransitivelyOn(responsibilities, dependencyResponsibility, requiredTaskKey, deliveryId, projectId, seen)
      : false;
  });
}

function taskKey(deliveryId, projectId, responsibility) {
  return `${deliveryId}/${projectId}/${responsibility.name}/${responsibility.attempt}`;
}

function receiptIdentity(receipt) {
  return {
    receipt_id: receipt.receipt_id,
    task_key: receipt.task_key,
    attempt: receipt.attempt,
    kind: receipt.kind
  };
}

function sameReceiptIdentity(left, right) {
  return left.receipt_id === right.receipt_id
    && left.task_key === right.task_key
    && left.attempt === right.attempt
    && left.kind === right.kind;
}

function parseAttemptFromTaskKey(taskKeyValue) {
  if (typeof taskKeyValue !== 'string') return null;
  const parts = taskKeyValue.split('/');
  if (parts.length !== 4) return null;
  const attempt = Number(parts[3]);
  return Number.isInteger(attempt) && attempt > 0 ? attempt : null;
}

function appendRuntimeEvent(plane, type, payload, at) {
  plane.events = Array.isArray(plane.events) ? plane.events : [];
  plane.events.push({ event_id: `${plane.revision}-${plane.events.length + 1}`, type, at, ...payload });
}

function revisionConflict(expectedRevision, current) {
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

function isNonEmptyString(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

function blocked(plane, type, errors, receiptId = null) {
  return {
    ok: false,
    status: 'BLOCKED',
    state_changed: false,
    plane: structuredClone(plane),
    decision_required: [{ type, errors, ...(receiptId ? { receipt_id: receiptId } : {}) }],
    actions: [],
    applied_receipts: [],
    next_wait: []
  };
}
