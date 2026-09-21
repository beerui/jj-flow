#!/usr/bin/env node
/**
 * teamSession.mjs — invariant validator for a jj-team `team-session.json`.
 *
 * WHY THIS EXISTS. The jj-team contract tests assert that `specs/state-layout.md`
 * *says* the parallelism rules ("measured equals the unblocked lane count"). They
 * match spec prose, never a ledger, so a live `team-session.json` can violate the
 * spec in every field and every test still passes. This module is the missing half:
 * it reads an actual session object and answers with a list of violations.
 *
 * The live ledger lives in `~/.jj-flow/team/`, which this repo's own
 * `HNS-STATE-001` rule pushes out of the working tree. So the validator is
 * exported from `src/` and exercised from `tests/` against fixtures: the repo
 * tests the checker, and a gate outside the repo points the checker at the real
 * ledger. Neither side drags machine-local state into CI.
 *
 * WHAT IT IS NOT. Not a JSON Schema, and deliberately not a full schema: only the
 * structural shape the invariants need in order to be checkable at all
 * (`parallelism` an object, `lanes[]` an array, `tasks[]` an array, `excluded` an
 * object), plus the invariants themselves. `schema_version` is not policed here —
 * a checker that rejects an unknown version turns every forward-compatible
 * session into a violation, which is a different failure from the one this fixes.
 *
 * The three invariants, each with its spec line in `skills/jj-team/specs/state-layout.md`:
 *   1. `parallelism.measured === lanes.filter(unblocked).length`      — :90
 *   2. `tasks[].status ∈ {in_progress, landed, done}`, with `closed_at`
 *      present for `landed`/`done` and null for `in_progress`           — :92
 *   3. `parallelism.excluded` carries all five reason keys              — :90
 *
 * Usage:
 *   node teamSession.mjs <path-to-team-session.json> [--json]
 *
 * Exit codes:
 *   0  valid      — no violations
 *   1  invalid    — at least one violation; each is printed
 *   2  unreadable — no such file, or not JSON. Distinct from 1 so that a gate
 *                   never reads "could not open the ledger" as "the ledger is
 *                   consistent" — the same reason `snapshot_stale.mjs` keeps
 *                   `unverifiable` apart from `stale`.
 *   3  usage      — the command itself is wrong; nothing was checked
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** The only session schema this validator speaks. */
export const SESSION_SCHEMA_VERSION = 'jj-flow/team-session/1.0';

/** `state-layout.md:92` — `landed` = committed, `done` = finished, nothing to commit. */
export const TASK_STATUSES = ['in_progress', 'landed', 'done'];

/** The statuses whose `closed_at` must be a timestamp rather than null. */
export const CLOSED_STATUSES = ['landed', 'done'];

/**
 * `state-layout.md:90` — `excluded` counts lanes by reason. Five reasons, no more:
 * a sixth key means someone started counting a reason the roster does not know.
 */
export const EXCLUDED_KEYS = [
  'substantively_complete',
  'blocked_on_decision',
  'blocked_on_live_host',
  'owner_is_team_lead',
  'optional_only',
];

/** Exit codes, exported so callers and tests share one vocabulary. */
export const EXIT = { valid: 0, invalid: 1, unreadable: 2, usage: 3 };

/**
 * Read and parse a session file. Throws an Error whose `code` is `ENOENT`-ish for
 * a missing file and `'not-json'` for a parse failure, so `main` can map both to
 * EXIT.unreadable without inspecting messages.
 */
export function loadTeamSession(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`cannot read ${filePath}: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${filePath} is not JSON: ${error.message}`);
  }
}

function violation(rule, path_, message, expected, actual) {
  return { rule, path: path_, message, expected, actual };
}

/**
 * Validate one session object. Returns `{ ok, violations }` — never throws and
 * never returns a bare boolean, because the caller has to be able to say *which*
 * invariant broke, and a boolean is exactly the "assert something" shape that let
 * the spec-prose tests stay green while the ledger drifted.
 *
 * Every field is checked for shape before it is compared: a missing `parallelism`
 * must report "missing", not crash on `.lanes`, and a non-boolean `unblocked`
 * must not be silently counted as blocked.
 */
export function validateTeamSession(session) {
  const violations = [];

  if (session === null || typeof session !== 'object' || Array.isArray(session)) {
    return { ok: false, violations: [violation('session-not-an-object', '$', 'session must be a JSON object', 'object', describe(session))] };
  }

  const parallelism = session.parallelism;
  if (parallelism === undefined) {
    violations.push(violation('parallelism-missing', '$.parallelism', 'parallelism is required', 'object', 'undefined'));
  } else if (parallelism === null || typeof parallelism !== 'object' || Array.isArray(parallelism)) {
    violations.push(violation('parallelism-not-an-object', '$.parallelism', 'parallelism must be an object', 'object', describe(parallelism)));
  } else {
    violations.push(...validateParallelism(parallelism));
  }

  const tasks = session.tasks;
  if (tasks === undefined) {
    violations.push(violation('tasks-missing', '$.tasks', 'tasks is required', 'array', 'undefined'));
  } else if (!Array.isArray(tasks)) {
    violations.push(violation('tasks-not-an-array', '$.tasks', 'tasks must be an array', 'array', describe(tasks)));
  } else {
    tasks.forEach((task, index) => violations.push(...validateTask(task, index)));
  }

  return { ok: violations.length === 0, violations };
}

function validateParallelism(parallelism) {
  const violations = [];

  // --- lanes[] : the evidence `measured` is read off (state-layout.md:90) ---
  const lanes = parallelism.lanes;
  let unblockedCount = null;
  if (lanes === undefined) {
    violations.push(violation('lanes-missing', '$.parallelism.lanes', 'lanes is required — `measured` is read off it', 'array', 'undefined'));
  } else if (!Array.isArray(lanes)) {
    violations.push(violation('lanes-not-an-array', '$.parallelism.lanes', 'lanes must be an array', 'array', describe(lanes)));
  } else {
    lanes.forEach((lane, index) => {
      const at = `$.parallelism.lanes[${index}]`;
      if (lane === null || typeof lane !== 'object' || Array.isArray(lane)) {
        violations.push(violation('lane-not-an-object', at, 'lane must be an object', 'object', describe(lane)));
        return;
      }
      if (typeof lane.unblocked !== 'boolean') {
        // Reported separately AND left out of the count: a string "true" must not
        // be able to satisfy the measurement by accident.
        violations.push(violation('lane-unblocked-not-boolean', `${at}.unblocked`, 'unblocked must be a boolean', 'boolean', describe(lane.unblocked)));
      }
    });
    unblockedCount = lanes.filter((lane) => lane && typeof lane === 'object' && lane.unblocked === true).length;
  }

  // --- measured === unblocked lane count (state-layout.md:90) ---
  const measured = parallelism.measured;
  if (measured === undefined) {
    violations.push(violation('measured-missing', '$.parallelism.measured', 'measured is required', 'number', 'undefined'));
  } else if (typeof measured !== 'number' || !Number.isInteger(measured)) {
    violations.push(violation('measured-not-an-integer', '$.parallelism.measured', 'measured must be an integer', 'integer', describe(measured)));
  } else if (measured < 0) {
    violations.push(violation('measured-negative', '$.parallelism.measured', 'measured cannot be negative', '>= 0', String(measured)));
  } else if (unblockedCount !== null && measured !== unblockedCount) {
    // The invariant R-5 measured as violated: measured=3 against four lanes that
    // were all `unblocked: true`. "A number without the lanes behind it is not a
    // measurement" — the count is the assertion, not the number.
    violations.push(violation(
      'measured-not-equal-unblocked-lanes',
      '$.parallelism.measured',
      `measured (${measured}) is not the number of unblocked lanes (${unblockedCount})`,
      String(unblockedCount),
      String(measured),
    ));
  }

  // --- excluded : five reason keys (state-layout.md:90) ---
  const excluded = parallelism.excluded;
  if (excluded === undefined) {
    violations.push(violation('excluded-missing', '$.parallelism.excluded', 'excluded is required', 'object', 'undefined'));
  } else if (excluded === null || typeof excluded !== 'object' || Array.isArray(excluded)) {
    violations.push(violation('excluded-not-an-object', '$.parallelism.excluded', 'excluded must be an object', 'object', describe(excluded)));
  } else {
    const missing = EXCLUDED_KEYS.filter((key) => excluded[key] === undefined);
    if (missing.length) {
      violations.push(violation(
        'excluded-keys-missing',
        '$.parallelism.excluded',
        `excluded is missing reason keys: ${missing.join(', ')}`,
        EXCLUDED_KEYS.join(', '),
        Object.keys(excluded).join(', ') || '(empty)',
      ));
    }
    const unknown = Object.keys(excluded).filter((key) => !EXCLUDED_KEYS.includes(key));
    if (unknown.length) {
      violations.push(violation(
        'excluded-keys-unknown',
        '$.parallelism.excluded',
        `excluded has keys outside the five reasons: ${unknown.join(', ')}`,
        EXCLUDED_KEYS.join(', '),
        Object.keys(excluded).join(', '),
      ));
    }
  }

  return violations;
}

function validateTask(task, index) {
  const at = `$.tasks[${index}]`;
  if (task === null || typeof task !== 'object' || Array.isArray(task)) {
    return [violation('task-not-an-object', at, 'task must be an object', 'object', describe(task))];
  }
  const violations = [];
  const label = typeof task.task_id === 'string' && task.task_id ? task.task_id : `#${index}`;

  const status = task.status;
  if (status === undefined) {
    violations.push(violation('task-status-missing', `${at}.status`, `task ${label} has no status`, TASK_STATUSES.join(' | '), 'undefined'));
    return violations;
  }
  if (!TASK_STATUSES.includes(status)) {
    violations.push(violation(
      'task-status-not-in-enum',
      `${at}.status`,
      `task ${label} has status ${JSON.stringify(status)}, outside the enum`,
      TASK_STATUSES.join(' | '),
      describe(status),
    ));
    return violations;
  }

  const closedAt = task.closed_at;
  if (CLOSED_STATUSES.includes(status)) {
    // "required" is presence-and-not-null, not a format. Real ledgers carry
    // date-only values ("2026-09-18") alongside full ISO stamps, and the spec
    // pins no format — a format rule here would fail sessions that are valid.
    if (closedAt === undefined || closedAt === null) {
      violations.push(violation(
        'task-closed-at-missing',
        `${at}.closed_at`,
        `task ${label} is ${status} but closed_at is ${closedAt === undefined ? 'absent' : 'null'}`,
        'a timestamp',
        describe(closedAt),
      ));
    }
  } else if (closedAt !== undefined && closedAt !== null) {
    // in_progress with a closed_at is the mirror defect: it reads as finished
    // to anything that treats a non-null closed_at as "this lane is closed".
    violations.push(violation(
      'task-closed-at-not-null',
      `${at}.closed_at`,
      `task ${label} is in_progress but closed_at is set`,
      'null',
      describe(closedAt),
    ));
  }

  return violations;
}

/** Render a value for a violation's `actual` field without ever throwing. */
function describe(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === 'object') return `object(${Object.keys(value).join(', ') || 'empty'})`;
  return typeof value;
}

/** Human-readable report, or the raw result object with `--json`. */
export function report(result, { json = false } = {}) {
  if (json) return JSON.stringify(result, null, 2);
  if (result.ok) return 'team-session: valid';
  const lines = [`team-session: ${result.violations.length} violation(s)`];
  for (const item of result.violations) {
    lines.push(`  [${item.rule}] ${item.path} — ${item.message}`);
  }
  return lines.join('\n');
}

export function main(argv) {
  const args = parseSessionArgs(argv);
  if (args.error) {
    process.stderr.write(`usage: node teamSession.mjs <path-to-team-session.json> [--json]\n  ${args.error}\n`);
    return EXIT.usage;
  }
  let session;
  try {
    session = loadTeamSession(args.file);
  } catch (error) {
    // A gate must not be able to read "could not open the ledger" as a pass.
    process.stderr.write(`team-session: ${error.message}\n`);
    return EXIT.unreadable;
  }
  const result = validateTeamSession(session);
  process.stdout.write(`${report(result, { json: args.json })}\n`);
  return result.ok ? EXIT.valid : EXIT.invalid;
}

/**
 * Parse this checker's own argv. Named for what it is rather than `parseArgs`:
 * the other `parseArgs` in this repo (scripts/lab-check.mjs, the lab overlay)
 * never error, consume `--suite <value>` and have no positional contract — a
 * shared generic name would imply a shared implementation that does not exist.
 *
 * Unknown flags and a second positional are *misuse* (EXIT.usage), not an
 * invalid session: nothing was checked, so the caller must not read this as a
 * verdict about a ledger.
 */
function parseSessionArgs(argv) {
  const args = { file: null, json: false, error: null };
  for (const token of argv) {
    if (token === '--json') args.json = true;
    else if (token === '--help' || token === '-h') args.error = 'no help yet; pass a path';
    else if (token.startsWith('-')) args.error = args.error || `unknown flag ${token}`;
    else if (args.file === null) args.file = token;
    else args.error = args.error || `unexpected argument ${token}`;
  }
  if (!args.error && !args.file) args.error = 'nothing to check: pass a path to a team-session.json';
  return args;
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
