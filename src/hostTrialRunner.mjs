import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  approveDispatch,
  bindThread,
  createControlPlane,
  markDispatchUnknown,
  previewDispatch,
  reconcileDispatch,
  recordTargetResult,
  requestRework,
  validateControlPlane
} from './dispatchControlPlane.mjs';
import { buildReceipt, persistPlaneCas, tickDispatch } from './dispatchRuntime.mjs';

export const HOST_TRIAL_REPORT_VERSION = 'jj-flow/host-trial-report/1.0';

const DELIVERY_ID = 'DEL-HOST-TRIAL-001';
const PROJECT_ID = 'project-a';
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

export function runHostTrial() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-flow-host-trial-'));
  let report;
  try {
    report = executeTrial(tempRoot);
  } catch (error) {
    report = failedReport(error);
  } finally {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch (error) {
      report = report || failedReport(error);
      report.status = 'FAIL';
      report.earliest_violation = {
        rule_id: 'HST-CLEANUP-001',
        reason: `Host trial 临时目录清理失败：${error.message}`,
        next_action: '清理临时控制仓和 worktree 后重试。'
      };
    }
  }

  const cleaned = !fs.existsSync(tempRoot);
  report.cleanup = { status: cleaned ? 'PASS' : 'FAIL', temporary_root_removed: cleaned };
  if (!cleaned && report.status === 'PASS') {
    report.status = 'FAIL';
    report.earliest_violation = {
      rule_id: 'HST-CLEANUP-001',
      reason: 'Host trial 临时目录未被清理。',
      next_action: '清理临时控制仓和 worktree 后重试。'
    };
  }
  return report;
}

export function renderHostTrialText(report) {
  const lines = [
    `host trial ${report.trial_id}: ${report.status}`,
    `mode: ${report.mode}`,
    `side effects: ${report.side_effects}`
  ];
  for (const item of report.assertions || []) lines.push(`- [${item.status}] ${item.id}`);
  if (report.earliest_violation) {
    lines.push(`violation: [${report.earliest_violation.rule_id}] ${report.earliest_violation.reason}`);
    lines.push(`next: ${report.earliest_violation.next_action}`);
  }
  return `${lines.join('\n')}\n`;
}

function executeTrial(tempRoot) {
  const controlDir = path.join(tempRoot, 'control');
  const targetRepo = path.join(tempRoot, 'project-a');
  const worktree = path.join(tempRoot, 'worktrees', 'project-a');
  const manifestPath = path.join(controlDir, 'control-plane.json');
  fs.mkdirSync(controlDir, { recursive: true });
  initializeTargetRepository(targetRepo);
  const baseHead = git(targetRepo, ['rev-parse', 'HEAD']);

  let plane = createControlPlane(makeControlPlane(controlDir, targetRepo));
  writeJson(manifestPath, plane);
  let casWrites = 0;
  let createCount = 0;
  let worktreeCreated = false;
  const transitionRevisions = [];

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
    fs.mkdirSync(path.dirname(worktree), { recursive: true });
    git(targetRepo, ['worktree', 'add', '-b', 'codex/h4-host-trial', worktree, 'main']);
    worktreeCreated = true;
  };

  const candidateFor = (action) => {
    createCount += 1;
    if (action.access === 'write') ensureWorktree();
    const suffix = action.task_key.split('/').slice(-2).join('-');
    return {
      task_key: action.task_key,
      thread_id: `thread-h4-${suffix}`,
      project_id: action.project_id,
      host_id: 'host-trial-local',
      agent_name: action.agent_name,
      sandbox_mode: action.sandbox_mode,
      effective_sandbox_mode: action.sandbox_mode,
      sandbox_evidence_ref: `SANDBOX:H4:${action.task_key}`,
      environment: action.environment,
      worktree: action.access === 'write' ? normalizePath(worktree) : null
    };
  };

  const bindAction = (action) => {
    const candidate = candidateFor(action);
    persist(bindThread(plane, {
      taskKey: candidate.task_key,
      threadId: candidate.thread_id,
      projectId: candidate.project_id,
      hostId: candidate.host_id,
      agentName: candidate.agent_name,
      sandboxMode: candidate.sandbox_mode,
      effectiveSandboxMode: candidate.effective_sandbox_mode,
      sandboxEvidenceRef: candidate.sandbox_evidence_ref,
      environment: candidate.environment,
      worktree: candidate.worktree
    }), `bind:${action.task_key}`);
    return candidate;
  };

  const preview1 = previewDispatch(plane, DELIVERY_ID);
  persist(approveDispatch(plane, {
    deliveryId: DELIVERY_ID,
    decisionRef: 'decision:H4:approval:1',
    approvedAt: NOW
  }), 'approval:1');

  const analysisTick = tick({ label: 'tick:analysis' });
  const analysisAction = requireAction(analysisTick, 'analysis', 1);
  const interruptedCandidate = candidateFor(analysisAction);
  persist(markDispatchUnknown(plane, { taskKey: analysisAction.task_key }), 'host:create-uncertain');
  const resumeTick = tick({ label: 'tick:resume' });
  const reconcileAction = requireAction(resumeTick, 'analysis', 1, 'RECONCILE_THREAD');
  const reconciled = reconcileDispatch(plane, {
    taskKey: reconcileAction.task_key,
    candidates: [interruptedCandidate]
  });
  if (!reconciled.ok) throw new Error(`reconcile failed: ${reconciled.reason}`);
  persist(reconciled.plane, 'host:reconcile');

  const analysisReceipt = buildReceipt({
    receiptId: 'RCPT-H4-ANALYSIS-1',
    taskKey: analysisAction.task_key,
    attempt: 1,
    kind: 'TASK_RESULT',
    status: 'COMPLETED',
    evidenceRef: 'ANL-TARGET:H4:1',
    targetAnalysis: targetAnalysis(baseHead),
    recordedAt: NOW
  });
  const developmentTick1 = tick({ receipts: [analysisReceipt], label: 'receipt:analysis' });
  const development1 = requireAction(developmentTick1, 'development', 1);
  bindAction(development1);
  const commit1 = commitWorktree(worktree, 'status=implemented\n', 'feat: host trial attempt 1', '2026-07-18T00:01:00.000Z');

  const developmentReceipt1 = taskReceipt(development1, 'RCPT-H4-DEV-1', {
    evidenceRef: 'VRF:H4:development:1',
    producedCommit: commit1
  });
  const testTick1 = tick({ receipts: [developmentReceipt1], label: 'receipt:development:1' });
  const test1 = requireAction(testTick1, 'test', 1);
  bindAction(test1);
  assertCommitContains(targetRepo, commit1, 'status=implemented');

  const testReceipt1 = taskReceipt(test1, 'RCPT-H4-TEST-1', {
    evidenceRef: 'VRF:H4:test:1',
    consumedCommit: commit1
  });
  const reviewTick1 = tick({ receipts: [testReceipt1], label: 'receipt:test:1' });
  const review1 = requireAction(reviewTick1, 'review', 1);
  bindAction(review1);
  const firstReviewContent = readCommitFile(targetRepo, commit1);
  const finding = {
    id: 'F-H4-001',
    severity: 'P1',
    file: 'delivery.txt',
    line: 2,
    description: '交付缺少 verified=true 验收标记。',
    status: 'OPEN',
    acceptance: '在当前 Developer worktree 补充 verified=true 并重新验证。'
  };
  if (firstReviewContent.includes('verified=true')) throw new Error('attempt 1 unexpectedly passed review fixture');
  const reviewReceipt1 = reviewReceipt(review1, 'RCPT-H4-REVIEW-1', commit1, 'NEEDS_CHANGES', [finding]);
  tick({ receipts: [reviewReceipt1], label: 'receipt:review:1', allowBlockedAfterReceipt: true });

  persist(requestRework(plane, {
    reviewTaskKey: review1.task_key,
    reason: 'F-H4-001 requires a second developer attempt.',
    recordedAt: NOW
  }), 'review:request-rework');
  const preview2 = previewDispatch(plane, DELIVERY_ID);
  persist(approveDispatch(plane, {
    deliveryId: DELIVERY_ID,
    decisionRef: 'decision:H4:approval:2',
    approvedAt: NOW
  }), 'approval:2');

  const developmentTick2 = tick({ label: 'tick:development:2' });
  const development2 = requireAction(developmentTick2, 'development', 2);
  bindAction(development2);
  const commit2 = commitWorktree(worktree, 'status=implemented\nverified=true\n', 'fix: resolve H4 review finding', '2026-07-18T00:02:00.000Z');

  const developmentReceipt2 = taskReceipt(development2, 'RCPT-H4-DEV-2', {
    evidenceRef: 'VRF:H4:development:2',
    producedCommit: commit2
  });
  const testTick2 = tick({ receipts: [developmentReceipt2], label: 'receipt:development:2' });
  const test2 = requireAction(testTick2, 'test', 2);
  bindAction(test2);
  assertCommitContains(targetRepo, commit2, 'verified=true');

  const testReceipt2 = taskReceipt(test2, 'RCPT-H4-TEST-2', {
    evidenceRef: 'VRF:H4:test:2',
    consumedCommit: commit2
  });
  const reviewTick2 = tick({ receipts: [testReceipt2], label: 'receipt:test:2' });
  const review2 = requireAction(reviewTick2, 'review', 2);
  bindAction(review2);
  const secondReviewContent = readCommitFile(targetRepo, commit2);
  if (!secondReviewContent.includes('verified=true')) throw new Error('attempt 2 did not resolve review finding');
  const resolved = { ...finding, status: 'RESOLVED' };
  const reviewReceipt2 = reviewReceipt(review2, 'RCPT-H4-REVIEW-2', commit2, 'PASS', [resolved]);
  tick({ receipts: [reviewReceipt2], label: 'receipt:review:2' });

  persist(recordTargetResult(plane, {
    deliveryId: DELIVERY_ID,
    projectId: PROJECT_ID,
    status: 'VERIFIED',
    evidenceRef: 'VRF:H4:target',
    commit: commit2,
    sourceHead: baseHead,
    targetHead: commit2,
    recordedAt: NOW
  }), 'target:verified');

  const finalValidation = validateControlPlane(plane);
  const persisted = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const delivery = plane.deliveries[0];
  const target = delivery.targets[0];
  const assertions = [
    assertion('HST-A2-WORKTREE', worktreeCreated && commit1 !== commit2, { commits: 2, exclusive_worktree: true }),
    assertion('HST-SANDBOX-ATTESTATION', delivery.dispatch_intents.every((item) => item.sandbox_evidence_ref), { bound_intents: delivery.dispatch_intents.length }),
    assertion('HST-INTERRUPTED-RESUME', reconcileAction.type === 'RECONCILE_THREAD' && createCount === 7, { action: reconcileAction.type, duplicate_create_count: 0 }),
    assertion('HST-A3-REWORK', delivery.reviews.map((item) => item.outcome).join(',') === 'NEEDS_CHANGES,PASS', { outcomes: delivery.reviews.map((item) => item.outcome) }),
    assertion('HST-CAS-PERSISTED', persisted.revision === plane.revision && casWrites > 0, { revision: plane.revision, cas_writes: casWrites }),
    assertion('HST-TARGET-VERIFIED', finalValidation.ok && target.status === 'VERIFIED' && delivery.status === 'VERIFIED', { target_status: target.status, delivery_status: delivery.status })
  ];
  const failed = assertions.find((item) => item.status === 'FAIL');

  return {
    schema_version: HOST_TRIAL_REPORT_VERSION,
    trial_id: 'HST-semi-real-001',
    executed_at: NOW,
    mode: 'semi-real',
    status: failed ? 'FAIL' : 'PASS',
    isolated: true,
    side_effects: 'temporary-git-only',
    runner_sha256: runnerHash(),
    summary: '临时控制仓通过真实 Git worktree、commit、CAS、中断恢复和两轮 Review 完成 A2/A3 半真实闭环。',
    host: {
      adapter: 'local-git-worktree',
      real_git: true,
      real_worktree: true,
      codex_app_threads: false,
      external_network: false
    },
    control_plane: {
      final_revision: plane.revision,
      delivery_status: delivery.status,
      target_status: target.status,
      cas_writes: casWrites,
      transition_count: transitionRevisions.length
    },
    git: {
      branch: 'codex/h4-host-trial',
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
}

function makeControlPlane(controlDir, targetRepo) {
  const analysis = `${DELIVERY_ID}/${PROJECT_ID}/analysis/1`;
  const development = `${DELIVERY_ID}/${PROJECT_ID}/development/1`;
  const test = `${DELIVERY_ID}/${PROJECT_ID}/test/1`;
  return {
    schema_version: 'jj-flow/control-plane/1.0',
    revision: 0,
    control_project: { id: 'control', name: 'H4 临时控制仓', path: normalizePath(controlDir), role: 'control' },
    projects: [{ id: PROJECT_ID, name: 'H4 目标仓', path: normalizePath(targetRepo), codex_project_id: null, status: 'active' }],
    deliveries: [{
      delivery_id: DELIVERY_ID,
      title: 'H4 半真实 Host 闭环',
      request_ref: 'REQ:H4:semi-real',
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
  git(targetRepo, ['config', 'user.name', 'jj-flow host trial']);
  git(targetRepo, ['config', 'user.email', 'host-trial@jj-flow.invalid']);
  git(targetRepo, ['config', 'core.autocrlf', 'false']);
  fs.writeFileSync(path.join(targetRepo, 'delivery.txt'), 'status=pending\n', 'utf8');
  git(targetRepo, ['add', 'delivery.txt']);
  git(targetRepo, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'chore: initialize host trial'], commitEnvironment('2026-07-18T00:00:00.000Z'));
}

function commitWorktree(worktree, content, message, at) {
  fs.writeFileSync(path.join(worktree, 'delivery.txt'), content, 'utf8');
  git(worktree, ['add', 'delivery.txt']);
  git(worktree, ['-c', 'commit.gpgsign=false', 'commit', '-m', message], commitEnvironment(at));
  return git(worktree, ['rev-parse', 'HEAD']);
}

function targetAnalysis(baseHead) {
  return {
    analysis_ref: 'ANL-TARGET:H4:1',
    evidence_ref: 'ANL-TARGET:H4:1',
    difference_ref: 'DIFF:H4:1',
    knowledge_refs: ['ARCHITECTURE.md'],
    decision: 'DIRECT',
    decision_status: 'APPROVED',
    decision_origin: 'AUTO',
    decision_ref: 'AUTO:H4:1',
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
    evidenceRef: `REV:H4:${action.task_key}`,
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
    next_action: passed ? null : '检查 Host adapter、控制面 transition 和 Git evidence。'
  };
}

function runnerHash() {
  const content = fs.readFileSync(fileURLToPath(import.meta.url));
  return `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
}

function failedReport(error) {
  return {
    schema_version: HOST_TRIAL_REPORT_VERSION,
    trial_id: 'HST-semi-real-001',
    executed_at: NOW,
    mode: 'semi-real',
    status: 'FAIL',
    isolated: true,
    side_effects: 'temporary-git-only',
    runner_sha256: runnerHash(),
    summary: '半真实 Host trial 未完成。',
    host: { adapter: 'local-git-worktree', real_git: true, real_worktree: true, codex_app_threads: false, external_network: false },
    assertions: [],
    earliest_violation: {
      rule_id: 'HST-EXECUTION-001',
      reason: error.message,
      next_action: '从失败的 Host action、CAS、receipt 或 Git 操作开始修复。'
    }
  };
}

function normalizePath(value) {
  return value.replaceAll('\\', '/');
}
