import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { runCli } from '../../src/cli.mjs';
import {
  initRun,
  saveRun,
  recordReview,
  setGate,
  readRunEventsText,
  inspectAnalyzePlanArtifacts,
  passDeliverGates,
  evaluateAcceptJudgment,
  INTENSITY_DEFAULTS,
  INTENSITY_HEURISTIC,
  suggestIntensity,
  resumeRun,
  loadRun,
  computeRalphNext,
  GATE_SET_HEURISTIC,
  createRunSkeleton,
  suggestGateSet
} from '../../src/ralph.mjs';
import { root, readJson, writeConversationPlan } from './helpers.mjs';

test('silent intensity inference requires small wording and gives architecture/review precedence', () => {
  assert.equal(INTENSITY_HEURISTIC.max_scope_in, 1);
  assert.equal(GATE_SET_HEURISTIC.max_scope_in, 2);
  const cases = [
    [{ goal: '文案修改 点击拨打改成拨打电话' }, 'tiny'],
    [{ goal: '改两字' }, 'tiny'],
    [{ goal: 'tip bottom 4px 改成 6px', scope: { in: ['src/tip.css'] } }, 'tiny'],
    [{ title: '改文案', goal: '换按钮文字', scope: { in: ['src/button.vue'] } }, 'tiny'],
    [{ goal: '加上筛选和导出', scope: { in: ['src/dashboard.vue'] } }, 'standard'],
    [{ goal: 'small fix', scope: { in: ['src/a.js'] } }, 'standard'],
    [{ goal: '刷新 token 失败要重登' }, 'standard'],
    [{ goal: '刷新鉴权 token / 登录认证失败要重登' }, 'strict'],
    [{ goal: '审查过再归档' }, 'strict'],
    [{ goal: 'review before archive' }, 'strict'],
    [{ goal: '文案改一下登录鉴权提示' }, 'strict'],
    [{ goal: '改文案', scope: { in: ['src/auth.js'] } }, 'strict'],
    [{ goal: '先改项目A：登录后密码过期提示' }, 'standard'],
    [{ goal: 'tiny 改一下' }, 'standard'],
    [{ goal: 'strict 做这个' }, 'standard'],
    [{ goal: 'single-point' }, 'standard'],
    [{ goal: 'Copy the README', scope: { in: ['README.md'] } }, 'standard'],
    [{ goal: 'copyright' }, 'standard'],
    [{}, 'standard'],
    [{ goal: '改文案', scope: { in: ['src/a.js', 'src/b.js'] } }, 'standard'],
    [{ goal: '改文案；换按钮颜色' }, 'standard'],
    [{ goal: '改文案', capability_ids: ['CAP-a', 'CAP-b'] }, 'standard'],
    [{ goal: '改文案', capability_ids: ['CAP-a', ' '] }, 'tiny']
  ];
  for (const entry of ['src/', 'src/**/*.js', 'src/lib', 'Dockerfile']) {
    cases.push([{ goal: '改文案', scope: { in: [entry] } }, 'standard']);
  }
  for (const [input, expected] of cases) {
    const result = suggestIntensity(input);
    assert.equal(result.intensity, expected, JSON.stringify(input));
    assert.equal(result.applied, true);
    assert.ok(result.reasons.length > 0);
  }
  assert.ok(suggestIntensity({ goal: '文案改一下登录鉴权提示' }).reasons.includes('precedence:strict (tiny∧strict)'));
  assert.equal(suggestGateSet({ goal: '改文案', scope: { in: ['src/a.js', 'src/b.js'] } }).gate_set, 'lite');
});

test('init applies inference before budgets and intent; annotations never persist even after a caller saves again', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-inference-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const runId = 'task-inferred-copy';
  const run = initRun({ run_id: runId, title: '按钮文案', goal: '改两字', attach_knowledge: false }, cwd);
  assert.equal(run.intensity, 'tiny');
  assert.equal(run.gate_set, 'full');
  assert.equal(run.budget.max_deliver_loops, INTENSITY_DEFAULTS.tiny.budget.max_deliver_loops);
  assert.equal(run.accept_layers.judgment, 'SKIPPED');
  const dir = path.join(cwd, '.workflow', 'ralph', runId);
  assert.doesNotMatch(fs.readFileSync(path.join(dir, 'task_plan.md'), 'utf8'), /## 存疑/);
  assert.match(fs.readFileSync(path.join(dir, 'progress.md'), 'utf8'), /- intensity: tiny \(inferred:/);
  assert.match(readRunEventsText(runId, cwd), /- intensity: tiny \(inferred:/);
  assert.equal(run.intensity_inference.applied, true);
  // Model the dispatch pattern: annotate/bind the returned run, then save it again.
  run.map_find = { query: '按钮', matches: [], applied: true };
  run.reuse_suggestions = [{ run_id: 'task-old' }];
  saveRun(run, cwd);
  const disk = loadRun(runId, cwd);
  const schema = readJson('schemas/ralph-run.schema.json');
  for (const key of Object.keys(disk)) assert.ok(Object.hasOwn(schema.properties, key), key);
  for (const key of ['gate_set_suggestion', 'intensity_inference', 'map_find', 'reuse_suggestions']) {
    assert.equal(Object.hasOwn(disk, key), false, key);
    assert.equal(Object.hasOwn(run, key), true, 'save must not mutate caller annotations: ' + key);
  }
  const resumed = resumeRun(runId, { cwd, reason: '鉴权协议需要后续改动' });
  assert.equal(resumed.run.intensity, 'tiny');
  assert.equal(Object.hasOwn(resumed.run, 'intensity_inference'), false);
  assert.equal(loadRun(runId, cwd).intensity, 'tiny');
  const explicitIntent = initRun({ run_id: 'task-inferred-intent', title: '文案', goal: '改两字', write_intent: true, attach_knowledge: false }, cwd);
  assert.equal(explicitIntent.intensity, 'tiny');
  assert.match(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', explicitIntent.run_id, 'task_plan.md'), 'utf8'), /## 存疑/);
});

test('mechanical intensity overrides remain explicit; blank values infer and CLI help does not offer gate_set hints', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-intensity-override-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  for (const [index, intensity] of [undefined, null, '', '   '].entries()) {
    const run = initRun({ run_id: 'task-empty-intensity-' + index, title: '文案', goal: '改两字', intensity, attach_knowledge: false }, cwd);
    assert.equal(run.intensity, 'tiny');
    assert.equal(run.intensity_inference.applied, true);
  }
  const explicit = initRun({ run_id: 'task-explicit-standard', title: '文案', goal: '改两字', intensity: 'standard', attach_knowledge: false }, cwd);
  assert.equal(explicit.intensity, 'standard');
  assert.equal(Object.hasOwn(explicit, 'intensity_inference'), false);
  assert.equal(explicit.budget.max_deliver_loops, INTENSITY_DEFAULTS.standard.budget.max_deliver_loops);
  const chunks = [];
  const stdout = { write: (value) => chunks.push(value) };
  assert.equal(runCli(['ralph', 'init', '--run-id', 'task-cli-intensity', '--title', '鉴权协议', '--goal', '改鉴权协议', '--intensity', 'standard', '--no-knowledge-refs', '--json'], { cwd, stdout }), 0);
  const cliRun = JSON.parse(chunks.join('')).run;
  assert.equal(cliRun.intensity, 'standard');
  assert.equal(Object.hasOwn(cliRun, 'intensity_inference'), false);
  chunks.length = 0;
  assert.equal(runCli(['ralph', '--help'], { cwd, stdout }), 0);
  assert.doesNotMatch(chunks.join(''), /gate_set\?/);
  assert.match(chunks.join(''), /jj ralph init --intensity/);
});

test('judgment errors route to $jj-review while next remains independent of intensity', () => {
  for (const intensity of ['tiny', 'standard', 'strict']) {
    const run = createRunSkeleton({ run_id: 'task-next-' + intensity, title: 'next', goal: 'next', intensity });
    run.gates.deliver = 'PASS';
    assert.equal(computeRalphNext(run).next, 'gate analyze');
    run.gates.analyze = 'PASS';
    assert.equal(computeRalphNext(run).next, 'gate plan');
    run.gates.plan = 'PASS';
    assert.equal(computeRalphNext(run).next, intensity === 'tiny' ? 'gate accept' : 'review');
    if (intensity === 'strict') {
      const judgment = evaluateAcceptJudgment(run);
      assert.equal(judgment.ok, false);
      assert.match(judgment.reasons.join(';'), /\$jj-review.*gate accept/);
      assert.doesNotMatch(judgment.reasons.join(';'), /setAcceptLayer/);
      assert.doesNotMatch(judgment.reasons.join(';'), /review-record/);
    }
    run.gates.accept = 'PASS';
    assert.equal(computeRalphNext(run).next, 'finalize');
  }
});

test('deliver preflight rejects empty or missing artifacts without any ledger or event write', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-fold-reject-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const run = initRun({ run_id: 'task-fold-reject', title: 'fold artifacts', goal: 'check actual content', attach_knowledge: false }, cwd);
  const dir = path.join(cwd, '.workflow', 'ralph', run.run_id);
  const ledger = () => fs.readFileSync(path.join(dir, '.state', 'run.json'), 'utf8');
  const beforeLedger = ledger();
  const beforeEvents = readRunEventsText(run.run_id, cwd);
  const beforeProgress = fs.readFileSync(path.join(dir, 'progress.md'), 'utf8');
  const assertRejected = (pattern) => {
    assert.throws(() => passDeliverGates(run.run_id, { cwd }), pattern);
    assert.equal(ledger(), beforeLedger);
    assert.equal(readRunEventsText(run.run_id, cwd), beforeEvents);
    assert.equal(fs.readFileSync(path.join(dir, 'progress.md'), 'utf8'), beforeProgress);
  };
  assertRejected(/missing 验收.*missing Step file backticks/);
  for (const [patch, error] of [
    [{ goal: '<!-- placeholder -->\n1. [ ]' }, /missing Goal/],
    [{ acceptance: '1. [ ]' }, /missing 验收/],
    [{ steps: '1. [ ]' }, /missing Step file backticks/],
    [{ steps: '1. Edit README.md' }, /missing Step file backticks/],
    [{ steps: '1. Edit `README.md`\n2. Verify it' }, /missing Step file backticks/],
    [{ steps: '1. Run `npm test`' }, /missing Step file backticks/],
    [{ steps: '1. Read `https://example.com/doc.md`' }, /missing Step file backticks/],
    [{ steps: '```md\n1. Edit `README.md`\n```' }, /missing Step file backticks/],
    [{ questions: '- [ ] Which label?\n- [x] Color confirmed' }, /unanswered ## 存疑/],
    [{ questions: '- [ ]' }, /unanswered ## 存疑/],
    [{ questions: 'Which label?' }, /unanswered ## 存疑/]
  ]) {
    writeConversationPlan(cwd, run.run_id, patch);
    assertRejected(error);
  }
  fs.renameSync(path.join(dir, 'task_plan.md'), path.join(dir, 'saved-plan.md'));
  assertRejected(/missing Goal.*missing 验收.*missing Step file backticks/);
});

test('deliver preflight accepts answered or absent questions and concrete documentation steps', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-fold-plan-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const run = initRun({ run_id: 'task-fold-plan', title: '文案', goal: '改两字', attach_knowledge: false }, cwd);
  const planPath = path.join(cwd, '.workflow', 'ralph', run.run_id, 'task_plan.md');
  for (const questions of ['', ' \n ', '-\n*\n1.', '- [x] Label confirmed', '- [X] Label confirmed\n  User approved the text']) {
    writeConversationPlan(cwd, run.run_id, { questions });
    const result = inspectAnalyzePlanArtifacts(run, cwd);
    assert.deepEqual(result.missing, [], questions);
    assert.deepEqual(result.unanswered_open_questions, [], questions);
  }
  // Only ## 存疑 is the contract; the old ### 存疑事项 section is not it.
  const text = writeConversationPlan(cwd, run.run_id).replace('## 存疑\n\n\n\n', '');
  fs.writeFileSync(planPath, '### 存疑事项\n- [ ] Historical note\n\n' + text);
  assert.deepEqual(inspectAnalyzePlanArtifacts(run, cwd).unanswered_open_questions, []);
  for (const steps of [
    '1. Update `docs/guide.md`\n2. Update `README.md`',
    '1. Update the file\n   `src/example.mjs:12`',
    '- Update `Dockerfile`'
  ]) {
    writeConversationPlan(cwd, run.run_id, { steps });
    assert.equal(inspectAnalyzePlanArtifacts(run, cwd).plan_ok, true, steps);
  }
  fs.writeFileSync(path.join(cwd, 'User Guide.md'), 'guide');
  writeConversationPlan(cwd, run.run_id, { steps: '1. Update `User Guide.md`' });
  assert.equal(inspectAnalyzePlanArtifacts(run, cwd).plan_ok, true);
});

test('folded delivery saves the ledger once and recovers partial prerequisites on retry', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-fold-save-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const run = initRun({ run_id: 'task-fold-save', title: 'fold persistence', goal: 'save all gates', attach_knowledge: false }, cwd);
  writeConversationPlan(cwd, run.run_id);
  const ledgerPath = path.join(cwd, '.workflow', 'ralph', run.run_id, '.state', 'run.json');
  const writeFile = fs.writeFileSync;
  let writes = 0;
  const writer = t.mock.method(fs, 'writeFileSync', function (file, ...args) {
    if (String(file) === ledgerPath) writes += 1;
    return writeFile.call(this, file, ...args);
  });
  const first = passDeliverGates(run.run_id, { cwd });
  assert.equal(writes, 1);
  assert.equal(first.folded, true);
  assert.deepEqual(first.gates_written, ['analyze', 'plan', 'deliver']);
  assert.equal(first.run.phase, 'ACCEPT');
  assert.deepEqual(first.run.gates, { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PENDING', archive: 'PENDING' });
  writes = 0;
  assert.deepEqual(passDeliverGates(run.run_id, { cwd }).gates_written, ['deliver']);
  assert.equal(writes, 1);
  writer.mock.restore();
  setGate(run.run_id, { gate: 'plan', status: 'FAIL', cwd });
  assert.deepEqual(passDeliverGates(run.run_id, { cwd }).gates_written, ['plan', 'deliver']);
  assert.equal(computeRalphNext(loadRun(run.run_id, cwd)).next, loadRun(run.run_id, cwd).intensity === 'tiny' ? 'gate accept' : 'review');
  for (const gate of ['analyze', 'plan', 'deliver']) {
    assert.match(readRunEventsText(run.run_id, cwd), new RegExp('gate ' + gate + '=PASS'));
  }
});

test('wrapper deliver folds only PASS while explicit and mechanical gates stay single-key', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-fold-wrapper-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const run = initRun({ run_id: 'task-fold-wrapper', title: 'wrapper fold', goal: 'atomic boundary', attach_knowledge: false }, cwd);
  const ops = path.join(root, 'skills/jj-ralph/scripts/ralph_ops.mjs');
  const invoke = (gate, status) => spawnSync(process.execPath, [ops, 'gate', '--run-id', run.run_id, '--gate', gate, '--status', status, '--cwd', cwd], { encoding: 'utf8' });
  const rejected = invoke('deliver', 'PASS');
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /missing 验收/);
  assert.deepEqual(loadRun(run.run_id, cwd).gates, run.gates);
  const explicit = invoke('analyze', 'PASS');
  assert.equal(explicit.status, 0, explicit.stderr);
  assert.deepEqual(JSON.parse(explicit.stdout).gates_written, ['analyze']);
  assert.equal(loadRun(run.run_id, cwd).gates.plan, 'PENDING');
  const failed = invoke('deliver', 'FAIL');
  assert.equal(failed.status, 0, failed.stderr);
  assert.equal(JSON.parse(failed.stdout).folded, false);
  const output = [];
  assert.equal(runCli(['ralph', 'gate', '--run-id', run.run_id, '--gate', 'deliver', '--status', 'PASS', '--json'], { cwd, stdout: { write: (value) => output.push(value) } }), 0);
  assert.deepEqual(JSON.parse(output.join('')).gates_written, ['deliver']);
  assert.equal(loadRun(run.run_id, cwd).gates.plan, 'PENDING');
  writeConversationPlan(cwd, run.run_id);
  const folded = invoke('deliver', 'PASS');
  assert.equal(folded.status, 0, folded.stderr);
  assert.equal(JSON.parse(folded.stdout).folded, true);
  assert.deepEqual(JSON.parse(folded.stdout).gates_written, ['plan', 'deliver']);
});

test('folded delivery preserves judgment, product consistency and archive review gates', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-fold-evidence-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const run = initRun({ run_id: 'task-fold-evidence', title: '鉴权协议', goal: '验证鉴权', attach_knowledge: false }, cwd);
  writeConversationPlan(cwd, run.run_id, { steps: '1. Update `src/expected.mjs`' });
  passDeliverGates(run.run_id, { cwd });
  assert.throws(() => setGate(run.run_id, { gate: 'accept', status: 'PASS', cwd, diff_paths: ['src/other.mjs'] }), /product-consistency/);
  assert.throws(() => setGate(run.run_id, { gate: 'accept', status: 'PASS', cwd }), /\$jj-review.*gate accept/);
  assert.equal(loadRun(run.run_id, cwd).gates.accept, 'PENDING');
  recordReview(run.run_id, { cwd, outcome: 'PASS', summary: 'Evidence checked', findings: [], review_scope: 'working_tree' });
  setGate(run.run_id, { gate: 'accept', status: 'PASS', cwd });
  assert.equal(computeRalphNext(loadRun(run.run_id, cwd)).next, 'commit-scoped-review');
  assert.throws(() => setGate(run.run_id, { gate: 'archive', status: 'PASS', cwd }), /review_scope=commit/);
});
