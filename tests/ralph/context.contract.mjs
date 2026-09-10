import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { runCli } from '../../src/cli.mjs';
import {
  contextGateOptions, getRalphContext, getRalphSummary, getStatus, initRun,
  loadRun, locateRalphRuns, passDeliverGates, readRunEventsText, recordReview, saveRun, setGate,
  updateRunScope, validateRalphContext, writeRalphContext
} from '../../src/ralph.mjs';
import { snapshotCommit, snapshotGit } from '../../src/gitSnapshot.mjs';
import { gitFixture } from '../helpers/git-fixture.mjs';
import { writeConversationPlan } from './helpers.mjs';

function fixture(t) {
  const f = gitFixture(t);
  const runId = 'task-context';
  initRun({ run_id: runId, title: '任务范围', goal: '实现标签更新', scope: { in: ['src/中文 label.js'], out: [] }, attach_knowledge: false }, f.cwd);
  writeConversationPlan(f.cwd, runId, { steps: '1. [x] Update `src/中文 label.js`' });
  f.write('src/中文 label.js', 'export const label = "新标签";\n');
  f.write('other/中文 label.js', 'unrelated\n');
  return { ...f, runId, context: () => getRalphContext(runId, { cwd: f.cwd, review: true }) };
}

function closeoutFixture(t, { ownedDeletion = false } = {}) {
  const f = gitFixture(t);
  const runId = 'task-scoped-closeout';
  const owned = ownedDeletion ? 'tests/owned.test.mjs' : 'src/feature.js';
  const other = 'tests/other-task.test.mjs';
  f.write(owned, ownedDeletion ? 'test("owned behavior", () => {});\n' : 'export const value = 1;\n');
  f.write(other, 'test("other behavior", () => {});\n');
  f.git(['add', '--', owned, other]);
  f.git(['commit', '-m', 'test: 准备任务范围']);
  const base = f.git(['rev-parse', 'HEAD']);
  initRun({ run_id: runId, title: 'Scoped fix', goal: 'Fix the current feature', scope: { in: [owned], out: [] }, attach_knowledge: false }, f.cwd);
  writeConversationPlan(f.cwd, runId, { steps: '1. [x] Update `' + owned + '`' });
  passDeliverGates(runId, { cwd: f.cwd });
  f.write('.workflow/ralph/' + runId + '/progress.md', 'user_correction: fix the current feature\n');
  if (ownedDeletion) {
    // Acceptance happened before the later commit; archive must check its new deletion evidence.
    setGate(runId, { cwd: f.cwd, gate: 'accept', status: 'PASS' });
    f.git(['rm', '--', owned]);
  } else {
    f.write(owned, 'export const value = 2;\n');
    f.git(['add', '--', owned]);
  }
  f.git(['commit', '-m', 'fix(feature): 更新当前任务']);
  if (!ownedDeletion) fs.unlinkSync(path.join(f.cwd, other));
  const context = getRalphContext(runId, { cwd: f.cwd, review: true, review_scope: 'commit', base_commit: base });
  assert.equal(context.scope_preflight.ok, true, context.scope_preflight.reasons.join('; '));
  const contextFile = writeRalphContext('.workflow/closeout-context.json', context, f.cwd);
  recordReview(runId, { cwd: f.cwd, outcome: 'PASS', context, summary: 'Fixture review for scoped closeout' });
  return { ...f, runId, owned, other, contextFile };
}

test('bound locate avoids global enumeration; compact summaries omit maps and history', t => {
  const f = fixture(t);
  const readdir = fs.readdirSync;
  t.mock.method(fs, 'readdirSync', (...args) => {
    assert.fail('direct locate must not enumerate directories: ' + args[0]);
    return readdir(...args);
  });
  assert.equal(locateRalphRuns(f.cwd, { runId: f.runId })[0].run_id, f.runId);
  assert.deepEqual(locateRalphRuns(f.cwd, { runId: 'task-missing' }), []);
  t.mock.restoreAll();
  const run = loadRun(f.runId, f.cwd);
  for (let i = 0; i < 10; i += 1) saveRun({ ...run, run_id: 'task-candidate-' + i }, f.cwd);
  fs.writeFileSync(path.join(f.cwd, '.workflow/ralph/business-map.json'), 'invalid map deliberately not loaded');
  const compact = getRalphSummary({ cwd: f.cwd });
  assert.equal(compact.total, 11);
  assert.equal(compact.runs.length, 8);
  assert.equal(compact.omitted, 3);
  assert.equal(compact.runs[0].goal, undefined);
  assert.equal(getRalphSummary({ cwd: f.cwd, details: true }).runs.length, 11);
  const status = getStatus({ runId: f.runId, cwd: f.cwd, details: false });
  assert.equal(status.metrics, undefined);
  assert.equal(status.run.review, undefined);
  assert.equal(status.run.run_id, f.runId);
  const output = [];
  runCli(['ralph', 'status'], { cwd: f.cwd, stdout: { write: text => output.push(text) } });
  assert.match(output.join(''), /3 more candidates/);
});

test('compact status reports the same review, blockers and iteration as detailed status', t => {
  const f = fixture(t);
  recordReview(f.runId, { cwd: f.cwd, outcome: 'NEEDS_CHANGES', findings: [{
    id: 'F-1', severity: 'high', file: 'src/中文 label.js', line: 1,
    description: 'The label still needs correction', status: 'OPEN', acceptance: 'Correct the label'
  }] });
  const run = loadRun(f.runId, f.cwd);
  run.status = 'BLOCKED';
  run.iteration = 2;
  run.intervention_needed = { kind: 'STAGNATION', reason: 'verification still fails' };
  run.capability_ids = ['CAP-status-probe'];
  run.knowledge_refs = ['KB-status-probe'];
  run.host = { host_id: 'codex', thread_id: 'status-probe-thread' };
  saveRun(run, f.cwd);
  const render = flags => {
    const output = [];
    runCli(['ralph', 'status', '--run-id', f.runId, ...flags], { cwd: f.cwd, stdout: { write: text => output.push(text) } });
    return output.join('');
  };
  const compact = render([]);
  const detailed = render(['--details']);
  for (const pattern of [/iteration: 2\/20/, /review: REV-1 NEEDS_CHANGES/, /intervention: STAGNATION verification still fails/, /host: codex \/ status-probe-thread/]) {
    assert.match(compact, pattern);
    assert.match(detailed, pattern);
  }
  assert.doesNotMatch(compact, /undefined|stagnation: \(legacy\)|capabilities:|knowledge_refs:/);
  assert.match(detailed, /capabilities: CAP-status-probe/);
  assert.match(detailed, /knowledge_refs: KB-status-probe/);
  const json = JSON.parse(render(['--json']));
  assert.equal(json.run.iteration, 2);
  assert.equal(json.run.latest_review.outcome, 'NEEDS_CHANGES');
  assert.equal(json.run.intervention_needed.reason, 'verification still fails');
  assert.equal(json.run.review, undefined, 'compact status must not expand the full review history');
  assert.equal(json.metrics, undefined, 'compact status must not compute detailed metrics');
});

test('scoped accept and closeout both ignore another task deletion', async t => {
  for (const command of ['archive', 'finalize']) await t.test(command, st => {
    const f = closeoutFixture(st);
    const options = { cwd: f.cwd, stdout: { write() {} } };
    const contextArgs = ['--run-id', f.runId, '--context-file', f.contextFile, '--json'];
    assert.equal(runCli(['ralph', 'gate', '--gate', 'accept', '--status', 'PASS', ...contextArgs], options), 0);
    assert.equal(loadRun(f.runId, f.cwd).gates.accept, 'PASS');
    assert.equal(runCli(['ralph', command, ...contextArgs, ...(command === 'finalize' ? ['--no-contribution-package'] : [])], options), 0);
    assert.equal(loadRun(f.runId, f.cwd).status, 'COMPLETED');
    assert.equal(fs.existsSync(path.join(f.cwd, f.other)), false, 'closeout must preserve concurrent deletion');
    assert.match(f.git(['status', '--porcelain']), /\bD tests\/other-task\.test\.mjs/);
  });
});

test('scoped closeout still rejects task-owned test deletions already committed to HEAD', async t => {
  for (const command of ['archive', 'finalize']) await t.test(command, st => {
    const f = closeoutFixture(st, { ownedDeletion: true });
    assert.equal(f.git(['status', '--porcelain', '--', f.owned]), '', 'deletion evidence comes from the commit range');
    assert.throws(() => runCli(['ralph', command, '--run-id', f.runId, '--context-file', f.contextFile,
      ...(command === 'finalize' ? ['--no-contribution-package'] : [])], { cwd: f.cwd, stdout: { write() {} } }), /must not delete or empty tests: tests\/owned\.test\.mjs/);
    assert.notEqual(loadRun(f.runId, f.cwd).status, 'COMPLETED');
  });
});

test('review packet preserves spaced paths, keeps concurrent changes visible and writes no index', t => {
  const f = fixture(t);
  const index = path.join(f.cwd, '.git/index');
  const before = fs.readFileSync(index);
  fs.utimesSync(path.join(f.cwd, 'README.md'), new Date(), new Date());
  const context = f.context();
  assert.deepEqual(fs.readFileSync(index), before);
  assert.deepEqual(context.diff.task_paths, ['src/中文 label.js']);
  assert.deepEqual(context.diff.other_paths, ['other/中文 label.js']);
  assert.equal(context.scope_preflight.ok, true, context.scope_preflight.reasons.join('; '));
  assert.match(context.contract.steps, /中文 label/);
  assert.equal(context.review_handoff.role, 'read-only');
  const file = writeRalphContext('.workflow/context.json', context, f.cwd);
  assert.deepEqual(contextGateOptions(f.runId, file, f.cwd).diff_paths, ['src/中文 label.js']);
  assert.throws(() => writeRalphContext('context.json', context, f.cwd), /under .workflow/);
  const forged = structuredClone(context);
  forged.diff.task_paths = ['other/中文 label.js'];
  assert.throws(() => validateRalphContext(f.runId, forged, { cwd: f.cwd }), /selection changed/);
  f.write('src/中文 label.js', 'export const label = "改过";\n');
  assert.throws(() => validateRalphContext(f.runId, context, { cwd: f.cwd }), /stale/);
});

test('scope replacement is explicit and audited; empty or missing task diff cannot pass review', t => {
  const f = fixture(t);
  updateRunScope(f.runId, { cwd: f.cwd, add_in: ['src/history.js'] });
  const packet = f.context();
  assert.match(packet.scope_preflight.reasons.join('; '), /planned missing.*history/);
  const result = recordReview(f.runId, { cwd: f.cwd, outcome: 'PASS', context: packet });
  assert.equal(result.report.outcome, 'NEEDS_CHANGES');
  assert.ok(result.report.findings.some(item => item.id === 'F-CONTEXT-SCOPE'));
  assert.throws(() => updateRunScope(f.runId, { cwd: f.cwd, replace_in: ['src/中文 label.js'] }), /requires a reason/);
  updateRunScope(f.runId, { cwd: f.cwd, replace_in: ['src/中文 label.js'], reason: '当前方案已替换历史路径，历史保留在事件中' });
  assert.match(readRunEventsText(f.runId, f.cwd), /scope-replaced.*history\.js/);
  assert.equal(f.context().scope_preflight.ok, true);
  f.git(['add', '--', 'src/中文 label.js']);
  f.git(['commit', '-m', 'feat(label): 更新标签']);
  const empty = f.context();
  assert.equal(recordReview(f.runId, { cwd: f.cwd, outcome: 'PASS', context: empty }).report.outcome, 'NEEDS_CHANGES');
});

test('JSON files preserve host provenance and verified scope across metadata-only gate changes', t => {
  const f = fixture(t);
  const context = f.context();
  writeRalphContext('.workflow/context.json', context, f.cwd);
  f.write('.workflow/host.json', '\uFEFF' + JSON.stringify({ method: 'skill', entry: 'code-review', artifact_paths: ['审查 结果.json'], note: '中文 "引号"' }));
  f.write('.workflow/findings.json', '\uFEFF[]');
  const output = [];
  assert.equal(runCli(['ralph', 'review-record', '--run-id', f.runId, '--outcome', 'PASS', '--source', 'host_builtin',
    '--context-file', '.workflow/context.json', '--host-review-file', '.workflow/host.json', '--findings-file', '.workflow/findings.json', '--json'], {
    cwd: f.cwd, stdout: { write: text => output.push(text) }
  }), 0);
  const report = JSON.parse(output.join('')).report;
  assert.equal(report.outcome, 'PASS');
  assert.equal(report.source, 'host_builtin');
  assert.equal(report.host_review.note, '中文 "引号"');
  assert.deepEqual(report.context_snapshot.other_paths, ['other/中文 label.js']);
  assert.equal(validateRalphContext(f.runId, context, { cwd: f.cwd }).scope_preflight.ok, true);
  const run = loadRun(f.runId, f.cwd);
  run.gates.deliver = 'PASS';
  saveRun(run, f.cwd);
  assert.doesNotThrow(() => contextGateOptions(f.runId, '.workflow/context.json', f.cwd));
  writeConversationPlan(f.cwd, f.runId, { goal: 'different behavior', steps: '1. [x] Update `src/中文 label.js`' });
  assert.throws(() => validateRalphContext(f.runId, context, { cwd: f.cwd }), /contract.*changed/);
  assert.throws(() => setGate(f.runId, { cwd: f.cwd, gate: 'accept', status: 'PASS', diff_paths: ['src/中文 label.js'] }), /stale scoped review/);
});

test('commit context binds the real range and HEAD; changed index, branch or untracked bytes invalidate snapshots', t => {
  const f = fixture(t);
  const base = f.git(['rev-parse', 'HEAD']);
  f.git(['add', '--', 'src/中文 label.js']);
  f.git(['commit', '-m', 'feat(label): 更新标签']);
  const head = f.git(['rev-parse', 'HEAD']);
  const context = getRalphContext(f.runId, { cwd: f.cwd, review: true, review_scope: 'commit', base_commit: base });
  assert.equal(context.diff.reviewed_commit, head);
  assert.equal(context.diff.base_commit, base);
  assert.equal(context.scope_preflight.ok, true);
  assert.equal(recordReview(f.runId, { cwd: f.cwd, outcome: 'PASS', context }).report.review_scope, 'commit');
  assert.throws(() => recordReview(f.runId, { cwd: f.cwd, outcome: 'PASS', reviewed_commit: base, context }), /does not match/);
  assert.ok(snapshotCommit(f.cwd, { reviewed_commit: base }).paths.includes('README.md'));
  f.write('src/中文 label.js', 'new dirty change\n');
  assert.equal(getRalphContext(f.runId, { cwd: f.cwd, review_scope: 'commit' }).scope_preflight.ok, false);
  const dirty = f.context();
  f.git(['add', '--', 'src/中文 label.js']);
  assert.throws(() => validateRalphContext(f.runId, dirty, { cwd: f.cwd }), /stale/);
  const staged = f.context();
  f.git(['switch', '-c', 'renamed-work']);
  assert.throws(() => validateRalphContext(f.runId, staged, { cwd: f.cwd }), /stale/);
  const before = snapshotGit(f.cwd);
  f.write('other/中文 label.js', 'different untracked bytes\n');
  assert.notEqual(snapshotGit(f.cwd).fingerprint, before.fingerprint);
});
