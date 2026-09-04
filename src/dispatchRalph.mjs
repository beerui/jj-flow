/** Bridge: dispatch coordination stays in control_root; each business repo gets a full Ralph run. */
import fs from 'node:fs';
import path from 'node:path';
import { appendProgressLine, initRun, isReviewSliceText, listRuns, loadRun, saveRun, nowIso } from './ralph.mjs';

const DATE_SUFFIX_RE = /-\d{8}$/;

export function ralphRunIdFromDelivery(deliveryId) {
  let slug = String(deliveryId || '').replace(/^DEL-/i, '').toLowerCase();
  slug = slug.replace(DATE_SUFFIX_RE, '');
  slug = slug.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) slug = 'dispatch';
  return slug.startsWith('task-') ? slug : 'task-' + slug;
}

export function collectDeliveryThreadIds(delivery = {}) {
  const ids = new Set();
  const take = (item) => {
    if (!item || typeof item !== 'object') return;
    if (item.thread_id) ids.add(String(item.thread_id));
    if (item.bound_thread_id) ids.add(String(item.bound_thread_id));
  };
  for (const row of delivery.lead_responsibilities || []) take(row);
  for (const target of delivery.targets || []) {
    for (const row of target.responsibilities || []) take(row);
  }
  for (const intent of delivery.intents || []) take(intent);
  return ids;
}

function runMatchesThreads(run, threadIds) {
  if (!run || !threadIds || threadIds.size === 0) return false;
  const candidates = [
    run.review?.task_thread_id,
    run.host?.thread_id,
    run.host?.session_handle
  ];
  for (const rev of run.review?.reviews || []) {
    candidates.push(rev.task_thread_id, rev.review_thread_id);
  }
  return candidates.filter(Boolean).some((id) => threadIds.has(String(id)));
}

export function findLiveRalphSibling({ cwd, canonicalRunId, threadIds } = {}) {
  if (!cwd) return null;
  for (const row of listRuns(cwd)) {
    if (row.layout !== 'active') continue;
    if (row.run_id === canonicalRunId) continue;
    if (row.status === 'COMPLETED' || row.status === 'ABANDONED') continue;
    try {
      const run = loadRun(row.run_id, cwd);
      if (run.status === 'COMPLETED' || run.status === 'ABANDONED') continue;
      if (runMatchesThreads(run, threadIds)) return run;
    } catch {
      // skip unreadable sibling
    }
  }
  const slices = [];
  for (const row of listRuns(cwd)) {
    if (row.layout !== 'active') continue;
    if (row.run_id === canonicalRunId) continue;
    if (row.status === 'COMPLETED' || row.status === 'ABANDONED') continue;
    if (isReviewSliceText([row.run_id, row.title, row.goal].join(' '))) slices.push(row);
  }
  if (slices.length === 1) {
    try {
      return loadRun(slices[0].run_id, cwd);
    } catch {
      return null;
    }
  }
  return null;
}

export function listDispatchRalphProjects(delivery, plane = {}) {
  const catalog = new Map((plane.projects || []).map((item) => [item.id, item]));
  const seen = new Set();
  const rows = [];
  const push = (projectId, role) => {
    if (!projectId || seen.has(projectId)) return;
    seen.add(projectId);
    const project = catalog.get(projectId) || {};
    rows.push({
      project_id: projectId,
      role,
      path: project.path || null,
      name: project.name || projectId
    });
  };
  push(delivery.lead_project, 'lead');
  for (const target of delivery.targets || []) push(target.project_id, 'target');
  return rows;
}

function bindDispatchFamily(run, { delivery, projectId, role, taskId }) {
  run.family = {
    enabled: true,
    lead_role: role === 'lead' ? projectId : (delivery.lead_project || null),
    lead_repo: delivery.lead_project || null,
    order: [delivery.lead_project, ...(delivery.targets || []).map((item) => item.project_id)].filter(Boolean),
    targets: (delivery.targets || []).map((item) => ({
      role: item.project_id,
      repo: item.project_id,
      status: 'NOT_STARTED'
    }))
  };
  run.updated_at = nowIso();
  return run;
}

function seedTaskPlan(cwd, run, delivery) {
  const planPath = path.join(cwd, '.workflow', 'ralph', run.run_id, 'task_plan.md');
  if (!fs.existsSync(planPath)) return;
  const prompt = delivery.distribution_prompt || {};
  const acceptance = Array.isArray(prompt.acceptance_criteria) ? prompt.acceptance_criteria : [];
  const doNot = Array.isArray(prompt.do_not_port) ? prompt.do_not_port : [];
  const acceptLines = acceptance.length
    ? acceptance.map((item, index) => (index + 1) + '. [ ] ' + item)
    : ['1. [ ] '];
  const stepLines = [
    '1. [ ] ANALYZE in this repo (Goal / 存疑)',
    '2. [ ] PLAN Steps for local adapt (not copy)',
    '3. [ ] DELIVER + verify',
    '4. [ ] ACCEPT then finalize; Git closeout is $jj-end'
  ];
  if (doNot.length) stepLines.push('5. [ ] Do not port: ' + doNot.join('；'));
  const nl = '\n';
  const body = [
    '# ' + run.run_id,
    '',
    '## Goal',
    '',
    run.goal || delivery.title || delivery.delivery_id,
    '',
    '## 验收',
    '',
    ...acceptLines,
    '',
    '## Steps',
    '',
    ...stepLines,
    ''
  ].join(nl);
  fs.writeFileSync(planPath, body, 'utf8');
}

/**
 * Init or reuse one Ralph run per lead/target business repo.
 * Control_root TASK docs stay an index; implementation lives in each project's `.workflow/ralph/`.
 */
export function ensureDispatchRalphRuns({
  delivery,
  plane = {},
  taskId = null,
  attach_knowledge = false
} = {}) {
  if (!delivery || typeof delivery !== 'object') throw new Error('delivery is required');
  const runId = ralphRunIdFromDelivery(delivery.delivery_id);
  const title = delivery.title || delivery.delivery_id;
  const prompt = delivery.distribution_prompt || {};
  const goal = prompt.summary || title;
  const threadIds = collectDeliveryThreadIds(delivery);
  const projects = listDispatchRalphProjects(delivery, plane);
  const runs = [];
  for (const project of projects) {
    if (!project.path || !fs.existsSync(project.path)) {
      runs.push({
        project_id: project.project_id,
        role: project.role,
        path: project.path,
        run_id: runId,
        action: 'skipped',
        reason: project.path ? 'project path missing' : 'project path not registered'
      });
      continue;
    }
    const existing = listRuns(project.path).find((row) => row.run_id === runId && !row.needs_migrate);
    const sibling = findLiveRalphSibling({
      cwd: project.path,
      canonicalRunId: runId,
      threadIds
    });
    if (existing) {
      try {
        const run = loadRun(runId, project.path);
        bindDispatchFamily(run, { delivery, projectId: project.project_id, role: project.role, taskId });
        saveRun(run, project.path);
        appendProgressLine(
          runId,
          project.path,
          '- ' + nowIso() + ' dispatch-bind ' + delivery.delivery_id + ' project=' + project.project_id + ' role=' + project.role
        );
      } catch {
        // reuse still counts even if bind cannot write
      }
      runs.push({
        project_id: project.project_id,
        role: project.role,
        path: project.path,
        run_id: runId,
        action: 'reuse',
        layout: existing.layout || 'active',
        ...(sibling ? { sibling_run_id: sibling.run_id } : {})
      });
      continue;
    }
    if (sibling) {
      try {
        bindDispatchFamily(sibling, { delivery, projectId: project.project_id, role: project.role, taskId });
        saveRun(sibling, project.path);
        appendProgressLine(
          sibling.run_id,
          project.path,
          '- ' + nowIso() + ' dispatch-bind-sibling ' + delivery.delivery_id
            + ' canonical=' + runId
            + ' project=' + project.project_id
            + ' role=' + project.role
        );
      } catch {
        // reuse still counts even if bind cannot write
      }
      runs.push({
        project_id: project.project_id,
        role: project.role,
        path: project.path,
        run_id: sibling.run_id,
        action: 'reuse-sibling',
        canonical_run_id: runId,
        sibling_run_id: sibling.run_id
      });
      continue;
    }
    const run = initRun({
      run_id: runId,
      title,
      goal,
      project_key: project.project_id,
      attach_knowledge,
      write_intent: false
    }, project.path);
    bindDispatchFamily(run, { delivery, projectId: project.project_id, role: project.role, taskId });
    saveRun(run, project.path);
    seedTaskPlan(project.path, run, delivery);
    appendProgressLine(
      run.run_id,
      project.path,
      '- ' + nowIso() + ' dispatch-init ' + delivery.delivery_id + ' project=' + project.project_id + ' role=' + project.role
    );
    runs.push({
      project_id: project.project_id,
      role: project.role,
      path: project.path,
      run_id: run.run_id,
      action: 'init'
    });
  }
  return { run_id: runId, runs };
}
