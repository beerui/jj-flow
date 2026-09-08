import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { runCli } from '../../src/cli.mjs';
import {
  RALPH_RUN_SCHEMA_VERSION,
  RALPH_RUN_SCHEMA_VERSION_LEGACY,
  TASK_PLAN_REL,
  initRun,
  saveRun,
  validateRun,
  defaultArchiveDirName,
  archiveRun,
  setGate,
  finalizeRun,
  readRunArtifactText,
  computeRunMetrics,
  recordHostMeta,
  INTENSITY_DEFAULTS,
  resolveReviewScope,
  resumeRun,
  abandonRun,
  loadRun,
  listRuns,
  locateRalphRuns,
  computeRalphNext,
  collectIndexArchiveHints,
  collectSameRequirementHints,
  writeRalphIndex,
  INDEX_ACTIVE_CAP,
  INDEX_STALE_MS,
  remediateCloseout,
  getStatus,
  ARCHIVE_CLOSEOUT_WARNING,
  renderRalphStatusText,
  appendProgressRound
} from '../../src/ralph.mjs';
import { root, ledgerText, withoutLocalPortfolio, liteAcceptanceTable, makeNextRun } from './helpers.mjs';

test('initRun writes lean Goal/验收/Steps task_plan and schema 1.2 task-* layout', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-init-shape-'));
  try {
    const runId = 'task-init-shape';
    const run = initRun({ run_id: runId, title: 'init shape', goal: 'Current heading', capability_ids: ['CAP-init-shape'], attach_knowledge: false }, cwd);
    assert.equal(run.schema_version, RALPH_RUN_SCHEMA_VERSION);
    assert.equal(run.artifact_refs.analyze, TASK_PLAN_REL);
    assert.equal(run.artifact_refs.plan, TASK_PLAN_REL);
    assert.equal(run.artifact_refs.acceptance, TASK_PLAN_REL);
    assert.equal(run.artifact_refs.findings, 'findings.md');
    assert.equal(run.gate_set, 'full');
    const dir = path.join(cwd, '.workflow', 'ralph', runId);
    const plan = fs.readFileSync(path.join(dir, TASK_PLAN_REL), 'utf8');
    assert.match(plan, /^## Goal$/m);
    assert.match(plan, /^## 验收$/m);
    assert.match(plan, /^## Steps$/m);
    assert.match(plan, /^## 存疑$/m);
    assert.equal((plan.match(/^## 分析$/m) || []).length, 0);
    assert.equal((plan.match(/^## 计划$/m) || []).length, 0);
    assert.equal((plan.match(/^### 当前$/m) || []).length, 0);
    assert.equal((plan.match(/^## Tasks$/m) || []).length, 0);
    assert.equal(fs.existsSync(path.join(dir, 'analyze.md')), false);
    assert.equal(fs.existsSync(path.join(dir, 'plan.md')), false);
    assert.equal(fs.existsSync(path.join(dir, 'acceptance.md')), false);
    assert.equal(fs.existsSync(path.join(dir, 'intent.md')), false);
    assert.equal(fs.existsSync(path.join(dir, 'knowledge-attach.json')), false);
    const findings = fs.readFileSync(path.join(dir, 'findings.md'), 'utf8');
    assert.match(findings, /## 可复用结论/);
    assert.match(findings, /## 改动摘要/);
    const progress = fs.readFileSync(path.join(dir, 'progress.md'), 'utf8');
    assert.match(progress, /^## \d{4}-\d{2}-\d{2}$/m);
    assert.doesNotMatch(progress, /failed_must:/);
    assert.doesNotMatch(progress, /hot_memory:/);
    assert.match(ledgerText(cwd, runId), /hot_memory:/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('defaultArchiveDirName avoids duplicated YYYYMMDD in archive folder', () => {
  assert.equal(defaultArchiveDirName('RALPH-smoke-20260723'), '2026-07-23-smoke');
  assert.equal(defaultArchiveDirName('RALPH-login-reminder-20260722'), '2026-07-22-login-reminder');
  assert.equal(defaultArchiveDirName('RALPH-demo', '2026-07-23T00:00:00.000Z'), '2026-07-23-demo');
});

test('archive soft-completes in place with inline ledger; leftover archive/ snapshot is read-only', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-arch-'));
  try {
    const runId = 'task-freeze';
    const liveRel = '.workflow/ralph/' + runId;
    const completedRel = '.workflow/ralph/completed/' + runId;
    initRun({ run_id: runId, title: 'freeze', goal: 'archive completed copy', capability_ids: ['CAP-freeze'] }, cwd);
    const runPath = path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json');
    const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
    run.gates = { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PASS', archive: 'PENDING' };
    saveRun(run, cwd);
    const leftoverDir = path.join(cwd, '.workflow', 'ralph', 'archive', 'old-snap');
    fs.mkdirSync(leftoverDir, { recursive: true });
    const leftoverFile = path.join(leftoverDir, 'marker.txt');
    fs.writeFileSync(leftoverFile, 'historical-snapshot\n');
    const result = archiveRun(runId, { cwd, slug: 'ignored-slug' });
    assert.equal(result.archive_path, completedRel);
    assert.equal(result.manifest.schema_version, 'jj-flow/ralph-archive/1.1');
    assert.equal(result.manifest.archive_path, completedRel);
    assert.ok(!fs.existsSync(path.join(cwd, '.workflow', 'ralph', runId, 'archive-manifest.json')));
    const archivedRun = JSON.parse(fs.readFileSync(path.join(cwd, result.archive_path, '.state', 'run.json'), 'utf8'));
    assert.equal(archivedRun.status, 'COMPLETED');
    assert.equal(archivedRun.phase, 'ARCHIVE');
    assert.equal(archivedRun.gates.archive, 'PASS');
    assert.ok(archivedRun.archive && archivedRun.archive.archived_at);
    assert.ok(Array.isArray(archivedRun.archive.files));
    assert.ok(archivedRun.archive.files.some((file) => file.path === '.state/run.json'));
    assert.ok(archivedRun.archive.manifest_hash);
    assert.deepEqual(archivedRun.archive_history, []);
    const active = loadRun(runId, cwd);
    assert.equal(active.status, 'COMPLETED');
    assert.ok(active.last_archived_at);
    assert.equal(active.last_archive_path, completedRel);
    assert.equal(fs.readFileSync(leftoverFile, 'utf8'), 'historical-snapshot\n');
    // Soft archive is not a freeze: same run can resume and re-archive in place.
    resumeRun(runId, { reason: 'more work after archive', cwd });
    assert.equal(loadRun(runId, cwd).status, 'IN_PROGRESS');
    assert.ok(fs.existsSync(path.join(cwd, liveRel, '.state', 'run.json')));
    const re = archiveRun(runId, { cwd });
    assert.equal(re.archive_path, completedRel);
    assert.equal(re.archive_path, result.archive_path);
    assert.ok(fs.existsSync(path.join(cwd, re.archive_path, '.state', 'run.json')));
    const reloaded = loadRun(runId, cwd);
    assert.equal(reloaded.status, 'COMPLETED');
    assert.equal(reloaded.last_archive_path, completedRel);
    assert.equal(reloaded.archive_history.length, 1);
    assert.equal(reloaded.archive_history[0].archived_at, result.run.archive.archived_at);
    assert.equal(reloaded.archive_history[0].manifest_hash, result.run.archive.manifest_hash);
    assert.ok(!fs.existsSync(path.join(cwd, '.workflow', 'ralph', runId, 'archive-manifest.json')));
    assert.equal(fs.readFileSync(leftoverFile, 'utf8'), 'historical-snapshot\n');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('host-record and init host metadata persist on run', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-host-'));
  try {
    const runId = 'task-host-meta';
    initRun({
      run_id: runId,
      title: 'host',
      goal: 'bind host',
      capability_ids: ['CAP-host'],
      attach_knowledge: false,
      host: { host_id: 'grok-build', thread_id: 'thread-1', model_id: 'grok-x' }
    }, cwd);
    let run = JSON.parse(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json'), 'utf8'));
    assert.equal(run.host.host_id, 'grok-build');
    assert.equal(run.host.thread_id, 'thread-1');
    const updated = recordHostMeta(runId, { export_path: '.workflow/exports/thread-1.jsonl', session_handle: 'sess-9' }, cwd);
    assert.equal(updated.host.export_path, '.workflow/exports/thread-1.jsonl');
    assert.equal(updated.host.session_handle, 'sess-9');
    const stdout = { write: () => {} };
    assert.equal(runCli(['ralph', 'host-record', '--run-id', runId, '--host-id', 'codex', '--thread-id', '019f', '--json'], { cwd, stdout }), 0);
    run = JSON.parse(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json'), 'utf8'));
    assert.equal(run.host.host_id, 'codex');
    assert.equal(run.host.thread_id, '019f');
    assert.equal(resolveReviewScope({ reviewed_commit: 'abcdef1' }), 'commit');
    assert.equal(resolveReviewScope({}), 'working_tree');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('init intensity tiers set budget and accept_layers defaults', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-intensity-'));
  try {
    for (const intensity of ['tiny', 'standard', 'strict']) {
      const runId = 'task-intensity-' + intensity;
      initRun({
        run_id: runId,
        title: 'intensity ' + intensity,
        goal: 'tier defaults',
        capability_ids: ['CAP-intensity'],
        attach_knowledge: false,
        intensity
      }, cwd);
      const run = loadRun(runId, cwd);
      assert.equal(run.intensity, intensity);
      assert.equal(run.max_iterations, INTENSITY_DEFAULTS[intensity].max_iterations);
      assert.equal(run.budget.max_deliver_loops, INTENSITY_DEFAULTS[intensity].budget.max_deliver_loops);
      assert.equal(run.stagnation.patience, INTENSITY_DEFAULTS[intensity].stagnation_patience);
      assert.equal(run.stagnation.unchanged_count, 0);
      if (intensity === 'strict') {
        assert.equal(run.accept_layers.judgment, 'PENDING');
      } else {
        assert.equal(run.accept_layers.judgment, 'SKIPPED');
      }
      assert.deepEqual(validateRun(run), []);
    }
    assert.throws(
      () => initRun({
        run_id: 'task-intensity-bad',
        title: 'bad',
        goal: 'bad',
        capability_ids: ['CAP-intensity'],
        attach_knowledge: false,
        intensity: 'ludicrous'
      }, cwd),
      /intensity must be/
    );
    // default standard
    initRun({
      run_id: 'task-intensity-default',
      title: 'default',
      goal: 'default',
      capability_ids: ['CAP-intensity'],
      attach_knowledge: false
    }, cwd);
    assert.equal(loadRun('task-intensity-default', cwd).intensity, 'standard');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('init writes Goal into task_plan.md except tiny skips 存疑', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-intent-'));
  try {
    const standardId = 'task-intent-std';
    initRun({ run_id: standardId, title: 'intent std', goal: 'write intent', attach_knowledge: false }, cwd);
    const stdDir = path.join(cwd, '.workflow', 'ralph', standardId);
    assert.equal(loadRun(standardId, cwd).artifact_refs.intent, TASK_PLAN_REL);
    assert.equal(fs.existsSync(path.join(stdDir, 'intent.md')), false);
    const stdPlan = fs.readFileSync(path.join(stdDir, TASK_PLAN_REL), 'utf8');
    assert.match(stdPlan, /^## Goal$/m);
    assert.match(stdPlan, /^## 存疑$/m);

    const tinyId = 'task-intent-tiny';
    initRun({ run_id: tinyId, title: 'intent tiny', goal: 'skip intent', intensity: 'tiny', attach_knowledge: false }, cwd);
    assert.equal(loadRun(tinyId, cwd).artifact_refs.intent, null);
    assert.equal(fs.existsSync(path.join(cwd, '.workflow', 'ralph', tinyId, 'intent.md')), false);
    const tinyPlan = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', tinyId, TASK_PLAN_REL), 'utf8');
    assert.match(tinyPlan, /^## Goal$/m);
    assert.doesNotMatch(tinyPlan, /^## 存疑$/m);

    const forcedId = 'task-intent-force';
    initRun({ run_id: forcedId, title: 'intent force', goal: 'tiny with intent', intensity: 'tiny', write_intent: true, attach_knowledge: false }, cwd);
    assert.equal(loadRun(forcedId, cwd).artifact_refs.intent, TASK_PLAN_REL);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('computeRunMetrics derives clocks as null when timestamps missing quality', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-metrics-'));
  try {
    const runId = 'task-metrics';
    initRun({ run_id: runId, title: 'metrics', goal: 'derived', attach_knowledge: false }, cwd);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    const metrics = computeRunMetrics(loadRun(runId, cwd), cwd);
    assert.equal(metrics.clock_quality, 'derived');
    assert.equal(metrics.deliver_rework_cycles, 0);
    assert.equal(typeof metrics.analyze_to_plan_hours === 'number' || metrics.analyze_to_plan_hours === null, true);
    const chunks = [];
    assert.equal(runCli(['ralph', 'metrics', '--run-id', runId, '--json'], { cwd, stdout: { write: (t) => chunks.push(t) } }), 0);
    const payload = JSON.parse(chunks[chunks.length - 1]);
    assert.equal(payload.metrics.clock_quality, 'derived');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('validateRun accepts 1.0 and 1.1; fragments and missing refs fail closed', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-refs-'));
  try {
    const runId = 'task-refs';
    const run = initRun({ run_id: runId, title: 'refs', goal: 'bare filenames', attach_knowledge: false }, cwd);
    assert.deepEqual(validateRun(run), []);
    const legacy = { ...run, schema_version: RALPH_RUN_SCHEMA_VERSION_LEGACY, artifact_refs: { ...run.artifact_refs } };
    delete legacy.artifact_refs.findings;
    assert.deepEqual(validateRun(legacy), []);
    const withFragment = {
      ...run,
      artifact_refs: { ...run.artifact_refs, plan: TASK_PLAN_REL + '#计划' }
    };
    assert.ok(validateRun(withFragment).some((err) => /fragment/.test(err)));
    assert.throws(
      () => readRunArtifactText(withFragment, 'plan', cwd),
      /bare filename/
    );
    const missing = {
      ...run,
      artifact_refs: { ...run.artifact_refs, plan: 'missing.md' }
    };
    assert.throws(
      () => readRunArtifactText(missing, 'plan', cwd),
      /missing file/
    );
    const emptyRef = { ...run, artifact_refs: { ...run.artifact_refs, plan: null } };
    assert.equal(readRunArtifactText(emptyRef, 'plan', cwd), '');
    assert.ok(readRunArtifactText(run, 'plan', cwd).includes('## Steps'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('Scheme A: events.jsonl is machine SSOT; progress rounds append; abandon parks under completed/', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-scheme-a-'));
  try {
    const runId = 'task-scheme-a-events';
    initRun({ run_id: runId, title: 'scheme a', goal: 'jsonl + completed', capability_ids: ['CAP-a'], attach_knowledge: false }, cwd);
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json')));
    assert.ok(!fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'tasks', runId)));

    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    const eventsPath = path.join(cwd, '.workflow', 'ralph', runId, '.state', 'events.jsonl');
    assert.ok(fs.existsSync(eventsPath));
    const rows = fs.readFileSync(eventsPath, 'utf8').trim().split(/\n/).map((line) => JSON.parse(line));
    assert.ok(rows.some((row) => row.type === 'gate' || /gate/i.test(row.message || row.line || '')));

    appendProgressRound(runId, cwd, { title: '用户纠正', goal: '第二轮' });
    const progress = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, 'progress.md'), 'utf8');
    assert.match(progress, /## \d{4}-\d{2}-\d{2} — 用户纠正/);
    assert.match(progress, /- 第二轮/);
    assert.doesNotMatch(progress, /进行中/);
    assert.doesNotMatch(progress, /gate analyze=PASS/);

    const abandoned = abandonRun(runId, { reason: 'park incomplete work', cwd });
    assert.equal(abandoned.status, 'ABANDONED');
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'completed', runId, '.state', 'run.json')));
    assert.ok(!fs.existsSync(path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json')));
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'index.md')));
    const index = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', 'index.md'), 'utf8');
    assert.match(index, /completed|已完成/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('resume progress round records the reason and does not stamp 进行中', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-resume-progress-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const runId = 'task-resume-progress';
  initRun({ run_id: runId, title: '风险设置', goal: '承接识票', attach_knowledge: false }, cwd);
  resumeRun(runId, { reason: '按审查改 REV-1', cwd });
  const progressPath = path.join(cwd, '.workflow', 'ralph', runId, 'progress.md');
  const progress = fs.readFileSync(progressPath, 'utf8');
  assert.match(progress, /## \d{4}-\d{2}-\d{2} — resume/);
  assert.match(progress, /- 按审查改 REV-1/);
  assert.doesNotMatch(progress, /进行中/);
  appendProgressRound(runId, cwd, { title: '按审查改失败回写', goal: 'catch 不写缓存', result: '20 PASS' });
  const after = fs.readFileSync(progressPath, 'utf8');
  assert.match(after, /## \d{4}-\d{2}-\d{2} — 按审查改失败回写/);
  assert.match(after, /- 20 PASS/);
});

test('computeRalphNext: review / commit-scoped-review / finalize / completed empty / resume window', () => {
  assert.equal(INDEX_ACTIVE_CAP, 5);
  assert.equal(INDEX_STALE_MS, 5 * 24 * 60 * 60 * 1000);
  assert.equal(computeRalphNext(makeNextRun({
    review: { latest_review_id: 'REV-1', reviews: [{ review_id: 'REV-1', outcome: 'NEEDS_CHANGES' }] }
  })).next, 'review');
  assert.equal(computeRalphNext(makeNextRun({
    gates: { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PASS', archive: 'PENDING' },
    review: { latest_review_id: 'REV-2', reviews: [{ review_id: 'REV-2', outcome: 'PASS', review_scope: 'working_tree' }] }
  })).next, 'commit-scoped-review');
  assert.equal(computeRalphNext(makeNextRun({
    gates: { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PASS', archive: 'PENDING' },
    review: { latest_review_id: 'REV-3', reviews: [{ review_id: 'REV-3', outcome: 'PASS', review_scope: 'commit', reviewed_commit: 'abc1234' }] }
  })).next, 'finalize');
  assert.equal(computeRalphNext(makeNextRun({
    status: 'COMPLETED',
    phase: 'ARCHIVE',
    gates: { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PASS', archive: 'PASS' },
    archive: { archived_at: '2026-09-01T00:00:00.000Z' }
  }), { layout: 'completed' }).next, null);
  assert.equal(computeRalphNext(makeNextRun({
    status: 'IN_PROGRESS',
    phase: 'DELIVER',
    gates: { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PASS', archive: 'PASS' },
    archive: { archived_at: '2026-09-01T00:00:00.000Z' }
  })).next, 'check');
  assert.equal(computeRalphNext(makeNextRun({ status: 'PAUSED' })).next, 'check');
  assert.equal(computeRalphNext(makeNextRun({ needs_migrate: true, run_id: 'RALPH-old' })).next, 'migrate');
});

test('init same-session guard matches CLI --thread-id / host.thread_id', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-host-sess-'));
  const stdout = { write: () => {} };
  try {
    assert.equal(runCli([
      'ralph', 'init',
      '--run-id', 'task-host-sess-a',
      '--title', 'first in session',
      '--goal', 'do the first thing',
      '--thread-id', 'sess-1',
      '--no-knowledge-refs'
    ], { cwd, stdout }), 0);
    const listed = listRuns(cwd);
    assert.equal(listed.find((row) => row.run_id === 'task-host-sess-a')?.host_thread_id, 'sess-1');
    assert.throws(
      () => runCli([
        'ralph', 'init',
        '--run-id', 'task-host-sess-b',
        '--title', 'unrelated title here',
        '--goal', 'unrelated goal here',
        '--thread-id', 'sess-1',
        '--no-knowledge-refs'
      ], { cwd, stdout }),
      /same session already has live Ralph task-host-sess-a/
    );
    initRun({
      run_id: 'task-host-sess-b',
      title: 'second forced',
      goal: 'forced sibling',
      attach_knowledge: false,
      force: true,
      host: { thread_id: 'sess-1' }
    }, cwd);
    const hints = collectSameRequirementHints(listRuns(cwd));
    assert.equal(hints.triggered, true);
    assert.ok(hints.items.some((item) => item.kind === 'same-session' && item.thread_id === 'sess-1'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('init refuses review-slice slug; index prompts when it sits beside another live run', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-review-slice-'));
  try {
    assert.throws(
      () => initRun({
        run_id: 'task-h5-enter-review-fix',
        title: '供应商H5入驻审查三点修复',
        goal: '按审查修三点',
        attach_knowledge: false
      }, cwd),
      /review-fix \/ 审查修复 is not a new requirement/
    );
    initRun({
      run_id: 'task-enter-form-h5',
      title: '动态入驻表单交接到供应商端H5',
      goal: 'H5 交接',
      attach_knowledge: false
    }, cwd);
    initRun({
      run_id: 'task-h5-enter-review-fix',
      title: '供应商H5入驻审查三点修复',
      goal: '按审查修三点',
      attach_knowledge: false,
      force: true
    }, cwd);
    const index = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', 'index.md'), 'utf8');
    assert.match(index, /## 同需求提示/);
    assert.match(index, /审查切片不是新任务/);
    assert.match(index, /不自动合并/);
    const listed = getStatus({ cwd });
    assert.equal(listed.same_requirement_hints.triggered, true);
    assert.match(renderRalphStatusText(listed), /同需求提示/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('index.md archive hints: overflow / stale trigger; uncertain asks; never auto-archive', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-index-hints-'));
  try {
    const fresh = initRun({
      run_id: 'task-hint-fresh-a',
      title: 'fresh a',
      goal: 'two live runs stay quiet',
      attach_knowledge: false
    }, cwd);
    initRun({
      run_id: 'task-hint-fresh-b',
      title: 'fresh b',
      goal: 'two live runs stay quiet',
      attach_knowledge: false
    }, cwd);
    let index = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', 'index.md'), 'utf8');
    assert.doesNotMatch(index, /## 归档提示/);
    const quiet = collectIndexArchiveHints([
      { run_id: fresh.run_id, status: 'IN_PROGRESS', updated_at: fresh.updated_at },
      { run_id: 'task-hint-fresh-b', status: 'IN_PROGRESS', updated_at: new Date().toISOString() }
    ]);
    assert.equal(quiet.triggered, false);
    assert.equal(quiet.auto_archive, false);

    const staleAt = new Date(Date.now() - INDEX_STALE_MS - 60_000).toISOString();
    const paused = loadRun('task-hint-fresh-a', cwd);
    paused.status = 'PAUSED';
    paused.updated_at = staleAt;
    saveRun(paused, cwd);
    index = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', 'index.md'), 'utf8');
    assert.match(index, /## 归档提示/);
    assert.match(index, /5天未更新/);
    assert.match(index, /询问用户/);
    assert.match(index, /不自动 finalize \/ abandon/);
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'task-hint-fresh-a', '.state', 'run.json')));

    const ready = loadRun('task-hint-fresh-b', cwd);
    ready.gates.accept = 'PASS';
    ready.gates.deliver = 'PASS';
    ready.updated_at = staleAt;
    saveRun(ready, cwd);
    index = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', 'index.md'), 'utf8');
    assert.match(index, /`task-hint-fresh-b` \| 5天未更新 \| finalize/);

    for (let i = 0; i < 4; i += 1) {
      initRun({
        run_id: 'task-hint-overflow-' + i,
        title: 'overflow ' + i,
        goal: 'push active count over cap',
        attach_knowledge: false
      }, cwd);
    }
    const listed = listRuns(cwd).filter((row) => row.layout === 'active');
    assert.ok(listed.length > INDEX_ACTIVE_CAP);
    const written = writeRalphIndex(cwd);
    assert.equal(written.hints.triggered, true);
    assert.equal(written.hints.auto_archive, false);
    assert.equal(written.hints.overflow, true);
    index = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', 'index.md'), 'utf8');
    assert.match(index, /活跃超过5条/);
    for (const row of listed) {
      assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', row.run_id, '.state', 'run.json')));
    }

    const status = getStatus({ runId: 'task-hint-fresh-b', cwd });
    assert.equal(status.next, 'finalize');
    assert.match(renderRalphStatusText(status), /next: finalize/);
    const listedStatus = getStatus({ cwd });
    assert.equal(listedStatus.index_hints.triggered, true);
    assert.match(renderRalphStatusText(listedStatus), /归档提示/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('auto-closeout: accept PASS next=finalize; ARCHIVE warning; completed has none; resume stays neutral', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-closeout-'));
  try {
    const runId = 'task-closeout-next';
    initRun({ run_id: runId, title: 'closeout', goal: 'next field', attach_knowledge: false }, cwd);
    const fresh = getStatus({ runId, cwd });
    assert.equal(fresh.next, 'gate analyze');
    assert.equal(fresh.warning, null);
    assert.equal(fresh.layout, 'active');
    assert.match(renderRalphStatusText(fresh), /next: gate analyze/);
    assert.doesNotMatch(renderRalphStatusText(fresh), /warning:/);

    for (const gate of ['analyze', 'plan', 'deliver', 'accept']) {
      setGate(runId, { gate, status: 'PASS', cwd });
    }
    const ready = getStatus({ runId, cwd });
    assert.equal(ready.run.gates.accept, 'PASS');
    assert.equal(ready.next, 'finalize');
    assert.equal(ready.warning, null);
    assert.match(renderRalphStatusText(ready), /next: finalize/);

    const liteId = 'task-closeout-lite';
    initRun({ run_id: liteId, title: 'lite close', goal: 'close is not finalize', attach_knowledge: false, gate_set: 'lite' }, cwd);
    setGate(liteId, { gate: 'brief', status: 'PASS', cwd });
    setGate(liteId, { gate: 'deliver', status: 'PASS', cwd });
    fs.writeFileSync(
      path.join(cwd, '.workflow', 'ralph', liteId, TASK_PLAN_REL),
      liteAcceptanceTable('write_then_read:mock_ok'),
      'utf8'
    );
    setGate(liteId, { gate: 'close', status: 'PASS', cwd });
    const closed = getStatus({ runId: liteId, cwd });
    assert.equal(closed.run.phase, 'ARCHIVE');
    assert.equal(closed.layout, 'active');
    assert.equal(closed.next, 'finalize');
    assert.equal(closed.warning, ARCHIVE_CLOSEOUT_WARNING);
    assert.match(renderRalphStatusText(closed), /warning: phase=ARCHIVE 未完成收尾——先跑 gate\/status 核对/);

    const finalized = withoutLocalPortfolio(() => finalizeRun(runId, { cwd, modules: ['src/a.js'] }));
    assert.equal(finalized.run.status, 'COMPLETED');
    const parked = getStatus({ runId, cwd });
    assert.equal(parked.layout, 'completed');
    assert.equal(parked.next, null);
    assert.equal(parked.warning, null);
    assert.match(renderRalphStatusText(parked), /next: \(none\)/);
    assert.doesNotMatch(renderRalphStatusText(parked), /warning:/);

    resumeRun(runId, { reason: 'continue after archive', cwd });
    const resumed = getStatus({ runId, cwd });
    assert.equal(resumed.layout, 'active');
    assert.equal(resumed.run.phase, 'ARCHIVE');
    assert.equal(resumed.run.status, 'IN_PROGRESS');
    assert.equal(resumed.warning, ARCHIVE_CLOSEOUT_WARNING);
    assert.equal(resumed.next, 'check');

    const chunks = [];
    assert.equal(runCli(['ralph', 'status', '--run-id', liteId, '--json'], { cwd, stdout: { write: (t) => chunks.push(t) } }), 0);
    const cliStatus = JSON.parse(chunks.join(''));
    assert.equal(cliStatus.next, 'finalize');
    assert.equal(cliStatus.warning, ARCHIVE_CLOSEOUT_WARNING);

    const ops = path.join(root, 'skills/jj-ralph/scripts/ralph_ops.mjs');
    const opsResult = spawnSync(process.execPath, [ops, 'status', '--run-id', liteId, '--cwd', cwd], { encoding: 'utf8' });
    assert.equal(opsResult.status, 0, opsResult.stderr || opsResult.stdout);
    const opsStatus = JSON.parse(opsResult.stdout);
    assert.equal(opsStatus.next, 'finalize');
    assert.equal(opsStatus.warning, ARCHIVE_CLOSEOUT_WARNING);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('auto-closeout: missing gate_set renders undefined; writeRalphIndex degrades; locate finds completed/', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-closeout-gate-'));
  try {
    const runId = 'task-closeout-undef';
    initRun({ run_id: runId, title: 'legacy gate', goal: 'no gate_set key', attach_knowledge: false }, cwd);
    const run = loadRun(runId, cwd);
    delete run.gate_set;
    saveRun(run, cwd);
    const status = getStatus({ runId, cwd });
    assert.equal(status.gate_set, undefined);
    assert.equal(status.run.gate_set, undefined);
    assert.match(renderRalphStatusText(status), /gate_set: undefined/);
    assert.doesNotMatch(renderRalphStatusText(status), /gate_set: full/);
    assert.equal(computeRalphNext(status.run, { layout: 'active' }).next, 'gate analyze');

    const indexPath = path.join(cwd, '.workflow', 'ralph', 'index.md');
    fs.rmSync(indexPath, { force: true });
    fs.mkdirSync(indexPath);
    const degraded = writeRalphIndex(cwd);
    assert.equal(degraded.ok, false);
    assert.equal(degraded.degraded, true);
    assert.ok(degraded.error);

    for (const gate of ['analyze', 'plan', 'deliver', 'accept']) {
      setGate(runId, { gate, status: 'PASS', cwd });
    }
    const archived = archiveRun(runId, { cwd });
    assert.equal(archived.run.status, 'COMPLETED');
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'completed', runId, '.state', 'run.json')));

    const located = locateRalphRuns(cwd);
    assert.equal(located.filter((row) => row.run_id === runId && row.layout === 'completed').length, 1);

    const chunks = [];
    assert.equal(runCli(['ralph', 'locate', '--run-id', runId], { cwd, stdout: { write: (t) => chunks.push(t) } }), 0);
    assert.match(chunks.join(''), /completed/);

    const ops = path.join(root, 'skills/jj-ralph/scripts/ralph_ops.mjs');
    const opsLocate = spawnSync(process.execPath, [ops, 'locate', '--run-id', runId, '--cwd', cwd], { encoding: 'utf8' });
    assert.equal(opsLocate.status, 0, opsLocate.stderr || opsLocate.stdout);
    const payload = JSON.parse(opsLocate.stdout);
    assert.equal(payload.action, 'locate');
    assert.equal(payload.runs[0].layout, 'completed');
    assert.equal(payload.runs[0].closeout, null);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('auto-closeout: locate annotates next; remediate dry-run then --yes finalizes', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-remediate-'));
  try {
    const runId = 'task-closeout-remediate';
    initRun({ run_id: runId, title: 'remediate', goal: 'finalize leftover', attach_knowledge: false }, cwd);
    for (const gate of ['analyze', 'plan', 'deliver', 'accept']) {
      setGate(runId, { gate, status: 'PASS', cwd });
    }
    const located = locateRalphRuns(cwd).filter((row) => row.run_id === runId);
    assert.equal(located.length, 1);
    assert.equal(located[0].next, 'finalize');
    assert.equal(located[0].closeout, 'finalize');
    assert.equal(located[0].layout, 'active');

    const preview = remediateCloseout({ cwd, yes: false });
    assert.equal(preview.dry_run, true);
    assert.equal(preview.count, 1);
    assert.equal(preview.items[0].run_id, runId);
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json')));

    const applied = withoutLocalPortfolio(() => remediateCloseout({ cwd, yes: true }));
    assert.equal(applied.dry_run, false);
    assert.equal(applied.ok, true);
    assert.equal(applied.finalized[0].ok, true);
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'completed', runId, '.state', 'run.json')));
    assert.equal(fs.existsSync(path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json')), false);

    const parked = locateRalphRuns(cwd).find((row) => row.run_id === runId);
    assert.equal(parked.layout, 'completed');
    assert.equal(parked.closeout, null);
    assert.equal(parked.next, null);

    const empty = remediateCloseout({ cwd, yes: false });
    assert.equal(empty.count, 0);

    const chunks = [];
    assert.equal(runCli(['ralph', 'remediate', '--json'], { cwd, stdout: { write: (t) => chunks.push(t) } }), 0);
    const cli = JSON.parse(chunks.join(''));
    assert.equal(cli.dry_run, true);
    assert.equal(cli.count, 0);

    const ops = path.join(root, 'skills/jj-ralph/scripts/ralph_ops.mjs');
    const opsResult = spawnSync(process.execPath, [ops, 'remediate', '--cwd', cwd], { encoding: 'utf8' });
    assert.equal(opsResult.status, 0, opsResult.stderr || opsResult.stdout);
    const opsPayload = JSON.parse(opsResult.stdout);
    assert.equal(opsPayload.action, 'remediate');
    assert.equal(opsPayload.dry_run, true);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
