/**
 * Behavioural tests for the jj-team snapshot staleness checker.
 *
 * The rule it mechanizes: a snapshot whose stamped skill sources have changed,
 * grown or disappeared is stale, and a snapshot that cannot be checked at all
 * must not read as fresh. Everything is asserted on real files in a temp dir —
 * no module is mocked, because the only dependency here is the filesystem.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  EXIT,
  STAMP_HEADER,
  buildStamp,
  checkSnapshot,
  parseStamp,
  skillSourceFiles
} from '../skills/jj-team/scripts/snapshot_stale.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'skills', 'jj-team', 'scripts', 'snapshot_stale.mjs');

const OLD = new Date('2026-09-01T00:00:00.000Z');
const NEWER = new Date('2026-09-10T00:00:00.000Z');

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

function makeSnapshot(block, extra = '') {
  const teamDir = tempDir('jj-team-team-');
  const snapshotPath = path.join(teamDir, 'team-snapshot.md');
  fs.writeFileSync(
    snapshotPath,
    `# team-snapshot\n\n## Staleness stamp\n\n${block}\n\n${extra}`,
    'utf8'
  );
  return snapshotPath;
}

/** A stamp that matches the skill root exactly — the "fresh" starting point. */
function freshStamp(skillRoot, now = '2026-09-01T00:00:00.000Z') {
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

test('a snapshot stamped against unchanged sources is fresh and exits 0', () => {
  const skillRoot = makeSkill(['SKILL.md', 'references/roles.md', 'specs/state-layout.md', 'scripts/snapshot_stale.mjs']);
  const snapshotPath = makeSnapshot(freshStamp(skillRoot));
  const result = checkSnapshot({ snapshotPath });
  assert.equal(result.status, 'fresh');
  assert.equal(result.reason, null);
  assert.equal(result.entries.length, 4);
  for (const entry of result.entries) assert.equal(entry.verdict, 'ok');

  const cli = runCli(['--snapshot', snapshotPath]);
  assert.equal(cli.status, EXIT.fresh, cli.stderr);
  assert.match(cli.stdout, /snapshot fresh/);
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
  const teamDir = tempDir('jj-team-team-');
  const snapshotPath = path.join(teamDir, 'team-snapshot.md');
  const body = [
    'staleness-stamp v2',
    `skill_root: ${skillRoot}`,
    'generated_at: 2026-09-01T00:00:00.000Z',
    `SKILL.md\t${OLD.toISOString()}`
  ].join('\n');
  fs.writeFileSync(snapshotPath, `# team-snapshot\n\n\`\`\`stamp\n${body}\n\`\`\`\n`, 'utf8');
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
  const built = buildStamp({ skillRoot, now: () => '2026-09-01T00:00:00.000Z' });
  assert.deepEqual(
    built.files.map((f) => f.path),
    ['SKILL.md', 'references/roles.md', 'specs/state-layout.md'],
    'the stamp is sorted so the block is byte-stable between runs'
  );
  const parsed = parseStamp(built.block);
  assert.equal(parsed.skill_root, skillRoot);
  assert.equal(parsed.generated_at, '2026-09-01T00:00:00.000Z');
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
  const built = buildStamp({ skillRoot, now: () => '2026-09-01T00:00:00.000Z' });
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
  const teamDir = tempDir('jj-team-team-');
  fs.writeFileSync(
    path.join(teamDir, 'team-snapshot.md'),
    `# team-snapshot\n\n${freshStamp(skillRoot)}\n`,
    'utf8'
  );
  const cli = runCli(['--team-dir', teamDir, '--json']);
  assert.equal(cli.status, EXIT.fresh, cli.stderr);
  const payload = JSON.parse(cli.stdout);
  assert.equal(payload.status, 'fresh');
  assert.equal(payload.snapshot, path.join(teamDir, 'team-snapshot.md'));
  assert.equal(payload.entries.length, 2);

  fs.utimesSync(path.join(skillRoot, 'SKILL.md'), NEWER, NEWER);
  const stale = runCli(['--team-dir', teamDir, '--json']);
  assert.equal(stale.status, EXIT.stale);
  assert.equal(JSON.parse(stale.stdout).status, 'stale');
});

test('--stamp prints a block for the real skill source and includes its own script', () => {
  // The distributed copy must contain this script, or the check cannot see it change.
  const cli = runCli(['--stamp', '--skill-root', path.join(root, 'skills', 'jj-team')]);
  assert.equal(cli.status, EXIT.fresh, cli.stderr);
  const parsed = parseStamp(cli.stdout);
  assert.ok(parsed, 'the emitted block must parse back');
  assert.equal(parsed.skill_root, path.join(root, 'skills', 'jj-team'));
  assert.ok(parsed.files.has('SKILL.md'));
  assert.ok(parsed.files.has('scripts/snapshot_stale.mjs'));
  assert.ok(parsed.files.has('specs/state-layout.md'));
  assert.ok(parsed.files.has('references/roles.md'));
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
  // Each of these three combinations used to exit 0 while checking nothing:
  // `--stamp` wins and no snapshot is ever read, or `--team-dir` overwrites the
  // `--snapshot` value on the way out of parseArgs. Exit 0 is the one code a caller
  // acts on, so a combination that does nothing must not be able to produce it.
  const skillRoot = makeSkill(['SKILL.md']);
  const snapshotPath = makeSnapshot(freshStamp(skillRoot));
  const teamDir = path.dirname(snapshotPath);
  for (const argv of [
    ['--stamp', '--snapshot', snapshotPath],
    ['--stamp', '--team-dir', teamDir],
    ['--snapshot', snapshotPath, '--team-dir', teamDir]
  ]) {
    const cli = runCli(argv);
    assert.equal(cli.status, EXIT.usage, argv.join(' ') + ' must be a usage error');
    assert.match(cli.stderr, /^usage: /m, argv.join(' ') + ' must say which rule it broke');
  }
  // The legal pairing still works: --stamp owns the output, --skill-root says where.
  const ok = runCli(['--stamp', '--skill-root', skillRoot]);
  assert.equal(ok.status, EXIT.fresh, ok.stderr);
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

test('--skill-root cannot be combined with --team-dir: it is a --stamp-only flag', () => {
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
  assert.match(unverifiable.stderr, /regenerate the snapshot: run this script with --stamp/);

  const stalePath = makeSnapshot(freshStamp(skillRoot));
  fs.utimesSync(path.join(skillRoot, 'SKILL.md'), NEWER, NEWER);
  const stale = runCli(['--snapshot', stalePath]);
  assert.equal(stale.status, EXIT.stale);
  assert.match(stale.stderr, /regenerate the snapshot: run this script with --stamp/);
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
