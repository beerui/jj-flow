// ① team-session.json 不变量校验器 — 正反 fixture。
// 每条不变量一个类级测试（同一测试内放正反两面）：这样一次变异只会让一个测试红，
// 「全文件只有 1 条 not ok」才证明得了红的是被点名的那条断言，不是顺带。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  EXIT,
  EXCLUDED_KEYS,
  SESSION_SCHEMA_VERSION,
  TASK_STATUSES,
  loadTeamSession,
  main,
  report,
  validateTeamSession,
} from '../src/teamSession.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(REPO, 'src', 'teamSession.mjs');

function lane(lane_id, unblocked, extra = {}) {
  return { lane_id, description: `lane ${lane_id}`, unblocked, owner: unblocked ? 'implementer-1' : null, files: [`src/${lane_id}.mjs`], ...extra };
}

function excluded(overrides = {}) {
  const base = {
    substantively_complete: 3,
    blocked_on_decision: 0,
    blocked_on_live_host: 2,
    owner_is_team_lead: 2,
    optional_only: 0,
  };
  return { ...base, ...overrides };
}

/**
 * A legal session. `parallelism` mirrors the shape R-5 measured as violated
 * (four lanes, all unblocked, measured reading 3) but with the count corrected,
 * and `tasks[]` mirrors a legal ledger's status distribution — five landed, five
 * done, one in_progress, one `closed_at` written date-only. Content is synthetic:
 * the point is the shape, and a product-repo test must not carry a session's
 * actual task list.
 */
function legalSession(overrides = {}) {
  return {
    schema_version: SESSION_SCHEMA_VERSION,
    team_id: 'TEAM-jj-flow-20260918',
    project_key: 'jj-flow',
    project_path: REPO,
    task_description: 'fixture',
    status: 'active',
    skill_id: 'jj-team',
    parallelism: {
      measured: 4,
      measured_at: '2026-09-21T01:59:19Z',
      lanes: [lane('lane-1', true), lane('lane-2', true), lane('lane-3', true), lane('lane-4', true)],
      excluded: excluded(),
      note: 'prose, not validated',
    },
    roles: [{ name: 'team-lead', role: 'control-plane' }],
    tasks: [
      ...['T-1', 'T-2', 'T-3', 'T-4', 'T-5'].map((id) => ({ task_id: id, description: id, status: 'landed', created_at: '2026-09-18', closed_at: '2026-09-18' })),
      ...['T-6', 'T-7', 'T-8', 'T-9', 'T-10'].map((id) => ({ task_id: id, description: id, status: 'done', created_at: '2026-09-18', closed_at: '2026-09-18T02:00:00Z' })),
      { task_id: 'T-11', description: 'in flight', status: 'in_progress', created_at: '2026-09-18', closed_at: null },
    ],
    ...overrides,
  };
}

/** Assert one rule fired, alone, with its path — the named-assertion discipline. */
function assertOnlyViolation(result, rule, at) {
  assert.equal(result.ok, false, 'expected a violation');
  assert.equal(result.violations.length, 1, `expected exactly one violation, got:\n${report(result)}`);
  assert.equal(result.violations[0].rule, rule);
  if (at) assert.equal(result.violations[0].path, at);
}

// ---------------------------------------------------------------- measured ---

test('measured must equal the number of unblocked lanes', () => {
  // positive: the count is read off the lanes, whatever the mix
  for (const [measured, flags] of [[4, [true, true, true, true]], [0, [false, false, false, false]], [2, [true, false, true, false]], [1, [true, false, false, false]]]) {
    const session = legalSession();
    session.parallelism.measured = measured;
    session.parallelism.lanes = flags.map((f, i) => lane(`lane-${i + 1}`, f));
    const result = validateTeamSession(session);
    assert.equal(result.ok, true, `measured=${measured} over ${flags.filter(Boolean).length} unblocked lanes must be legal:\n${report(result)}`);
    assert.equal(result.violations.length, 0);
  }

  // negative: the exact shape R-5 measured on the live ledger — measured=3 while
  // four lanes all claim unblocked. state-layout.md:90.
  const drifted = legalSession();
  drifted.parallelism.measured = 3;
  assertOnlyViolation(validateTeamSession(drifted), 'measured-not-equal-unblocked-lanes', '$.parallelism.measured');

  // negative: too high
  const tooHigh = legalSession();
  tooHigh.parallelism.measured = 5;
  assertOnlyViolation(validateTeamSession(tooHigh), 'measured-not-equal-unblocked-lanes', '$.parallelism.measured');

  // negative: blocked lanes do not count
  const blocked = legalSession();
  blocked.parallelism.lanes[3].unblocked = false;
  assertOnlyViolation(validateTeamSession(blocked), 'measured-not-equal-unblocked-lanes', '$.parallelism.measured');

  // negative: an empty lane list is not a measurement of zero concurrency
  const noLanes = legalSession();
  noLanes.parallelism.lanes = [];
  noLanes.parallelism.measured = 4;
  assertOnlyViolation(validateTeamSession(noLanes), 'measured-not-equal-unblocked-lanes', '$.parallelism.measured');
});

// ------------------------------------------------------------------ tasks ---

test('tasks carry a legal status and a closed_at that matches it', () => {
  // positive: the legal live shape — 5 landed / 5 done / 1 in_progress, with one
  // closed_at written date-only. R-5 measured 0 violations here; that must hold.
  const legal = validateTeamSession(legalSession());
  assert.equal(legal.ok, true, `the legal task shape must not be flagged:\n${report(legal)}`);

  // positive: in_progress may omit closed_at entirely as well as carry null
  const omitted = legalSession();
  omitted.tasks = [{ task_id: 'T-11', description: 'x', status: 'in_progress', created_at: '2026-09-18' }];
  assert.equal(validateTeamSession(omitted).ok, true);

  // negative: landed with no closed_at — state-layout.md:92
  const landedOpen = legalSession();
  landedOpen.tasks = [{ task_id: 'T-1', description: 'x', status: 'landed', created_at: '2026-09-18', closed_at: null }];
  assertOnlyViolation(validateTeamSession(landedOpen), 'task-closed-at-missing', '$.tasks[0].closed_at');

  // negative: done with the field absent
  const doneAbsent = legalSession();
  doneAbsent.tasks = [{ task_id: 'T-1', description: 'x', status: 'done', created_at: '2026-09-18' }];
  assertOnlyViolation(validateTeamSession(doneAbsent), 'task-closed-at-missing', '$.tasks[0].closed_at');

  // negative: in_progress carrying a closed_at
  const closedInFlight = legalSession();
  closedInFlight.tasks = [{ task_id: 'T-1', description: 'x', status: 'in_progress', created_at: '2026-09-18', closed_at: '2026-09-18T00:00:00Z' }];
  assertOnlyViolation(validateTeamSession(closedInFlight), 'task-closed-at-not-null', '$.tasks[0].closed_at');

  // negative: a status outside the enum
  const alien = legalSession();
  alien.tasks = [{ task_id: 'T-1', description: 'x', status: 'completed', created_at: '2026-09-18', closed_at: '2026-09-18' }];
  assertOnlyViolation(validateTeamSession(alien), 'task-status-not-in-enum', '$.tasks[0].status');

  // negative: no status at all
  const noStatus = legalSession();
  noStatus.tasks = [{ task_id: 'T-1', description: 'x', created_at: '2026-09-18', closed_at: null }];
  assertOnlyViolation(validateTeamSession(noStatus), 'task-status-missing', '$.tasks[0].status');

  // negative: the violation names the offending task, and a second bad task is
  // reported too — a validator that stops at the first would under-report.
  const two = legalSession();
  two.tasks = [
    { task_id: 'T-1', description: 'x', status: 'landed', created_at: '2026-09-18', closed_at: null },
    { task_id: 'T-2', description: 'x', status: 'bogus', created_at: '2026-09-18', closed_at: null },
  ];
  const both = validateTeamSession(two);
  assert.equal(both.violations.length, 2);
  assert.deepEqual(both.violations.map((v) => v.rule), ['task-closed-at-missing', 'task-status-not-in-enum']);
  assert.match(both.violations[0].message, /T-1/);
  assert.match(both.violations[1].message, /T-2/);
});

// --------------------------------------------------------------- excluded ---

test('excluded carries the five reason keys and no sixth', () => {
  // positive
  assert.equal(validateTeamSession(legalSession()).ok, true);

  // negative: one reason key missing — state-layout.md:90
  const short = legalSession();
  delete short.parallelism.excluded.blocked_on_live_host;
  const result = validateTeamSession(short);
  assertOnlyViolation(result, 'excluded-keys-missing', '$.parallelism.excluded');
  assert.match(result.violations[0].message, /blocked_on_live_host/);

  // negative: a sixth reason nobody defined
  const extra = legalSession();
  extra.parallelism.excluded.blocked_on_weather = 1;
  assertOnlyViolation(validateTeamSession(extra), 'excluded-keys-unknown', '$.parallelism.excluded');

  // negative: missing and unknown together are both reported
  const bothWrong = legalSession();
  delete bothWrong.parallelism.excluded.optional_only;
  bothWrong.parallelism.excluded.blocked_on_weather = 1;
  const bothResult = validateTeamSession(bothWrong);
  assert.deepEqual(bothResult.violations.map((v) => v.rule), ['excluded-keys-missing', 'excluded-keys-unknown']);

  // the key list itself is the spec's, in the spec's own terms
  assert.deepEqual([...EXCLUDED_KEYS].sort(), [
    'blocked_on_decision', 'blocked_on_live_host', 'optional_only', 'owner_is_team_lead', 'substantively_complete',
  ]);
  assert.deepEqual(TASK_STATUSES, ['in_progress', 'landed', 'done']);
});

// --------------------------------------------------------------- structure ---

test('shape is checked before it is compared, and a bad shape never crashes', () => {
  const notAnObject = [null, [], 'team-session', 42, true];
  for (const value of notAnObject) {
    const result = validateTeamSession(value);
    assert.equal(result.ok, false);
    assert.equal(result.violations.length, 1);
    assert.equal(result.violations[0].rule, 'session-not-an-object');
  }

  // parallelism / lanes / tasks / excluded: absent or wrong-typed each get their
  // own rule, so a caller can tell "field missing" from "field is a string".
  const cases = [
    ['parallelism', 'parallelism-missing', '$.parallelism'],
    ['lanes', 'lanes-missing', '$.parallelism.lanes'],
    ['measured', 'measured-missing', '$.parallelism.measured'],
    ['excluded', 'excluded-missing', '$.parallelism.excluded'],
    ['tasks', 'tasks-missing', '$.tasks'],
  ];
  for (const [field, rule, at] of cases) {
    const session = legalSession();
    if (field === 'lanes' || field === 'measured' || field === 'excluded') delete session.parallelism[field];
    else delete session[field];
    assertOnlyViolation(validateTeamSession(session), rule, at);
  }

  // wrong type: the count comparison must not run against a non-array
  const lanesWrongType = legalSession();
  lanesWrongType.parallelism.lanes = 'four';
  assertOnlyViolation(validateTeamSession(lanesWrongType), 'lanes-not-an-array', '$.parallelism.lanes');

  const parallelismWrongType = legalSession();
  parallelismWrongType.parallelism = [];
  assertOnlyViolation(validateTeamSession(parallelismWrongType), 'parallelism-not-an-object', '$.parallelism');

  const tasksWrongType = legalSession();
  tasksWrongType.tasks = {};
  assertOnlyViolation(validateTeamSession(tasksWrongType), 'tasks-not-an-array', '$.tasks');

  const excludedWrongType = legalSession();
  excludedWrongType.parallelism.excluded = null;
  assertOnlyViolation(validateTeamSession(excludedWrongType), 'excluded-not-an-object', '$.parallelism.excluded');

  const measuredWrongType = legalSession();
  measuredWrongType.parallelism.measured = '4';
  assertOnlyViolation(validateTeamSession(measuredWrongType), 'measured-not-an-integer', '$.parallelism.measured');

  const measuredNegative = legalSession();
  measuredNegative.parallelism.measured = -1;
  assertOnlyViolation(validateTeamSession(measuredNegative), 'measured-negative', '$.parallelism.measured');

  const laneWrongType = legalSession();
  laneWrongType.parallelism.lanes[1] = 'lane-2';
  // the broken lane drops the unblocked count to 3, so measured is corrected with
  // it — otherwise the count rule fires too and this assertion is not about one thing.
  laneWrongType.parallelism.measured = 3;
  assertOnlyViolation(validateTeamSession(laneWrongType), 'lane-not-an-object', '$.parallelism.lanes[1]');

  const taskWrongType = legalSession();
  taskWrongType.tasks[0] = null;
  assertOnlyViolation(validateTeamSession(taskWrongType), 'task-not-an-object', '$.tasks[0]');
});

test('a non-boolean unblocked is reported and left out of the count', () => {
  // A string "true" must not be able to satisfy the measurement by accident. With
  // measured set to the three real booleans, only the type violation fires — had
  // the string been counted as unblocked, the count rule would fire instead (3 vs 4).
  // (The interaction with the count rule is asserted in the measured test, where it
  // belongs, so that switching off either guard turns exactly one test red.)
  const session = legalSession();
  session.parallelism.lanes[0].unblocked = 'true';
  session.parallelism.measured = 3;
  const result = validateTeamSession(session);
  assert.equal(result.ok, false);
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].rule, 'lane-unblocked-not-boolean');
  assert.equal(result.violations[0].path, '$.parallelism.lanes[0].unblocked');
  assert.equal(result.violations[0].expected, 'boolean');
});

// ------------------------------------------------------------------- file ---

test('loadTeamSession reads a file and refuses anything that is not a session', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-session-'));
  try {
    const good = path.join(dir, 'team-session.json');
    fs.writeFileSync(good, JSON.stringify(legalSession()));
    assert.equal(loadTeamSession(good).team_id, 'TEAM-jj-flow-20260918');

    const bad = path.join(dir, 'bad.json');
    fs.writeFileSync(bad, '{ not json');
    assert.throws(() => loadTeamSession(bad), /is not JSON/);

    assert.throws(() => loadTeamSession(path.join(dir, 'nope.json')), /cannot read/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------------- cli ---

/**
 * A session that breaks several invariants at once, on purpose. The CLI test only
 * claims "a violating session exits 1", so its fixture must stay violating when any
 * single guard is switched off — otherwise a mutation aimed at one invariant would
 * turn this test red as collateral and the "exactly one not ok" proof for that
 * mutation would be about two tests, not one.
 */
function brokenSession() {
  const session = legalSession();
  session.parallelism.measured = 3;                 // count rule
  delete session.parallelism.excluded.optional_only; // excluded rule
  session.tasks[0].closed_at = null;                 // task rule
  return session;
}

/** Capture what the CLI writes to stderr, so a misuse reason can be asserted. */
function captureStderr() {
  const original = process.stderr.write.bind(process.stderr);
  const chunks = [];
  process.stderr.write = (chunk, ...rest) => {
    chunks.push(String(chunk));
    return true;
  };
  return {
    text: () => chunks.join(''),
    restore: () => {
      process.stderr.write = original;
    },
  };
}

test('the CLI separates valid, invalid and misuse', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-session-cli-'));
  try {
    const good = path.join(dir, 'good.json');
    fs.writeFileSync(good, JSON.stringify(legalSession()));
    const bad = path.join(dir, 'bad.json');
    fs.writeFileSync(bad, JSON.stringify(brokenSession()));

    assert.equal(main([good]), EXIT.valid);
    assert.equal(main([bad]), EXIT.invalid);
    assert.equal(main([]), EXIT.usage);

    // The misuse *reason* has to be the one that fired, not just any non-zero
    // usage exit. M27 (switch off the unknown-flag guard) already exits
    // unreadable rather than usage, so the code alone catches it; what the code
    // cannot tell apart is *which* misuse fired. These assertions pin the reason,
    // so a future edit that reports a different misuse while still exiting
    // usage is caught too.
    const unknownFlag = captureStderr();
    try {
      assert.equal(main(['--nope']), EXIT.usage);
      assert.match(unknownFlag.text(), /unknown flag --nope/);
    } finally {
      unknownFlag.restore();
    }

    const extraArg = captureStderr();
    try {
      assert.equal(main([good, 'extra']), EXIT.usage);
      assert.match(extraArg.text(), /unexpected argument extra/);
    } finally {
      extraArg.restore();
    }

    // --json hands the structured list to a caller instead of prose
    const run = spawnSync(process.execPath, [CLI, bad, '--json'], { cwd: REPO, encoding: 'utf8' });
    assert.equal(run.status, EXIT.invalid);
    const parsed = JSON.parse(run.stdout);
    assert.equal(parsed.ok, false);
    assert.ok(parsed.violations.length >= 1, 'a violating session must list at least one violation');
    assert.ok(parsed.violations.every((v) => typeof v.rule === 'string' && v.rule.length > 0));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an unreadable session file exits unreadable, never valid', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-session-unreadable-'));
  try {
    assert.equal(main([path.join(dir, 'missing.json')]), EXIT.unreadable);
    // Spawned, not called: a thrown-and-swallowed error inside main() would still
    // look like a clean exit code to a direct call, but not to a child process.
    const run = spawnSync(process.execPath, [CLI, path.join(dir, 'missing.json')], { cwd: REPO, encoding: 'utf8' });
    assert.equal(run.status, EXIT.unreadable);
    assert.match(run.stderr, /cannot read/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('report() prints every rule it is handed and never invents one', () => {
  // Hand-built violations, not validator output: this assertion is about the
  // renderer, so it must not go red when an invariant guard is mutated.
  const violations = [
    { rule: 'rule-one', path: '$.parallelism.measured', message: 'count drifted', expected: '4', actual: '3' },
    { rule: 'rule-two', path: '$.tasks[0].closed_at', message: 'landed without closed_at', expected: 'a timestamp', actual: 'null' },
  ];
  const text = report({ ok: false, violations });
  assert.match(text, /2 violation/);
  for (const item of violations) {
    assert.ok(text.includes(`[${item.rule}]`), `report must name ${item.rule}`);
    assert.ok(text.includes(item.path));
    assert.ok(text.includes(item.message));
  }
  assert.match(report({ ok: true, violations: [] }), /valid/);
  assert.equal(report({ ok: false, violations: [] }, { json: true }), JSON.stringify({ ok: false, violations: [] }, null, 2));
  assert.equal(report({ ok: true, violations: [] }, { json: true }), JSON.stringify({ ok: true, violations: [] }, null, 2));
});
