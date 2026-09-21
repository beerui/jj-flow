#!/usr/bin/env node
/**
 * snapshot_stale.mjs — mechanical staleness check for a team's team-snapshot.md.
 *
 * The snapshot carries a "staleness stamp": the modification time of every file of the
 * loaded skill (the whole tree, not a known list of directories) at snapshot time,
 * recorded against the host path the skill was actually loaded from.
 * This script re-reads those paths and answers one question with an exit code:
 *
 *   0  fresh        — every stamped file is unchanged and no source file is unaccounted for
 *   1  stale        — a source file changed, appeared or disappeared after the snapshot
 *   2  unverifiable — no snapshot, no parseable stamp, or the stamped skill root is gone
 *   3  usage        — the command itself is wrong; nothing was checked
 *
 * Exit code 2 is deliberately distinct from 1: "cannot tell" is not "changed", and
 * collapsing the two would make a missing stamp read as a pass.
 * Exit code 3 is deliberately distinct from 2: a mistyped command is not a snapshot
 * this script failed to read, and 2 sends the reader off to regenerate a stamp.
 * It also emits the stamp itself (`--stamp`), so the mtimes are never hand-written —
 * a fabricated mtime is exactly the kind of ledger lie this product refuses to write.
 *
 * Usage:
 *   node snapshot_stale.mjs --stamp [--skill-root <dir>]      # print a stamp block to paste in
 *   node snapshot_stale.mjs --snapshot <file> [--json]        # check one snapshot
 *   node snapshot_stale.mjs --team-dir <dir> [--json]         # check <dir>/team-snapshot.md
 *
 * `--snapshot` and `--team-dir` are alternatives; the checked file defaults to
 * `<team-dir>/team-snapshot.md`.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const STAMP_INFO = 'stamp';
export const STAMP_HEADER = 'staleness-stamp v1';

/** Exit codes, exported so callers and tests share one vocabulary. */
export const EXIT = { fresh: 0, stale: 1, unverifiable: 2, usage: 3 };

export function defaultSkillRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function toPosix(rel) {
  return rel.split(path.sep).join('/');
}

/**
 * Every source file of a skill, as sorted POSIX-ish relative paths.
 * The walk is the whole tree on purpose: a snapshot that only covered a known
 * list of directories would stop noticing a file added anywhere else, and the
 * "added" case is the one an mtime comparison cannot see at all.
 * Sorted so the stamp block is byte-stable between runs on an unchanged skill.
 */
export function skillSourceFiles(skillRoot) {
  const found = [];
  const walk = (abs, rel) => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absChild = path.join(abs, entry.name);
      const relChild = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name === '__pycache__' || entry.name === 'node_modules') continue;
        walk(absChild, relChild);
      } else if (entry.isFile()) {
        found.push(relChild);
      }
    }
  };
  walk(skillRoot, '');
  return found.sort();
}

/** mtime of a file as an ISO string, or null when it cannot be read. Injectable for tests. */
export function makeStatMtime(fsLike = fs) {
  return (abs) => {
    try {
      return fsLike.statSync(abs).mtime.toISOString();
    } catch {
      return null;
    }
  }
}

/**
 * Build the stamp block for a skill root. `now` is injectable so output is testable.
 * Returns `{ block, files }` where files is `[{path, mtime}]`. The block is emitted
 * fenced, so what this returns is pasteable into the snapshot as-is.
 *
 * A file whose mtime cannot be read throws, naming that file. Emitting it with an
 * empty mtime column instead would produce a block `parseStamp` rejects wholesale,
 * and the reader would be told "no parseable stamp" — pointing at the stamp's
 * author when the actual cause is one unreadable file.
 */
export function buildStamp({ skillRoot, statMtime = makeStatMtime(), now = () => new Date().toISOString() }) {
  const files = skillSourceFiles(skillRoot).map((rel) => ({ path: rel, mtime: statMtime(path.join(skillRoot, rel)) }));
  for (const file of files) {
    if (!file.mtime) throw new Error(`cannot stamp ${file.path}: no readable mtime under ${skillRoot}`);
  }
  const lines = [STAMP_HEADER, `skill_root: ${skillRoot}`, `generated_at: ${now()}`];
  for (const file of files) lines.push(`${file.path}\t${file.mtime}`);
  return { block: ['```' + STAMP_INFO, ...lines, '```'].join('\n'), files };
}

/**
 * The one shape a stamped date may take: exactly what this script emits.
 *
 * `Date.parse` accepts much more than that — a local-time stamp with no `Z`, a date
 * with no milliseconds, a space-separated date, an epoch number — and a value it
 * cannot parse at all is `NaN`, against which every comparison is false. "Not newer"
 * is the `ok` branch, so an unvalidated mtime column does not fail loudly; it reads
 * as unchanged and the snapshot comes back fresh. Round-tripping through
 * `toISOString` is the whole check: anything this script did not write is a defect
 * to report, never a value to compare.
 */
function isEmittedIso(value) {
  if (typeof value !== 'string' || value === '') return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  return new Date(parsed).toISOString() === value;
}

/**
 * Read a stamp block out of a markdown document and say why it could not be read.
 * Returns `{ stamp, defect }` — exactly one is non-null. `defect` names the field, so
 * a reader is told which part of the stamp is wrong instead of "no parseable stamp",
 * which points at the stamp's author when the cause is one hand-edited column.
 *
 * Every value that leaves this function has been validated. That is the property the
 * check depends on: `checkSnapshot` compares what it reads, so anything unvalidated
 * here reaches a comparison there, and a malformed value that reaches a comparison
 * turns into a verdict rather than into "cannot tell".
 */
function readStamp(markdown) {
  const lines = String(markdown).split('\n');
  const fence = `\`\`\`${STAMP_INFO}`;
  const starts = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === fence) starts.push(i + 1);
  }
  if (starts.length === 0) return { stamp: null, defect: 'no parseable staleness stamp' };
  if (starts.length > 1) return { stamp: null, defect: 'more than one staleness stamp' };
  const start = starts[0];
  const body = [];
  for (let i = start; i < lines.length; i += 1) {
    if (lines[i].trim().startsWith('```')) break;
    body.push(lines[i]);
  }
  const trimmed = body.filter((line) => line.trim() !== '');
  if (trimmed.length === 0 || trimmed[0].trim() !== STAMP_HEADER) {
    return { stamp: null, defect: 'no parseable staleness stamp' };
  }
  const stamp = { skill_root: null, generated_at: null, files: new Map() };
  for (const line of trimmed.slice(1)) {
    const header = /^(skill_root|generated_at):\s*(.*)$/.exec(line.trim());
    if (header) {
      stamp[header[1]] = header[2].trim();
      continue;
    }
    // Separator is a tab; 2+ spaces are accepted because a hand-typed stamp
    // may lose the tab. A single space is not a separator (paths can contain them).
    const parts = line.includes('\t') ? line.split('\t') : line.split(/ {2,}/);
    if (parts.length < 2) {
      return { stamp: null, defect: `a stamp line is not "<path><TAB><mtime>": ${line.trim()}` };
    }
    const rel = parts[0].trim();
    const mtime = parts.slice(1).join(' ').trim();
    if (!rel) return { stamp: null, defect: `a stamp line has no path: ${line.trim()}` };
    if (!isEmittedIso(mtime)) {
      return {
        stamp: null,
        defect: `the stamped mtime for ${rel} is not the ISO-8601 this script emits (with Z): ${mtime}`
      };
    }
    stamp.files.set(rel, mtime);
  }
  if (!stamp.skill_root) return { stamp: null, defect: 'the stamp has no skill_root' };
  if (!isEmittedIso(stamp.generated_at)) {
    return {
      stamp: null,
      defect: `generated_at is not the ISO-8601 this script emits (with Z): ${stamp.generated_at}`
    };
  }
  return { stamp, defect: null };
}

/**
 * Parse a stamp block out of a markdown document. Returns null when there is no
 * ```stamp fence — that is the "unverifiable" case, not an empty stamp.
 * A fence whose header is not STAMP_HEADER also returns null: a format this
 * script cannot read must not be silently treated as "nothing to check".
 *
 * More than one stamp fence also returns null. Taking the first block would
 * report a difference that a later, appended block has already accounted for,
 * forever, and taking the last would read a snapshot as fresh against a stamp
 * nobody verified. Either way the file cannot be checked as written, and the
 * fix is the same: replace the block, do not append to it.
 *
 * A stamp whose dates are not the ones this script emits also returns null. That
 * is not pedantry: `checkSnapshot` compares every value read out of the stamp, so
 * an unvalidated column that reaches a comparison turns a typo into a verdict —
 * and `Date.parse` on a non-date is `NaN`, against which "not newer" looks exactly
 * like "unchanged". `readStamp` is the single place that validates, and it also
 * reports which field failed.
 */
export function parseStamp(markdown) {
  return readStamp(markdown).stamp;
}

/**
 * Compare a snapshot's stamp against the skill root it names.
 * Returns `{ status, entries, reason }`; entries is `[{path, verdict, stamped, current}]`.
 * verdict is one of `ok | newer | missing | added`.
 */
export function checkSnapshot({ snapshotPath, statMtime = makeStatMtime() }) {
  let text;
  try {
    text = fs.readFileSync(snapshotPath, 'utf8');
  } catch {
    return { status: 'unverifiable', entries: [], reason: `snapshot not readable: ${snapshotPath}` };
  }
  const { stamp, defect } = readStamp(text);
  if (!stamp) {
    const suffix = defect === 'more than one staleness stamp'
      ? ': replace the stamp block, do not append to it'
      : '';
    return { status: 'unverifiable', entries: [], reason: `${defect} in ${snapshotPath}${suffix}` };
  }
  const root = stamp.skill_root;
  // `existsSync` answers true for a file, and a file reaches `readdirSync` below as a
  // bare ENOTDIR — a stack trace and, uncaught, exit 1, which every caller reads as
  // "stale" and acts on by regenerating. The truth is that this stamp does not point
  // at a skill root, so no verdict was reached and none may be reported.
  let rootStat = null;
  try {
    rootStat = fs.statSync(root);
  } catch {
    rootStat = null;
  }
  if (rootStat === null) {
    return { status: 'unverifiable', entries: [], reason: `stamped skill root is gone: ${root}` };
  }
  if (!rootStat.isDirectory()) {
    return { status: 'unverifiable', entries: [], reason: `stamped skill root is not a directory: ${root}` };
  }
  const entries = [];
  for (const [rel, stamped] of stamp.files) {
    const current = statMtime(path.join(root, rel));
    if (current === null) entries.push({ path: rel, verdict: 'missing', stamped, current: null });
    else if (Date.parse(current) > Date.parse(stamped)) entries.push({ path: rel, verdict: 'newer', stamped, current });
    else entries.push({ path: rel, verdict: 'ok', stamped, current });
  }
  for (const rel of skillSourceFiles(root)) {
    if (!stamp.files.has(rel)) entries.push({ path: rel, verdict: 'added', stamped: null, current: statMtime(path.join(root, rel)) });
  }
  const bad = entries.filter((entry) => entry.verdict !== 'ok');
  if (bad.length === 0) return { status: 'fresh', entries, reason: null };
  return { status: 'stale', entries, reason: null };
}

export function parseArgs(argv) {
  const out = { stamp: false, snapshot: null, teamDir: null, skillRoot: defaultSkillRoot(), skillRootGiven: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--stamp') out.stamp = true;
    else if (arg === '--json') out.json = true;
    else if (arg === '--snapshot' || arg === '--team-dir' || arg === '--skill-root') {
      // A flag with its value missing is a mistyped command, not a missing snapshot.
      // Silently keeping null would fall through to "nothing to check", which is the
      // wrong diagnosis and, worse, the same message for a different mistake.
      const wants = { '--snapshot': 'a file', '--team-dir': 'a directory', '--skill-root': 'a directory' }[arg];
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`${arg} requires ${wants}`);
      i += 1;
      if (arg === '--snapshot') out.snapshot = value;
      else if (arg === '--team-dir') out.teamDir = value;
      else { out.skillRoot = value; out.skillRootGiven = true; }
    }
    else if (arg === '--help' || arg === '-h') out.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  // Combinations that cannot do what they look like. Each of these used to exit 0
  // with nothing checked: `--stamp` wins and no snapshot is ever read, or `--team-dir`
  // silently replaces the `--snapshot` value below. Exit 0 is the one code a caller
  // acts on, so a command that checks nothing must not be able to produce it.
  if (out.stamp && (out.snapshot !== null || out.teamDir !== null)) {
    throw new Error('--stamp prints a stamp and checks nothing: it cannot be combined with --snapshot or --team-dir');
  }
  if (out.snapshot !== null && out.teamDir !== null) {
    throw new Error('--snapshot and --team-dir are alternatives: pass one of them, not both');
  }
  // One rule, not one `if` per target flag. `--skill-root` is read by the `--stamp`
  // branch and by nothing else: a check resolves its root from the stamp's own
  // `skill_root:` line, so a root passed alongside a check target is dropped on the
  // floor and the verdict that comes back describes the skill copy the stamp names —
  // never the tree the caller named. "Fresh about a root nobody checked" is the most
  // expensive kind of exit 0. The rule is about which branch reads the flag, so it
  // covers `--snapshot`, `--team-dir` and a bare `--skill-root` at once, and it holds
  // when the next target flag is added.
  if (out.skillRootGiven && !out.stamp) {
    throw new Error('--skill-root only tells --stamp where to read: it must be passed together with --stamp');
  }
  if (!out.snapshot && out.teamDir) out.snapshot = path.join(out.teamDir, 'team-snapshot.md');
  return out;
}

function report(result, { snapshotPath, json }) {
  if (json) {
    process.stdout.write(`${JSON.stringify({ ...result, snapshot: snapshotPath }, null, 2)}\n`);
    return;
  }
  if (result.status === 'fresh') {
    process.stdout.write(`snapshot fresh: ${snapshotPath} (${result.entries.length} stamped files match)\n`);
    return;
  }
  if (result.status === 'unverifiable') {
    process.stderr.write(`snapshot unverifiable: ${result.reason}\n`);
    // Same next step as the stale branch, and for the same reason: both outcomes
    // leave the reader with a stamp to replace, and a reason alone is not an action.
    process.stderr.write('regenerate the snapshot: run this script with --stamp and replace the stamp block\n');
    return;
  }
  for (const entry of result.entries) {
    if (entry.verdict === 'ok') continue;
    if (entry.verdict === 'newer') {
      process.stderr.write(`stale: ${entry.path} changed after the snapshot (stamped ${entry.stamped}, now ${entry.current})\n`);
    } else if (entry.verdict === 'missing') {
      process.stderr.write(`stale: ${entry.path} was stamped but no longer exists under the skill root\n`);
    } else {
      process.stderr.write(`stale: ${entry.path} exists under the skill root but is not in the stamp (${entry.current})\n`);
    }
  }
  process.stderr.write('regenerate the snapshot: run this script with --stamp and replace the stamp block\n');
}

/** Entry point. Returns the process exit code so tests can call it in-process. */
export function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    // A usage error is neither "the snapshot is stale" nor "this snapshot cannot be
    // checked". It gets its own code so a caller never mistakes a typo for a verdict.
    process.stderr.write(`usage: ${error.message}\n`);
    return EXIT.usage;
  }
  if (args.help) {
    process.stdout.write('usage: snapshot_stale.mjs [--stamp] [--snapshot <file>|--team-dir <dir>] [--skill-root <dir>] [--json]\n');
    return EXIT.fresh;
  }
  if (args.stamp) {
    let block;
    try {
      block = buildStamp({ skillRoot: args.skillRoot }).block;
    } catch (error) {
      // No stamp was produced, so any snapshot read against it is unverifiable —
      // but the message must not read as a snapshot this script failed to parse.
      process.stderr.write(`stamp failed: ${error.message}\n`);
      return EXIT.unverifiable;
    }
    process.stdout.write(`${block}\n`);
    return EXIT.fresh;
  }
  if (!args.snapshot) {
    process.stderr.write('usage: nothing to check: pass --snapshot <file> or --team-dir <dir>\n');
    return EXIT.usage;
  }
  let result;
  try {
    result = checkSnapshot({ snapshotPath: args.snapshot });
  } catch (error) {
    // A check that could not run is not a verdict. Uncaught, an unexpected throw
    // escapes as a stack trace and exit 1 — which every caller reads as "stale" and
    // answers by regenerating a snapshot that was never compared against anything.
    // The known causes are guarded inside checkSnapshot; this is the belt for the
    // ones nobody predicted, and it must never be able to report 1.
    process.stderr.write(`check failed: ${error.message}\n`);
    return EXIT.unverifiable;
  }
  report(result, { snapshotPath: args.snapshot, json: args.json });
  return EXIT[result.status];
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv.slice(2)));
}
