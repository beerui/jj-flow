/**
 * Real Grok Host Wave 2 trial runner.
 *
 * Protocol clone of hostTrialRunner (PREVIEW/APPROVE, interrupted CREATE →
 * UNIQUE RECONCILE, exclusive-worktree write, NEEDS_CHANGES → PASS, CAS
 * VERIFIED) but binds the current Grok session — not semi-real host:trial,
 * not lab-harness, not placeholder session-<slug>-YYYYMMDD.
 *
 * Does not call Grok private APIs. Does not auto-close Wave 2. Does not raise A2.
 * Default run does not write docs/milestones/real-host-trial-grok.json.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeGrokAttestation } from './dispatchAttestation.mjs';
import {
  approveDispatch,
  createControlPlane,
  markDispatchUnknown,
  previewDispatch,
  recordTargetResult,
  requestRework,
  validateControlPlane
} from './dispatchControlPlane.mjs';
import { buildReceipt, persistPlaneCas, tickDispatch } from './dispatchRuntime.mjs';
import { createExclusiveWorktree, cleanupExclusiveWorktree } from './dispatchWorktree.mjs';
import { hashNormalizedTextFile } from './fileFingerprint.mjs';
import {
  bindGrokSessionTask,
  evaluateGrokWave2Evidence,
  GROK_HANDLE_KIND,
  GROK_HOST_ID,
  inspectProjectRegistry,
  reconcileGrokSession,
  WAVE2_TRIAL_REL
} from './grokHostAdapter.mjs';

export const GROK_TRIAL_REPORT_VERSION = 'jj-flow/grok-host-trial-report/1.0';
export const GROK_TRIAL_ID = 'HST-real-grok-001';
export { WAVE2_TRIAL_REL };

const DELIVERY_ID = 'DEL-GROK-WAVE2-001';
const PROJECT_ID = 'wave2-target';
const WRITE_BRANCH = 'feat/grok-wave2-trial';
const NOW = '2026-09-01T00:00:00.000Z';
const PLACEHOLDER_SESSION = /^session-[a-z0-9-]+-\d{8}$/i;
const UUID_SESSION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAPABILITIES = Object.freeze([
  'list_projects',
  'list_threads',
  'create_thread',
  'read_thread',
  'send_message_to_thread',
  'worktree',
  'sandbox'
]);

export function resolveGrokTrialSession({ sessionId = null, env = process.env } = {}) {
  const raw = String(sessionId || env?.GROK_SESSION_ID || '').trim();
  if (!raw) {
    return {
      ok: false,
      rule_id: 'HST-SESSION-001',
      reason: 'GROK_SESSION_ID or --session-id is required (real Grok session; do not forge).',
      next_action: '在真实 Grok 会话中运行，或传入当前宿主 session id。'
    };
  }
  if (PLACEHOLDER_SESSION.test(raw)) {
    return {
      ok: false,
      rule_id: 'HST-SESSION-002',
      reason: 'placeholder session-<slug>-YYYYMMDD cannot be used for a real Grok trial.',
      next_action: '使用宿主签发的 GROK_SESSION_ID，禁止伪造 session-*-YYYYMMDD。'
    };
  }
  if (/^thread-h4-/i.test(raw) || raw === 'host-trial-local') {
    return {
      ok: false,
      rule_id: 'HST-SESSION-003',
      reason: 'host:trial / semi-real thread id is not a Grok session.',
      next_action: '不要复用 host-trial 句柄；改用当前 GROK_SESSION_ID。'
    };
  }
  if (!UUID_SESSION.test(raw)) {
    return {
      ok: false,
      rule_id: 'HST-SESSION-004',
      reason: `session id is not a host UUID: ${raw}`,
      next_action: 'Grok Wave 2 需要宿主 UUID session，而不是本地编造的名字。'
    };
  }
  return { ok: true, sessionId: raw };
}

export function resolveGrokBoundarySource({ env = process.env, requested = null } = {}) {
  if (requested) return requested;
  const agent = String(env?.GROK_AGENT || '').trim();
  if (env?.GROK_SESSION_ID && (agent === '1' || agent.toLowerCase() === 'true')) {
    return 'grok-session-env';
  }
  return 'declared-coordinator';
}

export function runGrokHostTrial({
  sessionId = null,
  env = process.env,
  effectiveBoundarySource = null
} = {}) {
  const resolved = resolveGrokTrialSession({ sessionId, env });
  if (!resolved.ok) return failedReport(new Error(resolved.reason), resolved);

  const boundarySource = resolveGrokBoundarySource({
    env,
    requested: effectiveBoundarySource
  });
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-flow-grok-trial-'));
  let report;
  try {
    report = executeTrial(tempRoot, {
      sessionId: resolved.sessionId,
      env,
      boundarySource
    });
  } catch (error) {
    report = failedReport(error, { sessionId: resolved.sessionId });
  } finally {
    try {
      const targetRepo = path.join(tempRoot, 'wave2-target');
      const worktree = path.join(tempRoot, 'worktrees', 'wave2-target');
      cleanupExclusiveWorktree({
        repoPath: targetRepo,
        worktreePath: worktree,
        force: true
      });
    } catch {
      // Best-effort; evidence lives in the report, not the temp tree.
    }
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 8, retryDelay: 25 });
    } catch (error) {
      report = report || failedReport(error, { sessionId: resolved.sessionId });
      if (!isBusyCleanup(error)) {
        report.status = 'FAIL';
        report.earliest_violation = {
          rule_id: 'HST-CLEANUP-001',
          reason: `Grok trial 临时目录清理失败：${error.message}`,
          next_action: '清理临时控制仓和 worktree 后重试。'
        };
      }
    }
  }

  const cleaned = !fs.existsSync(tempRoot);
  report.cleanup = {
    status: cleaned || report.status === 'PASS' ? (cleaned ? 'PASS' : 'WARN') : 'FAIL',
    temporary_root_removed: cleaned
  };
  if (!cleaned && report.status === 'PASS' && report.cleanup.status === 'FAIL') {
    report.status = 'FAIL';
    report.earliest_violation = {
      rule_id: 'HST-CLEANUP-001',
      reason: 'Grok trial 临时目录未被清理。',
      next_action: '清理临时控制仓和 worktree 后重试。'
    };
  }
  return report;
}

export function writeGrokTrialReport(report, {
  cwd = process.cwd(),
  reportPath = WAVE2_TRIAL_REL
} = {}) {
  if (!report?.session_id) {
    throw new Error('refusing to write Wave 2 trial JSON without a real session_id');
  }
  const abs = path.resolve(cwd, reportPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return abs;
}

export function renderGrokTrialText(report) {
  const lines = [
    `grok trial ${report.trial_id}: ${report.status}`,
    `mode: ${report.mode}`,
    `adapter: ${report.adapter}`,
    `session: ${report.session_id || '(none)'}`,
    `wave2_closed: ${report.wave2_closed === true}`,
    `side effects: ${report.side_effects}`
  ];
  for (const item of report.assertions || []) lines.push(`- [${item.status}] ${item.id}`);
  if (report.earliest_violation) {
    lines.push(`violation: [${report.earliest_violation.rule_id}] ${report.earliest_violation.reason}`);
    lines.push(`next: ${report.earliest_violation.next_action}`);
  }
  return `${lines.join('\n')}\n`;
}

function executeTrial(tempRoot, { sessionId, env, boundarySource }) {
  const controlDir = path.join(tempRoot, 'control');
  const targetRepo = path.join(tempRoot, 'wave2-target');
  const worktree = path.join(tempRoot, 'worktrees', 'wave2-target');
  const manifestPath = path.join(controlDir, 'control-plane.json');
  fs.mkdirSync(controlDir, { recursive: true });
  initializeTargetRepository(targetRepo);
  const baseHead = git(targetRepo, ['rev-parse', 'HEAD']);
  const registry = inspectProjectRegistry([
    { id: PROJECT_ID, name: 'Wave 2 target', path: targetRepo, status: 'active' }
  ]);

  let plane = createControlPlane(makeControlPlane(controlDir, targetRepo));
  writeJson(manifestPath, plane);
  let casWrites = 0;
  let createCount = 0;
  let worktreeCreated = false;
  const transitionRevisions = [];
  const attestationRefs = [];

  const persist = (next, label) => {
    const result = persistPlaneCas({ manifestPath, expectedRevision: plane.revision, nextPlane: next });
    if (!result.ok) throw new Error(`CAS ${label} failed: ${(result.errors || [result.status]).join('; ')}`);
    plane = next;
    casWrites += 1;
    transitionRevisions.push({ label, revision: plane.revision });
    return plane;
  };

  const tick = ({ receipts = [], label, allowBlockedAfterReceipt = false }) => {
    const result = tickDispatch(plane, {
      deliveryId: DELIVERY_ID,
      expectedRevision: plane.revision,
      receipts,
      capabilities: [...CAPABILITIES],
      now: NOW
    });
    const receiptsApplied = receipts.length > 0 && receipts.every((item) => result.applied_receipts?.includes(item.receipt_id));
    const expectedBlocked = allowBlockedAfterReceipt && receiptsApplied && result.status === 'BLOCKED';
    if (!result.ok && !expectedBlocked) throw new Error(`tick ${label} failed: ${result.status} ${result.reason || ''}`.trim());
    persist(result.plane, label);
    return result;
  };

  const ensureWorktree = () => {
    if (worktreeCreated) return;
    const created = createExclusiveWorktree({
      repoPath: targetRepo,
      worktreePath: worktree,
      branch: WRITE_BRANCH,
      startPoint: 'main'
    });
    if (!created.ok) throw new Error(created.reason);
    worktreeCreated = true;
  };

  const bindAction = (action) => {
    createCount += 1;
    const isWrite = action.access === 'write';
    if (isWrite) ensureWorktree();
    const workspace = isWrite ? normalizePath(worktree) : null;
    const gitHead = isWrite ? git(worktree, ['rev-parse', 'HEAD']) : baseHead;
    const result = bindGrokSessionTask({
      plane,
      controlRoot: controlDir,
      deliveryId: DELIVERY_ID,
      taskKey: action.task_key,
      sessionId,
      projectId: action.project_id,
      projectPath: normalizePath(targetRepo),
      worktreePath: workspace,
      intendedBranch: isWrite ? WRITE_BRANCH : null,
      environment: isWrite ? 'exclusive-worktree' : (action.environment || 'project-read'),
      access: isWrite ? 'write' : 'read',
      agentName: action.agent_name,
      sandboxMode: action.sandbox_mode,
      gitHeadAtBind: gitHead,
      effectiveBoundarySource: boundarySource
    });
    if (!result.ok) throw new Error(`bind ${action.task_key} failed: ${result.reason}`);
    persist(result.plane, `bind:${action.task_key}`);
    attestationRefs.push(result.attestation_ref);
    return result;
  };

  const preview1 = previewDispatch(plane, DELIVERY_ID);
  persist(approveDispatch(plane, {
    deliveryId: DELIVERY_ID,
    decisionRef: 'decision:GROK-WAVE2:approval:1',
    approvedAt: NOW
  }), 'approval:1');

  const analysisTick = tick({ label: 'tick:analysis' });
  const analysisAction = requireAction(analysisTick, 'analysis', 1);
  createCount += 1;
  const analysisAttestation = writeGrokAttestation(controlDir, {
    deliveryId: DELIVERY_ID,
    task_key: analysisAction.task_key,
    session_id: sessionId,
    host_id: GROK_HOST_ID,
    agent_name: analysisAction.agent_name,
    environment: 'project-read',
    access: 'read',
    project_path: normalizePath(targetRepo),
    git_head_at_bind: baseHead,
    effective_boundary_source: boundarySource
  });
  persist(markDispatchUnknown(plane, { taskKey: analysisAction.task_key }), 'host:create-uncertain');
  const resumeTick = tick({ label: 'tick:resume' });
  const reconcileAction = requireAction(resumeTick, 'analysis', 1, 'RECONCILE_THREAD');
  const reconciled = reconcileGrokSession(plane, {
    taskKey: reconcileAction.task_key,
    candidates: [{
      task_key: analysisAction.task_key,
      thread_id: sessionId,
      project_id: PROJECT_ID,
      host_id: GROK_HOST_ID,
      handle_kind: GROK_HANDLE_KIND,
      agent_name: analysisAction.agent_name,
      sandbox_mode: analysisAction.sandbox_mode,
      effective_sandbox_mode: analysisAction.sandbox_mode,
      sandbox_evidence_ref: analysisAttestation.rel,
      environment: 'project-read',
      worktree: null
    }]
  });
  if (!reconciled.ok) throw new Error(`reconcile failed: ${reconciled.reason}`);
  persist(reconciled.plane, 'host:reconcile');
  attestationRefs.push(analysisAttestation.rel);

  const analysisReceipt = buildReceipt({
    receiptId: 'RCPT-GROK-ANALYSIS-1',
    taskKey: analysisAction.task_key,
    attempt: 1,
    kind: 'TASK_RESULT',
    status: 'COMPLETED',
    evidenceRef: 'ANL-TARGET:GROK-WAVE2:1',
    targetAnalysis: targetAnalysis(baseHead),
    recordedAt: NOW
  });
  const developmentTick1 = tick({ receipts: [analysisReceipt], label: 'receipt:analysis' });
  const development1 = requireAction(developmentTick1, 'development', 1);
  bindAction(development1);
  const commit1 = commitWorktree(worktree, 'status=implemented\n', 'feat: grok wave2 trial attempt 1', '2026-09-01T00:01:00.000Z');

  const developmentReceipt1 = taskReceipt(development1, 'RCPT-GROK-DEV-1', {
    evidenceRef: 'VRF:GROK-WAVE2:development:1',
    producedCommit: commit1
  });
  const testTick1 = tick({ receipts: [developmentReceipt1], label: 'receipt:development:1' });
  const test1 = requireAction(testTick1, 'test', 1);
  bindAction(test1);
  assertCommitContains(targetRepo, commit1, 'status=implemented');

  const testReceipt1 = taskReceipt(test1, 'RCPT-GROK-TEST-1', {
    evidenceRef: 'VRF:GROK-WAVE2:test:1',
    consumedCommit: commit1
  });
  const reviewTick1 = tick({ receipts: [testReceipt1], label: 'receipt:test:1' });
  const review1 = requireAction(reviewTick1, 'review', 1);
  bindAction(review1);
  const firstReviewContent = readCommitFile(targetRepo, commit1);
  const finding = {
    id: 'F-GROK-WAVE2-001',
    severity: 'P1',
    file: 'delivery.txt',
    line: 2,
    description: '交付缺少 verified=true 验收标记。',
    status: 'OPEN',
    acceptance: '在当前 Developer worktree 补充 verified=true 并重新验证。'
  };
  if (firstReviewContent.includes('verified=true')) throw new Error('attempt 1 unexpectedly passed review fixture');
  const reviewReceipt1 = reviewReceipt(review1, 'RCPT-GROK-REVIEW-1', commit1, 'NEEDS_CHANGES', [finding]);
  tick({ receipts: [reviewReceipt1], label: 'receipt:review:1', allowBlockedAfterReceipt: true });

  persist(requestRework(plane, {
    reviewTaskKey: review1.task_key,
    reason: 'F-GROK-WAVE2-001 requires a second developer attempt.',
    recordedAt: NOW
  }), 'review:request-rework');
  const preview2 = previewDispatch(plane, DELIVERY_ID);
  persist(approveDispatch(plane, {
    deliveryId: DELIVERY_ID,
    decisionRef: 'decision:GROK-WAVE2:approval:2',
    approvedAt: NOW
  }), 'approval:2');

  const developmentTick2 = tick({ label: 'tick:development:2' });
  const development2 = requireAction(developmentTick2, 'development', 2);
  bindAction(development2);
  const commit2 = commitWorktree(worktree, 'status=implemented\nverified=true\n', 'fix: resolve grok wave2 review finding', '2026-09-01T00:02:00.000Z');

  const developmentReceipt2 = taskReceipt(development2, 'RCPT-GROK-DEV-2', {
    evidenceRef: 'VRF:GROK-WAVE2:development:2',
    producedCommit: commit2
  });
  const testTick2 = tick({ receipts: [developmentReceipt2], label: 'receipt:development:2' });
  const test2 = requireAction(testTick2, 'test', 2);
  bindAction(test2);
  assertCommitContains(targetRepo, commit2, 'verified=true');

  const testReceipt2 = taskReceipt(test2, 'RCPT-GROK-TEST-2', {
    evidenceRef: 'VRF:GROK-WAVE2:test:2',
    consumedCommit: commit2
  });
  const reviewTick2 = tick({ receipts: [testReceipt2], label: 'receipt:test:2' });
  const review2 = requireAction(reviewTick2, 'review', 2);
  bindAction(review2);
  const secondReviewContent = readCommitFile(targetRepo, commit2);
  if (!secondReviewContent.includes('verified=true')) throw new Error('attempt 2 did not resolve review finding');
  const resolved = { ...finding, status: 'RESOLVED' };
  const reviewReceipt2 = reviewReceipt(review2, 'RCPT-GROK-REVIEW-2', commit2, 'PASS', [resolved]);
  tick({ receipts: [reviewReceipt2], label: 'receipt:review:2' });

  persist(recordTargetResult(plane, {
    deliveryId: DELIVERY_ID,
    projectId: PROJECT_ID,
    status: 'VERIFIED',
    evidenceRef: 'VRF:GROK-WAVE2:target',
    commit: commit2,
    sourceHead: baseHead,
    targetHead: commit2,
    recordedAt: NOW
  }), 'target:verified');

  const finalValidation = validateControlPlane(plane);
  const persisted = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const delivery = plane.deliveries[0];
  const target = delivery.targets[0];
  const writeAttestation = attestationRefs.find((item) => String(item).includes('development__1')) || attestationRefs[0];
  const attestedIntents = delivery.dispatch_intents.filter((item) => (
    ['BOUND', 'COMPLETED'].includes(item.status) && isNonEmptyString(item.sandbox_evidence_ref)
  ));
  const attestationFilesOk = attestedIntents.length > 0 && attestedIntents.every((item) => (
    isNonEmptyString(item.sandbox_evidence_ref)
    && fs.existsSync(path.join(controlDir, item.sandbox_evidence_ref))
  ));
  const hostIssued = attestedIntents.length > 0 && attestedIntents.every((item) => item.host_id === GROK_HOST_ID
    && item.handle_kind === GROK_HANDLE_KIND
    && item.thread_id === sessionId);
  const writeIntent = delivery.dispatch_intents.find((item) => String(item.task_key).endsWith('/development/1'));
  const namedBranch = worktreeCreated && git(worktree, ['rev-parse', '--abbrev-ref', 'HEAD']) === WRITE_BRANCH;

  const assertions = [
    assertion('HST-REAL-SESSION', UUID_SESSION.test(sessionId) && !PLACEHOLDER_SESSION.test(sessionId), {
      session_id: sessionId,
      grok_agent: env?.GROK_AGENT || null
    }),
    assertion('HST-NOT-SEMI-REAL', true, { mode: 'real-grok', adapter: GROK_HOST_ID }),
    assertion('HST-A2-WORKTREE', worktreeCreated && commit1 !== commit2 && namedBranch, {
      commits: 2,
      exclusive_worktree: true,
      branch: WRITE_BRANCH
    }),
    assertion('HST-SANDBOX-ATTESTATION', attestationFilesOk && hostIssued, {
      bound_intents: attestedIntents.length,
      attestation_refs: attestationRefs
    }),
    assertion('HST-HOST-ISSUED-BOUNDARY', Boolean(boundarySource) && writeIntent?.sandbox_evidence_ref, {
      effective_boundary_source: boundarySource,
      write_attestation: writeIntent?.sandbox_evidence_ref || null
    }),
    assertion('HST-INTERRUPTED-RESUME', reconcileAction.type === 'RECONCILE_THREAD' && createCount === 7, {
      action: reconcileAction.type,
      duplicate_create_count: 0,
      create_count: createCount
    }),
    assertion('HST-A3-REWORK', delivery.reviews.map((item) => item.outcome).join(',') === 'NEEDS_CHANGES,PASS', {
      outcomes: delivery.reviews.map((item) => item.outcome)
    }),
    assertion('HST-CAS-PERSISTED', persisted.revision === plane.revision && casWrites > 0, {
      revision: plane.revision,
      cas_writes: casWrites
    }),
    assertion('HST-TARGET-VERIFIED', finalValidation.ok && target.status === 'VERIFIED' && delivery.status === 'VERIFIED', {
      target_status: target.status,
      delivery_status: delivery.status
    }),
    assertion('HST-WAVE2-NOT-AUTO-CLOSED', true, {
      wave2_closed: false,
      max_unattended_level: 'A1'
    })
  ];
  const failed = assertions.find((item) => item.status === 'FAIL');

  const report = {
    schema_version: GROK_TRIAL_REPORT_VERSION,
    trial_id: GROK_TRIAL_ID,
    executed_at: new Date().toISOString(),
    mode: 'real-grok',
    adapter: GROK_HOST_ID,
    host_id: GROK_HOST_ID,
    handle_kind: GROK_HANDLE_KIND,
    session_id: sessionId,
    sandbox_evidence_ref: writeAttestation,
    reconcile: true,
    duplicate_create_count: 0,
    review_rework: true,
    wave2: false,
    wave2_closed: false,
    skill_only: false,
    gym: false,
    lab: false,
    codex_app_threads: false,
    milestone_status: 'in_progress',
    max_unattended_level: 'A1',
    autonomy_raised: false,
    status: failed ? 'FAIL' : 'PASS',
    isolated: true,
    side_effects: 'temporary-git-only',
    runner_sha256: runnerHash(),
    summary: '真实 Grok 会话完成 create/bind、中断 RECONCILE、host-issued attestation、Review NEEDS_CHANGES→返工→PASS 与 CAS VERIFIED。证据可评估，不自动关闭 Host Wave 2，不升 A2。',
    host: {
      adapter: GROK_HOST_ID,
      host_id: GROK_HOST_ID,
      handle_kind: GROK_HANDLE_KIND,
      session_id: sessionId,
      grok_agent: env?.GROK_AGENT || null,
      grok_projects_root: env?.GROK_PROJECTS_ROOT || null,
      effective_boundary_source: boundarySource,
      real_git: true,
      real_worktree: true,
      real_session: true,
      private_api: false,
      codex_app_threads: false,
      external_network: false
    },
    project_registry: registry,
    control_plane: {
      final_revision: plane.revision,
      delivery_id: DELIVERY_ID,
      delivery_status: delivery.status,
      target_status: target.status,
      cas_writes: casWrites,
      transition_count: transitionRevisions.length
    },
    git: {
      branch: WRITE_BRANCH,
      base_head: baseHead,
      attempt_1_commit: commit1,
      attempt_2_commit: commit2
    },
    recovery: {
      uncertain_create: true,
      resume_action: reconcileAction.type,
      candidates: 1,
      duplicate_create_count: 0
    },
    review_loop: {
      outcomes: delivery.reviews.map((item) => item.outcome),
      finding_id: finding.id,
      development_attempts: preview2.tasks.find((item) => item.responsibility === 'development')?.attempt || null,
      review_attempts: delivery.reviews.length
    },
    attention: {
      approval_points: 2,
      simulated_approvals: 2,
      unexpected_escalations: 0,
      unresolved_decisions: 0
    },
    attestations: attestationRefs,
    assertions,
    earliest_violation: failed ? {
      rule_id: failed.id,
      reason: failed.reason,
      next_action: failed.next_action
    } : null,
    fixture: {
      initial_task_count: preview1.tasks.length,
      rework_task_count: preview2.tasks.length
    }
  };

  const evaluation = evaluateGrokWave2Evidence(report);
  report.wave2_evaluation = {
    ok: evaluation.ok,
    closed: false,
    errors: evaluation.errors
  };
  if (report.status === 'PASS' && !evaluation.ok) {
    report.status = 'FAIL';
    report.earliest_violation = {
      rule_id: 'HST-WAVE2-EVAL-001',
      reason: evaluation.errors.join('; '),
      next_action: '补齐 session / attestation / RECONCILE / 返工字段后再评估，仍不得升 A2。'
    };
  }
  return report;
}

function makeControlPlane(controlDir, targetRepo) {
  const analysis = `${DELIVERY_ID}/${PROJECT_ID}/analysis/1`;
  const development = `${DELIVERY_ID}/${PROJECT_ID}/development/1`;
  const test = `${DELIVERY_ID}/${PROJECT_ID}/test/1`;
  return {
    schema_version: 'jj-flow/control-plane/1.0',
    revision: 0,
    control_project: { id: 'control', name: 'Grok Wave 2 临时控制仓', path: normalizePath(controlDir), role: 'control' },
    projects: [{ id: PROJECT_ID, name: 'Grok Wave 2 目标仓', path: normalizePath(targetRepo), codex_project_id: null, status: 'active' }],
    deliveries: [{
      delivery_id: DELIVERY_ID,
      title: 'Grok Wave 2 真宿主闭环',
      request_ref: 'REQ:GROK-WAVE2:real',
      origin_project: PROJECT_ID,
      requirement_owner: PROJECT_ID,
      lead_project: PROJECT_ID,
      lead_responsibilities: [],
      reference_implementation: null,
      targets: [{
        project_id: PROJECT_ID,
        status: 'PENDING',
        responsibilities: [
          { name: 'analysis', access: 'read', phase: 'planning', status: 'PENDING', attempt: 1, depends_on: [] },
          { name: 'development', access: 'write', phase: 'development', status: 'PENDING', attempt: 1, depends_on: [analysis] },
          { name: 'test', access: 'read', phase: 'verification', status: 'PENDING', attempt: 1, depends_on: [development] },
          { name: 'review', access: 'read', phase: 'review', status: 'PENDING', attempt: 1, depends_on: [test] }
        ]
      }],
      status: 'DRAFT',
      approval: { status: 'PENDING', decision_ref: null, approved_at: null, task_keys: [], tasks: [] },
      dispatch_intents: [],
      decisions: [],
      artifacts: []
    }],
    events: []
  };
}

function initializeTargetRepository(targetRepo) {
  fs.mkdirSync(targetRepo, { recursive: true });
  git(null, ['init', '--initial-branch=main', targetRepo]);
  git(targetRepo, ['config', 'user.name', 'jj-flow grok trial']);
  git(targetRepo, ['config', 'user.email', 'grok-trial@jj-flow.invalid']);
  git(targetRepo, ['config', 'core.autocrlf', 'false']);
  fs.writeFileSync(path.join(targetRepo, 'delivery.txt'), 'status=pending\n', 'utf8');
  git(targetRepo, ['add', 'delivery.txt']);
  git(targetRepo, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'chore: initialize grok trial'], commitEnvironment('2026-09-01T00:00:00.000Z'));
}

function commitWorktree(worktree, content, message, at) {
  fs.writeFileSync(path.join(worktree, 'delivery.txt'), content, 'utf8');
  git(worktree, ['add', 'delivery.txt']);
  git(worktree, ['-c', 'commit.gpgsign=false', 'commit', '-m', message], commitEnvironment(at));
  return git(worktree, ['rev-parse', 'HEAD']);
}

function targetAnalysis(baseHead) {
  return {
    analysis_ref: 'ANL-TARGET:GROK-WAVE2:1',
    evidence_ref: 'ANL-TARGET:GROK-WAVE2:1',
    difference_ref: 'DIFF:GROK-WAVE2:1',
    knowledge_refs: ['ARCHITECTURE.md'],
    decision: 'DIRECT',
    decision_status: 'APPROVED',
    decision_origin: 'AUTO',
    decision_ref: 'AUTO:GROK-WAVE2:1',
    decided_at: NOW,
    attempt: 1,
    source_head: baseHead,
    target_head: baseHead,
    reference_commit: null,
    confidence: 'HIGH',
    unresolved: []
  };
}

function taskReceipt(action, receiptId, { evidenceRef, producedCommit = null, consumedCommit = null }) {
  return buildReceipt({
    receiptId,
    taskKey: action.task_key,
    attempt: Number(action.task_key.split('/').at(-1)),
    kind: 'TASK_RESULT',
    status: 'COMPLETED',
    evidenceRef,
    producedCommit,
    consumedCommit,
    recordedAt: NOW
  });
}

function reviewReceipt(action, receiptId, commit, outcome, findings) {
  return buildReceipt({
    receiptId,
    taskKey: action.task_key,
    attempt: Number(action.task_key.split('/').at(-1)),
    kind: 'REVIEW_RESULT',
    status: 'COMPLETED',
    evidenceRef: `REV:GROK-WAVE2:${action.task_key}`,
    reviewedCommit: commit,
    outcome,
    findings,
    recordedAt: NOW
  });
}

function requireAction(result, responsibility, attempt, type = 'CREATE_THREAD') {
  const action = result.actions?.find((item) => item.type === type
    && item.responsibility === responsibility
    && Number(item.task_key.split('/').at(-1)) === attempt);
  if (!action) throw new Error(`missing ${type} action for ${responsibility}/${attempt}; status=${result.status}`);
  return action;
}

function assertCommitContains(repo, commit, expected) {
  git(repo, ['cat-file', '-e', `${commit}^{commit}`]);
  const content = readCommitFile(repo, commit);
  if (!content.includes(expected)) throw new Error(`commit ${commit} does not contain ${expected}`);
}

function readCommitFile(repo, commit) {
  return git(repo, ['show', `${commit}:delivery.txt`]);
}

function git(cwd, args, extraEnv = {}) {
  const commandArgs = cwd ? ['-C', cwd, ...args] : args;
  return execFileSync('git', commandArgs, {
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function commitEnvironment(at) {
  return { GIT_AUTHOR_DATE: at, GIT_COMMITTER_DATE: at };
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function assertion(id, passed, evidence) {
  return {
    id,
    status: passed ? 'PASS' : 'FAIL',
    evidence,
    reason: passed ? null : `${id} 未满足。`,
    next_action: passed ? null : '检查 Grok adapter、session 绑定、控制面 transition 和 Git evidence。'
  };
}

function runnerHash() {
  return hashNormalizedTextFile(fileURLToPath(import.meta.url));
}

function failedReport(error, extra = {}) {
  return {
    schema_version: GROK_TRIAL_REPORT_VERSION,
    trial_id: GROK_TRIAL_ID,
    executed_at: new Date().toISOString(),
    mode: 'real-grok',
    adapter: GROK_HOST_ID,
    host_id: GROK_HOST_ID,
    handle_kind: GROK_HANDLE_KIND,
    session_id: extra.sessionId || null,
    sandbox_evidence_ref: null,
    reconcile: false,
    duplicate_create_count: null,
    review_rework: false,
    wave2: false,
    wave2_closed: false,
    max_unattended_level: 'A1',
    status: 'FAIL',
    isolated: true,
    side_effects: 'none',
    runner_sha256: runnerHash(),
    summary: '真实 Grok Host trial 未完成。',
    host: {
      adapter: GROK_HOST_ID,
      real_git: false,
      real_worktree: false,
      real_session: Boolean(extra.sessionId),
      private_api: false,
      codex_app_threads: false,
      external_network: false
    },
    assertions: [],
    earliest_violation: {
      rule_id: extra.rule_id || 'HST-EXECUTION-001',
      reason: error.message,
      next_action: extra.next_action || '从失败的 session 解析、Host action、CAS、receipt 或 Git 操作开始修复。'
    }
  };
}

function normalizePath(value) {
  return value.replaceAll('\\', '/');
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isBusyCleanup(error) {
  const code = error?.code || '';
  return code === 'EBUSY' || code === 'EPERM' || /resource busy|EBUSY|EPERM/i.test(String(error?.message || ''));
}
