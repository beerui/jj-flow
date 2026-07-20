/**
 * Pure control-plane protocol for the Codex-only $jj-dispatch skill.
 *
 * This module deliberately does not create threads, switch repositories, or
 * run a daemon. The Codex App host owns those capabilities; this module keeps
 * the durable state transitions deterministic and recoverable.
 */

export const CONTROL_PLANE_SCHEMA_VERSION = 'jj-flow/control-plane/1.0';

export const DISPATCH_ACTIONS = Object.freeze([
  'PREVIEW',
  'DISPATCH',
  'RECONCILE',
  'BIND_THREAD'
]);

export const REQUIRED_APP_CAPABILITIES = Object.freeze([
  'list_projects',
  'list_threads',
  'create_thread',
  'read_thread',
  'send_message_to_thread',
  'worktree',
  'sandbox'
]);

export const REVIEW_OUTCOMES = Object.freeze(['PASS', 'NEEDS_CHANGES']);
export const REVIEW_FINDING_STATUSES = Object.freeze(['OPEN', 'RESOLVED', 'WAIVED']);
export const TARGET_DIFFERENCE_DECISIONS = Object.freeze([
  'DIRECT',
  'ADAPT',
  'SYNC',
  'NO_CHANGE_REQUIRED',
  'BLOCKED'
]);

const DELIVERY_STATUSES = new Set([
  'DRAFT',
  'PREVIEW_ONLY',
  'APPROVED',
  'DISPATCHING',
  'RUNNING',
  'EVIDENCE_READY',
  'VERIFIED',
  'BLOCKED',
  'UNKNOWN'
]);

const TARGET_STATUSES = new Set([
  'PENDING',
  'DISPATCHING',
  'RUNNING',
  'VERIFIED',
  'NO_CHANGE_REQUIRED',
  'FAILED',
  'BLOCKED'
]);

const TASK_STATUSES = new Set([
  'PENDING_THREAD',
  'BOUND',
  'UNKNOWN',
  'COMPLETED',
  'BLOCKED',
  'SKIPPED'
]);

const SUCCESS_TARGET_STATUSES = new Set(['VERIFIED', 'NO_CHANGE_REQUIRED']);
const RESPONSIBILITY_STATUSES = new Set([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'BLOCKED',
  'SKIPPED',
  'NOT_APPLICABLE'
]);
const RESPONSIBILITY_PHASES = new Set(['planning', 'development', 'verification', 'review']);
const SANDBOX_MODES = new Set(['read-only', 'workspace-write']);

export function createControlPlane({
  controlProject,
  control_project,
  projects = [],
  deliveries = [],
  revision = 0,
  runtime = null,
  events = []
} = {}) {
  const plane = {
    schema_version: CONTROL_PLANE_SCHEMA_VERSION,
    revision,
    control_project: normalizeControlProject(controlProject || control_project),
    projects: Array.isArray(projects) ? projects.map(normalizeProject) : projects,
    deliveries: Array.isArray(deliveries) ? deliveries.map(normalizeDelivery) : deliveries,
    runtime: runtime === undefined ? null : clone(runtime),
    events: clone(events)
  };

  const validation = validateControlPlane(plane);
  if (!validation.ok) {
    throw new Error(`Invalid control plane: ${validation.errors.join('; ')}`);
  }
  return plane;
}

export function validateControlPlane(plane) {
  const errors = [];
  if (!plane || typeof plane !== 'object' || Array.isArray(plane)) {
    return { ok: false, errors: ['control plane must be an object'], warnings: [] };
  }

  if (plane.schema_version !== CONTROL_PLANE_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${CONTROL_PLANE_SCHEMA_VERSION}`);
  }

  if (!Number.isInteger(plane.revision) || plane.revision < 0) {
    errors.push('revision must be a non-negative integer');
  }

  if (!plane.control_project?.id) errors.push('control_project.id is required');
  else if (typeof plane.control_project.id !== 'string' || plane.control_project.id.includes('/')) errors.push('control_project.id must be a string without /');
  if (!plane.control_project?.name) errors.push('control_project.name is required');
  if (!plane.control_project?.path) errors.push('control_project.path is required');
  else if (typeof plane.control_project.path !== 'string') errors.push('control_project.path must be a string');
  if (!Array.isArray(plane.projects)) errors.push('projects must be an array');
  else if (plane.projects.length === 0) errors.push('projects requires at least one project');
  if (!Array.isArray(plane.deliveries)) errors.push('deliveries must be an array');
  if (plane.events !== undefined && !Array.isArray(plane.events)) errors.push('events must be an array');
  validateRuntimeState(plane.runtime, errors);

  const projectIds = new Set();
  const projectPaths = new Map();
  const codexProjectIds = new Map();
  for (const project of Array.isArray(plane.projects) ? plane.projects : []) {
    if (!project || typeof project !== 'object' || Array.isArray(project)) {
      errors.push('every project must be an object');
      continue;
    }
    if (!project?.id) {
      errors.push('every project requires id');
      continue;
    }
    if (String(project.id).includes('/')) errors.push(`project id cannot contain /: ${project.id}`);
    if (typeof project.id !== 'string') errors.push(`project ${project.id} id must be a string`);
    if (projectIds.has(project.id)) errors.push(`duplicate project id: ${project.id}`);
    projectIds.add(project.id);
    if (!project.name) errors.push(`project ${project.id} requires name`);
    else if (typeof project.name !== 'string') errors.push(`project ${project.id} name must be a string`);
    if (!project.path) errors.push(`project ${project.id} requires path`);
    else if (typeof project.path !== 'string') errors.push(`project ${project.id} path must be a string`);
    else {
      const previousPathProject = projectPaths.get(project.path);
      if (previousPathProject && previousPathProject !== project.id) {
        errors.push(`project path ${project.path} is registered by both ${previousPathProject} and ${project.id}`);
      } else {
        projectPaths.set(project.path, project.id);
      }
    }
    if (project.codex_project_id !== null && project.codex_project_id !== undefined) {
      if (typeof project.codex_project_id !== 'string' || !project.codex_project_id) {
        errors.push(`project ${project.id} codex_project_id must be a string or null`);
      } else {
        const previousCodexProject = codexProjectIds.get(project.codex_project_id);
        if (previousCodexProject && previousCodexProject !== project.id) {
          errors.push(`codex project ${project.codex_project_id} is registered by both ${previousCodexProject} and ${project.id}`);
        } else {
          codexProjectIds.set(project.codex_project_id, project.id);
        }
      }
    }
    if (!['active', 'paused', 'retired'].includes(project.status)) {
      errors.push(`project ${project.id} has invalid status ${project.status}`);
    }
  }

  const deliveryIds = new Set();
  const activeWriterTaskByProject = new Map();
  const activeWorktreeTaskByPath = new Map();
  const boundThreadTaskById = new Map();
  for (const delivery of Array.isArray(plane.deliveries) ? plane.deliveries : []) {
    if (!delivery || typeof delivery !== 'object' || Array.isArray(delivery)) {
      errors.push('every delivery must be an object');
      continue;
    }
    if (!delivery?.delivery_id) {
      errors.push('every delivery requires delivery_id');
      continue;
    }
    if (typeof delivery.delivery_id !== 'string') errors.push(`delivery id must be a string: ${delivery.delivery_id}`);
    if (String(delivery.delivery_id).includes('/')) errors.push(`delivery id cannot contain /: ${delivery.delivery_id}`);
    if (deliveryIds.has(delivery.delivery_id)) errors.push(`duplicate delivery id: ${delivery.delivery_id}`);
    deliveryIds.add(delivery.delivery_id);

    if (!DELIVERY_STATUSES.has(delivery.status)) {
      errors.push(`delivery ${delivery.delivery_id} has invalid status ${delivery.status}`);
    }
    for (const role of ['origin_project', 'requirement_owner', 'lead_project']) {
      if (!projectIds.has(delivery[role])) {
        errors.push(`delivery ${delivery.delivery_id} references unknown ${role}: ${delivery[role]}`);
      }
    }
    if (!Array.isArray(delivery.targets)) {
      errors.push(`delivery ${delivery.delivery_id} requires targets array`);
    } else if (delivery.targets.length === 0) {
      errors.push(`delivery ${delivery.delivery_id} requires at least one target`);
    }

    const targetIds = new Set();
    for (const target of Array.isArray(delivery.targets) ? delivery.targets : []) {
      if (!target || typeof target !== 'object' || Array.isArray(target)) {
        errors.push(`delivery ${delivery.delivery_id} has non-object target`);
        continue;
      }
      if (!target?.project_id) {
        errors.push(`delivery ${delivery.delivery_id} has target without project_id`);
        continue;
      }
      if (typeof target.project_id !== 'string') errors.push(`target project id must be a string: ${target.project_id}`);
      if (String(target.project_id).includes('/')) errors.push(`target project id cannot contain /: ${target.project_id}`);
      if (targetIds.has(target.project_id)) {
        errors.push(`delivery ${delivery.delivery_id} has duplicate target ${target.project_id}`);
      }
      targetIds.add(target.project_id);
      if (!projectIds.has(target.project_id)) {
        errors.push(`delivery ${delivery.delivery_id} references unknown target: ${target.project_id}`);
      }
      if (!TARGET_STATUSES.has(target.status)) {
        errors.push(`target ${target.project_id} in ${delivery.delivery_id} has invalid status ${target.status}`);
      }
      validateTargetAnalysis(target.analysis, `${delivery.delivery_id}/${target.project_id}`, errors);
      validateTargetCheckpoint(delivery, target, errors);
      validateTargetLastResult(delivery, target, errors);
      validateTargetSuccessConsistency(delivery, target, errors);
      if (!Array.isArray(target.responsibilities) || target.responsibilities.length === 0) {
        errors.push(`target ${target.project_id} in ${delivery.delivery_id} requires responsibilities`);
      }
      validateResponsibilities(target.responsibilities, `${delivery.delivery_id}/${target.project_id}`, errors);
    }

    if (!Array.isArray(delivery.lead_responsibilities)) {
      errors.push(`delivery ${delivery.delivery_id} requires lead_responsibilities array`);
    }
    const leadIsTarget = Array.isArray(delivery.targets) && delivery.targets.some((target) => target.project_id === delivery.lead_project);
    if (!leadIsTarget && (!Array.isArray(delivery.lead_responsibilities) || delivery.lead_responsibilities.length === 0)) {
      errors.push(`delivery ${delivery.delivery_id} requires lead_responsibilities when lead is not a target`);
    }
    if (!leadIsTarget) {
      validateResponsibilities(delivery.lead_responsibilities, `${delivery.delivery_id}/${delivery.lead_project}`, errors);
    }
    validateDependencies(delivery, errors);

    if (delivery.reference_implementation !== null) {
      const reference = delivery.reference_implementation;
      if (!reference || typeof reference !== 'object' || Array.isArray(reference)) {
        errors.push(`delivery ${delivery.delivery_id} reference must be an object or null`);
        continue;
      }
      for (const field of ['project_id', 'commit', 'snapshot_ref', 'snapshot_hash', 'verified_at', 'verification_ref']) {
        if (!reference?.[field]) errors.push(`delivery ${delivery.delivery_id} reference requires ${field}`);
        else if (typeof reference[field] !== 'string') errors.push(`delivery ${delivery.delivery_id} reference ${field} must be a string`);
      }
      if (reference?.commit && (typeof reference.commit !== 'string' || reference.commit.length < 7)) {
        errors.push(`delivery ${delivery.delivery_id} reference commit must be at least 7 characters`);
      }
      if (reference?.verified_at && !isDateTime(reference.verified_at)) {
        errors.push(`delivery ${delivery.delivery_id} reference verified_at must be a date-time`);
      }
      if (reference?.project_id && !projectIds.has(reference.project_id)) {
        errors.push(`delivery ${delivery.delivery_id} reference uses unknown project ${reference.project_id}`);
      }
      for (const field of ['source_head', 'handoff_ref', 'freshness']) {
        if (reference?.[field] !== undefined && reference?.[field] !== null && typeof reference[field] !== 'string') {
          errors.push(`delivery ${delivery.delivery_id} reference ${field} must be a string or null`);
        }
      }
      const referenceTarget = (Array.isArray(delivery.targets) ? delivery.targets : [])
        .find((target) => target?.project_id === reference.project_id);
      const synchronized = Boolean(delivery.sync_key || delivery.handoff_ref || referenceTarget?.sync_key || referenceTarget?.handoff_ref);
      if (synchronized) {
        for (const field of ['source_head', 'handoff_ref']) {
          if (!reference[field] || typeof reference[field] !== 'string') {
            errors.push(`delivery ${delivery.delivery_id} synchronized reference requires ${field}`);
          }
        }
        if (reference.freshness !== 'FRESH') errors.push(`delivery ${delivery.delivery_id} synchronized reference freshness must be FRESH`);
        const expectedHandoff = delivery.handoff_ref || referenceTarget?.handoff_ref || null;
        if (expectedHandoff && reference.handoff_ref !== expectedHandoff) {
          errors.push(`delivery ${delivery.delivery_id} synchronized reference handoff_ref must match its delivery or target`);
        }
      }
    }

    if (!Array.isArray(delivery.dispatch_intents)) {
      errors.push(`delivery ${delivery.delivery_id} requires dispatch_intents array`);
    }
    if (delivery.reviews !== undefined && !Array.isArray(delivery.reviews)) {
      errors.push(`delivery ${delivery.delivery_id} reviews must be an array`);
    }
    for (const review of Array.isArray(delivery.reviews) ? delivery.reviews : []) {
      validateReviewRecord(review, delivery.delivery_id, errors);
    }
    if (delivery.approval !== undefined && (!delivery.approval || typeof delivery.approval !== 'object' || Array.isArray(delivery.approval))) {
      errors.push(`delivery ${delivery.delivery_id} approval must be an object`);
    } else if (delivery.approval) {
      if (!['PENDING', 'APPROVED'].includes(delivery.approval.status)) {
        errors.push(`delivery ${delivery.delivery_id} has invalid approval status ${delivery.approval.status}`);
      }
      if (delivery.approval.status === 'APPROVED') {
        if (typeof delivery.approval.decision_ref !== 'string' || !delivery.approval.decision_ref) {
          errors.push(`delivery ${delivery.delivery_id} APPROVED approval requires decision_ref`);
        }
        if (!isDateTime(delivery.approval.approved_at)) {
          errors.push(`delivery ${delivery.delivery_id} APPROVED approval requires a date-time approved_at`);
        }
      } else {
        if (delivery.approval.decision_ref !== undefined
          && delivery.approval.decision_ref !== null
          && typeof delivery.approval.decision_ref !== 'string') {
          errors.push(`delivery ${delivery.delivery_id} approval decision_ref must be a string or null`);
        }
        if (delivery.approval.approved_at !== undefined
          && delivery.approval.approved_at !== null
          && !isDateTime(delivery.approval.approved_at)) {
          errors.push(`delivery ${delivery.delivery_id} approval approved_at must be a date-time`);
        }
      }
      if (!Array.isArray(delivery.approval.task_keys)) {
        errors.push(`delivery ${delivery.delivery_id} approval requires task_keys array`);
      }
      if (delivery.approval.tasks !== undefined && !Array.isArray(delivery.approval.tasks)) {
        errors.push(`delivery ${delivery.delivery_id} approval tasks must be an array`);
      } else if (Array.isArray(delivery.approval.tasks)) {
        const approvalTaskKeys = new Set();
        for (const task of delivery.approval.tasks) {
          if (!task || typeof task !== 'object' || Array.isArray(task)) {
            errors.push(`delivery ${delivery.delivery_id} approval contains non-object task`);
            continue;
          }
          for (const field of ['task_key', 'project_id', 'responsibility', 'access', 'phase', 'attempt', 'depends_on']) {
            if (task[field] === undefined || task[field] === null || task[field] === '') {
              errors.push(`delivery ${delivery.delivery_id} approval task requires ${field}`);
            }
          }
          if (approvalTaskKeys.has(task.task_key)) errors.push(`delivery ${delivery.delivery_id} approval has duplicate task_key ${task.task_key}`);
          approvalTaskKeys.add(task.task_key);
          if (!RESPONSIBILITY_PHASES.has(task.phase)) errors.push(`delivery ${delivery.delivery_id} approval task ${task.task_key} has invalid phase`);
          if (!Array.isArray(task.depends_on)) errors.push(`delivery ${delivery.delivery_id} approval task ${task.task_key} requires depends_on array`);
          if (!Number.isInteger(task.attempt) || task.attempt < 1) errors.push(`delivery ${delivery.delivery_id} approval task ${task.task_key} requires a positive attempt`);
        }
      }
    }
    const taskKeys = new Set();
    const plansByKey = buildPlanMap(delivery);
    const persistedIntents = Array.isArray(delivery.dispatch_intents) ? delivery.dispatch_intents : [];
    const intentsByKey = new Map(persistedIntents
      .filter((intent) => intent && typeof intent === 'object' && !Array.isArray(intent) && intent.task_key)
      .map((intent) => [intent.task_key, intent]));
    for (const intent of persistedIntents) {
      if (!intent || typeof intent !== 'object' || Array.isArray(intent)) {
        errors.push(`delivery ${delivery.delivery_id} has non-object dispatch intent`);
        continue;
      }
      if (!intent?.task_key) {
        errors.push(`delivery ${delivery.delivery_id} has dispatch intent without task_key`);
        continue;
      }
      if (taskKeys.has(intent.task_key)) errors.push(`duplicate task_key: ${intent.task_key}`);
      taskKeys.add(intent.task_key);
      for (const field of ['delivery_id', 'project_id', 'responsibility', 'access', 'phase', 'depends_on', 'created_at']) {
        if (!intent[field]) errors.push(`task ${intent.task_key} requires ${field}`);
      }
      if (intent.delivery_id && intent.delivery_id !== delivery.delivery_id) {
        errors.push(`task ${intent.task_key} has mismatched delivery_id`);
      }
      if (intent.project_id && !projectIds.has(intent.project_id)) {
        errors.push(`task ${intent.task_key} references unknown project ${intent.project_id}`);
      }
      const responsibility = intent.project_id && intent.responsibility
        ? findResponsibility(delivery, intent.project_id, intent.responsibility)
        : null;
      if (intent.project_id && intent.responsibility && !responsibility) {
        errors.push(`task ${intent.task_key} references unknown responsibility ${intent.project_id}/${intent.responsibility}`);
      }
      if (!Number.isInteger(intent.attempt) || intent.attempt < 1) {
        errors.push(`task ${intent.task_key} requires a positive attempt`);
      }
      if (!['read', 'write'].includes(intent.access)) {
        errors.push(`task ${intent.task_key} has invalid access ${intent.access}`);
      }
      if (!TASK_STATUSES.has(intent.status)) {
        errors.push(`task ${intent.task_key} has invalid status ${intent.status}`);
      }
      if (!RESPONSIBILITY_PHASES.has(intent.phase)) {
        errors.push(`task ${intent.task_key} has invalid phase ${intent.phase}`);
      }
      if (!Array.isArray(intent.depends_on)) {
        errors.push(`task ${intent.task_key} requires depends_on array`);
      }
      validateIntentResult(intent, responsibility, delivery, errors);
      if (intent.access === 'write' && ['PENDING_THREAD', 'BOUND', 'UNKNOWN'].includes(intent.status)) {
        const activeWriter = activeWriterTaskByProject.get(intent.project_id);
        if (activeWriter && activeWriter !== intent.task_key) {
          errors.push(`project ${intent.project_id} has multiple active write tasks: ${activeWriter}, ${intent.task_key}`);
        } else {
          activeWriterTaskByProject.set(intent.project_id, intent.task_key);
        }
      }
      if (intent.access === 'write' && ['PENDING_THREAD', 'BOUND', 'UNKNOWN'].includes(intent.status)
        && isNonEmptyString(intent.worktree)) {
        const previousWorktreeTask = activeWorktreeTaskByPath.get(intent.worktree);
        if (previousWorktreeTask && previousWorktreeTask !== intent.task_key) {
          errors.push(`worktree ${intent.worktree} is already bound to ${previousWorktreeTask}`);
        } else {
          activeWorktreeTaskByPath.set(intent.worktree, intent.task_key);
        }
      }
      if (isNonEmptyString(intent.thread_id)) {
        const previousThreadTask = boundThreadTaskById.get(intent.thread_id);
        if (previousThreadTask && previousThreadTask !== intent.task_key) {
          errors.push(`thread ${intent.thread_id} is already bound to ${previousThreadTask}`);
        } else {
          boundThreadTaskById.set(intent.thread_id, intent.task_key);
        }
      }
      if (!['SKIPPED'].includes(intent.status)) {
        for (const dependency of Array.isArray(intent.depends_on) ? intent.depends_on : []) {
          if (!isDependencySatisfied(delivery, dependency, intentsByKey)) {
            errors.push(`task ${intent.task_key} persists before dependency ${dependency} is completed`);
          }
        }
      }
      if (intent.host_id !== undefined && intent.host_id !== null && typeof intent.host_id !== 'string') {
        errors.push(`task ${intent.task_key} host_id must be a string or null`);
      }
      if (intent.sandbox_mode !== undefined && !SANDBOX_MODES.has(intent.sandbox_mode)) {
        errors.push(`task ${intent.task_key} has invalid sandbox_mode ${intent.sandbox_mode}`);
      }
      if (intent.environment !== undefined && typeof intent.environment !== 'string') {
        errors.push(`task ${intent.task_key} environment must be a string`);
      }
      if (['read', 'write'].includes(intent.access)) {
        const expectedAgent = agentNameForTask(intent);
        const expectedSandbox = sandboxModeForAccess(intent.access);
        const expectedEnvironment = environmentForAccess(intent.access);
        if (intent.agent_name !== expectedAgent) {
          errors.push(`task ${intent.task_key} requires agent ${expectedAgent}`);
        }
        if (intent.sandbox_mode !== expectedSandbox) {
          errors.push(`task ${intent.task_key} requires ${expectedSandbox} sandbox`);
        }
        if (intent.environment !== expectedEnvironment) {
          errors.push(`task ${intent.task_key} requires ${expectedEnvironment} environment`);
        }
      }
      if (intent.created_at && !isDateTime(intent.created_at)) {
        errors.push(`task ${intent.task_key} created_at must be a date-time`);
      }
      if (intent.delivery_id && intent.project_id && intent.responsibility && Number.isInteger(intent.attempt) && intent.attempt > 0) {
        try {
          if (buildTaskKey({
            deliveryId: intent.delivery_id,
            projectId: intent.project_id,
            responsibility: intent.responsibility,
            attempt: intent.attempt
          }) !== intent.task_key) {
            errors.push(`task ${intent.task_key} does not match its task fields`);
          }
        } catch (error) {
          errors.push(`task ${intent.task_key} has invalid task fields: ${error.message}`);
        }
      }
      const currentPlan = plansByKey.get(intent.task_key);
      if (currentPlan) {
        for (const field of ['project_id', 'responsibility', 'access', 'phase', 'attempt']) {
          if (intent[field] !== currentPlan[field]) errors.push(`task ${intent.task_key} differs from current task plan in ${field}`);
        }
        if (JSON.stringify(intent.depends_on) !== JSON.stringify(currentPlan.depends_on)) {
          errors.push(`task ${intent.task_key} differs from current task plan in depends_on`);
        }
        if (responsibility && intent.attempt === responsibility.attempt) {
          const expectedResponsibilityStatus = {
            PENDING_THREAD: 'PENDING',
            UNKNOWN: 'PENDING',
            BOUND: 'RUNNING',
            COMPLETED: 'COMPLETED',
            BLOCKED: 'BLOCKED',
            SKIPPED: ['SKIPPED', 'NOT_APPLICABLE']
          }[intent.status];
          const allowedStatuses = Array.isArray(expectedResponsibilityStatus)
            ? expectedResponsibilityStatus
            : [expectedResponsibilityStatus];
          if (expectedResponsibilityStatus && !allowedStatuses.includes(responsibility.status)) {
            errors.push(`task ${intent.task_key} status ${intent.status} conflicts with responsibility status ${responsibility.status}`);
          }
        }
      } else if (responsibility && intent.attempt !== responsibility.attempt && !['COMPLETED', 'BLOCKED'].includes(intent.status)) {
        errors.push(`task ${intent.task_key} is stale; current responsibility attempt is ${responsibility.attempt}`);
      }
      validateIntentBinding(intent, errors);
      if (intent.access === 'read' && intent.status === 'BOUND' && intent.sandbox_mode !== 'read-only') {
        errors.push(`read task ${intent.task_key} requires read-only sandbox`);
      }
      if (intent.access === 'write' && intent.status === 'BOUND' && intent.sandbox_mode !== 'workspace-write') {
        errors.push(`write task ${intent.task_key} requires workspace-write sandbox`);
      }
      if (intent.access === 'write' && intent.status === 'BOUND' && !intent.worktree) {
        errors.push(`bound write task ${intent.task_key} requires worktree`);
      }
      if (intent.access === 'read' && intent.status === 'BOUND' && intent.worktree) {
        errors.push(`read task ${intent.task_key} cannot bind a worktree`);
      }
    }
    validateReviewConsistency(delivery, errors);
    validateDeliveryCompletion(delivery, errors);
  }

  return { ok: errors.length === 0, errors, warnings: [] };
}

export function buildTaskKey({ deliveryId, projectId, responsibility, attempt = 1 } = {}) {
  for (const [name, value] of Object.entries({ deliveryId, projectId, responsibility })) {
    if (!value || String(value).includes('/')) {
      throw new Error(`${name} must be non-empty and cannot contain /`);
    }
  }
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error('attempt must be a positive integer');
  return `${deliveryId}/${projectId}/${responsibility}/${attempt}`;
}

export function previewDispatch(plane, deliveryId) {
  const delivery = requireDelivery(plane, deliveryId);
  return {
    action: 'PREVIEW',
    status: 'PREVIEW_ONLY',
    delivery_id: deliveryId,
    origin_project: delivery.origin_project,
    requirement_owner: delivery.requirement_owner,
    lead_project: delivery.lead_project,
    lead_responsibilities: normalizeResponsibilities({
      responsibilities: delivery.lead_responsibilities?.length
        ? delivery.lead_responsibilities
        : [{ name: 'development', access: 'write', status: 'PENDING', attempt: 1 }]
    }),
    reference_implementation: delivery.reference_implementation,
    tasks: buildTaskPlans(delivery),
    reason: '预览不会创建任务，也不会调用 Codex App。用户明确批准后才进入 DISPATCH。'
  };
}

export function approveDispatch(plane, { deliveryId, decisionRef, approvedAt = new Date().toISOString() } = {}) {
  const validation = validateControlPlane(plane);
  if (!validation.ok) {
    throw new Error(`Invalid control plane: ${validation.errors.join('; ')}`);
  }
  const next = clone(plane);
  const delivery = requireDelivery(next, deliveryId);
  if (!decisionRef || typeof decisionRef !== 'string') throw new Error('decisionRef must be a non-empty string to approve dispatch');
  if (!isDateTime(approvedAt)) throw new Error('approvedAt must be a date-time');
  if (!['DRAFT', 'PREVIEW_ONLY', 'APPROVED', 'BLOCKED'].includes(delivery.status)) {
    throw new Error(`delivery ${deliveryId} cannot be approved from ${delivery.status}`);
  }
  if (delivery.status === 'BLOCKED') {
    const currentPlans = buildTaskPlans(delivery);
    const existingIntents = Array.isArray(delivery.dispatch_intents) ? delivery.dispatch_intents : [];
    const approvedKeys = new Set(Array.isArray(delivery.approval?.task_keys) ? delivery.approval.task_keys : []);
    const existingAttempts = new Map();
    for (const intent of existingIntents) {
      const identity = `${intent?.project_id}/${intent?.responsibility}`;
      if (!intent?.project_id || !intent?.responsibility || !Number.isInteger(intent?.attempt)) continue;
      existingAttempts.set(identity, Math.max(existingAttempts.get(identity) || 0, intent.attempt));
    }
    const hasNewAttempt = existingIntents.length === 0 || currentPlans.some((task) => {
      const identity = `${task.project_id}/${task.responsibility}`;
      const previousAttempt = existingAttempts.get(identity);
      return previousAttempt === undefined
        ? !approvedKeys.has(task.task_key)
        : task.attempt > previousAttempt;
    });
    if (!hasNewAttempt) {
      throw new Error(`delivery ${deliveryId} requires a new attempt task_key before re-approval`);
    }
  }
  prepareTargetRetriesForApproval(delivery);
  delivery.approval = {
    status: 'APPROVED',
    decision_ref: decisionRef,
    approved_at: approvedAt,
    task_keys: buildTaskPlans(delivery).map((task) => task.task_key),
    tasks: buildApprovalTasks(delivery)
  };
  delivery.status = 'APPROVED';
  next.revision += 1;
  appendEvent(next, 'DISPATCH_APPROVED', { delivery_id: deliveryId, decision_ref: decisionRef });
  const outputValidation = validateControlPlane(next);
  if (!outputValidation.ok) {
    throw new Error(`approval produced an invalid control plane: ${outputValidation.errors.join('; ')}`);
  }
  return next;
}

export function dispatchTasks(plane, deliveryId, {
  capabilities = [],
  now = new Date().toISOString(),
  hostId = null,
  eligibleProjects = null,
  allowedTaskKeys = null
} = {}) {
  if (!isDateTime(now)) throw new Error('dispatch now must be a date-time');
  if (hostId !== null && (typeof hostId !== 'string' || !hostId)) {
    throw new Error('dispatch hostId must be a non-empty string or null');
  }
  const validation = validateControlPlane(plane);
  if (!validation.ok) {
    return {
      ok: false,
      status: 'BLOCKED',
      action: 'DISPATCH',
      delivery_id: deliveryId,
      tasks: [],
      reason: validation.errors.join('; '),
      plane: clone(plane)
    };
  }

  const delivery = requireDelivery(plane, deliveryId);
  if (delivery.approval?.status !== 'APPROVED') {
    return blockedResult(plane, deliveryId, 'DISPATCH 需要控制项目中的明确批准记录。');
  }
  const approvedTaskKeys = [...(delivery.approval.task_keys || [])].sort();
  const currentTaskKeys = buildTaskPlans(delivery).map((task) => task.task_key).sort();
  if (approvedTaskKeys.length !== currentTaskKeys.length || approvedTaskKeys.some((key, index) => key !== currentTaskKeys[index])) {
    return blockedResult(plane, deliveryId, '当前任务集合与批准快照不一致，必须重新 PREVIEW 并批准。');
  }
  if (JSON.stringify(delivery.approval.tasks || []) !== JSON.stringify(buildApprovalTasks(delivery))) {
    return blockedResult(plane, deliveryId, '当前任务权限或责任与批准快照不一致，必须重新 PREVIEW 并批准。');
  }
  const dispatchProjects = new Set(buildTaskPlans(delivery).map((task) => task.project_id));
  const inactiveProjects = (Array.isArray(plane.projects) ? plane.projects : [])
    .filter((project) => dispatchProjects.has(project.id) && project.status !== 'active');
  if (inactiveProjects.length) {
    return blockedResult(
      plane,
      deliveryId,
      `以下 lead/target 项目不是 active，禁止创建任务：${inactiveProjects.map((project) => `${project.id}(${project.status})`).join(', ')}`
    );
  }

  const missing = REQUIRED_APP_CAPABILITIES.filter((capability) => !hasCapability(capabilities, capability));
  if (missing.length) {
    return {
      ok: false,
      status: 'BLOCKED',
      action: 'DISPATCH',
      delivery_id: deliveryId,
      tasks: buildTaskPlans(delivery),
      missing_capabilities: missing,
      reason: `缺少 Codex App capability：${missing.join(', ')}。保持 PREVIEW_ONLY/BLOCKED，不创建 projectless 任务。`,
      plane: clone(plane)
    };
  }

  const next = clone(plane);
  const nextDelivery = requireDelivery(next, deliveryId);
  const existing = new Map((nextDelivery.dispatch_intents || []).map((intent) => [intent.task_key, intent]));
  const created = [];
  const reused = [];
  const deferred = [];
  const skipped = [];
  const plans = buildTaskPlans(nextDelivery);
  const isSatisfied = (dependency) => isDependencySatisfied(nextDelivery, dependency, existing);
  // A project may declare several write responsibilities (for example frontend
  // and backend), but only one writer may be active at a time.  The set also
  // covers writers created earlier in this same dispatch wave.
  const waveWriters = new Set();

  const eligible = eligibleProjects == null
    ? null
    : eligibleProjects instanceof Set
      ? eligibleProjects
      : new Set(eligibleProjects);
  const allowed = allowedTaskKeys == null
    ? null
    : allowedTaskKeys instanceof Set
      ? allowedTaskKeys
      : new Set(allowedTaskKeys);

  for (const task of plans) {
    const prior = existing.get(task.task_key);
    if (prior) {
      reused.push(prior);
      continue;
    }
    if (eligible && !eligible.has(task.project_id)) {
      deferred.push({
        ...task,
        blocked_by: [`target-analysis:${task.project_id}`]
      });
      continue;
    }
    if (allowed && !allowed.has(task.task_key)) {
      deferred.push({
        ...task,
        blocked_by: [`runtime-gate:${task.project_id}`]
      });
      continue;
    }
    const responsibility = findResponsibility(nextDelivery, task.project_id, task.responsibility);
    if (['SKIPPED', 'NOT_APPLICABLE'].includes(responsibility?.status)) {
      skipped.push({ ...task, status: responsibility.status });
      continue;
    }
    const blockedBy = (task.depends_on || []).filter((dependency) => !isSatisfied(dependency));
    if (blockedBy.length) {
      deferred.push({ ...task, blocked_by: blockedBy });
      continue;
    }
    if (task.access === 'write'
      && (waveWriters.has(task.project_id) || hasActiveWriter(next, task.project_id, task.task_key))) {
      deferred.push({
        ...task,
        blocked_by: [`active-writer:${task.project_id}`]
      });
      continue;
    }
    const intent = {
      ...task,
      delivery_id: deliveryId,
      status: 'PENDING_THREAD',
      created_at: now,
      thread_id: null,
      host_id: hostId,
      worktree: null,
      agent_name: agentNameForTask(task),
      sandbox_mode: sandboxModeForAccess(task.access),
      environment: environmentForAccess(task.access),
      effective_sandbox_mode: null,
      sandbox_evidence_ref: null,
      bound_at: null
    };
    nextDelivery.dispatch_intents.push(intent);
    created.push(intent);
    if (task.access === 'write') waveWriters.add(task.project_id);
  }

  refreshDeliveryStatus(nextDelivery);
  if (created.length) {
    next.revision += 1;
    appendEvent(next, 'DISPATCH_INTENT', {
      delivery_id: deliveryId,
      task_keys: buildTaskPlans(nextDelivery).map((task) => task.task_key),
      created: created.map((task) => task.task_key)
    });
  }

  const outputValidation = validateControlPlane(next);
  if (!outputValidation.ok) {
    return {
      ok: false,
      status: 'BLOCKED',
      action: 'DISPATCH',
      delivery_id: deliveryId,
      tasks: [],
      reason: `DISPATCH 产生了无效控制平面：${outputValidation.errors.join('; ')}`,
      plane: clone(plane)
    };
  }

  return {
    ok: true,
    status: nextDelivery.status === 'UNKNOWN'
      ? 'UNKNOWN'
      : created.length
        ? 'DISPATCHING'
        : deferred.length
          ? 'WAITING_DEPENDENCY'
          : nextDelivery.status,
    action: 'DISPATCH',
    delivery_id: deliveryId,
    created,
    reused,
    deferred,
    skipped,
    tasks: [...created, ...reused],
    plane: next
  };
}

export function markDispatchUnknown(plane, { taskKey } = {}) {
  const validation = validateControlPlane(plane);
  if (!validation.ok) throw new Error(`Invalid control plane: ${validation.errors.join('; ')}`);
  const next = clone(plane);
  const found = findIntent(next, taskKey);
  if (!found) throw new Error(`Unknown task_key: ${taskKey}`);
  if (!['PENDING_THREAD', 'UNKNOWN'].includes(found.intent.status)) {
    throw new Error(`task ${taskKey} cannot enter UNKNOWN from ${found.intent.status}`);
  }
  assertCurrentAttempt(found.delivery, found.intent);
  if (found.intent.status === 'UNKNOWN') return next;
  found.intent.status = 'UNKNOWN';
  refreshDeliveryStatus(found.delivery);
  next.revision += 1;
  appendEvent(next, 'DISPATCH_UNKNOWN', { task_key: taskKey });
  return next;
}

export function abandonDispatchUnknown(plane, {
  taskKey,
  reason = '无法确认已创建 thread，转为阻塞并等待新的 attempt。',
  evidenceRef = null,
  recordedAt = new Date().toISOString()
} = {}) {
  const inputValidation = validateControlPlane(plane);
  if (!inputValidation.ok) throw new Error(`Invalid control plane: ${inputValidation.errors.join('; ')}`);
  requireNonEmptyString(reason, 'reason');
  if (evidenceRef !== null && evidenceRef !== undefined) requireNonEmptyString(evidenceRef, 'evidenceRef');
  if (!isDateTime(recordedAt)) throw new Error('recordedAt must be a date-time');
  const next = clone(plane);
  const found = findIntent(next, taskKey);
  if (!found) throw new Error(`Unknown task_key: ${taskKey}`);
  if (found.intent.status !== 'UNKNOWN') {
    throw new Error(`task ${taskKey} must be UNKNOWN before it can be abandoned`);
  }
  const responsibility = assertCurrentAttempt(found.delivery, found.intent);
  found.intent.status = 'BLOCKED';
  found.intent.result = {
    status: 'BLOCKED',
    evidence_ref: evidenceRef,
    reason,
    recorded_at: recordedAt
  };
  responsibility.status = 'BLOCKED';
  const target = (Array.isArray(found.delivery.targets) ? found.delivery.targets : [])
    .find((item) => item?.project_id === found.intent.project_id);
  if (target) {
    target.status = 'BLOCKED';
    if (target.last_result && target.last_result.status !== 'BLOCKED') target.last_result = null;
  }
  refreshDeliveryStatus(found.delivery);
  next.revision += 1;
  appendEvent(next, 'DISPATCH_ABANDONED', { task_key: taskKey, reason, evidence_ref: evidenceRef });
  const outputValidation = validateControlPlane(next);
  if (!outputValidation.ok) throw new Error(`abandon produced an invalid control plane: ${outputValidation.errors.join('; ')}`);
  return next;
}

export function bindThread(plane, {
  taskKey,
  threadId,
  projectId,
  hostId,
  agentName,
  sandboxMode,
  environment,
  effectiveSandboxMode,
  sandboxEvidenceRef,
  worktree = null
} = {}) {
  requireNonEmptyString(threadId, 'threadId');
  requireNonEmptyString(projectId, 'projectId');
  requireNonEmptyString(hostId, 'hostId');
  if (worktree !== null && worktree !== undefined && typeof worktree !== 'string') {
    throw new Error('worktree must be a string or null');
  }
  const validation = validateControlPlane(plane);
  if (!validation.ok) throw new Error(`Invalid control plane: ${validation.errors.join('; ')}`);
  const next = clone(plane);
  const found = findIntent(next, taskKey);
  if (!found) throw new Error(`Unknown task_key: ${taskKey}`);
  if (projectId && found.intent.project_id !== projectId) {
    throw new Error(`task ${taskKey} belongs to ${found.intent.project_id}, not ${projectId}`);
  }
  if (found.intent.thread_id && found.intent.thread_id !== threadId) {
    throw new Error(`task ${taskKey} is already bound to another thread`);
  }
  if (found.intent.host_id && found.intent.host_id !== hostId) {
    throw new Error(`task ${taskKey} is already bound to another host`);
  }
  if (!['PENDING_THREAD', 'UNKNOWN', 'BOUND'].includes(found.intent.status)) {
    throw new Error(`task ${taskKey} cannot be bound from ${found.intent.status}`);
  }
  assertCurrentAttempt(found.delivery, found.intent);
  assertDependenciesCompleted(next, found.intent);
  const expectedAgent = agentNameForTask(found.intent);
  const expectedSandbox = sandboxModeForAccess(found.intent.access);
  const expectedEnvironment = environmentForAccess(found.intent.access);
  if (!agentName || agentName !== expectedAgent) {
    throw new Error(`task ${taskKey} requires agent ${expectedAgent}`);
  }
  if (!sandboxMode || sandboxMode !== expectedSandbox) {
    throw new Error(`task ${taskKey} requires ${expectedSandbox} sandbox`);
  }
  if (!environment || environment !== expectedEnvironment) {
    throw new Error(`task ${taskKey} requires ${expectedEnvironment} environment`);
  }
  if (!effectiveSandboxMode || effectiveSandboxMode !== expectedSandbox) {
    throw new Error(`task ${taskKey} requires effective ${expectedSandbox} sandbox attestation`);
  }
  requireNonEmptyString(sandboxEvidenceRef, 'sandboxEvidenceRef');
  if (found.intent.access === 'read' && worktree) {
    throw new Error(`read task ${taskKey} cannot bind a worktree`);
  }
  if (found.intent.access === 'write' && !isNonEmptyString(worktree)) {
    throw new Error(`write task ${taskKey} requires worktree`);
  }
  for (const delivery of Array.isArray(next.deliveries) ? next.deliveries : []) {
    for (const intent of Array.isArray(delivery?.dispatch_intents) ? delivery.dispatch_intents : []) {
      if (intent.task_key !== taskKey && intent.thread_id === threadId) {
        throw new Error(`thread ${threadId} is already bound to ${intent.task_key}`);
      }
      if (found.intent.access === 'write'
        && intent.task_key !== taskKey
        && ['PENDING_THREAD', 'UNKNOWN', 'BOUND'].includes(intent.status)
        && intent.worktree
        && worktree
        && intent.worktree === worktree) {
        throw new Error(`worktree ${worktree} is already bound to ${intent.task_key}`);
      }
    }
  }
  if (found.intent.status === 'BOUND' && found.intent.thread_id === threadId) {
    if (found.intent.access === 'write' && worktree && found.intent.worktree !== worktree) {
      throw new Error(`task ${taskKey} is already bound to another worktree`);
    }
    return next;
  }
  found.intent.status = 'BOUND';
  found.intent.thread_id = threadId;
  found.intent.host_id = hostId;
  found.intent.agent_name = agentName;
  found.intent.sandbox_mode = sandboxMode;
  found.intent.environment = environment;
  found.intent.effective_sandbox_mode = effectiveSandboxMode;
  found.intent.sandbox_evidence_ref = sandboxEvidenceRef;
  if (found.intent.access === 'write') found.intent.worktree = worktree || found.intent.worktree;
  found.intent.bound_at = new Date().toISOString();
  const responsibility = findResponsibility(found.delivery, found.intent.project_id, found.intent.responsibility);
  if (responsibility) {
    responsibility.status = 'RUNNING';
    responsibility.thread_id = threadId;
  }
  const target = (Array.isArray(found.delivery.targets) ? found.delivery.targets : [])
    .find((item) => item?.project_id === found.intent.project_id);
  if (target) target.status = 'RUNNING';
  refreshDeliveryStatus(found.delivery);
  next.revision += 1;
  appendEvent(next, 'THREAD_BOUND', { task_key: taskKey, thread_id: threadId, host_id: hostId, agent_name: agentName, sandbox_mode: sandboxMode });
  const outputValidation = validateControlPlane(next);
  if (!outputValidation.ok) {
    throw new Error(`thread binding produced an invalid control plane: ${outputValidation.errors.join('; ')}`);
  }
  return next;
}

export function reconcileDispatch(plane, { taskKey, candidates = [] } = {}) {
  const validation = validateControlPlane(plane);
  if (!validation.ok) {
    return {
      ok: false,
      status: 'BLOCKED',
      action: 'RECONCILE',
      task_key: taskKey,
      reason: `控制平面校验失败：${validation.errors.join('; ')}`,
      plane: clone(plane)
    };
  }
  const found = findIntent(plane, taskKey);
  if (!found) throw new Error(`Unknown task_key: ${taskKey}`);
  if (found.intent.status !== 'UNKNOWN') {
    return { ok: true, status: found.intent.status, action: 'RECONCILE', plane: clone(plane), reason: '任务不处于 UNKNOWN，无需重新创建。' };
  }

  const matches = (Array.isArray(candidates) ? candidates : []).filter((candidate) => (
    candidate
    && typeof candidate === 'object'
    && candidate.task_key === taskKey
    && candidate.thread_id
    && candidate.project_id === found.intent.project_id
    && isNonEmptyString(candidate.thread_id)
    && isNonEmptyString(candidate.host_id)
    && candidate.host_id
    && candidate.agent_name === agentNameForTask(found.intent)
    && candidate.sandbox_mode === sandboxModeForAccess(found.intent.access)
    && candidate.environment === environmentForAccess(found.intent.access)
    && candidate.effective_sandbox_mode === sandboxModeForAccess(found.intent.access)
    && isNonEmptyString(candidate.sandbox_evidence_ref)
    && (found.intent.access !== 'read' || !candidate.worktree)
    && (found.intent.access !== 'write' || candidate.worktree)
  ));
  if (matches.length !== 1) {
    return {
      ok: false,
      status: 'BLOCKED',
      action: 'RECONCILE',
      task_key: taskKey,
      reason: !Array.isArray(candidates)
        ? '候选线程列表必须是数组，禁止盲目重复创建。'
        : matches.length
          ? '发现多个候选线程，必须人工绑定。'
          : '没有唯一候选线程，禁止盲目重复创建。',
      plane: clone(plane)
    };
  }

  try {
    return {
      ok: true,
      status: 'BOUND',
      action: 'RECONCILE',
      task_key: taskKey,
      plane: bindThread(plane, {
        taskKey,
        threadId: matches[0].thread_id,
        projectId: matches[0].project_id,
        hostId: matches[0].host_id,
        agentName: matches[0].agent_name,
        sandboxMode: matches[0].sandbox_mode,
        environment: matches[0].environment,
        effectiveSandboxMode: matches[0].effective_sandbox_mode,
        sandboxEvidenceRef: matches[0].sandbox_evidence_ref,
        worktree: matches[0].worktree || null
      }),
      reason: '已按唯一候选线程恢复绑定。'
    };
  } catch (error) {
    return {
      ok: false,
      status: 'BLOCKED',
      action: 'RECONCILE',
      task_key: taskKey,
      reason: `候选线程不能安全绑定：${error.message}`,
      plane: clone(plane)
    };
  }
}

export function recordTaskResult(plane, {
  taskKey,
  status = 'COMPLETED',
  evidenceRef,
  commit = null,
  producedCommit = null,
  consumedCommit = null,
  recordedAt = new Date().toISOString()
} = {}) {
  const inputValidation = validateControlPlane(plane);
  if (!inputValidation.ok) throw new Error(`Invalid control plane: ${inputValidation.errors.join('; ')}`);
  if (!isDateTime(recordedAt)) throw new Error('recordedAt must be a date-time');
  if (!['COMPLETED', 'BLOCKED'].includes(status)) {
    throw new Error(`task result status must be COMPLETED or BLOCKED; got ${status}`);
  }
  if (!evidenceRef) throw new Error('task result requires evidenceRef');
  const next = clone(plane);
  const found = findIntent(next, taskKey);
  if (!found) throw new Error(`Unknown task_key: ${taskKey}`);
  if (found.intent.status !== 'BOUND') throw new Error(`task ${taskKey} must be BOUND before recording a result`);
  assertCurrentAttempt(found.delivery, found.intent);
  assertDependenciesCompleted(next, found.intent);
  const produced = producedCommit ?? (found.intent.access === 'write' ? commit : null);
  const consumed = consumedCommit ?? (found.intent.access === 'read' ? commit : null);
  if (found.intent.access === 'read' && producedCommit) {
    throw new Error(`read task ${taskKey} cannot produce a commit`);
  }
  if (found.intent.access === 'write' && consumedCommit) {
    throw new Error(`write task ${taskKey} cannot record consumed_commit`);
  }
  if (status === 'COMPLETED' && found.intent.access === 'write' && !produced) {
    throw new Error(`task ${taskKey} requires a committed result`);
  }
  if (status === 'COMPLETED'
    && found.intent.access === 'read'
    && ['verification', 'review'].includes(found.intent.phase)
    && !consumed) {
    throw new Error(`read task ${taskKey} requires consumed_commit`);
  }
  if (status === 'COMPLETED' && found.intent.access === 'read' && consumed) {
    assertConsumedCommitMatchesCurrentDeveloper(found.delivery, found.intent, consumed);
  }

  found.intent.status = status === 'COMPLETED' ? 'COMPLETED' : 'BLOCKED';
  found.intent.result = {
    status,
    evidence_ref: evidenceRef,
    commit: produced,
    produced_commit: produced,
    consumed_commit: consumed,
    recorded_at: recordedAt
  };
  const responsibility = findResponsibility(found.delivery, found.intent.project_id, found.intent.responsibility);
  if (responsibility) responsibility.status = status === 'COMPLETED' ? 'COMPLETED' : 'BLOCKED';
  const target = found.delivery.targets.find((item) => item.project_id === found.intent.project_id);
  if (target && status === 'BLOCKED') target.status = 'BLOCKED';
  if (status === 'BLOCKED') found.delivery.status = 'BLOCKED';
  refreshDeliveryStatus(found.delivery);
  next.revision += 1;
  appendEvent(next, 'TASK_RESULT', { task_key: taskKey, status, evidence_ref: evidenceRef });
  const validation = validateControlPlane(next);
  if (!validation.ok) throw new Error(`task result produced an invalid control plane: ${validation.errors.join('; ')}`);
  return next;
}

export function recordReviewResult(plane, {
  taskKey,
  outcome,
  findings = [],
  reviewedCommit,
  evidenceRef,
  recordedAt = new Date().toISOString()
} = {}) {
  const inputValidation = validateControlPlane(plane);
  if (!inputValidation.ok) throw new Error(`Invalid control plane: ${inputValidation.errors.join('; ')}`);
  if (!REVIEW_OUTCOMES.includes(outcome)) {
    throw new Error('review outcome must be PASS or NEEDS_CHANGES; got ' + outcome);
  }
  if (!evidenceRef) throw new Error('review result requires evidenceRef');
  if (!reviewedCommit || typeof reviewedCommit !== 'string' || reviewedCommit.length < 7) {
    throw new Error('review result requires reviewedCommit');
  }
  if (!isDateTime(recordedAt)) throw new Error('recordedAt must be a date-time');
  const findingErrors = [];
  if (!Array.isArray(findings)) findingErrors.push('review findings must be an array');
  const findingIds = new Set();
  for (const finding of Array.isArray(findings) ? findings : []) {
    validateReviewFinding(finding, 'review result', findingIds, findingErrors);
  }
  if (findingErrors.length) throw new Error(findingErrors.join('; '));
  const openFindings = findings.filter((finding) => finding.status === 'OPEN');
  if (outcome === 'NEEDS_CHANGES' && openFindings.length === 0) {
    throw new Error('NEEDS_CHANGES requires at least one OPEN finding');
  }
  if (outcome === 'PASS' && openFindings.length > 0) {
    throw new Error('PASS cannot contain OPEN findings');
  }
  const next = clone(plane);
  const found = findIntent(next, taskKey);
  if (!found) throw new Error('Unknown task_key: ' + taskKey);
  if (found.intent.status !== 'BOUND') throw new Error('review task ' + taskKey + ' must be BOUND before recording a review');
  if (found.intent.access !== 'read' || found.intent.phase !== 'review') {
    throw new Error('task ' + taskKey + ' is not a read-only review task');
  }
  assertCurrentAttempt(found.delivery, found.intent);
  assertDependenciesCompleted(next, found.intent);
  const reviewed = findSingleUpstreamWriterIntent(found.delivery, found.intent);
  const producedCommit = reviewed?.intent?.result?.produced_commit || reviewed?.intent?.result?.commit || null;
  if (!producedCommit || producedCommit !== reviewedCommit) {
    throw new Error('review task ' + taskKey + ' must consume the current developer commit');
  }
  const previousReviews = reviewsForProject(found.delivery, found.intent.project_id);
  const outstandingFindings = collectOutstandingFindings(previousReviews);
  const findingsById = new Map(findings.map((finding) => [finding.id, finding]));
  if (outcome === 'PASS') {
    const unresolved = [...outstandingFindings.keys()].filter((id) => {
      const finding = findingsById.get(id);
      return !finding || finding.status === 'OPEN';
    });
    if (unresolved.length) {
      throw new Error(`PASS must resolve or waive previous findings: ${unresolved.join(', ')}`);
    }
  }
  const resolvedFindingIds = [...outstandingFindings.keys()].filter((id) => {
    const finding = findingsById.get(id);
    return finding && ['RESOLVED', 'WAIVED'].includes(finding.status);
  });
  const reviewId = 'REV-' + (next.revision + 1) + '-' + found.intent.task_key;
  const review = {
    review_id: reviewId,
    task_key: taskKey,
    outcome,
    findings: clone(findings),
    reviewed_commit: reviewedCommit,
    evidence_ref: evidenceRef,
    previous_review_id: previousReviews.at(-1)?.review_id || null,
    resolved_finding_ids: resolvedFindingIds,
    recorded_at: recordedAt
  };
  found.delivery.reviews = Array.isArray(found.delivery.reviews) ? found.delivery.reviews : [];
  found.delivery.reviews.push(review);
  found.intent.status = 'COMPLETED';
  found.intent.result = {
    status: 'COMPLETED',
    evidence_ref: evidenceRef,
    commit: null,
    produced_commit: null,
    consumed_commit: reviewedCommit,
    review: {
      review_id: reviewId,
      outcome,
      findings: clone(findings),
      reviewed_commit: reviewedCommit,
      evidence_ref: evidenceRef,
      recorded_at: recordedAt,
      resolved_finding_ids: clone(resolvedFindingIds)
    },
    recorded_at: recordedAt
  };
  const responsibility = findResponsibility(found.delivery, found.intent.project_id, found.intent.responsibility);
  if (responsibility) responsibility.status = 'COMPLETED';
  const target = found.delivery.targets.find((item) => item.project_id === found.intent.project_id);
  if (target && outcome === 'NEEDS_CHANGES') target.status = 'BLOCKED';
  if (outcome === 'NEEDS_CHANGES') found.delivery.status = 'BLOCKED';
  else refreshDeliveryStatus(found.delivery);
  next.revision += 1;
  appendEvent(next, 'REVIEW_RESULT', { task_key: taskKey, outcome, review_id: reviewId, reviewed_commit: reviewedCommit });
  const validation = validateControlPlane(next);
  if (!validation.ok) throw new Error(`review result produced an invalid control plane: ${validation.errors.join('; ')}`);
  return next;
}

export function requestRework(plane, {
  reviewTaskKey,
  reason = 'Review 要求开发者修复 findings。',
  recordedAt = new Date().toISOString()
} = {}) {
  const inputValidation = validateControlPlane(plane);
  if (!inputValidation.ok) throw new Error(`Invalid control plane: ${inputValidation.errors.join('; ')}`);
  if (!isDateTime(recordedAt)) throw new Error('recordedAt must be a date-time');
  const next = clone(plane);
  const found = findIntent(next, reviewTaskKey);
  if (!found) throw new Error('Unknown task_key: ' + reviewTaskKey);
  if (found.intent.phase !== 'review' || found.intent.result?.review?.outcome !== 'NEEDS_CHANGES') {
    throw new Error('task ' + reviewTaskKey + ' has no NEEDS_CHANGES review to rework');
  }
  assertCurrentAttempt(found.delivery, found.intent);
  const reviewed = findSingleUpstreamWriterIntent(found.delivery, found.intent);
  if (!reviewed) throw new Error('review task ' + reviewTaskKey + ' has no developer task to rework');
  const delivery = found.delivery;
  const entries = responsibilityEntries(delivery).map((entry) => ({
    ...entry,
    oldKey: buildTaskKey({
      deliveryId: delivery.delivery_id,
      projectId: entry.projectId,
      responsibility: entry.responsibility.name,
      attempt: entry.responsibility.attempt
    })
  }));
  const developerEntry = entries.find((entry) => entry.oldKey === reviewed.intent.task_key);
  const reviewEntry = entries.find((entry) => entry.oldKey === found.intent.task_key);
  if (!developerEntry || !reviewEntry) throw new Error('rework responsibilities are no longer registered');

  const affectedKeys = new Set([developerEntry.oldKey, reviewEntry.oldKey]);
  for (const entry of entries) {
    if (entry.projectId === reviewed.intent.project_id && entry.responsibility.phase === 'review') {
      affectedKeys.add(entry.oldKey);
    }
  }
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const entry of entries) {
      if (affectedKeys.has(entry.oldKey)) continue;
      const dependencies = Array.isArray(entry.responsibility.depends_on) ? entry.responsibility.depends_on : [];
      if (!dependencies.some((dependency) => affectedKeys.has(dependency))) continue;
      affectedKeys.add(entry.oldKey);
      progressed = true;
    }
  }
  const affected = entries.filter((entry) => affectedKeys.has(entry.oldKey));
  const activeOldIntent = affected
    .map((entry) => delivery.dispatch_intents?.find((intent) => intent.task_key === entry.oldKey))
    .find((intent) => intent && ['PENDING_THREAD', 'BOUND', 'UNKNOWN'].includes(intent.status));
  if (activeOldIntent) {
    throw new Error(`cannot rework while downstream task ${activeOldIntent.task_key} is active; block or complete it first`);
  }

  const replacements = new Map(affected.map((entry) => [entry.oldKey, buildTaskKey({
    deliveryId: delivery.delivery_id,
    projectId: entry.projectId,
    responsibility: entry.responsibility.name,
    attempt: entry.responsibility.attempt + 1
  })]));
  const oldDeveloperKey = reviewed.intent.task_key;
  const newDeveloperKey = replacements.get(oldDeveloperKey);
  for (const entry of affected) {
    entry.responsibility.attempt += 1;
    entry.responsibility.depends_on = (entry.responsibility.depends_on || [])
      .map((dependency) => replacements.get(dependency) || dependency);
    resetResponsibility(entry.responsibility);
  }
  const reviewRecord = delivery.reviews?.find((review) => review.task_key === reviewTaskKey && review.outcome === 'NEEDS_CHANGES');
  if (reviewRecord) {
    reviewRecord.rework_of = oldDeveloperKey;
    reviewRecord.rework_task_key = newDeveloperKey;
    reviewRecord.rework_recorded_at = recordedAt;
  }
  delivery.approval = { status: 'PENDING', decision_ref: null, approved_at: null, task_keys: [], tasks: [] };
  delivery.status = 'PREVIEW_ONLY';
  next.revision += 1;
  appendEvent(next, 'REWORK_REQUESTED', {
    review_task_key: reviewTaskKey,
    old_task_key: oldDeveloperKey,
    new_task_key: newDeveloperKey,
    reason
  });
  const validation = validateControlPlane(next);
  if (!validation.ok) throw new Error(`rework produced an invalid control plane: ${validation.errors.join('; ')}`);
  return next;
}

export function setReferenceImplementation(plane, {
  deliveryId,
  projectId,
  commit,
  snapshotRef,
  snapshotHash,
  sourceHead = null,
  handoffRef = null,
  freshness = null,
  verifiedAt = new Date().toISOString(),
  verification
} = {}) {
  const inputValidation = validateControlPlane(plane);
  if (!inputValidation.ok) throw new Error(`Invalid control plane: ${inputValidation.errors.join('; ')}`);
  const next = clone(plane);
  const delivery = requireDelivery(next, deliveryId);
  const registered = next.projects.some((project) => project.id === projectId);
  const eligible = delivery.lead_project === projectId || delivery.targets.some((item) => item.project_id === projectId);
  if (!registered || !eligible) {
    throw new Error(`project ${projectId} is not the lead or an authorized target of ${deliveryId}`);
  }
  if (!commit || !snapshotRef || !snapshotHash) throw new Error('reference requires commit, snapshotRef, and snapshotHash');
  if (typeof commit !== 'string' || commit.length < 7) throw new Error('reference commit must be at least 7 characters');
  if (!isDateTime(verifiedAt)) throw new Error('reference verifiedAt must be a date-time');
  if (!verification?.status || verification.status !== 'PASS' || verification.commit_stable !== true) {
    throw new Error('reference requires PASS verification evidence with commit_stable=true');
  }
  if (!isNonEmptyString(verification.evidence_ref)) throw new Error('reference requires verification.evidence_ref');
  const currentDeveloper = findCurrentDeveloperIntent(delivery, projectId);
  if (currentDeveloper) {
    const producedCommit = currentDeveloper.intent.result?.produced_commit || currentDeveloper.intent.result?.commit || null;
    if (producedCommit !== commit) {
      throw new Error('reference commit must match the current developer produced commit');
    }
  } else if (!isNonEmptyString(verification.source_ref)) {
    throw new Error('reference without a current developer requires verification.source_ref evidence');
  }
  if ((delivery.sync_key || delivery.handoff_ref) && (!sourceHead || !handoffRef || freshness !== 'FRESH')) {
    throw new Error('synchronized reference requires sourceHead, handoffRef and FRESH freshness');
  }
  if (delivery.handoff_ref && delivery.handoff_ref !== handoffRef) {
    throw new Error('reference handoffRef must match the delivery handoff_ref');
  }

  delivery.reference_implementation = {
    project_id: projectId,
    commit,
    snapshot_ref: snapshotRef,
    snapshot_hash: snapshotHash,
    source_head: sourceHead,
    handoff_ref: handoffRef,
    freshness,
    verified_at: verifiedAt,
    verification_ref: verification.evidence_ref
  };
  if (delivery.status === 'RUNNING' || delivery.status === 'DISPATCHING') delivery.status = 'EVIDENCE_READY';
  next.revision += 1;
  appendEvent(next, 'REFERENCE_SET', { delivery_id: deliveryId, project_id: projectId, commit, snapshot_ref: snapshotRef });
  const validation = validateControlPlane(next);
  if (!validation.ok) throw new Error(`reference produced an invalid control plane: ${validation.errors.join('; ')}`);
  return next;
}

export function recordTargetResult(plane, {
  deliveryId,
  projectId,
  status,
  evidenceRef,
  commit,
  sourceHead,
  sourceBranch = null,
  targetBranch = null,
  targetHead = null,
  snapshotRef = null,
  snapshotHash = null,
  handoffRef = null,
  freshness = null,
  differenceRef = null,
  analysisRef = null,
  unresolved,
  recordedAt = new Date().toISOString()
} = {}) {
  if (!TARGET_STATUSES.has(status) || status === 'PENDING' || status === 'DISPATCHING' || status === 'RUNNING') {
    throw new Error(`target result status must be VERIFIED, NO_CHANGE_REQUIRED, FAILED, or BLOCKED; got ${status}`);
  }
  requireNonEmptyString(evidenceRef, 'evidenceRef');
  if (!isDateTime(recordedAt)) throw new Error('recordedAt must be a date-time');
  for (const [name, value] of Object.entries({
    sourceHead,
    sourceBranch,
    targetBranch,
    targetHead,
    snapshotRef,
    snapshotHash,
    handoffRef,
    freshness,
    differenceRef,
    analysisRef
  })) {
    if (value !== null && value !== undefined && typeof value !== 'string') {
      throw new Error(`${name} must be a string or null`);
    }
  }
  if (commit !== null && commit !== undefined
    && (typeof commit !== 'string' || commit.length < 7)) {
    throw new Error('commit must be a commit string of at least 7 characters or null');
  }
  const inputValidation = validateControlPlane(plane);
  if (!inputValidation.ok) throw new Error(`Invalid control plane: ${inputValidation.errors.join('; ')}`);
  const next = clone(plane);
  const delivery = requireDelivery(next, deliveryId);
  const target = (Array.isArray(delivery.targets) ? delivery.targets : [])
    .find((item) => item?.project_id === projectId);
  if (!target) throw new Error(`project ${projectId} is not an authorized target of ${deliveryId}`);
  if (SUCCESS_TARGET_STATUSES.has(target.status)) {
    throw new Error(`target ${projectId} already has a successful result for the current attempt; create a new attempt before replaying a result`);
  }
  if (!['DISPATCHING', 'RUNNING', 'EVIDENCE_READY', 'BLOCKED', 'UNKNOWN'].includes(delivery.status)) {
    throw new Error(`delivery ${deliveryId} is not ready to record a target result`);
  }
  const targetResponsibilities = target.responsibilities || [];
  let reviewedCommit = null;
  const noChange = status === 'NO_CHANGE_REQUIRED';
  if (status === 'VERIFIED') {
    if (!targetResponsibilities.every((item) => item.status === 'COMPLETED')) {
      throw new Error(`target ${projectId} has incomplete responsibility tasks`);
    }
    assertTargetTasksCompleted(delivery, target);
    reviewedCommit = assertReviewPassForTarget(delivery, target, commit || null);
  } else if (noChange) {
    assertNoChangeRequired(delivery, target, {
      evidenceRef,
      analysisRef,
      differenceRef,
      targetHead,
      unresolved
    });
  }
  if (!SUCCESS_TARGET_STATUSES.has(status)) {
    if (!targetResponsibilities.some((item) => item.status === 'BLOCKED')) {
      throw new Error(`failed target result requires a blocked responsibility task`);
    }
    assertTargetHasBlockedTask(delivery, target);
  }

  if (SUCCESS_TARGET_STATUSES.has(status)) {
    if (!sourceHead) throw new Error('successful target result requires sourceHead');
    if (status === 'VERIFIED' && !commit) throw new Error('VERIFIED target result requires commit');
    if (noChange && commit !== null && commit !== undefined) {
      throw new Error('NO_CHANGE_REQUIRED target result cannot contain a commit');
    }
    const requiresSyncCheckpoint = Boolean(delivery.sync_key || delivery.handoff_ref || target.sync_key || target.handoff_ref);
    if (requiresSyncCheckpoint) {
      const requiredSyncFields = {
        snapshotRef,
        snapshotHash,
        handoffRef,
        differenceRef,
        sourceBranch,
        sourceHead,
        targetBranch,
        targetHead
      };
      const missing = Object.entries(requiredSyncFields).filter(([, value]) => !value).map(([name]) => name);
      if (missing.length || freshness !== 'FRESH') {
        throw new Error(`synchronized target result requires FRESH snapshot, handoff, branches, heads and difference evidence; missing: ${missing.join(', ') || 'freshness'}`);
      }
      if (delivery.handoff_ref && delivery.handoff_ref !== handoffRef) {
        throw new Error('synchronized target result handoffRef must match the delivery handoff_ref');
      }
      if (status === 'VERIFIED' && targetHead !== commit) {
        throw new Error('VERIFIED synchronized target requires targetHead to match commit');
      }
    }
    if (noChange && (!differenceRef || !targetHead)) {
      throw new Error('NO_CHANGE_REQUIRED target result requires differenceRef and targetHead');
    }
    if (noChange) markDownstreamResponsibilitiesSkipped(delivery, target, recordedAt);
    target.status = status;
    target.last_result = {
      status,
      evidence_ref: evidenceRef,
      analysis_ref: noChange ? (analysisRef || evidenceRef) : null,
      commit: noChange ? null : commit,
      reviewed_commit: reviewedCommit,
      source_head: sourceHead,
      target_head: targetHead || (noChange ? null : commit || null),
      difference_ref: differenceRef,
      unresolved: noChange ? [] : (Array.isArray(unresolved) ? clone(unresolved) : []),
      recorded_at: recordedAt
    };
    target.checkpoint = {
      source_head: sourceHead,
      source_branch: sourceBranch,
      target_head: targetHead || (noChange ? null : commit || target.checkpoint?.target_head || null),
      target_branch: targetBranch,
      commit: noChange ? null : (commit || target.checkpoint?.commit || null),
      evidence_ref: evidenceRef,
      snapshot_ref: snapshotRef || null,
      snapshot_hash: snapshotHash || null,
      handoff_ref: handoffRef || null,
      freshness: freshness || null,
      difference_ref: differenceRef || null,
      reviewed_commit: reviewedCommit,
      recorded_at: recordedAt
    };
  } else {
    target.status = status;
    target.last_result = {
      status,
      evidence_ref: evidenceRef,
      analysis_ref: null,
      commit: null,
      reviewed_commit: null,
      source_head: sourceHead || null,
      target_head: targetHead || null,
      difference_ref: differenceRef || null,
      unresolved: Array.isArray(unresolved) ? clone(unresolved) : null,
      recorded_at: recordedAt
    };
    // A failed target must retain its previous checkpoint for the next retry.
    delivery.status = 'BLOCKED';
  }

  const targetsVerified = delivery.targets.length && delivery.targets.every((item) => SUCCESS_TARGET_STATUSES.has(item.status));
  const leadVerified = delivery.targets.some((item) => item.project_id === delivery.lead_project)
    || areResponsibilityTasksCompleted(delivery, delivery.lead_project, delivery.lead_responsibilities);
  if (targetsVerified && leadVerified) {
    delivery.status = 'VERIFIED';
  } else {
    refreshDeliveryStatus(delivery);
  }
  next.revision += 1;
  appendEvent(next, 'TARGET_RESULT', { delivery_id: deliveryId, project_id: projectId, status, evidence_ref: evidenceRef || null });
  const validation = validateControlPlane(next);
  if (!validation.ok) throw new Error(`target result produced an invalid control plane: ${validation.errors.join('; ')}`);
  return next;
}

function normalizeControlProject(project = {}) {
  project = project && typeof project === 'object' ? project : {};
  return {
    ...project,
    id: project.id,
    name: hasOwn(project, 'name') ? project.name : project.id,
    path: project.path,
    role: 'control'
  };
}

function normalizeProject(project = {}) {
  project = project && typeof project === 'object' ? project : {};
  return {
    ...project,
    id: project.id,
    name: hasOwn(project, 'name') ? project.name : project.id,
    path: project.path,
    codex_project_id: hasOwn(project, 'codex_project_id') ? project.codex_project_id : null,
    status: hasOwn(project, 'status') ? project.status : 'active'
  };
}

function normalizeDelivery(delivery = {}) {
  delivery = delivery && typeof delivery === 'object' ? delivery : {};
  const approval = delivery.approval === undefined ? {} : delivery.approval;
  const leadIsTarget = Array.isArray(delivery.targets)
    && delivery.targets.some((target) => target?.project_id === delivery.lead_project);
  return {
    ...delivery,
    delivery_id: delivery.delivery_id,
    title: hasOwn(delivery, 'title') ? delivery.title : delivery.delivery_id,
    request_ref: hasOwn(delivery, 'request_ref') ? delivery.request_ref : null,
    origin_project: delivery.origin_project,
    requirement_owner: delivery.requirement_owner,
    lead_project: delivery.lead_project,
    lead_responsibilities: normalizeResponsibilities({
      responsibilities: delivery.lead_responsibilities === undefined
        ? leadIsTarget
          ? []
          : [{ name: 'development', access: 'write', status: 'PENDING', attempt: 1 }]
        : delivery.lead_responsibilities
    }),
    reference_implementation: !hasOwn(delivery, 'reference_implementation') || delivery.reference_implementation === null
      ? null
      : clone(delivery.reference_implementation),
    targets: (Array.isArray(delivery.targets) ? delivery.targets : []).map((target) => {
      const source = target && typeof target === 'object' ? target : {};
      return {
        ...source,
        project_id: source.project_id,
        status: hasOwn(source, 'status') ? source.status : 'PENDING',
        checkpoint: hasOwn(source, 'checkpoint') ? clone(source.checkpoint) : null,
        last_result: hasOwn(source, 'last_result') ? clone(source.last_result) : null,
        responsibilities: normalizeResponsibilities(source)
      };
    }),
    status: hasOwn(delivery, 'status') ? delivery.status : 'DRAFT',
    approval: approval && typeof approval === 'object' && !Array.isArray(approval)
      ? {
          ...approval,
          status: hasOwn(approval, 'status') ? approval.status : 'PENDING',
          decision_ref: hasOwn(approval, 'decision_ref') ? approval.decision_ref : null,
          approved_at: hasOwn(approval, 'approved_at') ? approval.approved_at : null,
          task_keys: hasOwn(approval, 'task_keys') ? clone(approval.task_keys) : [],
          tasks: hasOwn(approval, 'tasks') ? clone(approval.tasks) : []
        }
      : approval,
    reviews: delivery.reviews === undefined ? [] : clone(delivery.reviews),
    dispatch_intents: delivery.dispatch_intents === undefined ? [] : clone(delivery.dispatch_intents),
    decisions: Array.isArray(delivery.decisions) ? clone(delivery.decisions) : [],
    artifacts: Array.isArray(delivery.artifacts) ? clone(delivery.artifacts) : []
  };
}

function buildTaskPlans(delivery) {
  const plans = [];
  const targets = Array.isArray(delivery?.targets) ? delivery.targets : [];
  if (!targets.some((target) => target.project_id === delivery.lead_project)) {
    plans.push(...buildResponsibilityPlans(delivery, delivery.lead_project, delivery.lead_responsibilities));
  }
  for (const target of targets) {
    plans.push(...buildResponsibilityPlans(delivery, target.project_id, target.responsibilities));
  }
  return plans;
}

function buildPlanMap(delivery) {
  try {
    return new Map(buildTaskPlans(delivery).map((plan) => [plan.task_key, plan]));
  } catch {
    return new Map();
  }
}

function buildResponsibilityPlans(delivery, projectId, responsibilities) {
  return (Array.isArray(responsibilities) ? responsibilities : []).map((responsibility) => ({
    task_key: buildTaskKey({
      deliveryId: delivery.delivery_id,
      projectId,
      responsibility: responsibility.name,
      attempt: responsibility.attempt || 1
    }),
    project_id: projectId,
    responsibility: responsibility.name,
    access: responsibility.access,
    phase: responsibility.phase,
    depends_on: [...(responsibility.depends_on || [])],
    attempt: responsibility.attempt || 1,
    writer: responsibility.access === 'write',
    distribution_prompt: buildDistributionPrompt(delivery, projectId, responsibility.name)
  }));
}

/**
 * Freeze the source handoff and target decision into every task plan. The
 * host can pass this object verbatim as the child task's initial context.
 */
function buildDistributionPrompt(delivery, projectId, responsibility) {
  const base = delivery?.distribution_prompt && typeof delivery.distribution_prompt === 'object'
    ? clone(delivery.distribution_prompt)
    : {};
  return {
    ...base,
    delivery_id: delivery?.delivery_id || null,
    source_project: base.source_project || delivery?.requirement_owner || delivery?.origin_project || null,
    source_head: base.source_head || delivery?.reference_implementation?.commit || null,
    handoff_ref: base.handoff_ref || delivery?.handoff_ref || null,
    target_project: projectId,
    // The approved task snapshot must stay stable while ANL-TARGET is being
    // consumed. A later human decision is carried by a new approval attempt,
    // not by mutating an existing task plan.
    target_decision: base.target_decision || null,
    responsibility,
    task_mode: delivery?.task_mode || 'standard'
  };
}

function buildApprovalTasks(delivery) {
  return buildTaskPlans(delivery)
    .map(({ task_key, project_id, responsibility, access, phase, depends_on, attempt, distribution_prompt }) => ({
      task_key,
      project_id,
      responsibility,
      access,
      phase,
      depends_on,
      attempt,
      distribution_prompt
    }))
    .sort((left, right) => left.task_key.localeCompare(right.task_key));
}

function normalizeResponsibilities(target) {
  target = target || {};
  if (hasOwn(target, 'responsibilities') && !Array.isArray(target.responsibilities)) {
    return target.responsibilities;
  }
  const responsibilities = hasOwn(target, 'responsibilities')
    ? target.responsibilities
    : target.responsibility
      ? [{
          name: target.responsibility,
          access: hasOwn(target, 'access') ? target.access : inferAccess(target.responsibility),
          phase: hasOwn(target, 'phase') ? target.phase : inferPhase(target.responsibility),
          attempt: hasOwn(target, 'attempt') ? target.attempt : 1,
          status: 'PENDING',
          thread_id: hasOwn(target, 'thread_id') ? target.thread_id : null,
          depends_on: hasOwn(target, 'depends_on') ? target.depends_on : []
        }]
      : [];

  return responsibilities.map((responsibility) => {
    const source = responsibility && typeof responsibility === 'object' ? responsibility : {};
    return {
      ...source,
      name: source.name,
      access: hasOwn(source, 'access') ? source.access : inferAccess(source.name),
      phase: hasOwn(source, 'phase') ? source.phase : inferPhase(source.name),
      attempt: hasOwn(source, 'attempt') ? source.attempt : 1,
      status: hasOwn(source, 'status') ? source.status : 'PENDING',
      thread_id: hasOwn(source, 'thread_id') ? source.thread_id : null,
      depends_on: hasOwn(source, 'depends_on') ? source.depends_on : []
    };
  });
}

function validateResponsibilities(responsibilities, context, errors) {
  const responsibilityNames = new Set();
  if (!Array.isArray(responsibilities) || responsibilities.length === 0) return;
  for (const responsibility of responsibilities) {
    if (!responsibility?.name) {
      errors.push(`${context} has responsibility without name`);
      continue;
    }
    if (typeof responsibility.name !== 'string') errors.push(`${context} responsibility name must be a string`);
    if (String(responsibility.name).includes('/')) errors.push(`${context} responsibility name cannot contain /: ${responsibility.name}`);
    if (responsibilityNames.has(responsibility.name)) {
      errors.push(`${context} has duplicate responsibility ${responsibility.name}`);
    }
    responsibilityNames.add(responsibility.name);
    if (!['read', 'write'].includes(responsibility.access)) {
      errors.push(`responsibility ${responsibility.name} in ${context} requires read or write access`);
    }
    if (!RESPONSIBILITY_PHASES.has(responsibility.phase)) {
      errors.push(`responsibility ${responsibility.name} in ${context} has invalid phase ${responsibility.phase}`);
    }
    if (!Number.isInteger(responsibility.attempt) || responsibility.attempt < 1) {
      errors.push(`responsibility ${responsibility.name} in ${context} requires a positive attempt`);
    }
    if (!Array.isArray(responsibility.depends_on)) {
      errors.push(`responsibility ${responsibility.name} in ${context} requires depends_on array`);
    }
    if (!RESPONSIBILITY_STATUSES.has(responsibility.status)) {
      errors.push(`responsibility ${responsibility.name} in ${context} has invalid status ${responsibility.status}`);
    }
    if (['SKIPPED', 'NOT_APPLICABLE'].includes(responsibility.status)) {
      if (!isNonEmptyString(responsibility.skip_reason)) {
        errors.push(`responsibility ${responsibility.name} in ${context} requires skip_reason`);
      }
      if (!isNonEmptyString(responsibility.skip_evidence_ref)) {
        errors.push(`responsibility ${responsibility.name} in ${context} requires skip_evidence_ref`);
      }
      if (responsibility.skipped_at !== undefined && !isDateTime(responsibility.skipped_at)) {
        errors.push(`responsibility ${responsibility.name} in ${context} skipped_at must be a date-time`);
      }
    }
  }
}

function validateRuntimeState(runtime, errors) {
  if (runtime === undefined || runtime === null) return;
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)) {
    errors.push('runtime must be an object or null');
    return;
  }
  const ids = runtime.processed_receipt_ids;
  if (ids !== undefined) {
    if (!Array.isArray(ids)) {
      errors.push('runtime.processed_receipt_ids must be an array');
    } else {
      const unique = new Set();
      for (const id of ids) {
        if (!isNonEmptyString(id)) errors.push('runtime.processed_receipt_ids requires non-empty strings');
        if (unique.has(id)) errors.push(`runtime has duplicate processed receipt id ${id}`);
        unique.add(id);
      }
    }
  }
  if (runtime.processed_receipts !== undefined) {
    if (!Array.isArray(runtime.processed_receipts)) {
      errors.push('runtime.processed_receipts must be an array');
    } else {
      const unique = new Set();
      for (const receipt of runtime.processed_receipts) {
        if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
          errors.push('runtime.processed_receipts contains a non-object entry');
          continue;
        }
        for (const field of ['receipt_id', 'task_key', 'kind']) {
          if (!isNonEmptyString(receipt[field])) errors.push(`runtime processed receipt requires ${field}`);
        }
        if (!Number.isInteger(receipt.attempt) || receipt.attempt < 1) {
          errors.push(`runtime processed receipt ${receipt.receipt_id || '(unknown)'} requires positive attempt`);
        }
        if (unique.has(receipt.receipt_id)) errors.push(`runtime has duplicate processed receipt ${receipt.receipt_id}`);
        unique.add(receipt.receipt_id);
      }
    }
  }
  if (runtime.deliveries !== undefined
    && (!runtime.deliveries || typeof runtime.deliveries !== 'object' || Array.isArray(runtime.deliveries))) {
    errors.push('runtime.deliveries must be an object');
  }
}

function validateTargetAnalysis(analysis, context, errors) {
  if (analysis === undefined || analysis === null) return;
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) {
    errors.push(`target ${context} analysis must be an object or null`);
    return;
  }
  for (const field of ['analysis_ref', 'evidence_ref']) {
    if (!isNonEmptyString(analysis[field]) || !/^ANL-TARGET(?:-|:|$)/.test(analysis[field])) {
      errors.push(`target ${context} analysis ${field} must be ANL-TARGET evidence`);
    }
  }
  if (analysis.analysis_ref && analysis.evidence_ref && analysis.analysis_ref !== analysis.evidence_ref) {
    errors.push(`target ${context} analysis_ref must equal evidence_ref`);
  }
  if (!isNonEmptyString(analysis.difference_ref)) errors.push(`target ${context} analysis requires difference_ref`);
  if (!Array.isArray(analysis.knowledge_refs) || analysis.knowledge_refs.length === 0
    || analysis.knowledge_refs.some((ref) => !isNonEmptyString(ref))) {
    errors.push(`target ${context} analysis requires knowledge_refs`);
  }
  if (!TARGET_DIFFERENCE_DECISIONS.includes(analysis.decision)) {
    errors.push(`target ${context} analysis has invalid decision ${analysis.decision}`);
  }
  if (!['PENDING', 'APPROVED'].includes(analysis.decision_status)) {
    errors.push(`target ${context} analysis has invalid decision_status ${analysis.decision_status}`);
  }
  if (!Number.isInteger(analysis.attempt) || analysis.attempt < 1) {
    errors.push(`target ${context} analysis requires positive attempt`);
  }
  if (!isNonEmptyString(analysis.source_head)) errors.push(`target ${context} analysis requires source_head`);
  if (!isNonEmptyString(analysis.target_head)) errors.push(`target ${context} analysis requires target_head`);
  if (!['HIGH', 'MEDIUM', 'LOW'].includes(analysis.confidence)) {
    errors.push(`target ${context} analysis requires HIGH, MEDIUM, or LOW confidence`);
  }
  if (!Array.isArray(analysis.unresolved)) errors.push(`target ${context} analysis requires unresolved array`);
  if (analysis.reference_commit !== undefined && analysis.reference_commit !== null
    && (!isNonEmptyString(analysis.reference_commit) || analysis.reference_commit.length < 7)) {
    errors.push(`target ${context} analysis reference_commit must be null or a commit`);
  }
  if (analysis.decision_status === 'APPROVED') {
    if (!['AUTO', 'HUMAN'].includes(analysis.decision_origin)) {
      errors.push(`target ${context} approved analysis requires decision_origin`);
    }
    if (!isNonEmptyString(analysis.decision_ref)) errors.push(`target ${context} approved analysis requires decision_ref`);
    if (!isDateTime(analysis.decided_at)) errors.push(`target ${context} approved analysis requires decided_at`);
    if (analysis.decision_origin === 'AUTO'
      && (analysis.decision !== 'DIRECT' || analysis.confidence !== 'HIGH' || analysis.unresolved?.length)) {
      errors.push(`target ${context} AUTO approval only permits HIGH-confidence DIRECT with unresolved=[]`);
    }
    if (analysis.decision !== 'BLOCKED' && analysis.unresolved?.length) {
      errors.push(`target ${context} approved ${analysis.decision} requires unresolved=[]`);
    }
  }
}

function validateTargetCheckpoint(delivery, target, errors) {
  if (target?.checkpoint === null || target?.checkpoint === undefined) return;
  const context = `target ${target.project_id} in ${delivery.delivery_id} checkpoint`;
  if (!target.checkpoint || typeof target.checkpoint !== 'object' || Array.isArray(target.checkpoint)) {
    errors.push(`${context} must be an object or null`);
    return;
  }
  for (const field of ['source_head', 'evidence_ref', 'recorded_at']) {
    if (!target.checkpoint[field]) errors.push(`${context} requires ${field}`);
    else if (typeof target.checkpoint[field] !== 'string') errors.push(`${context} ${field} must be a string`);
  }
  if (target.checkpoint.recorded_at && !isDateTime(target.checkpoint.recorded_at)) {
    errors.push(`${context} recorded_at must be a date-time`);
  }
  for (const field of [
    'source_branch',
    'target_branch',
    'target_head',
    'commit',
    'snapshot_ref',
    'snapshot_hash',
    'handoff_ref',
    'freshness',
    'difference_ref',
    'reviewed_commit'
  ]) {
    if (target.checkpoint[field] !== undefined
      && target.checkpoint[field] !== null
      && typeof target.checkpoint[field] !== 'string') {
      errors.push(`${context} ${field} must be a string or null`);
    }
  }
  const synchronized = Boolean(delivery.sync_key || delivery.handoff_ref || target.sync_key || target.handoff_ref);
  const noChange = target.status === 'NO_CHANGE_REQUIRED';
  if (noChange) {
    if (target.checkpoint.commit !== null && target.checkpoint.commit !== undefined) {
      errors.push(`${context} NO_CHANGE_REQUIRED checkpoint commit must be null`);
    }
    if (!target.checkpoint.target_head) errors.push(`${context} NO_CHANGE_REQUIRED requires target_head`);
    if (!target.checkpoint.difference_ref) errors.push(`${context} NO_CHANGE_REQUIRED requires difference_ref`);
    if (target.checkpoint.reviewed_commit !== null && target.checkpoint.reviewed_commit !== undefined) {
      errors.push(`${context} NO_CHANGE_REQUIRED checkpoint reviewed_commit must be null`);
    }
  }
  if (!synchronized) return;
  for (const field of [
    'snapshot_ref',
    'snapshot_hash',
    'handoff_ref',
    'difference_ref',
    'source_branch',
    'source_head',
    'target_branch',
    'target_head'
  ]) {
    if (!target.checkpoint[field]) errors.push(`${context} requires ${field}`);
    else if (typeof target.checkpoint[field] !== 'string') errors.push(`${context} ${field} must be a string`);
  }
  if (!noChange) {
    if (!target.checkpoint.reviewed_commit) errors.push(`${context} requires reviewed_commit`);
    else if (typeof target.checkpoint.reviewed_commit !== 'string') errors.push(`${context} reviewed_commit must be a string`);
  }
  if (target.checkpoint.freshness !== 'FRESH') errors.push(`${context} freshness must be FRESH`);
}

function validateTargetLastResult(delivery, target, errors) {
  if (target?.last_result === null || target?.last_result === undefined) {
    if (SUCCESS_TARGET_STATUSES.has(target?.status)) {
      errors.push(`target ${target.project_id} in ${delivery.delivery_id} success status requires last_result`);
    }
    return;
  }
  const context = `target ${target.project_id} in ${delivery.delivery_id} last_result`;
  const result = target.last_result;
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    errors.push(`${context} must be an object or null`);
    return;
  }
  if (!result.status || result.status !== target.status) errors.push(`${context} status must match target status`);
  if (!isNonEmptyString(result.evidence_ref)) errors.push(`${context} requires evidence_ref`);
  for (const field of ['commit', 'reviewed_commit']) {
    if (result[field] !== null && result[field] !== undefined
      && (typeof result[field] !== 'string' || result[field].length < 7)) {
      errors.push(`${context} ${field} must be a commit string or null`);
    }
  }
  for (const field of ['source_head', 'target_head', 'difference_ref', 'analysis_ref']) {
    if (result[field] !== null && result[field] !== undefined && typeof result[field] !== 'string') {
      errors.push(`${context} ${field} must be a string or null`);
    }
  }
  if (!result.recorded_at || !isDateTime(result.recorded_at)) errors.push(`${context} requires a date-time recorded_at`);
  if (result.unresolved !== undefined && result.unresolved !== null && !Array.isArray(result.unresolved)) {
    errors.push(`${context} unresolved must be an array or null`);
  }
  if (SUCCESS_TARGET_STATUSES.has(target.status) && !isNonEmptyString(result.source_head)) {
    errors.push(`${context} success result requires source_head`);
  }
  if (target.status === 'VERIFIED') {
    if (!isNonEmptyString(result.commit)) errors.push(`${context} VERIFIED requires commit`);
    if (!isNonEmptyString(result.reviewed_commit)) errors.push(`${context} VERIFIED requires reviewed_commit`);
    if (result.commit && result.reviewed_commit && result.commit !== result.reviewed_commit) {
      errors.push(`${context} VERIFIED commit must match reviewed_commit`);
    }
  }
  if (target.status === 'NO_CHANGE_REQUIRED') {
    if (result.commit !== null && result.commit !== undefined) errors.push(`${context} NO_CHANGE_REQUIRED commit must be null`);
    if (result.reviewed_commit !== null && result.reviewed_commit !== undefined) errors.push(`${context} NO_CHANGE_REQUIRED reviewed_commit must be null`);
    if (!isNonEmptyString(result.difference_ref)) errors.push(`${context} NO_CHANGE_REQUIRED requires difference_ref`);
    if (!isNonEmptyString(result.target_head)) errors.push(`${context} NO_CHANGE_REQUIRED requires target_head`);
    if (!Array.isArray(result.unresolved) || result.unresolved.length !== 0) errors.push(`${context} NO_CHANGE_REQUIRED unresolved must be []`);
    if (!isNonEmptyString(result.analysis_ref) || !/^ANL-TARGET(?:-|:|$)/.test(result.analysis_ref)) {
      errors.push(`${context} NO_CHANGE_REQUIRED requires ANL-TARGET analysis_ref`);
    }
  }
}

function validateTargetSuccessConsistency(delivery, target, errors) {
  if (!SUCCESS_TARGET_STATUSES.has(target?.status)) return;
  const context = `target ${target.project_id} in ${delivery.delivery_id}`;
  if (!target.checkpoint || typeof target.checkpoint !== 'object' || Array.isArray(target.checkpoint)) {
    errors.push(`${context} success status requires checkpoint`);
    return;
  }
  if (!target.last_result || typeof target.last_result !== 'object' || Array.isArray(target.last_result)) return;
  for (const field of [
    'source_head',
    'target_head',
    'commit',
    'evidence_ref',
    'difference_ref',
    'reviewed_commit',
    'recorded_at'
  ]) {
    const checkpointValue = target.checkpoint[field] ?? null;
    const resultValue = target.last_result[field] ?? null;
    if (checkpointValue !== resultValue) errors.push(`${context} checkpoint ${field} must match last_result`);
  }
  const intents = Array.isArray(delivery.dispatch_intents) ? delivery.dispatch_intents : [];
  const responsibilities = Array.isArray(target.responsibilities) ? target.responsibilities : [];
  if (target.status === 'VERIFIED') {
    if (!responsibilities.length || responsibilities.some((responsibility) => responsibility.status !== 'COMPLETED')) {
      errors.push(`${context} VERIFIED requires all current responsibilities COMPLETED`);
    }
    for (const responsibility of responsibilities) {
      let taskKey;
      try {
        taskKey = buildTaskKey({
          deliveryId: delivery.delivery_id,
          projectId: target.project_id,
          responsibility: responsibility.name,
          attempt: responsibility.attempt
        });
      } catch {
        continue;
      }
      if (intents.find((intent) => intent?.task_key === taskKey)?.status !== 'COMPLETED') {
        errors.push(`${context} VERIFIED requires completed task ${taskKey}`);
      }
    }
    try {
      assertReviewPassForTarget(delivery, target, target.last_result.commit);
    } catch (error) {
      errors.push(`${context} VERIFIED review gate failed: ${error.message}`);
    }
    return;
  }
  const analysisResponsibilities = responsibilities.filter(isAnalysisResponsibility);
  if (!analysisResponsibilities.length) errors.push(`${context} NO_CHANGE_REQUIRED requires analysis responsibility`);
  for (const responsibility of analysisResponsibilities) {
    let taskKey;
    try {
      taskKey = buildTaskKey({
        deliveryId: delivery.delivery_id,
        projectId: target.project_id,
        responsibility: responsibility.name,
        attempt: responsibility.attempt
      });
    } catch {
      continue;
    }
    const intent = intents.find((item) => item?.task_key === taskKey);
    if (responsibility.status !== 'COMPLETED' || intent?.status !== 'COMPLETED') {
      errors.push(`${context} NO_CHANGE_REQUIRED requires completed analysis task ${taskKey}`);
    }
    if (intent?.result?.evidence_ref !== target.last_result.analysis_ref) {
      errors.push(`${context} analysis task ${taskKey} evidence must match last_result.analysis_ref`);
    }
  }
  for (const responsibility of responsibilities.filter((item) => !isAnalysisResponsibility(item))) {
    if (!['SKIPPED', 'NOT_APPLICABLE'].includes(responsibility.status)) {
      errors.push(`${context} NO_CHANGE_REQUIRED downstream responsibility ${responsibility.name} must be skipped`);
    }
    let taskKey;
    try {
      taskKey = buildTaskKey({
        deliveryId: delivery.delivery_id,
        projectId: target.project_id,
        responsibility: responsibility.name,
        attempt: responsibility.attempt
      });
    } catch {
      continue;
    }
    const intent = intents.find((item) => item?.task_key === taskKey);
    if (intent && intent.status !== 'SKIPPED') {
      errors.push(`${context} NO_CHANGE_REQUIRED downstream task ${taskKey} must not be dispatched`);
    }
  }
}

function validateReviewRecord(review, deliveryId, errors) {
  const context = `delivery ${deliveryId} review`;
  if (!review || typeof review !== 'object' || Array.isArray(review)) {
    errors.push(`${context} must be an object`);
    return;
  }
  for (const field of ['review_id', 'task_key', 'outcome', 'reviewed_commit', 'evidence_ref', 'recorded_at']) {
    if (!review[field]) errors.push(`${context} requires ${field}`);
  }
  for (const field of ['review_id', 'task_key', 'evidence_ref']) {
    if (review[field] !== undefined && typeof review[field] !== 'string') errors.push(`${context} ${field} must be a string`);
  }
  if (review.outcome && !REVIEW_OUTCOMES.includes(review.outcome)) {
    errors.push(`${context} has invalid outcome ${review.outcome}`);
  }
  if (review.reviewed_commit !== undefined && review.reviewed_commit !== null
    && (typeof review.reviewed_commit !== 'string' || review.reviewed_commit.length < 7)) {
    errors.push(`${context} reviewed_commit must be at least 7 characters`);
  }
  if (review.recorded_at && !isDateTime(review.recorded_at)) {
    errors.push(`${context} recorded_at must be a date-time`);
  }
  if (!Array.isArray(review.findings)) {
    errors.push(`${context} findings must be an array`);
  } else {
    const findingIds = new Set();
    for (const finding of review.findings) {
      validateReviewFinding(finding, context, findingIds, errors);
    }
    const openFindings = review.findings.filter((finding) => finding?.status === 'OPEN');
    if (review.outcome === 'PASS' && openFindings.length) errors.push(`${context} PASS cannot contain OPEN findings`);
    if (review.outcome === 'NEEDS_CHANGES' && !openFindings.length) errors.push(`${context} NEEDS_CHANGES requires an OPEN finding`);
  }
  if (review.resolved_finding_ids !== undefined && !Array.isArray(review.resolved_finding_ids)) {
    errors.push(`${context} resolved_finding_ids must be an array`);
  }
}

function validateReviewFinding(finding, context, findingIds, errors) {
  if (!finding || typeof finding !== 'object' || Array.isArray(finding)) {
    errors.push(`${context} contains a non-object finding`);
    return;
  }
  for (const field of ['id', 'severity', 'file', 'line', 'description', 'status', 'acceptance']) {
    if (finding[field] === undefined || finding[field] === null || finding[field] === '') {
      errors.push(`${context} finding requires ${field}`);
    }
  }
  if (findingIds.has(finding.id)) errors.push(`${context} has duplicate finding ${finding.id}`);
  findingIds.add(finding.id);
  for (const field of ['id', 'file', 'description', 'acceptance']) {
    if (typeof finding[field] !== 'string') errors.push(`${context} finding ${finding.id} ${field} must be a string`);
  }
  if (finding.severity && !['P0', 'P1', 'P2', 'P3'].includes(finding.severity)) {
    errors.push(`${context} finding ${finding.id} has invalid severity`);
  }
  if (finding.status && !REVIEW_FINDING_STATUSES.includes(finding.status)) {
    errors.push(`${context} finding ${finding.id} has invalid status`);
  }
  if (!Number.isInteger(finding.line) || finding.line < 1) {
    errors.push(`${context} finding ${finding.id} line must be a positive integer`);
  }
}

function validateIntentResult(intent, responsibility, delivery, errors) {
  if (intent?.status === 'SKIPPED') {
    const skippedContext = `task ${intent.task_key} result`;
    if (!intent.result || typeof intent.result !== 'object' || Array.isArray(intent.result)) {
      errors.push(`${skippedContext} is required for SKIPPED task`);
      return;
    }
    if (intent.result.status !== 'SKIPPED') errors.push(`${skippedContext} status must be SKIPPED`);
    if (!isNonEmptyString(intent.result.reason)) errors.push(`${skippedContext} requires reason`);
    if (intent.result.evidence_ref !== undefined && intent.result.evidence_ref !== null
      && !isNonEmptyString(intent.result.evidence_ref)) {
      errors.push(`${skippedContext} evidence_ref must be a non-empty string or null`);
    }
    if (!isDateTime(intent.result.recorded_at)) errors.push(`${skippedContext} requires a date-time recorded_at`);
    if (!responsibility || !['SKIPPED', 'NOT_APPLICABLE'].includes(responsibility.status)) {
      errors.push(`${skippedContext} requires responsibility status SKIPPED or NOT_APPLICABLE`);
    }
    return;
  }
  if (!['COMPLETED', 'BLOCKED'].includes(intent?.status)) return;
  const context = `task ${intent.task_key} result`;
  const result = intent.result;
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    errors.push(`${context} is required for ${intent.status} task`);
    return;
  }
  if (result.status !== intent.status) errors.push(`${context} status must match intent status`);
  if (intent.status === 'COMPLETED' && (!result.evidence_ref || typeof result.evidence_ref !== 'string')) {
    errors.push(`${context} requires a string evidence_ref`);
  }
  if (intent.status === 'BLOCKED' && result.evidence_ref !== null && result.evidence_ref !== undefined
    && typeof result.evidence_ref !== 'string') {
    errors.push(`${context} evidence_ref must be a string or null`);
  }
  if (!result.recorded_at || !isDateTime(result.recorded_at)) errors.push(`${context} requires a date-time recorded_at`);
  const produced = result.produced_commit ?? result.commit ?? null;
  const consumed = result.consumed_commit ?? null;
  if (intent.status === 'COMPLETED' && intent.access === 'write') {
    if (typeof produced !== 'string' || produced.length < 7) errors.push(`${context} write task requires produced_commit`);
    if (consumed !== null && consumed !== undefined) errors.push(`${context} write task cannot contain consumed_commit`);
  }
  if (intent.status === 'COMPLETED' && intent.access === 'read') {
    if (produced !== null && produced !== undefined) errors.push(`${context} read task cannot contain produced_commit`);
    if (['verification', 'review'].includes(intent.phase)
      && (typeof consumed !== 'string' || consumed.length < 7)) {
      errors.push(`${context} read ${intent.phase} task requires consumed_commit`);
    }
  }
  if (intent.status === 'COMPLETED' && intent.phase === 'review') {
    const review = result.review;
    if (!review || typeof review !== 'object' || Array.isArray(review)) {
      errors.push(`${context} review task requires result.review`);
    } else {
      if (!REVIEW_OUTCOMES.includes(review.outcome)) errors.push(`${context} has invalid review outcome`);
      if (typeof review.reviewed_commit !== 'string' || review.reviewed_commit.length < 7) {
        errors.push(`${context} review requires reviewed_commit`);
      }
      if (!Array.isArray(review.findings)) errors.push(`${context} review requires findings array`);
      for (const field of ['review_id', 'evidence_ref']) {
        if (!isNonEmptyString(review[field])) errors.push(`${context} review requires ${field}`);
      }
      if (!isDateTime(review.recorded_at)) errors.push(`${context} review requires a date-time recorded_at`);
      if (review.resolved_finding_ids !== undefined && !Array.isArray(review.resolved_finding_ids)) {
        errors.push(`${context} review resolved_finding_ids must be an array`);
      }
    }
  }
  if (responsibility && responsibility.attempt !== intent.attempt && !['COMPLETED', 'BLOCKED'].includes(intent.status)) {
    errors.push(`${context} has a stale responsibility attempt`);
  }
  if (delivery?.delivery_id !== intent.delivery_id) errors.push(`${context} has mismatched delivery_id`);
}

function validateIntentBinding(intent, errors) {
  const context = `task ${intent.task_key}`;
  for (const field of ['thread_id', 'host_id', 'worktree', 'bound_at', 'effective_sandbox_mode', 'sandbox_evidence_ref']) {
    const value = intent[field];
    if (value !== undefined && value !== null && typeof value !== 'string') {
      errors.push(`${context} ${field} must be a string or null`);
    }
  }
  if (intent.bound_at !== undefined && intent.bound_at !== null && !isDateTime(intent.bound_at)) {
    errors.push(`${context} bound_at must be a date-time`);
  }
  if (['PENDING_THREAD', 'UNKNOWN', 'SKIPPED'].includes(intent.status)) {
    for (const field of ['thread_id', 'worktree', 'bound_at', 'effective_sandbox_mode', 'sandbox_evidence_ref']) {
      if (intent[field] !== undefined && intent[field] !== null && intent[field] !== '') {
        errors.push(`${context} ${field} must be null before binding`);
      }
    }
    return;
  }
  const requiresBoundRuntime = ['BOUND', 'COMPLETED'].includes(intent.status)
    || (intent.status === 'BLOCKED' && isNonEmptyString(intent.thread_id));
  if (!requiresBoundRuntime) return;
  if (!isNonEmptyString(intent.thread_id)) errors.push(`bound task ${intent.task_key} requires thread_id`);
  if (!isNonEmptyString(intent.host_id)) errors.push(`bound task ${intent.task_key} requires host_id`);
  if (!isDateTime(intent.bound_at)) errors.push(`bound task ${intent.task_key} requires a date-time bound_at`);
  const expectedSandbox = sandboxModeForAccess(intent.access);
  if (intent.effective_sandbox_mode !== expectedSandbox) {
    errors.push(`bound task ${intent.task_key} requires effective ${expectedSandbox} sandbox`);
  }
  if (!isNonEmptyString(intent.sandbox_evidence_ref)) {
    errors.push(`bound task ${intent.task_key} requires sandbox_evidence_ref`);
  }
  if (intent.access === 'write' && !isNonEmptyString(intent.worktree)) {
    errors.push(`bound write task ${intent.task_key} requires worktree`);
  }
  if (intent.access === 'read' && intent.worktree) {
    errors.push(`read task ${intent.task_key} cannot bind a worktree`);
  }
}

function validateReviewConsistency(delivery, errors) {
  const intents = new Map((Array.isArray(delivery?.dispatch_intents) ? delivery.dispatch_intents : [])
    .filter((intent) => intent && typeof intent === 'object' && !Array.isArray(intent) && intent.task_key)
    .map((intent) => [intent.task_key, intent]));
  const seen = new Set();
  const outstandingByProject = new Map();
  for (const review of Array.isArray(delivery?.reviews) ? delivery.reviews : []) {
    if (!review || typeof review !== 'object' || Array.isArray(review) || !review.task_key) continue;
    if (seen.has(review.task_key)) errors.push(`delivery ${delivery.delivery_id} has duplicate review for task ${review.task_key}`);
    seen.add(review.task_key);
    const intent = intents.get(review.task_key);
    if (!intent) {
      errors.push(`delivery ${delivery.delivery_id} review ${review.review_id} references unknown task ${review.task_key}`);
      continue;
    }
    const projectOutstanding = outstandingByProject.get(intent.project_id) || new Map();
    const findings = Array.isArray(review.findings) ? review.findings : [];
    const findingsById = new Map(findings.map((finding) => [finding.id, finding]));
    const openFindings = findings.filter((finding) => finding.status === 'OPEN');
    if (review.outcome === 'PASS' && openFindings.length) {
      errors.push(`delivery ${delivery.delivery_id} review ${review.review_id} PASS cannot contain OPEN findings`);
    }
    if (review.outcome === 'NEEDS_CHANGES' && !openFindings.length) {
      errors.push(`delivery ${delivery.delivery_id} review ${review.review_id} NEEDS_CHANGES requires an OPEN finding`);
    }
    if (review.outcome === 'PASS') {
      for (const [findingId] of projectOutstanding) {
        const current = findingsById.get(findingId);
        if (!current || !['RESOLVED', 'WAIVED'].includes(current.status)) {
          errors.push(`delivery ${delivery.delivery_id} review ${review.review_id} must resolve or waive previous finding ${findingId}`);
        }
      }
    }
    const nextOutstanding = review.outcome === 'PASS' ? new Map() : new Map(projectOutstanding);
    for (const finding of findings) {
      if (finding.status === 'OPEN') nextOutstanding.set(finding.id, finding);
      else nextOutstanding.delete(finding.id);
    }
    outstandingByProject.set(intent.project_id, nextOutstanding);
    if (intent.phase !== 'review') errors.push(`delivery ${delivery.delivery_id} review ${review.review_id} references a non-review task`);
    if (intent.status !== 'COMPLETED') errors.push(`delivery ${delivery.delivery_id} review ${review.review_id} requires a completed review task`);
    const intentReview = intent.result?.review;
    if (!intentReview) {
      errors.push(`delivery ${delivery.delivery_id} review ${review.review_id} has no matching intent.result.review`);
      continue;
    }
    for (const field of ['review_id', 'outcome', 'reviewed_commit', 'evidence_ref', 'recorded_at']) {
      if (intentReview[field] !== review[field]) errors.push(`delivery ${delivery.delivery_id} review ${review.review_id} differs from intent.result.review in ${field}`);
    }
    if (JSON.stringify(intentReview.findings || []) !== JSON.stringify(review.findings || [])) {
      errors.push(`delivery ${delivery.delivery_id} review ${review.review_id} findings differ from intent.result.review`);
    }
    if (JSON.stringify(intentReview.resolved_finding_ids || []) !== JSON.stringify(review.resolved_finding_ids || [])) {
      errors.push(`delivery ${delivery.delivery_id} review ${review.review_id} resolved findings differ from intent.result.review`);
    }
  }
  for (const intent of intents.values()) {
    if (intent.phase === 'review' && intent.status === 'COMPLETED' && !seen.has(intent.task_key)) {
      errors.push(`delivery ${delivery.delivery_id} completed review task ${intent.task_key} lacks a persisted review record`);
    }
  }
}

function validateDeliveryCompletion(delivery, errors) {
  if (delivery?.status !== 'VERIFIED') return;
  const targets = Array.isArray(delivery.targets) ? delivery.targets : [];
  if (!targets.length || targets.some((target) => !SUCCESS_TARGET_STATUSES.has(target?.status))) {
    errors.push(`delivery ${delivery.delivery_id} VERIFIED requires every target to be successful`);
  }
  if (targets.some((target) => target?.project_id === delivery.lead_project)) return;
  try {
    if (!areResponsibilityTasksCompleted(delivery, delivery.lead_project, delivery.lead_responsibilities)) {
      errors.push(`delivery ${delivery.delivery_id} VERIFIED requires completed lead responsibilities`);
    }
  } catch (error) {
    errors.push(`delivery ${delivery.delivery_id} VERIFIED lead validation failed: ${error.message}`);
  }
}

function validateDependencies(delivery, errors) {
  let plans;
  try {
    plans = buildTaskPlans(delivery);
  } catch (error) {
    errors.push(`delivery ${delivery.delivery_id} has invalid task plan: ${error.message}`);
    return;
  }
  const known = new Set(plans.map((plan) => plan.task_key));
  const graph = new Map(plans.map((plan) => [plan.task_key, plan.depends_on || []]));
  for (const plan of plans) {
    for (const dependency of plan.depends_on || []) {
      if (!known.has(dependency)) errors.push(`task ${plan.task_key} depends on unknown task ${dependency}`);
      if (dependency === plan.task_key) errors.push(`task ${plan.task_key} cannot depend on itself`);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (taskKey, trail = []) => {
    if (visiting.has(taskKey)) {
      errors.push(`task dependency cycle: ${[...trail, taskKey].join(' -> ')}`);
      return;
    }
    if (visited.has(taskKey)) return;
    visiting.add(taskKey);
    for (const dependency of graph.get(taskKey) || []) {
      if (graph.has(dependency)) visit(dependency, [...trail, taskKey]);
    }
    visiting.delete(taskKey);
    visited.add(taskKey);
  };
  for (const taskKey of graph.keys()) visit(taskKey);
  const writersByProject = new Map();
  for (const plan of plans.filter((item) => item.access === 'write')) {
    const projectWriters = writersByProject.get(plan.project_id) || [];
    projectWriters.push(plan);
    writersByProject.set(plan.project_id, projectWriters);
  }
  for (const [projectId, writers] of writersByProject) {
    for (let left = 0; left < writers.length; left += 1) {
      for (let right = left + 1; right < writers.length; right += 1) {
        const comparable = taskDependsOn(graph, writers[left].task_key, writers[right].task_key)
          || taskDependsOn(graph, writers[right].task_key, writers[left].task_key);
        if (!comparable) {
          errors.push(`project ${projectId} write responsibilities must form one dependency chain; ${writers[left].task_key} and ${writers[right].task_key} are parallel`);
        }
      }
    }
  }
}

function taskDependsOn(graph, taskKey, dependencyKey, visited = new Set()) {
  if (visited.has(taskKey)) return false;
  visited.add(taskKey);
  for (const dependency of graph.get(taskKey) || []) {
    if (dependency === dependencyKey) return true;
    if (taskDependsOn(graph, dependency, dependencyKey, visited)) return true;
  }
  return false;
}

function buildDependencyGraph(delivery) {
  const plans = buildTaskPlans(delivery);
  return {
    plans,
    graph: new Map(plans.map((plan) => [plan.task_key, plan.depends_on || []]))
  };
}

function findTerminalWriterPlan(delivery, projectId) {
  const { plans, graph } = buildDependencyGraph(delivery);
  const writers = plans.filter((plan) => plan.project_id === projectId && plan.access === 'write');
  if (!writers.length) return null;
  const terminal = writers.filter((writer) => !writers.some((candidate) => (
    candidate.task_key !== writer.task_key
    && taskDependsOn(graph, candidate.task_key, writer.task_key)
  )));
  if (terminal.length !== 1) {
    throw new Error(`project ${projectId} requires one terminal writer; add explicit write dependencies or an integration responsibility`);
  }
  return terminal[0];
}

function inferAccess(responsibility = '') {
  return /^(development|developer|frontend|backend|fix|implementation)$/i.test(responsibility) ? 'write' : 'read';
}

function sandboxModeForAccess(access) {
  return access === 'read' ? 'read-only' : 'workspace-write';
}

function environmentForAccess(access) {
  return access === 'read' ? 'project-read' : 'exclusive-worktree';
}

function agentNameForTask(task = {}) {
  if (task.access === 'write') return 'jj-workflow-developer';
  return 'jj-workflow-reviewer';
}

function isDateTime(value) {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireNonEmptyString(value, name) {
  if (!isNonEmptyString(value)) throw new Error(`${name} must be a non-empty string`);
  return value;
}

function inferPhase(responsibility = '') {
  if (/^(product|planning|analysis|requirement)$/i.test(responsibility)) return 'planning';
  if (/^(test|qa|verification)$/i.test(responsibility)) return 'verification';
  if (/^review$/i.test(responsibility)) return 'review';
  return 'development';
}

function findResponsibility(delivery, projectId, responsibilityName) {
  const target = (Array.isArray(delivery?.targets) ? delivery.targets : [])
    .find((item) => item?.project_id === projectId);
  const targetResponsibility = (Array.isArray(target?.responsibilities) ? target.responsibilities : [])
    .find((item) => item?.name === responsibilityName);
  if (targetResponsibility) return targetResponsibility;
  if (delivery.lead_project === projectId) {
    return (Array.isArray(delivery.lead_responsibilities) ? delivery.lead_responsibilities : [])
      .find((item) => item?.name === responsibilityName);
  }
  return null;
}

function assertCurrentAttempt(delivery, intent) {
  const responsibility = findResponsibility(delivery, intent.project_id, intent.responsibility);
  if (!responsibility) {
    throw new Error(`task ${intent.task_key} no longer has an authorized responsibility`);
  }
  if (responsibility.attempt !== intent.attempt) {
    throw new Error(`task ${intent.task_key} is stale; current responsibility attempt is ${responsibility.attempt}`);
  }
  if (['SKIPPED', 'NOT_APPLICABLE'].includes(responsibility.status) && intent.status !== 'SKIPPED') {
    throw new Error(`task ${intent.task_key} belongs to a skipped responsibility and cannot run`);
  }
  return responsibility;
}

function assertDependenciesCompleted(plane, intent) {
  const found = findIntent(plane, intent.task_key);
  const delivery = found?.delivery;
  for (const dependency of Array.isArray(intent.depends_on) ? intent.depends_on : []) {
    const dependencyIntent = findIntent(plane, dependency)?.intent;
    if ((!dependencyIntent || dependencyIntent.status !== 'COMPLETED')
      && !isDependencySatisfied(delivery, dependency)) {
      throw new Error(`task ${intent.task_key} depends on incomplete task ${dependency}`);
    }
  }
}

function assertTargetTasksCompleted(delivery, target) {
  if (!areResponsibilityTasksCompleted(delivery, target.project_id, target.responsibilities)) {
    throw new Error(`target ${target.project_id} responsibility lacks a completed dispatch intent`);
  }
}

function assertNoChangeRequired(delivery, target, {
  evidenceRef,
  analysisRef,
  differenceRef,
  targetHead,
  unresolved
}) {
  const analysisEvidence = analysisRef || evidenceRef;
  if (!/^ANL-TARGET(?:-|:|$)/.test(analysisEvidence)) {
    throw new Error(`target ${target.project_id} NO_CHANGE_REQUIRED requires ANL-TARGET analysis evidence`);
  }
  if (!isNonEmptyString(differenceRef) || !isNonEmptyString(targetHead)) {
    throw new Error(`target ${target.project_id} NO_CHANGE_REQUIRED requires differenceRef and targetHead`);
  }
  if (!Array.isArray(unresolved) || unresolved.length !== 0) {
    throw new Error(`target ${target.project_id} NO_CHANGE_REQUIRED requires unresolved=[]`);
  }
  const responsibilities = Array.isArray(target.responsibilities) ? target.responsibilities : [];
  const analysisResponsibilities = responsibilities.filter(isAnalysisResponsibility);
  if (!analysisResponsibilities.length) {
    throw new Error(`target ${target.project_id} NO_CHANGE_REQUIRED requires a planning/analysis responsibility`);
  }
  const intents = Array.isArray(delivery.dispatch_intents) ? delivery.dispatch_intents : [];
  const skippedTaskKeys = new Set(responsibilities
    .filter((responsibility) => !isAnalysisResponsibility(responsibility))
    .map((responsibility) => buildTaskKey({
      deliveryId: delivery.delivery_id,
      projectId: target.project_id,
      responsibility: responsibility.name,
      attempt: responsibility.attempt
    })));
  const { plans, graph } = buildDependencyGraph(delivery);
  const orphaned = plans.filter((plan) => !skippedTaskKeys.has(plan.task_key)
    && !['SKIPPED', 'NOT_APPLICABLE'].includes(findResponsibility(delivery, plan.project_id, plan.responsibility)?.status)
    && [...skippedTaskKeys].some((skippedTaskKey) => taskDependsOn(graph, plan.task_key, skippedTaskKey)));
  if (orphaned.length) {
    throw new Error(`target ${target.project_id} NO_CHANGE_REQUIRED would orphan dependent tasks: ${orphaned.map((plan) => plan.task_key).join(', ')}; rewire them to ANL-TARGET evidence or mark them not applicable`);
  }
  for (const responsibility of analysisResponsibilities) {
    const taskKey = buildTaskKey({
      deliveryId: delivery.delivery_id,
      projectId: target.project_id,
      responsibility: responsibility.name,
      attempt: responsibility.attempt
    });
    const intent = intents.find((item) => item?.task_key === taskKey);
    if (responsibility.status !== 'COMPLETED' || intent?.status !== 'COMPLETED') {
      throw new Error(`target ${target.project_id} NO_CHANGE_REQUIRED requires completed analysis task ${taskKey}`);
    }
    const taskEvidence = intent.result?.evidence_ref;
    if (taskEvidence !== analysisEvidence) {
      throw new Error(`target ${target.project_id} analysis task ${taskKey} must produce the current ANL-TARGET evidence`);
    }
  }
  for (const responsibility of responsibilities.filter((item) => !isAnalysisResponsibility(item))) {
    const taskKey = buildTaskKey({
      deliveryId: delivery.delivery_id,
      projectId: target.project_id,
      responsibility: responsibility.name,
      attempt: responsibility.attempt
    });
    const intent = intents.find((item) => item?.task_key === taskKey);
    if (intent && intent.status !== 'SKIPPED') {
      throw new Error(`target ${target.project_id} cannot record NO_CHANGE_REQUIRED after downstream task ${taskKey} was dispatched`);
    }
    if (!['PENDING', 'SKIPPED', 'NOT_APPLICABLE'].includes(responsibility.status)) {
      throw new Error(`target ${target.project_id} downstream responsibility ${responsibility.name} must remain undispatched before NO_CHANGE_REQUIRED`);
    }
  }
}

function markDownstreamResponsibilitiesSkipped(delivery, target, recordedAt) {
  const intents = Array.isArray(delivery.dispatch_intents) ? delivery.dispatch_intents : [];
  for (const responsibility of Array.isArray(target.responsibilities) ? target.responsibilities : []) {
    if (isAnalysisResponsibility(responsibility)) continue;
    if (responsibility.status !== 'NOT_APPLICABLE') {
      responsibility.status = 'SKIPPED';
      responsibility.skip_reason = 'ANL-TARGET proved this responsibility is not applicable.';
      responsibility.skip_evidence_ref = 'ANL-TARGET';
      responsibility.skipped_at = recordedAt;
    }
    responsibility.thread_id = null;
    const taskKey = buildTaskKey({
      deliveryId: delivery.delivery_id,
      projectId: target.project_id,
      responsibility: responsibility.name,
      attempt: responsibility.attempt
    });
    const intent = intents.find((item) => item?.task_key === taskKey);
    if (intent?.status === 'SKIPPED') {
      intent.result = intent.result || {
        status: 'SKIPPED',
        reason: responsibility.status === 'NOT_APPLICABLE'
          ? 'Responsibility was explicitly marked NOT_APPLICABLE.'
          : 'ANL-TARGET proved this responsibility is not applicable.',
        evidence_ref: 'ANL-TARGET',
        recorded_at: recordedAt
      };
    }
  }
}

function isAnalysisResponsibility(responsibility = {}) {
  return responsibility.phase === 'planning'
    || /^(analysis|planning|product|requirement)$/i.test(responsibility.name || '');
}

function assertReviewPassForTarget(delivery, target, targetCommit) {
  const reviewResponsibilities = (Array.isArray(target?.responsibilities) ? target.responsibilities : [])
    .filter((responsibility) => responsibility?.phase === 'review' || responsibility?.name === 'review');
  if (!reviewResponsibilities.length) {
    throw new Error(`target ${target.project_id} requires a current review responsibility`);
  }
  const terminalWriter = findTerminalWriterPlan(delivery, target.project_id);
  if (!terminalWriter) throw new Error(`target ${target.project_id} requires a current developer commit`);
  const terminalIntent = (Array.isArray(delivery.dispatch_intents) ? delivery.dispatch_intents : [])
    .find((item) => item?.task_key === terminalWriter.task_key && item.status === 'COMPLETED');
  const terminalCommit = terminalIntent?.result?.produced_commit || terminalIntent?.result?.commit || null;
  if (!terminalCommit) throw new Error(`target ${target.project_id} requires a completed terminal developer commit`);
  const { graph } = buildDependencyGraph(delivery);
  const terminalReviews = reviewResponsibilities.filter((responsibility) => {
    const taskKey = buildTaskKey({
      deliveryId: delivery.delivery_id,
      projectId: target.project_id,
      responsibility: responsibility.name,
      attempt: responsibility.attempt
    });
    return taskDependsOn(graph, taskKey, terminalWriter.task_key);
  });
  if (!terminalReviews.length) {
    throw new Error(`target ${target.project_id} requires a current review downstream of terminal writer ${terminalWriter.task_key}`);
  }
  for (const responsibility of terminalReviews) {
    const taskKey = buildTaskKey({
      deliveryId: delivery.delivery_id,
      projectId: target.project_id,
      responsibility: responsibility.name,
      attempt: responsibility.attempt
    });
    const intent = (Array.isArray(delivery.dispatch_intents) ? delivery.dispatch_intents : [])
      .find((item) => item?.task_key === taskKey);
    const reviewRecords = (Array.isArray(delivery.reviews) ? delivery.reviews : [])
      .filter((review) => review?.task_key === taskKey);
    const review = reviewRecords.length === 1 ? reviewRecords[0] : null;
    if (intent?.status !== 'COMPLETED' || !review || review.outcome !== 'PASS') {
      throw new Error(`target ${target.project_id} requires a PASS review for current attempt`);
    }
    const developer = findSingleUpstreamWriterIntent(delivery, intent);
    const producedCommit = developer?.intent?.result?.produced_commit || developer?.intent?.result?.commit || null;
    if (!producedCommit) {
      throw new Error(`target ${target.project_id} review requires an upstream developer commit`);
    }
    const reviewedCommit = review.reviewed_commit;
    if (reviewedCommit !== producedCommit) {
      throw new Error(`target ${target.project_id} review must consume the current developer commit`);
    }
    if (reviewedCommit !== terminalCommit) {
      throw new Error(`target ${target.project_id} terminal review must consume terminal writer commit`);
    }
  }
  if (targetCommit && targetCommit !== terminalCommit) {
    throw new Error(`target ${target.project_id} commit must match the terminal reviewed developer commit`);
  }
  return terminalCommit;
}

function areResponsibilityTasksCompleted(delivery, projectId, responsibilities) {
  const intents = Array.isArray(delivery?.dispatch_intents) ? delivery.dispatch_intents : [];
  const plans = buildResponsibilityPlans(delivery, projectId, responsibilities);
  return plans.length > 0 && plans.every((plan) => {
    const responsibility = (Array.isArray(responsibilities) ? responsibilities : [])
      .find((item) => item?.name === plan.responsibility && item.attempt === plan.attempt);
    if (!responsibility || responsibility.status !== 'COMPLETED') return false;
    const intent = intents.find((item) => item?.task_key === plan.task_key);
    if (!intent || intent.status !== 'COMPLETED') return false;
    assertCurrentAttempt(delivery, intent);
    return true;
  });
}

function assertTargetHasBlockedTask(delivery, target) {
  const intents = Array.isArray(delivery?.dispatch_intents) ? delivery.dispatch_intents : [];
  const plans = buildResponsibilityPlans(delivery, target.project_id, target.responsibilities);
  const blocked = plans.some((plan) => {
    const intent = intents.find((item) => item?.task_key === plan.task_key);
    if (!intent || intent.status !== 'BLOCKED') return false;
    assertCurrentAttempt(delivery, intent);
    return true;
  });
  if (!blocked) throw new Error(`target ${target.project_id} lacks a blocked dispatch intent`);
}

function refreshDeliveryStatus(delivery) {
  const intents = Array.isArray(delivery?.dispatch_intents) ? delivery.dispatch_intents : [];
  const currentPlans = buildPlanMap(delivery);
  const activeIntents = currentPlans.size
    ? intents.filter((intent) => currentPlans.has(intent?.task_key))
    : intents;
  const relevantIntents = activeIntents.length ? activeIntents : intents;
  if (relevantIntents.some((intent) => intent?.status === 'UNKNOWN')) {
    delivery.status = 'UNKNOWN';
    return;
  }
  if (relevantIntents.some((intent) => intent?.status === 'BLOCKED')) {
    delivery.status = 'BLOCKED';
    return;
  }
  if (relevantIntents.length && relevantIntents.every((intent) => ['COMPLETED', 'SKIPPED'].includes(intent?.status))) {
    delivery.status = 'EVIDENCE_READY';
    return;
  }
  if (relevantIntents.some((intent) => intent?.status === 'PENDING_THREAD')) {
    delivery.status = 'DISPATCHING';
    return;
  }
  if (relevantIntents.length && relevantIntents.every((intent) => ['BOUND', 'COMPLETED', 'SKIPPED'].includes(intent?.status))) {
    delivery.status = 'RUNNING';
  }
}

function hasActiveWriter(plane, projectId, taskKey) {
  for (const delivery of Array.isArray(plane?.deliveries) ? plane.deliveries : []) {
    for (const intent of Array.isArray(delivery?.dispatch_intents) ? delivery.dispatch_intents : []) {
      if (intent.task_key === taskKey) continue;
      if (intent.project_id === projectId
        && intent.access === 'write'
        && ['PENDING_THREAD', 'BOUND', 'UNKNOWN'].includes(intent.status)) {
        return true;
      }
    }
  }
  return false;
}

function blockedResult(plane, deliveryId, reason) {
  return {
    ok: false,
    status: 'BLOCKED',
    action: 'DISPATCH',
    delivery_id: deliveryId,
    tasks: previewDispatch(plane, deliveryId).tasks,
    reason,
    plane: clone(plane)
  };
}

function hasCapability(capabilities, name) {
  if (Array.isArray(capabilities)) return capabilities.includes(name);
  return Boolean(capabilities && capabilities[name]);
}

function requireDelivery(plane, deliveryId) {
  const delivery = (Array.isArray(plane?.deliveries) ? plane.deliveries : [])
    .find((item) => item?.delivery_id === deliveryId);
  if (!delivery) throw new Error(`Unknown delivery_id: ${deliveryId}`);
  return delivery;
}

function findIntent(plane, taskKey) {
  for (const delivery of Array.isArray(plane?.deliveries) ? plane.deliveries : []) {
    const intent = (Array.isArray(delivery?.dispatch_intents) ? delivery.dispatch_intents : [])
      .find((item) => item?.task_key === taskKey);
    if (intent) return { delivery, intent };
  }
  return null;
}

function isDependencySatisfied(delivery, taskKey, intentsByKey = new Map(), visited = new Set()) {
  if (visited.has(taskKey)) return false;
  const nextVisited = new Set(visited);
  nextVisited.add(taskKey);
  const intent = intentsByKey instanceof Map
    ? intentsByKey.get(taskKey)
    : (Array.isArray(delivery?.dispatch_intents) ? delivery.dispatch_intents : [])
      .find((item) => item?.task_key === taskKey);
  if (intent) {
    if (intent.status !== 'COMPLETED' && intent.status !== 'SKIPPED') return false;
    if (intent.status === 'COMPLETED') return true;
    let skippedPlan;
    try {
      skippedPlan = buildTaskPlans(delivery).find((item) => item.task_key === taskKey);
    } catch {
      return false;
    }
    const skippedResponsibility = skippedPlan
      ? findResponsibility(delivery, skippedPlan.project_id, skippedPlan.responsibility)
      : null;
    return ['SKIPPED', 'NOT_APPLICABLE'].includes(skippedResponsibility?.status)
      && Boolean(intent.result?.reason)
      && isDateTime(intent.result?.recorded_at)
      && (skippedPlan.depends_on || []).every((dependency) => (
        isDependencySatisfied(delivery, dependency, intentsByKey, nextVisited)
      ));
  }
  let plan;
  try {
    plan = buildTaskPlans(delivery).find((item) => item.task_key === taskKey);
  } catch {
    return false;
  }
  if (!plan) return false;
  const responsibility = findResponsibility(delivery, plan.project_id, plan.responsibility);
  return ['SKIPPED', 'NOT_APPLICABLE'].includes(responsibility?.status)
    && isNonEmptyString(responsibility.skip_reason)
    && isNonEmptyString(responsibility.skip_evidence_ref)
    && (plan.depends_on || []).every((dependency) => (
      isDependencySatisfied(delivery, dependency, intentsByKey, nextVisited)
    ));
}

function findCurrentDeveloperIntent(delivery, projectId) {
  const candidates = responsibilityEntries(delivery)
    .filter((entry) => entry.projectId === projectId && entry.responsibility.access === 'write')
    .map((entry) => {
      let taskKey;
      try {
        taskKey = buildTaskKey({
          deliveryId: delivery.delivery_id,
          projectId,
          responsibility: entry.responsibility.name,
          attempt: entry.responsibility.attempt
        });
      } catch {
        return null;
      }
      const intent = (Array.isArray(delivery.dispatch_intents) ? delivery.dispatch_intents : [])
        .find((item) => item?.task_key === taskKey && item.status === 'COMPLETED');
      return intent ? { delivery, intent } : null;
    })
    .filter(Boolean);
  if (candidates.length <= 1) return candidates[0] || null;
  // For a project with several sequential writers, the last plan entry is the
  // terminal commit.  Consumers with an explicit dependency use the stricter
  // graph-based helper below.
  return candidates.at(-1);
}

function findUpstreamWriterIntents(delivery, intent) {
  if (!intent || typeof intent !== 'object') return [];
  const intents = new Map((Array.isArray(delivery?.dispatch_intents) ? delivery.dispatch_intents : [])
    .filter((item) => item && typeof item === 'object' && item.task_key)
    .map((item) => [item.task_key, item]));
  const writers = new Map();
  const visited = new Set();
  const walk = (taskKey) => {
    if (visited.has(taskKey)) return;
    visited.add(taskKey);
    const dependency = intents.get(taskKey);
    if (!dependency) return;
    if (dependency.access === 'write') {
      if (dependency.status === 'COMPLETED') writers.set(dependency.task_key, { delivery, intent: dependency });
      return;
    }
    for (const parent of Array.isArray(dependency.depends_on) ? dependency.depends_on : []) walk(parent);
  };
  if (intent.access === 'write') {
    if (intent.status === 'COMPLETED') return [{ delivery, intent }];
    return [];
  }
  for (const dependency of Array.isArray(intent.depends_on) ? intent.depends_on : []) walk(dependency);
  return [...writers.values()];
}

function findSingleUpstreamWriterIntent(delivery, intent) {
  const writers = findUpstreamWriterIntents(delivery, intent);
  if (writers.length > 1) {
    throw new Error(`task ${intent.task_key} has multiple upstream writer commits; add an integration responsibility or consume an explicit aggregate commit`);
  }
  return writers[0] || null;
}

function assertConsumedCommitMatchesCurrentDeveloper(delivery, intent, consumedCommit) {
  const developer = findSingleUpstreamWriterIntent(delivery, intent);
  const producedCommit = developer?.intent?.result?.produced_commit || developer?.intent?.result?.commit || null;
  if (!producedCommit || producedCommit !== consumedCommit) {
    throw new Error(`read task ${intent.task_key} must consume the current developer commit`);
  }
}

function reviewsForProject(delivery, projectId) {
  const intents = new Map((Array.isArray(delivery?.dispatch_intents) ? delivery.dispatch_intents : [])
    .map((intent) => [intent.task_key, intent]));
  return (Array.isArray(delivery?.reviews) ? delivery.reviews : [])
    .filter((review) => intents.get(review.task_key)?.project_id === projectId);
}

function collectOutstandingFindings(reviews) {
  const latest = new Map();
  for (const review of reviews) {
    for (const finding of Array.isArray(review?.findings) ? review.findings : []) {
      latest.set(finding.id, finding);
    }
  }
  return new Map([...latest].filter(([, finding]) => finding.status === 'OPEN'));
}

function responsibilityEntries(delivery) {
  const entries = [];
  if (Array.isArray(delivery?.lead_responsibilities)) {
    for (const responsibility of delivery.lead_responsibilities) {
      entries.push({ projectId: delivery.lead_project, responsibility });
    }
  }
  for (const target of Array.isArray(delivery?.targets) ? delivery.targets : []) {
    for (const responsibility of Array.isArray(target?.responsibilities) ? target.responsibilities : []) {
      entries.push({ projectId: target.project_id, responsibility });
    }
  }
  return entries;
}

function resetResponsibility(responsibility) {
  responsibility.status = 'PENDING';
  responsibility.thread_id = null;
  responsibility.skip_reason = null;
  responsibility.skip_evidence_ref = null;
  responsibility.skipped_at = null;
}

function prepareTargetRetriesForApproval(delivery) {
  const intents = Array.isArray(delivery?.dispatch_intents) ? delivery.dispatch_intents : [];
  for (const target of Array.isArray(delivery?.targets) ? delivery.targets : []) {
    if (!['FAILED', 'BLOCKED'].includes(target.status)) continue;
    const plans = buildResponsibilityPlans(delivery, target.project_id, target.responsibilities);
    const hasNewAttempt = plans.some((plan) => !intents.some((intent) => intent?.task_key === plan.task_key));
    if (!hasNewAttempt) continue;
    target.status = 'PENDING';
    target.last_result = null;
  }
}

function appendEvent(plane, type, payload) {
  plane.events = Array.isArray(plane.events) ? plane.events : [];
  plane.events.push({ event_id: `${plane.revision}-${plane.events.length + 1}`, type, at: new Date().toISOString(), ...payload });
}

function clone(value) {
  return structuredClone(value);
}

function hasOwn(value, key) {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
}
