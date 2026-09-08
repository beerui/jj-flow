import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  TASK_PLAN_REL,
  initRun,
  mapMergeFromRun,
  saveRun,
  recordReview,
  archiveRun,
  setGate,
  extractLedgerPathRefs,
  extractMarkdownSection,
  extractPlanCurrentSection,
  collectClaimedImplementationPaths,
  findImplementationPathMismatch,
  detectTestIntegrityViolation,
  INSTRUCTION_CORRECTION_REL,
  evaluateAcceptArchiveGate,
  inspectAcceptanceEvidence,
  evaluateAcceptJudgment,
  detectDeliverOutsideLedger,
  recordDeliverAttempt,
  fingerprintDeliverState,
  setAcceptLayer,
  addGateIssue,
  rollbackPhase,
  setRunStatus,
  resumeRun,
  abandonRun,
  suggestReopenAsNew,
  loadRun
} from '../../src/ralph.mjs';
import { ledgerText } from './helpers.mjs';

test('setGate advances phase on PASS and can block', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-gate-'));
  try {
    const runId = 'task-gate';
    initRun({ run_id: runId, title: 'gate', goal: 'advance', capability_ids: ['CAP-gate'] }, cwd);
    let result = setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    assert.equal(result.phase, 'PLAN');
    assert.equal(result.run.gates.analyze, 'PASS');
    result = setGate(runId, { gate: 'plan', status: 'BLOCKED', cwd });
    assert.equal(result.run.status, 'BLOCKED');
    result = setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    assert.equal(result.phase, 'DELIVER');
    assert.equal(result.run.status, 'IN_PROGRESS');
    result = setGate(runId, { gate: 'deliver', status: 'PASS', cwd, advance: false });
    assert.equal(result.run.gates.deliver, 'PASS');
    assert.equal(result.phase, 'DELIVER');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('rollbackPhase allows apbacent edges and writes progress; COMPLETED/ARCHIVE/ABANDONED resumable', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-rollback-'));
  try {
    const runId = 'task-rollback';
    initRun({ run_id: runId, title: 'rollback', goal: 'phase back', capability_ids: ['CAP-rb'] }, cwd);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    setGate(runId, { gate: 'deliver', status: 'PASS', cwd });
    let run = loadRun(runId, cwd);
    assert.equal(run.phase, 'ACCEPT');
    assert.equal(run.gates.deliver, 'PASS');

    const rolled = rollbackPhase(runId, { toPhase: 'DELIVER', reason: '验收证据不足', cwd });
    assert.equal(rolled.toPhase, 'DELIVER');
    assert.equal(rolled.fromPhase, 'ACCEPT');
    run = loadRun(runId, cwd);
    assert.equal(run.phase, 'DELIVER');
    assert.equal(run.gates.deliver, 'FAIL');
    assert.equal(run.gates.accept, 'PENDING');
    const progress = ledgerText(cwd, runId);
    assert.match(progress, /rollbackPhase ACCEPT→DELIVER/);

    assert.throws(
      () => rollbackPhase(runId, { toPhase: 'ANALYZE', reason: 'skip not allowed', cwd }),
      /apbacent/
    );

    setRunStatus(runId, { status: 'PAUSED', reason: '等 UAT', cwd });
    run = loadRun(runId, cwd);
    assert.equal(run.status, 'PAUSED');
    setRunStatus(runId, { status: 'IN_PROGRESS', reason: '继续实施', cwd });
    run = loadRun(runId, cwd);
    assert.equal(run.status, 'IN_PROGRESS');

    // COMPLETED / ARCHIVE are soft — same-run resume + ARCHIVE→ACCEPT rollback allowed
    run.status = 'COMPLETED';
    run.phase = 'ARCHIVE';
    run.gates.archive = 'PASS';
    run.gates.accept = 'PASS';
    saveRun(run, cwd);
    const resumedStatus = setRunStatus(runId, { status: 'IN_PROGRESS', reason: 'same-run continue after archive', cwd });
    assert.equal(resumedStatus.status, 'IN_PROGRESS');
    assert.equal(loadRun(runId, cwd).status, 'IN_PROGRESS');

    // re-apply COMPLETED+ARCHIVE for rollback path
    run = loadRun(runId, cwd);
    run.status = 'COMPLETED';
    run.phase = 'ARCHIVE';
    run.gates.archive = 'PASS';
    run.gates.accept = 'PASS';
    saveRun(run, cwd);
    const fromArchive = rollbackPhase(runId, { toPhase: 'ACCEPT', reason: 'resume deliver after soft archive', cwd });
    assert.equal(fromArchive.fromPhase, 'ARCHIVE');
    assert.equal(fromArchive.toPhase, 'ACCEPT');
    assert.equal(fromArchive.status, 'IN_PROGRESS');
    run = loadRun(runId, cwd);
    assert.equal(run.phase, 'ACCEPT');
    assert.equal(run.status, 'IN_PROGRESS');
    assert.equal(run.gates.archive, 'PENDING');

    // ABANDONED → resume same run
    const abandoned = abandonRun(runId, { reason: 'half-done drop for now', cwd });
    assert.equal(abandoned.status, 'ABANDONED');
    assert.throws(
      () => mapMergeFromRun(runId, { force: true }, cwd),
      /ABANDONED/
    );
    const resumed = resumeRun(runId, { reason: 'pick abandoned work back up', cwd });
    assert.equal(resumed.status, 'IN_PROGRESS');
    assert.equal(resumed.from, 'ABANDONED');
    assert.equal(loadRun(runId, cwd).status, 'IN_PROGRESS');

    const suggestion = suggestReopenAsNew(run, { newRunId: 'task-rollback-reopen' });
    assert.equal(suggestion.supersedes_run_id, runId);
    assert.match(suggestion.note, /same-run resume|Prefer same-run/i);
    assert.match(suggestion.note, /progress\.md/i);
    assert.match(suggestion.note, /not family/i);
    assert.doesNotMatch(suggestion.note, /progress\/family/i);
    assert.doesNotMatch(suggestion.note, /Do not un-archive|cannot.*reopen/i);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('setGate FAIL covers prior PASS without forging COMPLETED reopen', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-gate-fail-'));
  try {
    const runId = 'task-gate-fail';
    initRun({ run_id: runId, title: 'gate fail', goal: 'fail gate', capability_ids: ['CAP-gf'] }, cwd);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    const failed = setGate(runId, { gate: 'plan', status: 'FAIL', cwd, advance: false });
    assert.equal(failed.run.gates.plan, 'FAIL');
    assert.equal(failed.phase, 'DELIVER');
    const progress = ledgerText(cwd, runId);
    assert.match(progress, /gate plan=FAIL/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('product-consistency extracts ledger paths and detects EP-04-style drift', () => {
  const bt = String.fromCharCode(96);
  const plan = [
    '# Plan',
    `- TASK-1: ${bt}publish-dialog.vue${bt} @closed blur`,
    `- TASK-2: ${bt}batch-publish-dialog.vue${bt}`
  ].join('\n');
  const claimed = extractLedgerPathRefs(plan);
  assert.deepEqual(claimed, ['publish-dialog.vue', 'batch-publish-dialog.vue']);
  const mismatch = findImplementationPathMismatch(claimed, [
    'src/views/pages/draft-manage/InventoryManager.vue'
  ]);
  assert.match(mismatch, /InventoryManager\.vue/);
  assert.equal(
    findImplementationPathMismatch(['inquiry-card.vue'], [
      'src/views/components/inquiry-card.vue'
    ]),
    null
  );
});

test('accept/archive PASS blocked by NEEDS_CHANGES review and path drift', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-consistency-'));
  try {
    const runId = 'task-consistency';
    initRun({ run_id: runId, title: 'consistency', goal: 'block false complete', capability_ids: ['CAP-consistency'] }, cwd);
    const runDirPath = path.join(cwd, '.workflow', 'ralph', runId);
    const bt = String.fromCharCode(96);
    fs.writeFileSync(
      path.join(runDirPath, TASK_PLAN_REL),
      ['## 计划', '### 当前', `- TASK: ${bt}publish-dialog.vue${bt} blur`].join('\n'),
      'utf8'
    );

    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    setGate(runId, { gate: 'deliver', status: 'PASS', cwd });

    assert.throws(
      () => setGate(runId, {
        gate: 'accept',
        status: 'PASS',
        cwd,
        diff_paths: ['src/views/pages/draft-manage/InventoryManager.vue']
      }),
      /product-consistency gate blocked accept PASS/
    );

    // Align ledger and diff first, then record a failing review.
    fs.writeFileSync(
      path.join(runDirPath, TASK_PLAN_REL),
      ['## 计划', '### 当前', `- TASK: ${bt}InventoryManager.vue${bt} focus-visible`].join('\n'),
      'utf8'
    );
    recordReview(runId, {
      cwd,
      outcome: 'NEEDS_CHANGES',
      summary: 'ledger/code still inconsistent historically',
      findings: [{
        id: 'F-1',
        severity: 'medium',
        file: TASK_PLAN_REL,
        line: 1,
        description: 'OPEN drift',
        status: 'OPEN',
        acceptance: 'sync ledger'
      }]
    });

    assert.throws(
      () => setGate(runId, {
        gate: 'accept',
        status: 'PASS',
        cwd,
        diff_paths: ['src/views/pages/draft-manage/InventoryManager.vue']
      }),
      /latest review REV-1 is NEEDS_CHANGES/
    );

    // Direct archive must also refuse when review is NEEDS_CHANGES even if accept was forced earlier.
    const runPath = path.join(runDirPath, '.state', 'run.json');
    const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
    run.gates.accept = 'PASS';
    saveRun(run, cwd);
    assert.throws(() => archiveRun(runId, { cwd }), /archive blocked by product-consistency gate/)

    // force escapes the gate for operator override.
    const forced = setGate(runId, {
      gate: 'accept',
      status: 'PASS',
      cwd,
      force: true,
      diff_paths: ['src/views/pages/draft-manage/InventoryManager.vue']
    });
    assert.equal(forced.run.gates.accept, 'PASS');
    const archived = archiveRun(runId, { cwd, force: true });
    assert.equal(archived.run.status, 'COMPLETED');

    const evalOk = evaluateAcceptArchiveGate(run, {
      cwd,
      force: true,
      diff_paths: ['src/views/pages/draft-manage/InventoryManager.vue']
    });
    assert.equal(evalOk.ok, true);
    assert.equal(evalOk.forced, true);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('accept PASS blocked when write-then-read evidence_class is only static', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-evclass-'));
  try {
    const runId = 'task-evidence-class';
    initRun({
      run_id: runId,
      title: 'evidence class',
      goal: 'block false green',
      attach_knowledge: false
    }, cwd);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    setGate(runId, { gate: 'deliver', status: 'PASS', cwd });
    const acceptancePath = path.join(cwd, '.workflow', 'ralph', runId, TASK_PLAN_REL);
    fs.writeFileSync(acceptancePath, [
      '## 验收',
      '',
      '### 当前',
      '',
      '| 项 | must_id | evidence_class | 结果 | 证据 |',
      '| --- | --- | --- | --- | --- |',
      '| title persist | REQ-001 | write-then-read | PASS | static |',
      ''
    ].join('\n'), 'utf8');
    const inspected = inspectAcceptanceEvidence(loadRun(runId, cwd), cwd);
    assert.equal(inspected.header_has_class, true);
    assert.equal(inspected.weak_evidence_pass, true);
    assert.throws(
      () => setGate(runId, { gate: 'accept', status: 'PASS', cwd }),
      /evidence_class over-claim/
    );
    const forced = setGate(runId, { gate: 'accept', status: 'PASS', cwd, force: true });
    assert.equal(forced.run.gates.accept, 'PASS');

    fs.writeFileSync(acceptancePath, [
      '## 验收',
      '',
      '### 当前',
      '',
      '| 项 | must_id | evidence_class | 结果 | 证据 |',
      '| --- | --- | --- | --- | --- |',
      '| title persist | REQ-001 | write-then-read | PASS | write_then_read:mock_ok |',
      ''
    ].join('\n'), 'utf8');
    const run = loadRun(runId, cwd);
    run.gates.accept = 'PENDING';
    saveRun(run, cwd);
    const ok = setGate(runId, { gate: 'accept', status: 'PASS', cwd });
    assert.equal(ok.run.gates.accept, 'PASS');

    run.gates.accept = 'PENDING';
    saveRun(run, cwd);
    fs.writeFileSync(acceptancePath, [
      '# ' + runId,
      '',
      '## Goal',
      '',
      'lean checkbox',
      '',
      '## 验收',
      '',
      '1. [x] After save, reopen shows title persist 证据: static',
      '',
      '## Steps',
      '',
      '1. [x] `src/a.js`',
      ''
    ].join('\n'), 'utf8');
    const checkbox = inspectAcceptanceEvidence(loadRun(runId, cwd), cwd);
    assert.equal(checkbox.weak_evidence_pass, true);
    assert.throws(
      () => setGate(runId, { gate: 'accept', status: 'PASS', cwd }),
      /evidence_class over-claim/
    );
    fs.writeFileSync(acceptancePath, [
      '# ' + runId,
      '',
      '## 验收',
      '',
      '1. [x] After save, reopen shows title  evidence_class: write-then-read  证据: write_then_read:mock_ok',
      ''
    ].join('\n'), 'utf8');
    const checkboxOk = setGate(runId, { gate: 'accept', status: 'PASS', cwd });
    assert.equal(checkboxOk.run.gates.accept, 'PASS');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('archive blocks working_tree PASS review without fix commit (v2)', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-v2-'));
  try {
    const runId = 'task-review-scope';
    initRun({ run_id: runId, title: 'scope', goal: 'working tree review cannot archive', capability_ids: ['CAP-scope'], attach_knowledge: false }, cwd);
    const runDirPath = path.join(cwd, '.workflow', 'ralph', runId);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    setGate(runId, { gate: 'deliver', status: 'PASS', cwd });
    recordReview(runId, {
      cwd,
      outcome: 'PASS',
      review_scope: 'working_tree',
      summary: 'looks ok in tree'
    });
    setGate(runId, {
      gate: 'accept',
      status: 'PASS',
      cwd,
      diff_paths: []
    });
    assert.throws(
      () => archiveRun(runId, { cwd, diff_paths: [] }),
      /review_scope=commit/
    );
    recordReview(runId, {
      cwd,
      outcome: 'PASS',
      review_scope: 'commit',
      fix_commit: 'abcdef1234567',
      reviewed_commit: 'abcdef1234567',
      summary: 'landed'
    });
    const archived = archiveRun(runId, { cwd, diff_paths: [] });
    assert.equal(archived.run.status, 'COMPLETED');
    const latest = archived.run.review.reviews.at(-1);
    assert.equal(latest.review_scope, 'commit');
    assert.equal(latest.fix_commit, 'abcdef1234567');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('accept blocked when deliver pending despite progress DELIVER (v4)', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-v4-'));
  try {
    const runId = 'task-deliver-drift';
    initRun({ run_id: runId, title: 'drift', goal: 'deliver outside ledger', capability_ids: ['CAP-drift'], attach_knowledge: false }, cwd);
    const runDirPath = path.join(cwd, '.workflow', 'ralph', runId);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    fs.appendFileSync(path.join(runDirPath, 'progress.md'), '- 2026-07-29 DELIVER: changed account.vue\n', 'utf8');
    const drift = detectDeliverOutsideLedger(
      JSON.parse(fs.readFileSync(path.join(runDirPath, '.state', 'run.json'), 'utf8')),
      cwd,
      { diff_paths: ['src/views/account.vue'] }
    );
    assert.equal(drift.observed, true);
    assert.ok(drift.signals.includes('progress_mentions_deliver'));
    assert.throws(
      () => setGate(runId, {
        gate: 'accept',
        status: 'PASS',
        cwd,
        diff_paths: ['src/views/account.vue']
      }),
      /gates\.deliver=PASS|deliver work observed/
    );
    setGate(runId, { gate: 'deliver', status: 'PASS', cwd });
    const ok = setGate(runId, {
      gate: 'accept',
      status: 'PASS',
      cwd,
      diff_paths: ['src/views/account.vue']
    });
    assert.equal(ok.run.gates.accept, 'PASS');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('recordDeliverAttempt stagnates then BLOCKED with STAGNATION', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-stag-'));
  try {
    const runId = 'task-stagnation';
    initRun({
      run_id: runId,
      title: 'stag',
      goal: 'stop spinning',
      capability_ids: ['CAP-stag'],
      attach_knowledge: false,
      intensity: 'tiny'
    }, cwd);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });

    let r = recordDeliverAttempt(runId, { improved: false, signal: 'test_fail:foo', cwd });
    assert.equal(r.blocked, false);
    assert.equal(r.stagnation.unchanged_count, 1);
    assert.equal(r.iteration, 1);

    r = recordDeliverAttempt(runId, { improved: false, signal: 'test_fail:foo', cwd });
    assert.equal(r.blocked, true);
    assert.equal(r.status, 'BLOCKED');
    assert.equal(r.intervention_needed.kind, 'STAGNATION');
    assert.equal(r.stagnation.unchanged_count, 2);

    // improvement resets counter when unblocked
    setRunStatus(runId, { status: 'IN_PROGRESS', reason: 'retry with new strategy', cwd });
    r = recordDeliverAttempt(runId, { improved: true, signal: 'tests_green', cwd });
    assert.equal(r.blocked, false);
    assert.equal(r.stagnation.unchanged_count, 0);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('recordDeliverAttempt auto fingerprint detects no-change stagnation', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-auto-fp-'));
  try {
    const runId = 'task-auto-fp';
    initRun({
      run_id: runId,
      title: 'auto fp',
      goal: 'fingerprint',
      capability_ids: ['CAP-fp'],
      attach_knowledge: false,
      intensity: 'tiny'
    }, cwd);
    const samePaths = ['src/a.js'];
    const r1 = recordDeliverAttempt(runId, {
      signal: 'fail',
      paths: samePaths,
      cwd
    });
    assert.equal(r1.improved_source, 'auto');
    assert.equal(r1.improved, true); // baseline
    assert.ok(r1.fingerprint);

    const r2 = recordDeliverAttempt(runId, {
      signal: 'fail',
      paths: samePaths,
      cwd
    });
    assert.equal(r2.improved, false);
    assert.equal(r2.blocked, false);

    const r3 = recordDeliverAttempt(runId, {
      signal: 'fail',
      paths: samePaths,
      cwd
    });
    assert.equal(r3.improved, false);
    assert.equal(r3.blocked, true);
    assert.equal(r3.intervention_needed.kind, 'STAGNATION');

    // path change → improved
    setRunStatus(runId, { status: 'IN_PROGRESS', reason: 'new diff', cwd });
    const r4 = recordDeliverAttempt(runId, {
      signal: 'fail',
      paths: ['src/a.js', 'src/b.js'],
      cwd
    });
    assert.equal(r4.improved, true);
    assert.equal(r4.stagnation.unchanged_count, 0);

    const fp = fingerprintDeliverState(cwd, { signal: 'x', paths: ['src/z.js'] });
    assert.equal(fp.fingerprint.length, 16);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('strict accept requires judgment layer; error gate_issues block; standard can skip', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-accept-layer-'));
  try {
    const strictId = 'task-strict-accept';
    initRun({
      run_id: strictId,
      title: 'strict accept',
      goal: 'judgment required',
      capability_ids: ['CAP-strict'],
      attach_knowledge: false,
      intensity: 'strict'
    }, cwd);
    setGate(strictId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(strictId, { gate: 'plan', status: 'PASS', cwd });
    setGate(strictId, { gate: 'deliver', status: 'PASS', cwd });

    // Without judgment PASS, strict accept is blocked (force would bypass — not used here).
    assert.throws(
      () => setGate(strictId, { gate: 'accept', status: 'PASS', cwd }),
      /judgment/
    );

    setAcceptLayer(strictId, { layer: 'judgment', status: 'PASS', mode: 'review', note: 'REV ok', cwd });
    const passed = setGate(strictId, { gate: 'accept', status: 'PASS', cwd });
    assert.equal(passed.run.gates.accept, 'PASS');
    assert.equal(passed.run.accept_layers.mechanical, 'PASS');
    assert.equal(passed.run.accept_layers.judgment, 'PASS');

    const stdId = 'task-std-accept';
    initRun({
      run_id: stdId,
      title: 'standard accept',
      goal: 'skip judgment',
      capability_ids: ['CAP-std'],
      attach_knowledge: false,
      intensity: 'standard'
    }, cwd);
    setGate(stdId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(stdId, { gate: 'plan', status: 'PASS', cwd });
    setGate(stdId, { gate: 'deliver', status: 'PASS', cwd });
    const stdPass = setGate(stdId, { gate: 'accept', status: 'PASS', cwd });
    assert.equal(stdPass.run.gates.accept, 'PASS');
    assert.equal(stdPass.run.accept_layers.judgment, 'SKIPPED');

    const errId = 'task-gate-issue';
    initRun({
      run_id: errId,
      title: 'gate issue',
      goal: 'error blocks',
      capability_ids: ['CAP-issue'],
      attach_knowledge: false,
      intensity: 'standard'
    }, cwd);
    setGate(errId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(errId, { gate: 'plan', status: 'PASS', cwd });
    setGate(errId, { gate: 'deliver', status: 'PASS', cwd });
    addGateIssue(errId, { class: 'error', code: 'SEC-1', message: 'secret in code', cwd });
    assert.equal(evaluateAcceptJudgment(loadRun(errId, cwd)).ok, false);
    assert.throws(() => setGate(errId, { gate: 'accept', status: 'PASS', cwd }), /gate_issue error/);
    // warning does not block
    const warnId = 'task-gate-warn';
    initRun({
      run_id: warnId,
      title: 'warn',
      goal: 'warn ok',
      capability_ids: ['CAP-warn'],
      attach_knowledge: false
    }, cwd);
    setGate(warnId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(warnId, { gate: 'plan', status: 'PASS', cwd });
    setGate(warnId, { gate: 'deliver', status: 'PASS', cwd });
    addGateIssue(warnId, { class: 'warning', message: 'style nits', cwd });
    assert.equal(setGate(warnId, { gate: 'accept', status: 'PASS', cwd }).run.gates.accept, 'PASS');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('extractPlanCurrentSection ignores Landed and claimed paths use 当前 only', () => {
  const bt = String.fromCharCode(96);
  const withCurrent = [
    '# Plan',
    '## Current',
    `- TASK-2 ${bt}tip.vue${bt}`,
    '## Landed',
    `- TASK-1 ${bt}old-panel.vue${bt}`,
    '## Superseded',
    `- TASK-0 ${bt}legacy.vue${bt}`
  ].join('\n');
  assert.deepEqual(extractLedgerPathRefs(extractPlanCurrentSection(withCurrent)), []);
  assert.ok(extractLedgerPathRefs(withCurrent).includes('old-panel.vue'));

  const chinese = [
    '## 计划',
    '### 当前',
    `- TASK-2 ${bt}tip.vue${bt}`,
    '### 已落地',
    `- TASK-1 ${bt}old-panel.vue${bt}`,
    '### 已取代',
    `- TASK-0 ${bt}legacy.vue${bt}`,
    '## 验收',
    '### 当前',
    `- ${bt}should-not-count.vue${bt}`
  ].join('\n');
  assert.match(extractMarkdownSection(chinese, '计划', 2), /tip\.vue/);
  assert.match(extractMarkdownSection(chinese, '计划', 2), /old-panel\.vue/);
  assert.deepEqual(extractLedgerPathRefs(extractPlanCurrentSection(chinese)), ['tip.vue']);

  const steps = [
    '## Goal',
    'do the thing',
    '## Steps',
    `- TASK-2 ${bt}tip.vue${bt}`,
    '## 验收',
    `- ${bt}should-not-count.vue${bt}`
  ].join('\n');
  assert.deepEqual(extractLedgerPathRefs(extractPlanCurrentSection(steps)), ['tip.vue']);
  const emptyCurrent = [
    '## 计划',
    '### 当前',
    '',
    '### 已落地',
    `- TASK-1 ${bt}old-panel.vue${bt}`
  ].join('\n');
  assert.deepEqual(extractLedgerPathRefs(extractPlanCurrentSection(emptyCurrent)), []);

  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-current-'));
  try {
    const runId = 'task-current-paths';
    initRun({ run_id: runId, title: 'current paths', goal: 'current only', attach_knowledge: false }, cwd);
    const dir = path.join(cwd, '.workflow', 'ralph', runId);
    const planOnly = [
      '## 计划',
      '### 当前',
      `- TASK-2 ${bt}tip.vue${bt}`,
      '### 已落地',
      `- TASK-1 ${bt}old-panel.vue${bt}`,
      '### 已取代',
      `- TASK-0 ${bt}legacy.vue${bt}`
    ].join('\n');
    fs.writeFileSync(path.join(dir, TASK_PLAN_REL), planOnly, 'utf8');
    const claimed = collectClaimedImplementationPaths(loadRun(runId, cwd), cwd);
    assert.deepEqual(claimed, ['tip.vue']);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    setGate(runId, { gate: 'deliver', status: 'PASS', cwd });
    const ok = setGate(runId, {
      gate: 'accept',
      status: 'PASS',
      cwd,
      diff_paths: ['src/views/tip.vue']
    });
    assert.equal(ok.run.gates.accept, 'PASS');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('second unchanged deliver-attempt writes instruction-correction', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-twostrike-'));
  try {
    const runId = 'task-twostrike';
    initRun({ run_id: runId, title: 'two strike', goal: 'stagnation correction', attach_knowledge: false }, cwd);
    recordDeliverAttempt(runId, { cwd, improved: false, signal: 'same-tool' });
    const second = recordDeliverAttempt(runId, { cwd, improved: false, signal: 'same-tool' });
    assert.equal(second.blocked, true);
    const correction = path.join(cwd, '.workflow', 'ralph', runId, INSTRUCTION_CORRECTION_REL);
    assert.ok(fs.existsSync(correction));
    assert.match(fs.readFileSync(correction, 'utf8'), /Proposed rule/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('bugfix cannot delete tests; tiny presentational does not trip', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-testint-'));
  try {
    const runId = 'task-testint';
    initRun({ run_id: runId, title: 'test integrity', goal: 'protect tests', attach_knowledge: false }, cwd);
    fs.appendFileSync(
      path.join(cwd, '.workflow', 'ralph', runId, 'progress.md'),
      '- 2026-08-31T00:00:00.000Z failed_must REQ-1\n',
      'utf8'
    );
    const hit = detectTestIntegrityViolation(loadRun(runId, cwd), cwd, {
      diff_paths: ['src/app.js'],
      deleted_paths: ['tests/app.test.js']
    });
    assert.equal(hit.violated, true);

    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    setGate(runId, { gate: 'deliver', status: 'PASS', cwd });
    assert.throws(
      () => setGate(runId, {
        gate: 'accept',
        status: 'PASS',
        cwd,
        diff_paths: ['src/app.js'],
        deleted_paths: ['tests/app.test.js']
      }),
      /must not delete or empty tests/
    );

    const tinyId = 'task-testint-tiny';
    initRun({ run_id: tinyId, title: 'tiny css', goal: 'color', intensity: 'tiny', attach_knowledge: false }, cwd);
    const skip = detectTestIntegrityViolation(loadRun(tinyId, cwd), cwd, {
      diff_paths: ['src/a.css'],
      deleted_paths: ['tests/a.test.js']
    });
    assert.equal(skip.violated, false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
