import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { runCli } from '../../src/cli.mjs';
import {
  RALPH_RUN_SCHEMA_VERSION,
  TASK_PLAN_REL,
  initRun,
  saveRun,
  validateRun,
  setGate,
  finalizeRun,
  computeRunMetrics,
  recordDeliverAttempt,
  INTENSITY_DEFAULTS,
  rollbackPhase,
  loadRun,
  listRuns,
  GATE_ALIASES,
  GATE_SET_HEURISTIC,
  LITE_MAX_DELIVER_LOOPS,
  createRunSkeleton,
  promoteGateSetToFull,
  suggestGateSet,
  updateRunScope
} from '../../src/ralph.mjs';
import { root, ledgerText, withoutLocalPortfolio, liteAcceptanceTable } from './helpers.mjs';

test('P2+a init --lite sets gate_set=lite and caps max_deliver_loops; default and tiny stay full', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-lite-init-'));
  try {
    assert.equal(LITE_MAX_DELIVER_LOOPS, 3);
    assert.deepEqual(GATE_ALIASES, { brief: ['analyze', 'plan'], close: ['accept', 'archive'] });

    const lite = initRun({ run_id: 'task-lite-std', title: 'lite std', goal: 'small fix', attach_knowledge: false, gate_set: 'lite' }, cwd);
    assert.equal(lite.gate_set, 'lite');
    assert.equal(lite.schema_version, RALPH_RUN_SCHEMA_VERSION);
    assert.equal(lite.phase, 'ANALYZE');
    assert.deepEqual(Object.keys(lite.gates).sort(), ['accept', 'analyze', 'archive', 'deliver', 'plan']);
    assert.ok(lite.budget.max_deliver_loops <= 3);
    assert.equal(lite.budget.max_deliver_loops, Math.min(INTENSITY_DEFAULTS.standard.budget.max_deliver_loops, 3));
    assert.equal(lite.budget.max_accept_rechecks, INTENSITY_DEFAULTS.standard.budget.max_accept_rechecks);
    assert.equal(lite.max_iterations, INTENSITY_DEFAULTS.standard.max_iterations);
    assert.equal(lite.stagnation.patience, INTENSITY_DEFAULTS.standard.stagnation_patience);
    assert.deepEqual(validateRun(loadRun('task-lite-std', cwd)), []);
    const liteDir = path.join(cwd, '.workflow', 'ralph', 'task-lite-std');
    const progress = ledgerText(cwd, 'task-lite-std');
    assert.match(progress, /gate_set: lite/);
    const plan = fs.readFileSync(path.join(liteDir, TASK_PLAN_REL), 'utf8');
    assert.match(plan, /^## Goal$/m);
    assert.match(plan, /^## Steps$/m);
    assert.match(plan, /^## 验收$/m);
    assert.deepEqual(fs.readdirSync(liteDir).sort(), ['.state', 'findings.md', 'progress.md', 'task_plan.md']);

    // no flag → full; tiny without --lite → still full (intensity ⟂ gate_set)
    const plain = initRun({ run_id: 'task-lite-plain', title: 'plain', goal: 'default', attach_knowledge: false }, cwd);
    assert.equal(plain.gate_set, 'full');
    assert.equal(plain.budget.max_deliver_loops, INTENSITY_DEFAULTS.standard.budget.max_deliver_loops);
    const tiny = initRun({ run_id: 'task-lite-tiny', title: 'tiny', goal: 'tiny stays full', attach_knowledge: false, intensity: 'tiny' }, cwd);
    assert.equal(tiny.gate_set, 'full');
    assert.equal(tiny.budget.max_deliver_loops, INTENSITY_DEFAULTS.tiny.budget.max_deliver_loops);
    // explicit --full is a no-op override; tiny + --lite caps too
    const full = initRun({ run_id: 'task-lite-full', title: 'full', goal: 'explicit', attach_knowledge: false, gate_set: 'full' }, cwd);
    assert.equal(full.gate_set, 'full');
    const tinyLite = initRun({ run_id: 'task-lite-tiny-lite', title: 'tiny lite', goal: 'both', attach_knowledge: false, intensity: 'tiny', gate_set: 'lite' }, cwd);
    assert.equal(tinyLite.gate_set, 'lite');
    assert.equal(tinyLite.intensity, 'tiny');
    assert.equal(tinyLite.budget.max_deliver_loops, 3);
    // budget override below cap is kept as-is
    const skeleton = createRunSkeleton({ run_id: 'task-lite-skel', title: 's', goal: 'g', gate_set: 'lite', budget: { max_deliver_loops: 2 } });
    assert.equal(skeleton.budget.max_deliver_loops, 2);
    assert.throws(() => createRunSkeleton({ run_id: 'task-lite-bad', title: 's', goal: 'g', gate_set: 'medium' }), /gate_set must be one of full\|lite/);

    // CLI --lite / --full / both
    const chunks = [];
    const stdout = { write: (text) => chunks.push(text) };
    assert.equal(runCli(['ralph', 'init', '--run-id', 'task-lite-cli', '--title', 'cli', '--goal', 'lite via cli', '--no-knowledge-refs', '--lite', '--json'], { cwd, stdout }), 0);
    const cliRun = JSON.parse(chunks[chunks.length - 1]).run;
    assert.equal(cliRun.gate_set, 'lite');
    assert.equal(cliRun.budget.max_deliver_loops, 3);
    assert.equal(loadRun('task-lite-cli', cwd).gate_set, 'lite');
    assert.equal(runCli(['ralph', 'init', '--run-id', 'task-full-cli', '--title', 'cli', '--goal', 'full via cli', '--no-knowledge-refs', '--full', '--json'], { cwd, stdout }), 0);
    assert.equal(loadRun('task-full-cli', cwd).gate_set, 'full');
    assert.throws(
      () => runCli(['ralph', 'init', '--run-id', 'task-both-cli', '--title', 'cli', '--goal', 'both', '--no-knowledge-refs', '--lite', '--full'], { cwd, stdout }),
      /--lite or --full, not both/
    );
    assert.equal(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'task-both-cli')), false);
    chunks.length = 0;
    assert.equal(runCli(['ralph', 'status', '--run-id', 'task-lite-cli'], { cwd, stdout }), 0);
    assert.match(chunks.join(''), /gate_set: lite/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('P2+a setGate brief PASS writes analyze+plan PASS and lands in DELIVER; aliases are lite-only', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-lite-brief-'));
  try {
    const runId = 'task-lite-brief';
    initRun({ run_id: runId, title: 'brief', goal: 'merge analyze+plan', attach_knowledge: false, gate_set: 'lite' }, cwd);
    const result = setGate(runId, { gate: 'brief', status: 'PASS', cwd });
    assert.equal(result.alias, 'brief');
    assert.deepEqual(result.gates_written, ['analyze', 'plan']);
    assert.equal(result.phase, 'DELIVER');
    assert.equal(result.promotion.promoted, false);
    let run = loadRun(runId, cwd);
    assert.equal(run.gates.analyze, 'PASS');
    assert.equal(run.gates.plan, 'PASS');
    assert.equal(run.gates.deliver, 'PENDING');
    assert.equal(run.phase, 'DELIVER');
    assert.equal(run.gate_set, 'lite');
    assert.equal(run.status, 'IN_PROGRESS');
    assert.deepEqual(validateRun(run), []);
    assert.equal(Object.hasOwn(run.gates, 'brief'), false);
    assert.equal(Object.hasOwn(run.gates, 'close'), false);
    // progress keeps five-key gate lines (metrics parser) tagged with the alias
    const progress = ledgerText(cwd, runId);
    assert.match(progress, /gate analyze=PASS phase=DELIVER status=IN_PROGRESS via=brief/);
    assert.match(progress, /gate plan=PASS phase=DELIVER status=IN_PROGRESS via=brief/);
    assert.doesNotMatch(progress, /gate brief=/);
    const metrics = computeRunMetrics(run, cwd);
    assert.equal(metrics.analyze_to_plan_hours, 0);

    // deliver is shared: same key, phase → ACCEPT
    const delivered = setGate(runId, { gate: 'deliver', status: 'PASS', cwd });
    assert.equal(delivered.alias, null);
    assert.equal(delivered.phase, 'ACCEPT');
    run = loadRun(runId, cwd);
    assert.equal(run.gate_set, 'lite');

    // aliases refused on a full run
    initRun({ run_id: 'task-full-noalias', title: 'full', goal: 'no alias', attach_knowledge: false }, cwd);
    assert.throws(
      () => setGate('task-full-noalias', { gate: 'brief', status: 'PASS', cwd }),
      /gate alias brief requires gate_set=lite \(current=full\); use analyze then plan/
    );
    assert.equal(loadRun('task-full-noalias', cwd).gates.analyze, 'PENDING');
    assert.throws(() => setGate('task-full-noalias', { gate: 'nope', status: 'PASS', cwd }), /invalid gate: nope .*lite aliases brief\|close/);

    // CLI gate alias round-trip
    initRun({ run_id: 'task-lite-cli-brief', title: 'cli brief', goal: 'cli alias', attach_knowledge: false, gate_set: 'lite' }, cwd);
    const chunks = [];
    const stdout = { write: (text) => chunks.push(text) };
    assert.equal(runCli(['ralph', 'gate', '--run-id', 'task-lite-cli-brief', '--gate', 'brief', '--status', 'PASS'], { cwd, stdout }), 0);
    assert.match(chunks.join(''), /gate brief=PASS phase=DELIVER .*writes=analyze,plan/);
    assert.equal(loadRun('task-lite-cli-brief', cwd).gates.plan, 'PASS');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('P2+a close PASS still runs accept/archive evidence gates; weak write-then-read evidence blocks', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-lite-close-'));
  try {
    const runId = 'task-lite-close';
    initRun({ run_id: runId, title: 'close', goal: 'accept+archive merged', attach_knowledge: false, gate_set: 'lite' }, cwd);
    // close before deliver PASS → blocked by the existing consistency gate
    assert.throws(() => setGate(runId, { gate: 'close', status: 'PASS', cwd }), /requires gates\.deliver=PASS/);
    setGate(runId, { gate: 'brief', status: 'PASS', cwd });
    setGate(runId, { gate: 'deliver', status: 'PASS', cwd });
    const planPath = path.join(cwd, '.workflow', 'ralph', runId, TASK_PLAN_REL);

    fs.writeFileSync(planPath, liteAcceptanceTable('static'), 'utf8');
    assert.throws(() => setGate(runId, { gate: 'close', status: 'PASS', cwd }), /evidence_class over-claim/);
    let run = loadRun(runId, cwd);
    assert.equal(run.gates.accept, 'PENDING');
    assert.equal(run.gates.archive, 'PENDING');
    assert.equal(run.phase, 'ACCEPT');
    assert.equal(run.status, 'IN_PROGRESS');
    assert.equal(run.gate_set, 'lite');
    const progressWeak = ledgerText(cwd, runId);
    assert.doesNotMatch(progressWeak, /gate accept=PASS/);
    assert.doesNotMatch(progressWeak, /promoted lite→full/);

    // strong evidence → close PASS = accept PASS + archive PASS, COMPLETED, still lite
    fs.writeFileSync(planPath, liteAcceptanceTable('write_then_read:mock_ok'), 'utf8');
    const closed = setGate(runId, { gate: 'close', status: 'PASS', cwd });
    assert.equal(closed.alias, 'close');
    assert.deepEqual(closed.gates_written, ['accept', 'archive']);
    assert.equal(closed.phase, 'ARCHIVE');
    run = loadRun(runId, cwd);
    assert.equal(run.gates.accept, 'PASS');
    assert.equal(run.gates.archive, 'PASS');
    assert.equal(run.accept_layers.mechanical, 'PASS');
    assert.equal(run.status, 'COMPLETED');
    assert.equal(run.gate_set, 'lite');
    assert.deepEqual(validateRun(run), []);
    const progress = ledgerText(cwd, runId);
    assert.match(progress, /gate accept=PASS phase=ARCHIVE status=COMPLETED via=close/);
    assert.match(progress, /gate archive=PASS phase=ARCHIVE status=COMPLETED via=close/);

    // existing finalize still applies on top (in-place ledger, no copy)
    const finalized = withoutLocalPortfolio(() => finalizeRun(runId, { cwd, modules: ['src/lite.js'], keywords: ['lite'] }));
    assert.equal(finalized.archive_path, '.workflow/ralph/completed/' + runId);
    assert.equal(finalized.run.status, 'COMPLETED');
    assert.ok(Array.isArray(finalized.run.archive.files) && finalized.run.archive.files.length > 0);

    // strict lite: close PASS also needs the judgment layer (no shortcut around evaluateAcceptJudgment)
    const strictId = 'task-lite-strict';
    initRun({ run_id: strictId, title: 'strict lite', goal: 'judgment still required', attach_knowledge: false, gate_set: 'lite', intensity: 'strict' }, cwd);
    setGate(strictId, { gate: 'brief', status: 'PASS', cwd });
    setGate(strictId, { gate: 'deliver', status: 'PASS', cwd });
    fs.writeFileSync(path.join(cwd, '.workflow', 'ralph', strictId, TASK_PLAN_REL), liteAcceptanceTable('write_then_read:mock_ok'), 'utf8');
    assert.throws(() => setGate(strictId, { gate: 'close', status: 'PASS', cwd }), /accept judgment layer blocked PASS/);
    assert.equal(loadRun(strictId, cwd).gates.accept, 'PENDING');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('P2+a lite FAIL/BLOCKED or scope.in growth promotes to full in place (same run_id, dir, evidence)', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-lite-promote-'));
  try {
    const dirOf = (id) => path.join(cwd, '.workflow', 'ralph', id);
    const progressOf = (id) => ledgerText(cwd, id);

    // (a) gate FAIL on lite → full; budget restored to intensity default; BRIEF evidence kept
    const failId = 'task-lite-fail';
    initRun({ run_id: failId, title: 'fail', goal: 'promote on fail', attach_knowledge: false, gate_set: 'lite' }, cwd);
    setGate(failId, { gate: 'brief', status: 'PASS', cwd });
    const beforeFiles = fs.readdirSync(dirOf(failId)).sort();
    const failed = setGate(failId, { gate: 'deliver', status: 'FAIL', cwd, advance: false });
    assert.equal(failed.promotion.promoted, true);
    assert.match(failed.promotion.reason, /gate deliver=FAIL/);
    assert.deepEqual(failed.promotion.max_deliver_loops, { from: 3, to: INTENSITY_DEFAULTS.standard.budget.max_deliver_loops });
    let run = loadRun(failId, cwd);
    assert.equal(run.run_id, failId);
    assert.equal(run.gate_set, 'full');
    assert.equal(run.budget.max_deliver_loops, INTENSITY_DEFAULTS.standard.budget.max_deliver_loops);
    assert.equal(run.gates.analyze, 'PASS');
    assert.equal(run.gates.plan, 'PASS');
    assert.equal(run.gates.deliver, 'FAIL');
    assert.equal(run.gates.accept, 'PENDING');
    assert.equal(run.phase, 'DELIVER');
    assert.deepEqual(validateRun(run), []);
    assert.deepEqual(fs.readdirSync(dirOf(failId)).sort(), beforeFiles);
    assert.equal(listRuns(cwd).filter((row) => row.run_id === failId).length, 1);
    assert.match(progressOf(failId), /gate deliver=FAIL phase=DELIVER status=IN_PROGRESS\n- \S+ promoted lite→full reason=gate deliver=FAIL max_deliver_loops=3→20/);
    // promoted run must now walk the five gates; aliases are refused
    assert.throws(() => setGate(failId, { gate: 'close', status: 'PASS', cwd }), /requires gate_set=lite \(current=full\)/);
    // a second FAIL on full does not write another promotion line
    setGate(failId, { gate: 'deliver', status: 'FAIL', cwd, advance: false });
    assert.equal((progressOf(failId).match(/promoted lite→full/g) || []).length, 1);

    // (b) BLOCKED on a lite alias → both keys BLOCKED, status BLOCKED, promoted
    const blockId = 'task-lite-block';
    initRun({ run_id: blockId, title: 'block', goal: 'promote on blocked', attach_knowledge: false, gate_set: 'lite', intensity: 'tiny' }, cwd);
    const blocked = setGate(blockId, { gate: 'brief', status: 'BLOCKED', cwd });
    assert.equal(blocked.promotion.promoted, true);
    run = loadRun(blockId, cwd);
    assert.equal(run.gate_set, 'full');
    assert.equal(run.status, 'BLOCKED');
    assert.equal(run.gates.analyze, 'BLOCKED');
    assert.equal(run.gates.plan, 'BLOCKED');
    assert.equal(run.phase, 'ANALYZE');
    assert.equal(run.budget.max_deliver_loops, INTENSITY_DEFAULTS.tiny.budget.max_deliver_loops);
    assert.match(progressOf(blockId), /promoted lite→full reason=gate brief=BLOCKED/);

    // (c) restored cap is never below iterations already used
    const usedId = 'task-lite-used';
    initRun({ run_id: usedId, title: 'used', goal: 'floor at used', attach_knowledge: false, gate_set: 'lite' }, cwd);
    run = loadRun(usedId, cwd);
    run.iteration = INTENSITY_DEFAULTS.standard.budget.max_deliver_loops + 5;
    saveRun(run, cwd);
    setGate(usedId, { gate: 'brief', status: 'FAIL', cwd, advance: false });
    assert.equal(loadRun(usedId, cwd).budget.max_deliver_loops, INTENSITY_DEFAULTS.standard.budget.max_deliver_loops + 5);

    // (d) scope.in growth via updateRunScope → promoted; scope.out growth or duplicates do not promote
    const scopeId = 'task-lite-scope';
    initRun({ run_id: scopeId, title: 'scope', goal: 'promote on growth', attach_knowledge: false, gate_set: 'lite', scope: { in: ['src/a.js'], out: ['src/b.js'] } }, cwd);
    setGate(scopeId, { gate: 'brief', status: 'PASS', cwd });
    let scoped = updateRunScope(scopeId, { add_out: ['docs/'], cwd });
    assert.equal(scoped.promotion.promoted, false);
    assert.deepEqual(scoped.added_out, ['docs/']);
    scoped = updateRunScope(scopeId, { add_in: ['src/a.js'], cwd });
    assert.equal(scoped.promotion.promoted, false);
    assert.deepEqual(scoped.added_in, []);
    assert.equal(loadRun(scopeId, cwd).gate_set, 'lite');
    scoped = updateRunScope(scopeId, { add_in: ['src/new-module.js', ' src/a.js '], cwd });
    assert.equal(scoped.promotion.promoted, true);
    assert.deepEqual(scoped.added_in, ['src/new-module.js']);
    run = loadRun(scopeId, cwd);
    assert.equal(run.run_id, scopeId);
    assert.equal(run.gate_set, 'full');
    assert.deepEqual(run.scope, { in: ['src/a.js', 'src/new-module.js'], out: ['src/b.js', 'docs/'] });
    assert.equal(run.gates.analyze, 'PASS');
    assert.equal(run.gates.plan, 'PASS');
    assert.equal(run.phase, 'DELIVER');
    assert.equal(run.budget.max_deliver_loops, INTENSITY_DEFAULTS.standard.budget.max_deliver_loops);
    assert.deepEqual(validateRun(run), []);
    assert.match(progressOf(scopeId), /scope in\+=\[src\/new-module\.js\] out\+=\[\] gate_set=full\n- \S+ promoted lite→full reason=scope\.in expanded: src\/new-module\.js/);
    assert.throws(() => updateRunScope(scopeId, { cwd }), /needs add_in and\/or add_out/);

    // (d2) rollbackPhase writes the leaving gate FAIL → same fallback; stagnation fingerprint still runs on lite
    const rbId = 'task-lite-rollback';
    initRun({ run_id: rbId, title: 'rollback', goal: 'promote on rollback', attach_knowledge: false, gate_set: 'lite' }, cwd);
    setGate(rbId, { gate: 'brief', status: 'PASS', cwd });
    const first = recordDeliverAttempt(rbId, { improved: true, signal: 'tests 1/3', cwd });
    assert.equal(first.blocked, false);
    assert.equal(first.iteration, 1);
    assert.ok(first.fingerprint);
    assert.equal(loadRun(rbId, cwd).stagnation.last_fingerprint, first.fingerprint);
    setGate(rbId, { gate: 'deliver', status: 'PASS', cwd });
    const rolled = rollbackPhase(rbId, { toPhase: 'DELIVER', reason: '验收证据不足', cwd });
    assert.equal(rolled.promotion.promoted, true);
    run = loadRun(rbId, cwd);
    assert.equal(run.gate_set, 'full');
    assert.equal(run.gates.deliver, 'FAIL');
    assert.equal(run.phase, 'DELIVER');
    assert.equal(run.budget.max_deliver_loops, INTENSITY_DEFAULTS.standard.budget.max_deliver_loops);
    assert.match(progressOf(rbId), /rollbackPhase ACCEPT→DELIVER reason=验收证据不足\n- \S+ promoted lite→full reason=rollbackPhase ACCEPT→DELIVER deliver=FAIL/);

    // (d3) lite budget: third deliver attempt hits max_deliver_loops=3 → BLOCKED with the lite escape hint (no auto-promotion)
    const budgetId = 'task-lite-budget';
    initRun({ run_id: budgetId, title: 'budget', goal: 'cap at 3', attach_knowledge: false, gate_set: 'lite' }, cwd);
    setGate(budgetId, { gate: 'brief', status: 'PASS', cwd });
    recordDeliverAttempt(budgetId, { improved: true, signal: 'a', cwd });
    recordDeliverAttempt(budgetId, { improved: true, signal: 'b', cwd });
    const third = recordDeliverAttempt(budgetId, { improved: true, signal: 'c', cwd });
    assert.equal(third.blocked, true);
    assert.equal(third.intervention_needed.kind, 'MAX_ITERATIONS');
    assert.match(third.intervention_needed.reason, /budget\.max_deliver_loops 3/);
    assert.match(third.intervention_needed.unblock, /lite run: gate deliver FAIL/);
    assert.equal(loadRun(budgetId, cwd).gate_set, 'lite');
    assert.equal(loadRun(budgetId, cwd).status, 'BLOCKED');
    // taking the documented exit lifts the budget stop: the cap is gone, so is the stale MAX_ITERATIONS block
    const escaped = setGate(budgetId, { gate: 'deliver', status: 'FAIL', cwd, advance: false });
    assert.equal(escaped.promotion.promoted, true);
    assert.equal(escaped.promotion.unblocked, true);
    assert.deepEqual(escaped.promotion.max_deliver_loops, { from: 3, to: INTENSITY_DEFAULTS.standard.budget.max_deliver_loops });
    run = loadRun(budgetId, cwd);
    assert.equal(run.budget.max_deliver_loops, INTENSITY_DEFAULTS.standard.budget.max_deliver_loops);
    assert.equal(run.status, 'IN_PROGRESS');
    assert.equal(run.intervention_needed, null);
    assert.equal(run.gates.deliver, 'FAIL');
    assert.match(progressOf(budgetId), /promoted lite→full reason=gate deliver=FAIL max_deliver_loops=3→20 status=BLOCKED→IN_PROGRESS/);
    const fourth = recordDeliverAttempt(budgetId, { improved: true, signal: 'd', cwd });
    assert.equal(fourth.blocked, false);
    assert.equal(fourth.iteration, 4);
    // (d4) a gate written BLOCKED at the lite cap promotes but stays BLOCKED (the gate itself is blocked)
    const stayId = 'task-lite-stay-blocked';
    initRun({ run_id: stayId, title: 'stay', goal: 'blocked gate keeps block', attach_knowledge: false, gate_set: 'lite' }, cwd);
    setGate(stayId, { gate: 'brief', status: 'PASS', cwd });
    for (const s of ['a', 'b', 'c']) recordDeliverAttempt(stayId, { improved: true, signal: s, cwd });
    assert.equal(loadRun(stayId, cwd).status, 'BLOCKED');
    const stayed = setGate(stayId, { gate: 'deliver', status: 'BLOCKED', cwd, advance: false });
    assert.equal(stayed.promotion.promoted, true);
    assert.equal(stayed.promotion.unblocked, false);
    run = loadRun(stayId, cwd);
    assert.equal(run.gate_set, 'full');
    assert.equal(run.status, 'BLOCKED');
    assert.equal(run.intervention_needed?.kind, 'MAX_ITERATIONS');
    assert.doesNotMatch(progressOf(stayId), /status=BLOCKED→IN_PROGRESS/);
    // (d5) scope growth at the lite cap also lifts the budget stop; a STAGNATION block never does
    const scopeCapId = 'task-lite-scope-cap';
    initRun({ run_id: scopeCapId, title: 'scope cap', goal: 'growth lifts cap stop', attach_knowledge: false, gate_set: 'lite', scope: { in: ['src/a.js'], out: [] } }, cwd);
    setGate(scopeCapId, { gate: 'brief', status: 'PASS', cwd });
    for (const s of ['a', 'b', 'c']) recordDeliverAttempt(scopeCapId, { improved: true, signal: s, cwd });
    const grown = updateRunScope(scopeCapId, { add_in: ['src/b.js'], cwd });
    assert.equal(grown.promotion.unblocked, true);
    assert.equal(loadRun(scopeCapId, cwd).status, 'IN_PROGRESS');
    assert.equal(loadRun(scopeCapId, cwd).intervention_needed, null);
    const stagId = 'task-lite-stagnation';
    initRun({ run_id: stagId, title: 'stagnation', goal: 'stagnation block stands', attach_knowledge: false, gate_set: 'lite' }, cwd);
    setGate(stagId, { gate: 'brief', status: 'PASS', cwd });
    recordDeliverAttempt(stagId, { improved: false, signal: 'same', cwd });
    const stalled = recordDeliverAttempt(stagId, { improved: false, signal: 'same', cwd });
    assert.equal(stalled.intervention_needed?.kind, 'STAGNATION');
    const stagPromoted = setGate(stagId, { gate: 'deliver', status: 'FAIL', cwd, advance: false });
    assert.equal(stagPromoted.promotion.promoted, true);
    assert.equal(stagPromoted.promotion.unblocked, false);
    assert.equal(loadRun(stagId, cwd).status, 'BLOCKED');
    assert.equal(loadRun(stagId, cwd).intervention_needed?.kind, 'STAGNATION');

    // (e) promoteGateSetToFull is a no-op on full; scope growth on a full run never touches gate_set
    const fullId = 'task-full-scope';
    initRun({ run_id: fullId, title: 'full scope', goal: 'no promotion', attach_knowledge: false }, cwd);
    const noop = promoteGateSetToFull(loadRun(fullId, cwd), { reason: 'x' });
    assert.equal(noop.promoted, false);
    const fullScoped = updateRunScope(fullId, { add_in: ['src/z.js'], cwd });
    assert.equal(fullScoped.promotion.promoted, false);
    assert.equal(loadRun(fullId, cwd).gate_set, 'full');
    assert.doesNotMatch(progressOf(fullId), /promoted lite→full/);

    // (f) mechanical CLI owns legacy init/brief; ralph_ops scope still promotes existing runs
    const chunks = [];
    const stdout = { write: (text) => chunks.push(text) };
    const cliId = 'task-lite-cli-scope';
    initRun({ run_id: cliId, title: 'cli scope', goal: 'cli', attach_knowledge: false, gate_set: 'lite' }, cwd);
    assert.equal(runCli(['ralph', 'scope', '--run-id', cliId, '--in', 'src/extra.js'], { cwd, stdout }), 0);
    assert.match(chunks.join(''), /scope in\+=\[src\/extra\.js\] out\+=\[\] gate_set=full/);
    assert.match(chunks.join(''), /promoted lite→full: scope\.in expanded: src\/extra\.js/);
    assert.equal(loadRun(cliId, cwd).gate_set, 'full');
    assert.throws(() => runCli(['ralph', 'scope', '--run-id', cliId], { cwd, stdout }), /at least one --in or --out/);

    const ops = path.join(root, 'skills/jj-ralph/scripts/ralph_ops.mjs');
    const runNode = (args) => {
      const result = spawnSync(process.execPath, [ops, ...args, '--cwd', cwd], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      return JSON.parse(result.stdout);
    };
    const opsId = 'task-lite-ops';
    chunks.length = 0;
    assert.equal(runCli(['ralph', 'init', '--run-id', opsId, '--title', 'ops lite', '--goal', 'thin wrap', '--lite', '--project', 'ops-lite-proj', '--json'], { cwd, stdout }), 0);
    const opsInit = JSON.parse(chunks.join('')).run;
    assert.equal(opsInit.gate_set, 'lite');
    assert.equal(opsInit.budget.max_deliver_loops, 3);
    assert.equal(loadRun(opsId, cwd).gate_set, 'lite');
    chunks.length = 0;
    assert.equal(runCli(['ralph', 'gate', '--run-id', opsId, '--gate', 'brief', '--status', 'PASS', '--json'], { cwd, stdout }), 0);
    const opsBrief = JSON.parse(chunks.join(''));
    assert.deepEqual(opsBrief.gates_written, ['analyze', 'plan']);
    assert.equal(opsBrief.phase, 'DELIVER');
    const opsScope = runNode(['scope', '--run-id', opsId, '--in', 'src/x.js,src/y.js']);
    assert.deepEqual(opsScope.added_in, ['src/x.js', 'src/y.js']);
    assert.equal(opsScope.gate_set, 'full');
    assert.equal(opsScope.promotion.promoted, true);
    assert.equal(loadRun(opsId, cwd).gate_set, 'full');
    const both = spawnSync(process.execPath, [ops, 'init', '--run-id', 'task-lite-ops-both', '--title', 't', '--goal', 'g', '--lite', '--full', '--cwd', cwd], { encoding: 'utf8' });
    assert.notEqual(both.status, 0);
    assert.match(both.stderr, /对话包装不接受 --lite/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('P2+b suggestGateSet reads title/goal/scope/capability_ids only; lite needs every signal small, else full', () => {
  assert.equal(GATE_SET_HEURISTIC.max_scope_in, 2);
  const lite = suggestGateSet({ title: 'tip 位置', goal: 'tip bottom 4px 改成 6px', scope: { in: ['src/tip.css'], out: [] } });
  assert.equal(lite.gate_set, 'lite');
  assert.equal(lite.applied, false);
  assert.deepEqual(lite.signals, { surface: 'small', scope_in: 1, architecture_terms: [], acceptance_items: 1 });
  assert.deepEqual(lite.reasons, ['surface:small (scope.in=1 concrete file)', 'architecture:none', 'acceptance:single']);
  assert.match(lite.hint, /advisory only.*--lite --force/);

  // 改动面小 via the user's own wording when scope.in is empty
  const wording = suggestGateSet({ title: '顺手修', goal: '顺手把登录页 typo 改了' });
  assert.equal(wording.gate_set, 'lite');
  assert.equal(wording.signals.surface, 'small');
  assert.match(wording.reasons[0], /small-change wording/);

  // 拿不准 → full: no scope, no small-change wording
  const unknown = suggestGateSet({ title: '登录提醒', goal: '登录后密码过期要提示' });
  assert.equal(unknown.gate_set, 'full');
  assert.equal(unknown.signals.surface, 'unknown');
  assert.equal(unknown.hint, null);

  // 改动面宽: >2 files, or dir / glob / extension-less entries
  assert.equal(suggestGateSet({ goal: 'small fix', scope: { in: ['src/a.js', 'src/b.js', 'src/c.js'] } }).signals.surface, 'wide');
  assert.equal(suggestGateSet({ goal: 'small fix', scope: { in: ['src/a.js', 'src/b.js'] } }).gate_set, 'lite');
  for (const entry of ['src/', 'src/**/*.js', 'src/lib', 'Dockerfile']) {
    const wide = suggestGateSet({ goal: 'small fix', scope: { in: [entry] } });
    assert.equal(wide.gate_set, 'full', entry);
    assert.match(wide.reasons[0], /surface:wide/);
  }

  // 架构词 anywhere in title / goal / scope.in → full even with one file and small wording
  const arch = suggestGateSet({ title: '顺手重构', goal: '顺手重构鉴权协议', scope: { in: ['src/auth.js'] } });
  assert.equal(arch.gate_set, 'full');
  assert.deepEqual(arch.signals.architecture_terms, ['重构', '鉴权', '协议', 'auth']);
  assert.equal(suggestGateSet({ goal: 'add api field', scope: { in: ['src/a.js'] } }).gate_set, 'full');
  assert.equal(suggestGateSet({ goal: 'bump schema description', scope: { in: ['schemas/x.json'] } }).gate_set, 'full');
  // \bauth\b does not catch "author"
  assert.equal(suggestGateSet({ goal: 'show author name', scope: { in: ['src/a.js'] } }).gate_set, 'lite');

  // 多验收项: separators / list markers / conjunctions / capability_ids
  for (const goal of ['改 tip 文案；把 close 挪一点', '1. 改 A\n2. 改 B', '① 改 A ② 改 B', '- 改 A\n- 改 B', '改 A 并且改 B', 'fix A and also B']) {
    const multi = suggestGateSet({ goal, scope: { in: ['src/a.js'] } });
    assert.equal(multi.gate_set, 'full', goal);
    assert.ok(multi.signals.acceptance_items > 1, goal);
    assert.match(multi.reasons[2], /acceptance:multiple/);
  }
  assert.equal(suggestGateSet({ goal: 'small fix 3.5px', scope: { in: ['src/a.css'] } }).signals.acceptance_items, 1);
  const caps = suggestGateSet({ goal: 'small fix', scope: { in: ['src/a.js'] }, capability_ids: ['CAP-a', 'CAP-b'] });
  assert.equal(caps.gate_set, 'full');
  assert.match(caps.reasons[2], /capability_ids=2/);

  // intensity is not an input: the same wording yields the same suggestion regardless of tier
  const asTiny = suggestGateSet({ goal: 'small fix', scope: { in: ['src/a.js'] }, intensity: 'tiny' });
  const asStrict = suggestGateSet({ goal: 'small fix', scope: { in: ['src/a.js'] }, intensity: 'strict' });
  assert.deepEqual(asTiny, asStrict);
  assert.equal(suggestGateSet().gate_set, 'full');
});

test('P2+b init without --lite/--full stays full; heuristic only advises (returned object + progress), never the ledger', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-lite-hint-'));
  try {
    const dirOf = (id) => path.join(cwd, '.workflow', 'ralph', id);
    const progressOf = (id) => ledgerText(cwd, id);
    const diskOf = (id) => JSON.parse(fs.readFileSync(path.join(dirOf(id), '.state', 'run.json'), 'utf8'));

    // (a) small wording + one file → inferred tiny budget; gate_set stays full, suggestion is advisory
    const smallId = 'task-hint-small';
    const small = initRun({ run_id: smallId, title: 'tip 位置', goal: 'tip bottom 4px 改成 6px', attach_knowledge: false, scope: { in: ['src/tip.css'], out: [] } }, cwd);
    assert.equal(small.gate_set, 'full');
    assert.equal(small.intensity, 'tiny');
    assert.equal(small.budget.max_deliver_loops, INTENSITY_DEFAULTS.tiny.budget.max_deliver_loops);
    assert.equal(small.gate_set_suggestion.gate_set, 'lite');
    assert.equal(small.gate_set_suggestion.applied, false);
    assert.match(small.gate_set_suggestion.hint, /run\.json keeps gate_set=full/);
    const disk = diskOf(smallId);
    assert.equal(disk.gate_set, 'full');
    assert.equal(Object.hasOwn(disk, 'gate_set_suggestion'), false);
    assert.equal(Object.hasOwn(disk, 'intensity_inference'), false);
    assert.equal(Object.hasOwn(disk, 'reuse_suggestions'), false);
    assert.deepEqual(validateRun(loadRun(smallId, cwd)), []);
    assert.equal(loadRun(smallId, cwd).gate_set_suggestion, undefined);
    assert.match(progressOf(smallId), /^- gate_set: full\n- gate_set_suggestion: lite \(advisory; run\.json stays full — explicit --lite only\) reasons=surface:small \(scope\.in=1 concrete file\); architecture:none; acceptance:single$/m);
    // aliases still refused: the suggestion changed nothing in the ledger
    assert.throws(() => setGate(smallId, { gate: 'brief', status: 'PASS', cwd }), /requires gate_set=lite \(current=full\)/);
    // taking the hint = explicit --lite (re-init --force before any gate); no other path flips gate_set
    const taken = initRun({ run_id: smallId, title: 'tip 位置', goal: 'tip bottom 4px 改成 6px', attach_knowledge: false, scope: { in: ['src/tip.css'], out: [] }, gate_set: 'lite', force: true }, cwd);
    assert.equal(taken.gate_set, 'lite');
    assert.equal(taken.budget.max_deliver_loops, LITE_MAX_DELIVER_LOOPS);
    assert.equal(taken.gate_set_suggestion, undefined);
    assert.equal(diskOf(smallId).gate_set, 'lite');
    assert.match(progressOf(smallId), /gate_set: lite \(brief→deliver→close; max_deliver_loops=3\)/);
    assert.doesNotMatch(
      fs.readFileSync(path.join(dirOf(smallId), 'progress.md'), 'utf8'),
      /gate_set_suggestion/
    );

    // (b) intensity ⟂ gate_set: tiny never flips gate_set and never feeds the heuristic
    const tinyArch = initRun({ run_id: 'task-hint-tiny-arch', title: '重构鉴权', goal: '重构鉴权协议', attach_knowledge: false, intensity: 'tiny' }, cwd);
    assert.equal(tinyArch.gate_set, 'full');
    assert.equal(tinyArch.gate_set_suggestion.gate_set, 'full');
    assert.match(tinyArch.gate_set_suggestion.reasons.join(';'), /architecture:重构,鉴权,协议/);
    assert.doesNotMatch(progressOf('task-hint-tiny-arch'), /gate_set_suggestion/);
    const tinySmall = initRun({ run_id: 'task-hint-tiny-small', title: 'tiny', goal: 'small fix', attach_knowledge: false, intensity: 'tiny', scope: { in: ['src/a.js'], out: [] } }, cwd);
    assert.equal(tinySmall.gate_set, 'full');
    assert.equal(tinySmall.intensity, 'tiny');
    assert.equal(tinySmall.budget.max_deliver_loops, INTENSITY_DEFAULTS.tiny.budget.max_deliver_loops);
    assert.equal(tinySmall.gate_set_suggestion.gate_set, 'lite');
    assert.equal(diskOf('task-hint-tiny-small').gate_set, 'full');
    const strictSmall = initRun({ run_id: 'task-hint-strict-small', title: 'strict', goal: 'small fix', attach_knowledge: false, intensity: 'strict', scope: { in: ['src/a.js'], out: [] } }, cwd);
    assert.deepEqual(strictSmall.gate_set_suggestion.signals, tinySmall.gate_set_suggestion.signals);
    assert.equal(strictSmall.gate_set, 'full');

    // (c) 拿不准 → full suggestion, no progress line
    const unknown = initRun({ run_id: 'task-hint-unknown', title: '登录提醒', goal: '登录后密码过期要提示', attach_knowledge: false }, cwd);
    assert.equal(unknown.gate_set, 'full');
    assert.equal(unknown.gate_set_suggestion.gate_set, 'full');
    assert.equal(unknown.gate_set_suggestion.signals.surface, 'unknown');
    assert.doesNotMatch(progressOf('task-hint-unknown'), /gate_set_suggestion/);

    // (d) explicit flag = user decided: no suggestion at all
    const explicitFull = initRun({ run_id: 'task-hint-full', title: 'tip 位置', goal: 'tip bottom 4px 改成 6px', attach_knowledge: false, scope: { in: ['src/tip.css'], out: [] }, gate_set: 'full' }, cwd);
    assert.equal(explicitFull.gate_set, 'full');
    assert.equal(explicitFull.gate_set_suggestion, undefined);
    assert.doesNotMatch(progressOf('task-hint-full'), /gate_set_suggestion/);
    const explicitLite = initRun({ run_id: 'task-hint-lite', title: '大改', goal: '重构鉴权协议', attach_knowledge: false, gate_set: 'lite' }, cwd);
    assert.equal(explicitLite.gate_set, 'lite');
    assert.equal(explicitLite.gate_set_suggestion, undefined);

    // (e) CLI text / --json / --full
    const chunks = [];
    const stdout = { write: (text) => chunks.push(text) };
    assert.equal(runCli(['ralph', 'init', '--run-id', 'task-hint-cli', '--title', 'cli tip', '--goal', 'tip bottom 4px 改成 6px', '--in', 'src/tip.css', '--no-knowledge-refs'], { cwd, stdout }), 0);
    assert.match(chunks.join(''), /^initialized task-hint-cli\n/);
    assert.doesNotMatch(chunks.join(''), /gate_set\?/);
    assert.match(chunks.join(''), /^intensity: tiny$/m);
    assert.equal(loadRun('task-hint-cli', cwd).gate_set, 'full');
    chunks.length = 0;
    assert.equal(runCli(['ralph', 'init', '--run-id', 'task-hint-cli-json', '--title', 'cli tip json', '--goal', 'tip bottom 4px 改成 6px', '--in', 'src/tip.css', '--no-knowledge-refs', '--json'], { cwd, stdout }), 0);
    const jsonRun = JSON.parse(chunks.join('')).run;
    assert.equal(jsonRun.gate_set, 'full');
    assert.equal(jsonRun.gate_set_suggestion.gate_set, 'lite');
    assert.equal(jsonRun.gate_set_suggestion.applied, false);
    assert.equal(diskOf('task-hint-cli-json').gate_set, 'full');
    chunks.length = 0;
    assert.equal(runCli(['ralph', 'init', '--run-id', 'task-hint-cli-full', '--title', 'cli tip full', '--goal', 'tip bottom 4px 改成 6px', '--in', 'src/tip.css', '--no-knowledge-refs', '--full'], { cwd, stdout }), 0);
    assert.match(chunks.join(''), /^initialized task-hint-cli-full\n/);
    assert.doesNotMatch(chunks.join(''), /gate_set\?/);
    chunks.length = 0;
    assert.equal(runCli(['ralph', 'init', '--run-id', 'task-hint-cli-unknown', '--title', 'cli 登录提醒', '--goal', '登录后密码过期要提示', '--no-knowledge-refs'], { cwd, stdout }), 0);
    assert.match(chunks.join(''), /^initialized task-hint-cli-unknown\n/);
    assert.doesNotMatch(chunks.join(''), /gate_set\?/);
    assert.equal(loadRun('task-hint-cli-unknown', cwd).gate_set, 'full');

    // (f) ralph_ops passes the advisory through; run.json stays full
    const ops = path.join(root, 'skills/jj-ralph/scripts/ralph_ops.mjs');
    const runNode = (args) => {
      const result = spawnSync(process.execPath, [ops, ...args, '--cwd', cwd], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      return JSON.parse(result.stdout);
    };
    const opsHint = runNode(['init', '--run-id', 'task-hint-ops', '--title', 'tip 位置', '--goal', 'tip bottom 4px 改成 6px', '--in', 'src/tip.css', '--project', 'ops-hint-proj']);
    assert.equal(opsHint.gate_set, 'full');
    assert.equal(opsHint.intensity, 'tiny');
    assert.equal(opsHint.max_deliver_loops, INTENSITY_DEFAULTS.tiny.budget.max_deliver_loops);
    assert.equal(opsHint.intensity_inference.applied, true);
    assert.equal(opsHint.gate_set_suggestion.gate_set, 'lite');
    assert.equal(opsHint.gate_set_suggestion.applied, false);
    assert.equal(diskOf('task-hint-ops').gate_set, 'full');
    assert.equal(Object.hasOwn(diskOf('task-hint-ops'), 'intensity_inference'), false);
    const opsFull = initRun({ run_id: 'task-hint-ops-full', title: 'tip 位置', goal: 'tip bottom 4px 改成 6px', scope: { in: ['src/tip.css'], out: [] }, gate_set: 'full', project: 'ops-hint-proj', attach_knowledge: false }, cwd);
    assert.equal(opsFull.gate_set, 'full');
    assert.equal(opsFull.gate_set_suggestion, undefined);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
