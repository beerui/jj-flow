/**
 * Behavioural tests for the jj-team snapshot staleness checker.
 *
 * The rule it mechanizes: a snapshot whose stamped skill sources have changed,
 * grown or disappeared is stale; a snapshot whose environment fingerprint no longer
 * re-derives is stale; and a snapshot that cannot be checked at all must not read as
 * fresh. Everything is asserted on real files in a temp dir — no module is mocked,
 * because the only dependency here is the filesystem.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CONVENTION_PATHS,
  DERIVED_SIGNALS,
  EXIT,
  FINGERPRINT_HEADER,
  STAMP_HEADER,
  buildFingerprint,
  buildStamp,
  checkFingerprint,
  checkSnapshot,
  parseFingerprint,
  parseStamp,
  skillSourceFiles
} from '../skills/jj-team/scripts/snapshot_stale.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'skills', 'jj-team', 'scripts', 'snapshot_stale.mjs');

const OLD = new Date('2026-09-01T00:00:00.000Z');
const NEWER = new Date('2026-09-10T00:00:00.000Z');
const NOW = '2026-09-01T00:00:00.000Z';

const temps = [];
function tempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

test.after(() => {
  for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true });
});

/** A fake installed skill root with deterministic mtimes. */
function makeSkill(files) {
  const skillRoot = tempDir('jj-team-skill-');
  for (const rel of files) {
    const abs = path.join(skillRoot, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `# ${rel}\n`, 'utf8');
    fs.utimesSync(abs, OLD, OLD);
  }
  return skillRoot;
}

/**
 * A project the fingerprint can derive from: an agent-definition surface with a
 * declared model, and a manifest. Both are the real signals, so a drift in either is
 * a drift the check can actually see.
 */
function makeProject() {
  const project = tempDir('jj-team-project-');
  fs.mkdirSync(path.join(project, '.grok/agents'), { recursive: true });
  fs.writeFileSync(path.join(project, '.grok/agents/frontend-dev.md'), '---\nmodel: grok-4.6\n---\n# fd\n', 'utf8');
  fs.writeFileSync(
    path.join(project, 'package.json'),
    JSON.stringify({ name: 'cs', dependencies: { vue: '^3.5.0' }, files: ['dist'] }, null, 2),
    'utf8'
  );
  fs.mkdirSync(path.join(project, '.plans/daji-cs'), { recursive: true });
  fs.mkdirSync(path.join(project, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(project, 'AGENTS.md'), '# agents\n', 'utf8');
  return project;
}

/** The ledger a provisioned team writes. `project_path` is what the fingerprint derives from. */
function sessionFor(projectPath, extra = {}) {
  return {
    schema_version: 'jj-flow/team-session/1.0',
    project_key: 'cs',
    project_path: projectPath,
    capabilities: { teammates: true, task_board: false },
    roles: [
      { name: 'implementer-1', role: 'implement', model: 'sonnet', lane: 'lane-A' },
      { name: 'reviewer', role: 'review', model: 'sonnet', lane: null }
    ],
    review_rubric: ['RD-1', 'RD-2', 'RD-3', 'RD-4'],
    last_seen_at: '2026-09-01T00:00:00.000Z',
    tasks: [],
    ...extra
  };
}

/** A team dir holding a ledger that points at `project`. */
function makeTeamDir(project, sessionExtra) {
  const teamDir = tempDir('jj-team-team-');
  fs.writeFileSync(path.join(teamDir, 'team-session.json'), JSON.stringify(sessionFor(project, sessionExtra), null, 2), 'utf8');
  return teamDir;
}

/** Both blocks, matching the skill root and the team dir — the "fresh" starting point. */
function freshBlocks(skillRoot, teamDir, now = NOW) {
  return {
    stamp: buildStamp({ skillRoot, now: () => now }).block,
    fingerprint: buildFingerprint({ teamDir, now: () => now }).block
  };
}

/**
 * Write a snapshot document. `block` is the stamp block under test; the fingerprint
 * block is built from the same team dir, so a stamp defect is the only thing that can
 * explain an `unverifiable` verdict.
 */
function makeSnapshot(block, extra = '', teamDirOverride) {
  const project = makeProject();
  const teamDir = teamDirOverride ?? makeTeamDir(project);
  const snapshotPath = path.join(teamDir, 'team-snapshot.md');
  fs.writeFileSync(
    snapshotPath,
    `# team-snapshot\n\n## Staleness stamp\n\n${block}\n\n${buildFingerprint({ teamDir, now: () => NOW }).block}\n\n${extra}`,
    'utf8'
  );
  return snapshotPath;
}

/** A stamp that matches the skill root exactly. */
function freshStamp(skillRoot, now = NOW) {
  return buildStamp({ skillRoot, now: () => now }).block;
}

/**
 * Assemble a stamp document field by field, so one field can be broken alone.
 * `null` for skillRoot / generatedAt omits the line entirely.
 */
function stampDocument({
  header = STAMP_HEADER,
  skillRoot,
  generatedAt = OLD.toISOString(),
  files = [['SKILL.md', OLD.toISOString()]]
} = {}) {
  const lines = [header];
  if (skillRoot !== null) lines.push(`skill_root: ${skillRoot}`);
  if (generatedAt !== null) lines.push(`generated_at: ${generatedAt}`);
  for (const [rel, mtime] of files) lines.push(`${rel}\t${mtime}`);
  return ['```stamp', ...lines, '```'].join('\n');
}

function verdictFor(result, rel) {
  return result.entries.find((entry) => entry.path === rel);
}

function runCli(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
}

test('a snapshot stamped against unchanged sources and a matching environment is fresh and exits 0', () => {
  const skillRoot = makeSkill(['SKILL.md', 'references/roles.md', 'specs/state-layout.md', 'scripts/snapshot_stale.mjs']);
  const project = makeProject();
  const teamDir = makeTeamDir(project);
  const snapshotPath = path.join(teamDir, 'team-snapshot.md');
  fs.writeFileSync(snapshotPath, `# team-snapshot\n\n${freshBlocks(skillRoot, teamDir).stamp}\n\n${freshBlocks(skillRoot, teamDir).fingerprint}\n`, 'utf8');

  const result = checkSnapshot({ snapshotPath });
  assert.equal(result.status, 'fresh');
  assert.equal(result.reason, null);
  assert.equal(result.entries.length, 4);
  for (const entry of result.entries) assert.equal(entry.verdict, 'ok');
  assert.equal(result.fingerprint.status, 'fresh');
  assert.deepEqual(result.fingerprint.drift, []);

  const cli = runCli(['--snapshot', snapshotPath]);
  assert.equal(cli.status, EXIT.fresh, cli.stderr);
  assert.match(cli.stdout, /snapshot fresh/);
  assert.match(cli.stdout, /environment fingerprint re-derives/);
});

test('a source file modified after the snapshot is reported by name and exits 1', () => {
  const skillRoot = makeSkill(['SKILL.md', 'references/roles.md', 'specs/state-layout.md']);
  const snapshotPath = makeSnapshot(freshStamp(skillRoot));
  fs.utimesSync(path.join(skillRoot, 'specs/state-layout.md'), NEWER, NEWER);

  const result = checkSnapshot({ snapshotPath });
  assert.equal(result.status, 'stale');
  const entry = verdictFor(result, 'specs/state-layout.md');
  assert.equal(entry.verdict, 'newer');
  assert.equal(entry.stamped, OLD.toISOString());
  assert.equal(entry.current, NEWER.toISOString());
  // The untouched files stay ok — the report is per-file, not all-or-nothing.
  assert.equal(verdictFor(result, 'SKILL.md').verdict, 'ok');
  // ...and the environment half stays quiet: only the half that moved is reported.
  assert.deepEqual(result.fingerprint.drift, []);

  const cli = runCli(['--snapshot', snapshotPath]);
  assert.equal(cli.status, EXIT.stale);
  assert.match(cli.stderr, /stale: specs\/state-layout\.md changed after the snapshot/);
  assert.match(cli.stderr, /2026-09-01T00:00:00\.000Z/);
  assert.match(cli.stderr, /2026-09-10T00:00:00\.000Z/);
});

test('a source file added after the snapshot is stale even though no mtime moved', () => {
  // This is the hole in a pure mtime comparison: a brand-new file has no stamp
  // to be newer than, so it has to be caught by the file-set diff.
  const skillRoot = makeSkill(['SKILL.md', 'references/roles.md']);
  const snapshotPath = makeSnapshot(freshStamp(skillRoot));
  const added = path.join(skillRoot, 'references/review-dimensions.md');
  fs.writeFileSync(added, '# new\n', 'utf8');
  fs.utimesSync(added, OLD, OLD);

  const result = checkSnapshot({ snapshotPath });
  assert.equal(result.status, 'stale');
  assert.equal(verdictFor(result, 'references/review-dimensions.md').verdict, 'added');
});

test('a stamped source file that no longer exists is stale', () => {
  const skillRoot = makeSkill(['SKILL.md', 'references/roles.md', 'specs/state-layout.md']);
  const snapshotPath = makeSnapshot(freshStamp(skillRoot));
  fs.rmSync(path.join(skillRoot, 'references/roles.md'));

  const result = checkSnapshot({ snapshotPath });
  assert.equal(result.status, 'stale');
  assert.equal(verdictFor(result, 'references/roles.md').verdict, 'missing');
  const cli = runCli(['--snapshot', snapshotPath]);
  assert.equal(cli.status, EXIT.stale);
  assert.match(cli.stderr, /no longer exists/);
});

test('a snapshot with no stamp fence is unverifiable, not fresh', () => {
  const teamDir = tempDir('jj-team-team-');
  const snapshotPath = path.join(teamDir, 'team-snapshot.md');
  fs.writeFileSync(snapshotPath, '# team-snapshot\n\nno stamp here\n', 'utf8');

  const result = checkSnapshot({ snapshotPath });
  assert.equal(result.status, 'unverifiable');
  assert.match(result.reason, /no parseable staleness stamp/);
  const cli = runCli(['--snapshot', snapshotPath]);
  assert.equal(cli.status, EXIT.unverifiable);
  assert.match(cli.stderr, /unverifiable/);
});

test('a stamp fence with an unreadable version is unverifiable, not a fresh read', () => {
  // A stamp format this script cannot read must not be read as "nothing changed".
  // The body below is otherwise fully valid — real skill root, matching mtime — so
  // the version header is the only thing standing between it and a false "fresh".
  const skillRoot = makeSkill(['SKILL.md']);
  const snapshotPath = makeSnapshot(
    [
      'staleness-stamp v2',
      `skill_root: ${skillRoot}`,
      'generated_at: 2026-09-01T00:00:00.000Z',
      `SKILL.md\t${OLD.toISOString()}`
    ].join('\n')
  );
  const result = checkSnapshot({ snapshotPath });
  assert.equal(result.status, 'unverifiable');
  assert.equal(parseStamp(fs.readFileSync(snapshotPath, 'utf8')), null, 'an unknown version must not parse');
  const cli = runCli(['--snapshot', snapshotPath]);
  assert.equal(cli.status, EXIT.unverifiable);
  assert.match(cli.stderr, /unverifiable/);
});

test('an unreadable snapshot file is unverifiable', () => {
  const teamDir = tempDir('jj-team-team-');
  const result = checkSnapshot({ snapshotPath: path.join(teamDir, 'nope.md') });
  assert.equal(result.status, 'unverifiable');
  assert.match(result.reason, /not readable/);
});

test('a stamp whose skill root is gone is unverifiable, not stale', () => {
  // The host uninstalled the skill: every file would read as "missing", which
  // would tell the team-lead to regenerate a snapshot it cannot regenerate.
  const skillRoot = makeSkill(['SKILL.md']);
  const snapshotPath = makeSnapshot(freshStamp(skillRoot));
  fs.rmSync(skillRoot, { recursive: true, force: true });

  const result = checkSnapshot({ snapshotPath });
  assert.equal(result.status, 'unverifiable');
  assert.match(result.reason, /skill root is gone/);
});

test('the stamp it emits parses back to the same files and mtimes', () => {
  const skillRoot = makeSkill(['SKILL.md', 'references/roles.md', 'specs/state-layout.md']);
  const built = buildStamp({ skillRoot, now: () => NOW });
  assert.deepEqual(
    built.files.map((f) => f.path),
    ['SKILL.md', 'references/roles.md', 'specs/state-layout.md'],
    'the stamp is sorted so the block is byte-stable between runs'
  );
  const parsed = parseStamp(built.block);
  assert.equal(parsed.skill_root, skillRoot);
  assert.equal(parsed.generated_at, NOW);
  assert.deepEqual([...parsed.files.entries()], built.files.map((f) => [f.path, f.mtime]));
  assert.equal(parsed.files.get('SKILL.md'), OLD.toISOString());
});

test('the walk covers SKILL.md, references/, specs/ and scripts/ and skips bytecode caches', () => {
  const skillRoot = makeSkill(['SKILL.md', 'references/a.md', 'specs/b.md', 'scripts/c.mjs']);
  fs.mkdirSync(path.join(skillRoot, 'scripts/__pycache__'), { recursive: true });
  fs.writeFileSync(path.join(skillRoot, 'scripts/__pycache__/c.pyc'), 'x', 'utf8');
  assert.deepEqual(skillSourceFiles(skillRoot), ['SKILL.md', 'references/a.md', 'scripts/c.mjs', 'specs/b.md']);
});

test('the walk covers the whole skill root, not only the three known directories', () => {
  // This script used to carry `COVERED_DIRS = ['references','specs','scripts']` and
  // never used it, which read as "the stamp is limited to those three". It never was:
  // the walk is the whole tree. The property is asserted here so a future filter that
  // narrows coverage is caught instead of quietly shrinking every stamp.
  const skillRoot = makeSkill(['SKILL.md', 'references/a.md', 'other/extra.md', 'extra-root.md']);
  assert.deepEqual(
    skillSourceFiles(skillRoot),
    ['SKILL.md', 'extra-root.md', 'other/extra.md', 'references/a.md']
  );
});

test('a stamp is never emitted with an unreadable mtime', () => {
  // An empty mtime column makes parseStamp reject the whole block, so the reader is
  // told "no parseable stamp" — which points at whoever generated it, when the real
  // cause is one file the script could not stat. Refusing, and naming that file, is
  // the only version of this that does not misdirect.
  const skillRoot = makeSkill(['SKILL.md', 'references/roles.md']);
  assert.throws(
    () => buildStamp({ skillRoot, statMtime: () => null }),
    /cannot stamp SKILL\.md/
  );
  const built = buildStamp({ skillRoot, now: () => NOW });
  for (const file of built.files) assert.ok(file.mtime, file.path + ' must carry an mtime');
  assert.doesNotMatch(built.block, /\t\n/, 'no stamp line may end at its separator');
});

test('two stamp blocks are unverifiable instead of silently reading the first', () => {
  // Appending a regenerated block above the old one is the natural mistake. Reading
  // the first block then reports a file that no longer differs, forever, with a
  // reason that names it — a snapshot that can never converge.
  const skillRoot = makeSkill(['SKILL.md', 'references/roles.md']);
  const snapshotPath = makeSnapshot(freshStamp(skillRoot));
  fs.utimesSync(path.join(skillRoot, 'SKILL.md'), NEWER, NEWER);
  // The appended block matches the current mtimes exactly, so a reader that took the
  // last block would call this fresh and a reader that takes the first calls it stale.
  fs.appendFileSync(snapshotPath, `\n${freshStamp(skillRoot)}\n`, 'utf8');

  const result = checkSnapshot({ snapshotPath });
  assert.equal(result.status, 'unverifiable');
  assert.match(result.reason, /more than one staleness stamp/);
  assert.match(result.reason, /replace/i);
  assert.equal(parseStamp(fs.readFileSync(snapshotPath, 'utf8')), null);
  const cli = runCli(['--snapshot', snapshotPath]);
  assert.equal(cli.status, EXIT.unverifiable);
});

test('a skill root holding only SKILL.md still checks cleanly', () => {
  const skillRoot = makeSkill(['SKILL.md']);
  const snapshotPath = makeSnapshot(freshStamp(skillRoot));
  const result = checkSnapshot({ snapshotPath });
  assert.equal(result.status, 'fresh');
  assert.equal(result.entries.length, 1);
});

test('--team-dir resolves <dir>/team-snapshot.md and --json reports the status', () => {
  const skillRoot = makeSkill(['SKILL.md', 'references/roles.md']);
  const project = makeProject();
  const teamDir = makeTeamDir(project);
  const blocks = freshBlocks(skillRoot, teamDir);
  fs.writeFileSync(path.join(teamDir, 'team-snapshot.md'), `# team-snapshot\n\n${blocks.stamp}\n\n${blocks.fingerprint}\n`, 'utf8');
  const cli = runCli(['--team-dir', teamDir, '--json']);
  assert.equal(cli.status, EXIT.fresh, cli.stderr);
  const payload = JSON.parse(cli.stdout);
  assert.equal(payload.status, 'fresh');
  assert.equal(payload.snapshot, path.join(teamDir, 'team-snapshot.md'));
  assert.equal(payload.entries.length, 2);
  assert.equal(payload.fingerprint.status, 'fresh');

  fs.utimesSync(path.join(skillRoot, 'SKILL.md'), NEWER, NEWER);
  const stale = runCli(['--team-dir', teamDir, '--json']);
  assert.equal(stale.status, EXIT.stale);
  assert.equal(JSON.parse(stale.stdout).status, 'stale');
});

test('--stamp prints both blocks for the real skill source and includes its own script', () => {
  // The distributed copy must contain this script, or the check cannot see it change.
  const project = makeProject();
  const teamDir = makeTeamDir(project);
  const cli = runCli(['--stamp', '--team-dir', teamDir, '--skill-root', path.join(root, 'skills', 'jj-team')]);
  assert.equal(cli.status, EXIT.fresh, cli.stderr);
  const parsed = parseStamp(cli.stdout);
  assert.ok(parsed, 'the emitted stamp block must parse back');
  assert.equal(parsed.skill_root, path.join(root, 'skills', 'jj-team'));
  assert.ok(parsed.files.has('SKILL.md'));
  assert.ok(parsed.files.has('scripts/snapshot_stale.mjs'));
  assert.ok(parsed.files.has('specs/state-layout.md'));
  assert.ok(parsed.files.has('references/roles.md'));
  const fingerprint = parseFingerprint(cli.stdout);
  assert.ok(fingerprint, 'the emitted fingerprint block must parse back');
  assert.equal(fingerprint.project, project.split(path.sep).join('/'));
});

test('usage errors get their own exit code, not the unverifiable one', () => {
  // Exit 2 means "cannot tell whether this snapshot is fresh" and sends the reader to
  // regenerate a stamp. A mistyped command is not that, and must not read as it.
  const bogus = runCli(['--bogus']);
  assert.equal(bogus.status, EXIT.usage);
  assert.match(bogus.stderr, /^usage: unknown argument: --bogus/m);

  const noTarget = runCli([]);
  assert.equal(noTarget.status, EXIT.usage);
  assert.match(noTarget.stderr, /^usage: nothing to check/m);

  const missingValue = runCli(['--snapshot']);
  assert.equal(missingValue.status, EXIT.usage);
  assert.match(missingValue.stderr, /^usage: --snapshot requires a file/m);
});

test('conflicting arguments are usage errors, not a silent no-op', () => {
  // Each of these used to exit 0 with nothing checked: `--stamp` wins and no snapshot
  // is ever read, or `--team-dir` overwrites the `--snapshot` value on the way out of
  // parseArgs. Exit 0 is the one code a caller acts on, so a combination that does
  // nothing must not be able to produce it.
  const skillRoot = makeSkill(['SKILL.md']);
  const snapshotPath = makeSnapshot(freshStamp(skillRoot));
  const teamDir = path.dirname(snapshotPath);
  for (const argv of [
    ['--stamp', '--snapshot', snapshotPath],
    ['--snapshot', snapshotPath, '--team-dir', teamDir]
  ]) {
    const cli = runCli(argv);
    assert.equal(cli.status, EXIT.usage, argv.join(' ') + ' must be a usage error');
    assert.match(cli.stderr, /^usage: /m, argv.join(' ') + ' must say which rule it broke');
  }
  // The legal pairings still work. `--stamp` owns the output; `--skill-root` says where
  // the stamp comes from and `--team-dir` says which ledger the fingerprint reads.
  const project = makeProject();
  const okTeam = makeTeamDir(project);
  const ok = runCli(['--stamp', '--team-dir', okTeam, '--skill-root', skillRoot]);
  assert.equal(ok.status, EXIT.fresh, ok.stderr);
  assert.ok(parseStamp(ok.stdout), 'the legal pairing must still emit a stamp');
  assert.ok(parseFingerprint(ok.stdout), 'the legal pairing must also emit a fingerprint');
});

test('--skill-root cannot be combined with --snapshot: it is a --stamp-only flag', () => {
  // Both of these used to exit 0 while the named root was silently dropped.
  // `--skill-root` is read by the `--stamp` branch and nowhere else — a check resolves
  // its root from the stamp's own `skill_root:` line — so the verdict that comes back
  // describes the skill copy the stamp points at, not the tree the caller named. Exit 0
  // here is "fresh" about a root nobody checked.
  const skillRoot = makeSkill(['SKILL.md']);
  const snapshotPath = makeSnapshot(freshStamp(skillRoot));
  const cli = runCli(['--snapshot', snapshotPath, '--skill-root', skillRoot]);
  assert.equal(cli.status, EXIT.usage, cli.stderr);
  assert.match(cli.stderr, /^usage: --skill-root.*--stamp/m);
});

test('--skill-root cannot be combined with a check target: it is a --stamp-only flag', () => {
  // The other spelling of the same target. One rule closes both; a second `if` per
  // target flag would be the fourth and fifth instance of the same bug.
  const skillRoot = makeSkill(['SKILL.md']);
  const snapshotPath = makeSnapshot(freshStamp(skillRoot));
  const teamDir = path.dirname(snapshotPath);
  const cli = runCli(['--team-dir', teamDir, '--skill-root', skillRoot]);
  assert.equal(cli.status, EXIT.usage, cli.stderr);
  assert.match(cli.stderr, /^usage: --skill-root.*--stamp/m);
  // The flag on its own is not silently ignored either: it names a root nothing reads.
  const alone = runCli(['--skill-root', skillRoot]);
  assert.equal(alone.status, EXIT.usage, alone.stderr);
  assert.match(alone.stderr, /^usage: --skill-root.*--stamp/m);
});

test('a stamp whose skill root is a file is unverifiable, not a crash read as stale', () => {
  // `existsSync` answers true for a file, so the walk reaches `readdirSync` and throws
  // ENOTDIR: a bare stack trace and exit 1, which every caller reads as "stale" and
  // acts on by regenerating. The truth is that this stamp does not point at a skill
  // root at all, and no verdict was reached.
  const dir = tempDir('jj-team-notadir-');
  const notADir = path.join(dir, 'skill-root.txt');
  fs.writeFileSync(notADir, 'not a directory\n', 'utf8');
  const snapshotPath = makeSnapshot(stampDocument({ skillRoot: notADir }));

  const result = checkSnapshot({ snapshotPath });
  assert.equal(result.status, 'unverifiable');
  assert.match(result.reason, /not a directory/);

  const cli = runCli(['--snapshot', snapshotPath]);
  assert.equal(cli.status, EXIT.unverifiable);
  assert.doesNotMatch(cli.stderr, /ENOTDIR|node:fs/, 'a stack trace is not a verdict');
});

test('an unverifiable verdict names the next step, the way a stale one does', () => {
  // Both non-fresh outcomes leave the reader with something to do. The stale branch
  // said how; the unverifiable branch printed only the reason, so hitting exit 2 told
  // you what was wrong and nothing about what to do about it.
  const skillRoot = makeSkill(['SKILL.md']);
  const teamDir = tempDir('jj-team-team-');
  const snapshotPath = path.join(teamDir, 'team-snapshot.md');
  fs.writeFileSync(snapshotPath, '# team-snapshot\n\nno stamp here\n', 'utf8');
  const unverifiable = runCli(['--snapshot', snapshotPath]);
  assert.equal(unverifiable.status, EXIT.unverifiable);
  assert.match(unverifiable.stderr, /regenerate the snapshot: run this script with --stamp --team-dir/);

  const stalePath = makeSnapshot(freshStamp(skillRoot));
  fs.utimesSync(path.join(skillRoot, 'SKILL.md'), NEWER, NEWER);
  const stale = runCli(['--snapshot', stalePath]);
  assert.equal(stale.status, EXIT.stale);
  assert.match(stale.stderr, /regenerate the snapshot: run this script with --stamp --team-dir/);
});

test('a stamped mtime that is not the ISO-8601 this script emits is unverifiable', () => {
  // `Date.parse('yesterday-ish')` is NaN, every comparison against NaN is false, and
  // "not newer" is the `ok` branch — so a stamp with a hand-edited mtime column read
  // as fresh and exited 0. The mtime column is the one field the check compares, so
  // it is the one field that must never reach a comparison unvalidated.
  const skillRoot = makeSkill(['SKILL.md']);
  const malformed = ['yesterday-ish', '2026-09-01T00:00:00', '2026-09-01T00:00:00Z', '2026-09-01 00:00:00', '1756684800000', ''];
  for (const mtime of malformed) {
    const snapshotPath = makeSnapshot(stampDocument({ skillRoot, files: [['SKILL.md', mtime]] }));
    const result = checkSnapshot({ snapshotPath });
    assert.equal(result.status, 'unverifiable', `mtime ${JSON.stringify(mtime)} must not reach a comparison`);
    assert.match(result.reason, /mtime/, `mtime ${JSON.stringify(mtime)} must be named in the reason`);
    const cli = runCli(['--snapshot', snapshotPath]);
    assert.equal(cli.status, EXIT.unverifiable, `mtime ${JSON.stringify(mtime)} must exit 2, not 0 or 1`);
  }
});

test('every malformed stamp field is unverifiable — never fresh, never stale', () => {
  // The class, not the instance. Three review rounds found the same shape of bug in
  // this script: a value read out of the stamp reached a comparison unchecked and the
  // failure landed in a verdict instead of in `unverifiable`. Each row breaks exactly
  // one field of an otherwise-valid stamp whose skill root exists and matches, so
  // nothing but that field can explain the outcome. `without` records the exit code
  // the row produced before the field was validated — those are the rows that make
  // this test a guard rather than a restatement.
  const skillRoot = makeSkill(['SKILL.md']);
  const dir = tempDir('jj-team-rootcases-');
  const notADir = path.join(dir, 'root.txt');
  fs.writeFileSync(notADir, 'not a directory\n', 'utf8');
  const goneRoot = path.join(dir, 'uninstalled');

  const cases = [
    { name: 'mtime is not a date', files: [['SKILL.md', 'yesterday-ish']], without: '0 fresh' },
    { name: 'mtime has no Z', files: [['SKILL.md', '2026-09-01T00:00:00']], without: '0 fresh on UTC, 1 stale at UTC+8' },
    { name: 'mtime has no milliseconds', files: [['SKILL.md', '2026-09-01T00:00:00Z']], without: '0 fresh' },
    { name: 'mtime is a space-separated date', files: [['SKILL.md', '2026-09-01 00:00:00']], without: '0 fresh' },
    { name: 'mtime is an epoch number', files: [['SKILL.md', '1756684800000']], without: '0 fresh' },
    { name: 'mtime column is empty', files: [['SKILL.md', '']], without: '2 already' },
    { name: 'the path column is empty', files: [['', OLD.toISOString()]], without: '2 already' },
    { name: 'the file line has no separator', files: null, rawLine: 'SKILL.md', without: '2 already' },
    { name: 'generated_at is not a date', generatedAt: 'whenever', without: '0 fresh' },
    { name: 'generated_at is empty', generatedAt: '', without: '0 fresh' },
    { name: 'generated_at is missing', generatedAt: null, without: '0 fresh' },
    { name: 'the version header is unreadable', header: 'staleness-stamp v2', without: '2 already' },
    { name: 'skill_root points at a file', skillRoot: notADir, without: '1 stale, from a bare ENOTDIR' },
    { name: 'skill_root is gone', skillRoot: goneRoot, without: '2 already' },
    { name: 'skill_root is missing', skillRoot: null, without: '2 already' },
    { name: 'skill_root is empty', skillRoot: '', without: '2 already' },
    { name: 'a second stamp fence is appended', secondBlock: true, without: '2 already' }
  ];

  for (const item of cases) {
    let block;
    if (item.secondBlock) {
      block = freshStamp(skillRoot);
    } else if (item.rawLine !== undefined) {
      block = ['```stamp', STAMP_HEADER, `skill_root: ${skillRoot}`, `generated_at: ${OLD.toISOString()}`, item.rawLine, '```'].join('\n');
    } else {
      block = stampDocument({
        header: item.header,
        skillRoot: item.skillRoot === undefined ? skillRoot : item.skillRoot,
        generatedAt: item.generatedAt,
        files: item.files === undefined ? undefined : item.files
      });
    }
    const snapshotPath = makeSnapshot(block, item.secondBlock ? `\n${freshStamp(skillRoot)}\n` : '');
    const result = checkSnapshot({ snapshotPath });
    assert.equal(
      result.status,
      'unverifiable',
      `${item.name} must be unverifiable (before validation it read as ${item.without})`
    );
    assert.ok(result.reason, `${item.name} must say why`);
    const cli = runCli(['--snapshot', snapshotPath]);
    assert.equal(
      cli.status,
      EXIT.unverifiable,
      `${item.name} must exit 2, never 0 or 1 (before validation it read as ${item.without})`
    );
  }
});

// ---------------------------------------------------------------------------
// The environment fingerprint
// ---------------------------------------------------------------------------

/** A team whose skill root and ledger both match its snapshot. */
function makeTeam(skillFiles = ['SKILL.md', 'references/roles.md'], sessionExtra) {
  const skillRoot = makeSkill(skillFiles);
  const project = makeProject();
  const teamDir = makeTeamDir(project, sessionExtra);
  const blocks = freshBlocks(skillRoot, teamDir);
  const snapshotPath = path.join(teamDir, 'team-snapshot.md');
  fs.writeFileSync(snapshotPath, `# team-snapshot\n\n${blocks.stamp}\n\n${blocks.fingerprint}\n`, 'utf8');
  return { skillRoot, project, teamDir, snapshotPath };
}

test('the fingerprint block records both halves and parses back to what was emitted', () => {
  const { project, teamDir } = makeTeam();
  const built = buildFingerprint({ teamDir, now: () => NOW });
  const parsed = parseFingerprint(built.block);
  assert.ok(parsed, 'the emitted block must parse back');
  assert.equal(parsed.project, project.split(path.sep).join('/'));
  assert.equal(parsed.generated_at, NOW);
  assert.match(parsed.fingerprint, /^[0-9a-f]{64}$/);
  // Every section is present, including the empty ones — a missing section would be
  // indistinguishable from a signal that found nothing.
  for (const name of [
    'derived models',
    'derived stack',
    'derived surface',
    'derived conventions',
    'declared capabilities',
    'declared models',
    'declared review_rubric'
  ]) {
    assert.ok(parsed.sections.has(name), 'the block must carry ' + name);
  }
  assert.equal(parsed.sections.get('derived models').get('.grok/agents/frontend-dev.md'), 'grok-4.6');
  assert.equal(parsed.sections.get('derived stack').get('name'), 'cs');
  assert.equal(parsed.sections.get('declared models').get('implementer-1'), 'sonnet');
  assert.equal(parsed.sections.get('declared review_rubric').get('all'), 'RD-1,RD-2,RD-3,RD-4');
  // A legacy bare-array rubric is recorded rather than read as "no rubric at all",
  // which would drift every snapshot written before the floor/project shape.
  assert.equal(parsed.sections.get('declared review_rubric').has('floor'), false);
});

test('a derived signal that moves is stale, and the report names the half', () => {
  // The host upgrades an agent's model. Nothing under the skill changed, so the
  // mtime stamp is silent — this is the drift the fingerprint exists to see.
  const { project, snapshotPath } = makeTeam();
  fs.writeFileSync(path.join(project, '.grok/agents/frontend-dev.md'), '---\nmodel: grok-5\n---\n# fd\n', 'utf8');

  const result = checkSnapshot({ snapshotPath });
  assert.equal(result.status, 'stale');
  assert.equal(result.entries.every((entry) => entry.verdict === 'ok'), true, 'the skill files did not move');
  assert.equal(result.fingerprint.status, 'stale');
  assert.deepEqual(result.fingerprint.drift, [
    { section: 'derived models', key: '.grok/agents/frontend-dev.md', recorded: 'grok-4.6', current: 'grok-5' }
  ]);

  const cli = runCli(['--snapshot', snapshotPath]);
  assert.equal(cli.status, EXIT.stale);
  assert.match(cli.stderr, /environment fingerprint drifted — derived models/);
  assert.match(cli.stderr, /grok-4\.6/);
  assert.match(cli.stderr, /grok-5/);
  assert.match(cli.stderr, /derived\)/, 'the report must say which half moved');
});

test('a declared half the ledger no longer says is stale, and the report names the half', () => {
  // `rebuild` rewrites roles[]; the cached onboarding prompts still describe the old
  // roster. Nothing on disk under the skill or the project moved.
  const { teamDir, snapshotPath } = makeTeam();
  const session = JSON.parse(fs.readFileSync(path.join(teamDir, 'team-session.json'), 'utf8'));
  session.roles[0].model = 'opus';
  fs.writeFileSync(path.join(teamDir, 'team-session.json'), JSON.stringify(session, null, 2), 'utf8');

  const result = checkSnapshot({ snapshotPath });
  assert.equal(result.status, 'stale');
  assert.equal(result.entries.every((entry) => entry.verdict === 'ok'), true, 'the skill files did not move');
  assert.deepEqual(result.fingerprint.drift, [
    { section: 'declared models', key: 'implementer-1', recorded: 'sonnet', current: 'opus' }
  ]);

  const cli = runCli(['--snapshot', snapshotPath]);
  assert.equal(cli.status, EXIT.stale);
  assert.match(cli.stderr, /environment fingerprint drifted — declared models/);
  assert.match(cli.stderr, /declared\)/, 'the report must say which half moved');
});

test('a ledger touch that is not environmental does not drift the fingerprint', () => {
  // `last_seen_at` is bumped on every Phase 0 and `tasks[]` grows with the work.
  // Projecting either into the declared half would make the fingerprint drift on
  // every invocation — noise, and noise is how a guard gets switched off.
  const { teamDir, snapshotPath } = makeTeam();
  const session = JSON.parse(fs.readFileSync(path.join(teamDir, 'team-session.json'), 'utf8'));
  session.last_seen_at = '2026-09-22T00:00:00.000Z';
  session.updated_at = '2026-09-22T00:00:00.000Z';
  session.tasks = [{ task_id: 't1', description: 'x', status: 'done', closed_at: '2026-09-22T00:00:00.000Z' }];
  fs.writeFileSync(path.join(teamDir, 'team-session.json'), JSON.stringify(session, null, 2), 'utf8');

  const result = checkSnapshot({ snapshotPath });
  assert.equal(result.status, 'fresh');
  assert.deepEqual(result.fingerprint.drift, []);
});

test('a snapshot with no fingerprint block is unverifiable, never fresh', () => {
  // The whole point of the second exit-2 case. Exit 0 is the one code a caller acts
  // on, so a snapshot that says nothing about the half that goes stale most often
  // must not be able to produce it.
  const skillRoot = makeSkill(['SKILL.md']);
  const teamDir = tempDir('jj-team-team-');
  fs.writeFileSync(
    path.join(teamDir, 'team-snapshot.md'),
    `# team-snapshot\n\n${freshStamp(skillRoot)}\n`,
    'utf8'
  );
  const result = checkSnapshot({ snapshotPath: path.join(teamDir, 'team-snapshot.md') });
  assert.equal(result.status, 'unverifiable');
  assert.match(result.reason, /no environment fingerprint/);
  assert.match(result.reason, /--stamp --team-dir/);
  const cli = runCli(['--snapshot', path.join(teamDir, 'team-snapshot.md')]);
  assert.equal(cli.status, EXIT.unverifiable);
  assert.doesNotMatch(cli.stdout, /fresh/);
});

test('a fingerprint that does not match its own contents is unverifiable, not stale', () => {
  // Someone edited a value in place. Both the digest and the signal comparison would
  // fire, and the digest has to win: telling this reader to "regenerate" would launder
  // the edit into a fresh stamp, which is the exact lie the digest exists to catch.
  const { teamDir, snapshotPath } = makeTeam();
  const text = fs.readFileSync(snapshotPath, 'utf8').replace('grok-4.6', 'grok-9');
  fs.writeFileSync(snapshotPath, text, 'utf8');

  const result = checkSnapshot({ snapshotPath });
  assert.equal(result.status, 'unverifiable');
  assert.match(result.reason, /does not match its own contents/);
  assert.doesNotMatch(result.reason, /regenerate both blocks with --stamp --team-dir <team dir> and replace both/);
  const cli = runCli(['--snapshot', snapshotPath]);
  assert.equal(cli.status, EXIT.unverifiable);
  assert.doesNotMatch(cli.stderr, /^stale:/m);
});

test('every malformed fingerprint field is unverifiable — never fresh, never stale', () => {
  // The same class as the stamp table below, for the second block. Each row breaks
  // exactly one thing in an otherwise-valid fingerprint whose project and ledger both
  // exist and match, so nothing else can explain the outcome.
  const { teamDir, snapshotPath } = makeTeam();
  const good = fs.readFileSync(snapshotPath, 'utf8');
  const block = parseFingerprint(good);
  assert.ok(block, 'precondition: the fixture fingerprint parses');

  const rewrite = (mutate) => {
    const lines = good.split('\n');
    const start = lines.findIndex((l) => l.trim() === '```fingerprint');
    const end = lines.findIndex((l, i) => i > start && l.trim().startsWith('```'));
    const body = lines.slice(start + 1, end);
    const next = mutate(body);
    fs.writeFileSync(snapshotPath, [...lines.slice(0, start + 1), ...next, ...lines.slice(end)].join('\n'), 'utf8');
  };

  const cases = [
    { name: 'the version header is unreadable', mutate: (b) => [FINGERPRINT_HEADER.replace('v1', 'v2'), ...b.slice(1)] },
    { name: 'the version header is missing', mutate: (b) => b.slice(1) },
    { name: 'project is missing', mutate: (b) => b.filter((l) => !l.startsWith('project:')) },
    { name: 'project is empty', mutate: (b) => b.map((l) => (l.startsWith('project:') ? 'project: ' : l)) },
    { name: 'generated_at is not a date', mutate: (b) => b.map((l) => (l.startsWith('generated_at:') ? 'generated_at: whenever' : l)) },
    { name: 'generated_at is missing', mutate: (b) => b.filter((l) => !l.startsWith('generated_at:')) },
    { name: 'the digest is not a sha256', mutate: (b) => b.map((l) => (l.startsWith('fingerprint:') ? 'fingerprint: deadbeef' : l)) },
    { name: 'the digest is missing', mutate: (b) => b.filter((l) => !l.startsWith('fingerprint:')) },
    { name: 'a section is missing', mutate: (b) => { const at = b.indexOf('derived stack'); return [...b.slice(0, at), ...b.slice(at + 2)]; } },
    { name: 'a section is duplicated', mutate: (b) => [...b, 'declared models', 'reviewer\tsonnet'] },
    { name: 'an unknown section appears', mutate: (b) => [...b, 'derived nonsense', 'a\tb'] },
    { name: 'a line is outside every section', mutate: (b) => ['stray\tvalue', ...b] },
    { name: 'a value column is empty', mutate: (b) => b.map((l) => (l === '.grok/agents/frontend-dev.md\tgrok-4.6' ? '.grok/agents/frontend-dev.md\t' : l)) },
    { name: 'a line has no separator', mutate: (b) => b.map((l) => (l === '.grok/agents/frontend-dev.md\tgrok-4.6' ? '.grok/agents/frontend-dev.md' : l)) }
  ];

  for (const item of cases) {
    rewrite(item.mutate);
    const result = checkSnapshot({ snapshotPath });
    assert.equal(result.status, 'unverifiable', `${item.name} must be unverifiable`);
    assert.ok(result.reason, `${item.name} must say why`);
    const cli = runCli(['--snapshot', snapshotPath]);
    assert.equal(cli.status, EXIT.unverifiable, `${item.name} must exit 2, never 0 or 1`);
  }
});

test('two fingerprint blocks are unverifiable instead of reading the first', () => {
  // Appending a regenerated block is the natural mistake, and it is the one the stamp
  // already refuses. The fingerprint refuses it for the same reason: two blocks means
  // the file cannot be checked as written, and the fix is to replace, not to append.
  const { teamDir, snapshotPath } = makeTeam();
  fs.appendFileSync(snapshotPath, `\n${buildFingerprint({ teamDir, now: () => NOW }).block}\n`, 'utf8');

  const result = checkSnapshot({ snapshotPath });
  assert.equal(result.status, 'unverifiable');
  assert.match(result.reason, /more than one environment fingerprint/);
  assert.equal(parseFingerprint(fs.readFileSync(snapshotPath, 'utf8')), null);
  const cli = runCli(['--snapshot', snapshotPath]);
  assert.equal(cli.status, EXIT.unverifiable);
});

test('a fingerprinted project that is gone is unverifiable, not stale', () => {
  // The project moved or was deleted. Every derived signal would read as absent, which
  // would tell the team-lead to regenerate a fingerprint of an environment that is no
  // longer there to be derived from.
  const { project, snapshotPath } = makeTeam();
  fs.rmSync(project, { recursive: true, force: true });

  const result = checkSnapshot({ snapshotPath });
  assert.equal(result.status, 'unverifiable');
  assert.match(result.reason, /fingerprinted project is not a directory/);
  const cli = runCli(['--snapshot', snapshotPath]);
  assert.equal(cli.status, EXIT.unverifiable);
});

test('an unreadable ledger beside the snapshot is unverifiable', () => {
  // The declared half is re-read at check time, because that is what catches a roster
  // rewritten after the snapshot. With the ledger gone, no verdict was reached.
  const { teamDir, snapshotPath } = makeTeam();
  fs.rmSync(path.join(teamDir, 'team-session.json'));

  const result = checkSnapshot({ snapshotPath });
  assert.equal(result.status, 'unverifiable');
  assert.match(result.reason, /cannot re-read the declared half/);
});

test('--stamp refuses to emit a fingerprint when the ledger is missing or has no project', () => {
  // A half-written block would record "the team declared nothing" — a claim about a
  // ledger nobody read. Refusing, and naming the file, is the only honest exit.
  const empty = tempDir('jj-team-empty-');
  const cli = runCli(['--stamp', '--team-dir', empty]);
  assert.equal(cli.status, EXIT.unverifiable);
  assert.match(cli.stderr, /fingerprint failed/);
  assert.match(cli.stderr, /team-session\.json/);

  const noPath = tempDir('jj-team-nopath-');
  fs.writeFileSync(path.join(noPath, 'team-session.json'), JSON.stringify({ roles: [] }), 'utf8');
  const cli2 = runCli(['--stamp', '--team-dir', noPath]);
  assert.equal(cli2.status, EXIT.unverifiable);
  assert.match(cli2.stderr, /project_path/);
});

test('--stamp without --team-dir still emits the stamp and says the fingerprint is missing', () => {
  // Backwards compatible on purpose: a stamp on its own is still a stamp. The note is
  // what keeps that from being a silent no-op, because the check fails closed on a
  // snapshot with no fingerprint block.
  const skillRoot = makeSkill(['SKILL.md', 'references/roles.md']);
  const cli = runCli(['--stamp', '--skill-root', skillRoot]);
  assert.equal(cli.status, EXIT.fresh, cli.stderr);
  assert.ok(parseStamp(cli.stdout), 'the stamp block must still parse');
  assert.equal(parseFingerprint(cli.stdout), null, 'no fingerprint without a team dir');
  assert.match(cli.stderr, /no --team-dir/);
});

test('the emitted fingerprint survives a round trip through the checker', () => {
  // The property that makes --stamp worth anything: what it prints is what the check
  // accepts, with no hand-written digest anywhere in between.
  const { teamDir } = makeTeam();
  const cli = runCli(['--stamp', '--team-dir', teamDir, '--skill-root', path.join(root, 'skills', 'jj-team')]);
  assert.equal(cli.status, EXIT.fresh, cli.stderr);
  const stamp = parseStamp(cli.stdout);
  const fingerprint = parseFingerprint(cli.stdout);
  assert.ok(stamp && fingerprint);
  fs.writeFileSync(path.join(teamDir, 'team-snapshot.md'), `# team-snapshot\n\n${cli.stdout}`, 'utf8');
  const result = checkSnapshot({ snapshotPath: path.join(teamDir, 'team-snapshot.md') });
  assert.equal(result.status, 'fresh', result.reason ?? '');
});

test('the four derived signals are the ones SKILL.md names, and the convention list is fixed', () => {
  // A signal the script computes but the probe table does not name is an
  // implementation detail nobody reviews; a convention list that grew with the repo
  // would drift the fingerprint every time a directory appeared.
  assert.deepEqual(DERIVED_SIGNALS, ['models', 'stack', 'surface', 'conventions']);
  assert.deepEqual(CONVENTION_PATHS, ['.plans', '.workflow', 'AGENTS.md', 'CLAUDE.md', 'docs']);
  const skill = fs.readFileSync(path.join(root, 'skills', 'jj-team', 'SKILL.md'), 'utf8');
  for (const signal of DERIVED_SIGNALS) {
    assert.ok(skill.includes(signal), 'SKILL.md must name the ' + signal + ' signal');
  }
});

test('checkFingerprint reports a drift on a block parsed straight out of a document', () => {
  // The exported helper is what a reader of the JSON output consumes; it must agree
  // with checkSnapshot rather than being a second, quieter implementation.
  const { snapshotPath } = makeTeam();
  const block = parseFingerprint(fs.readFileSync(snapshotPath, 'utf8'));
  const before = checkFingerprint({ block, snapshotPath });
  assert.equal(before.status, 'fresh');
  assert.deepEqual(before.drift, []);
});
