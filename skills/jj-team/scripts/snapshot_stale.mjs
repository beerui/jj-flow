#!/usr/bin/env node
/**
 * snapshot_stale.mjs — mechanical staleness check for a team's team-snapshot.md.
 *
 * Two blocks are checked, because a snapshot can be wrong in two ways.
 *
 * 1. The **staleness stamp**: the modification time of every file of the loaded skill
 *    (the whole tree, not a known list of directories) at snapshot time, recorded
 *    against the host path the skill was actually loaded from.
 * 2. The **environment fingerprint**: what the Phase 3 probe read when the roster and
 *    the rubric were chosen. The stamp says nothing about this half — a skill file
 *    untouched for a month still leaves a roster pinned to models that no longer
 *    exist and a rubric written for a project that has since grown an SDK.
 *
 * The fingerprint is split, and the split is the point:
 *
 *   derived  — what the script can recompute from the project right now: the model
 *              surface named in the host's agent definitions, the stack, the published
 *              surface, the conventional directories. Nobody's judgement is in here.
 *   declared — what the team wrote down in its own ledger (`team-session.json`):
 *              capabilities, the model per role, the rubric ids. A judgement, recorded.
 *
 * Re-deriving both at check time is what makes the split useful. A drift in `derived`
 * means the environment moved under a roster nobody re-measured; a drift in `declared`
 * means the ledger was rewritten after the snapshot (a `rebuild`, or a hand edit) and
 * the cached prompts describe a team that no longer exists.
 *
 * This script answers one question with an exit code:
 *
 *   0  fresh        — every stamped file is unchanged, no source file is unaccounted
 *                     for, and both halves of the fingerprint still re-derive
 *   1  stale        — a source file changed / appeared / disappeared after the
 *                     snapshot, or a fingerprint half drifted
 *   2  unverifiable — no snapshot, no parseable stamp, no parseable fingerprint, a
 *                     fingerprint that does not match its own contents, or a project
 *                     the fingerprint names that is gone
 *   3  usage        — the command itself is wrong; nothing was checked
 *
 * Exit code 2 is deliberately distinct from 1: "cannot tell" is not "changed", and
 * collapsing the two would make a missing stamp read as a pass. It holds for the
 * fingerprint too, and harder: a snapshot with no fingerprint block is **unverifiable**,
 * not fresh — the alternative is a snapshot that reports exit 0 while saying nothing
 * at all about the half that goes stale most often.
 * Exit code 3 is deliberately distinct from 2: a mistyped command is not a snapshot
 * this script failed to read, and 2 sends the reader off to regenerate a stamp.
 * It also emits both blocks (`--stamp`), so no mtime and no digest is ever hand-written
 * — a fabricated value is exactly the kind of ledger lie this product refuses to write.
 *
 * Usage:
 *   node snapshot_stale.mjs --stamp [--team-dir <dir>] [--skill-root <dir>]
 *                                       # print the stamp block, plus the fingerprint
 *                                       # block when --team-dir names the team's ledger
 *   node snapshot_stale.mjs --snapshot <file> [--json]        # check one snapshot
 *   node snapshot_stale.mjs --team-dir <dir> [--json]         # check <dir>/team-snapshot.md
 *
 * `--snapshot` and `--team-dir` are alternatives for *checking*; the checked file
 * defaults to `<team-dir>/team-snapshot.md`. `--team-dir` may also be passed to
 * `--stamp`, where it is the only way to say which team's ledger the declared half
 * of the fingerprint comes from — `--stamp` reads no snapshot, so it never reads
 * `--snapshot`.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const STAMP_INFO = 'stamp';
export const STAMP_HEADER = 'staleness-stamp v1';

export const FINGERPRINT_INFO = 'fingerprint';
export const FINGERPRINT_HEADER = 'environment-fingerprint v1';

/**
 * The four signals the Phase 3 probe reads off the project, in canonical order.
 * The script and `SKILL.md` name the same four: a probe table the script cannot
 * recompute is a promise, and a signal the docs do not name is an implementation
 * detail nobody can review.
 */
export const DERIVED_SIGNALS = ['models', 'stack', 'surface', 'conventions'];

/** The three things a team declares in its own ledger, in canonical order. */
export const DECLARED_SECTIONS = ['capabilities', 'models', 'review_rubric'];

const SECTION_ORDER = [
  ...DERIVED_SIGNALS.map((name) => `derived ${name}`),
  ...DECLARED_SECTIONS.map((name) => `declared ${name}`)
];

/**
 * The fixed set of conventional paths the probe looks for. Small on purpose: a signal
 * set that grew with the repo would drift the fingerprint every time a directory
 * appeared, and a fingerprint that cries wolf is one nobody reads.
 */
export const CONVENTION_PATHS = ['.plans', '.workflow', 'AGENTS.md', 'CLAUDE.md', 'docs'];

/**
 * The agent-definition surfaces that carry a `model:` line, as project-relative dirs.
 * A Claude-Code-only project has neither, so its model surface is empty and the
 * roster's models come from the host itself — recorded as empty, not guessed at.
 */
const MODEL_SURFACES = ['.grok/agents', '.codex/agents'];

/** Exit codes, exported so callers and tests share one vocabulary. */
export const EXIT = { fresh: 0, stale: 1, unverifiable: 2, usage: 3 };

export function defaultSkillRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function toPosix(rel) {
  return rel.split(path.sep).join('/');
}

/** Stable key order, so the same content always produces the same block and digest. */
function byKey(a, b) {
  return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
}

function sortedEntries(map) {
  return [...(map ?? new Map()).entries()].sort(byKey);
}

function isDirectory(abs) {
  try {
    return fs.statSync(abs).isDirectory();
  } catch {
    return false;
  }
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function readJsonFile(file) {
  const text = readText(file);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * The `model:` line of a markdown file's YAML frontmatter, or null.
 *
 * Frontmatter only, on purpose. The same word appears in prose ("we considered
 * another model:"), and a prose mention would put a sentence in a field the check
 * compares byte for byte. A file with no frontmatter has no declared model, which
 * is a recorded fact rather than a defect.
 */
function frontmatterModel(text) {
  const fence = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!fence) return null;
  const line = /^model:\s*(.+?)\s*$/m.exec(fence[1]);
  return line ? line[1] : null;
}

/** `<dir>/<name>.md` for every markdown file directly under `abs`, sorted. */
function markdownFiles(abs) {
  let entries;
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * `derived models` — the model each agent-definition file declares, keyed by its
 * project-relative path. This is the signal that decides `roles[].model`, and the
 * one most likely to move: a host upgrade edits these files and nothing else.
 */
function modelSurface(projectPath) {
  const out = [];
  for (const dir of MODEL_SURFACES) {
    const abs = path.join(projectPath, ...dir.split('/'));
    for (const name of markdownFiles(abs)) {
      const model = frontmatterModel(readText(path.join(abs, name)) ?? '');
      if (model) out.push([`${dir}/${name}`, model]);
    }
  }
  return out.sort(byKey);
}

/**
 * `derived stack` — the manifest name and its direct dependency names.
 *
 * A project with no `package.json` records an empty section. That is honest: the
 * script does not guess at a Python or Go manifest, and an empty signal is a
 * statement about what this product can see, not a claim that there is no stack.
 */
function stackSignal(projectPath) {
  const pkg = readJsonFile(path.join(projectPath, 'package.json'));
  if (pkg === null) return [];
  const out = [];
  if (typeof pkg.name === 'string' && pkg.name !== '') out.push(['name', pkg.name]);
  const deps = pkg.dependencies && typeof pkg.dependencies === 'object' ? Object.keys(pkg.dependencies).sort() : [];
  if (deps.length > 0) out.push(['dependencies', deps.join(',')]);
  return out;
}

/**
 * `derived surface` — the published `files` list. What ships is the surface a
 * reviewer is asked to have an opinion about, and it changes rarely enough that
 * recording it costs nothing.
 */
function surfaceSignal(projectPath) {
  const pkg = readJsonFile(path.join(projectPath, 'package.json'));
  if (pkg === null || !Array.isArray(pkg.files)) return [];
  const files = pkg.files.filter((entry) => typeof entry === 'string').sort();
  return files.length > 0 ? [['files', files.join(',')]] : [];
}

/** `derived conventions` — presence only, for the fixed list above. */
function conventionsSignal(projectPath) {
  return CONVENTION_PATHS.map((rel) => [rel, isDirectory(path.join(projectPath, rel)) || fs.existsSync(path.join(projectPath, rel)) ? 'yes' : 'no']);
}

/**
 * Recompute the four derived signals for a project. Returns a Map of section name to
 * a Map of key → value. Every section is present, even when empty: a missing section
 * would be indistinguishable from a signal that found nothing.
 */
export function deriveEnvironment(projectPath) {
  return new Map([
    ['derived models', new Map(modelSurface(projectPath))],
    ['derived stack', new Map(stackSignal(projectPath))],
    ['derived surface', new Map(surfaceSignal(projectPath))],
    ['derived conventions', new Map(conventionsSignal(projectPath))]
  ]);
}

/**
 * The rubric ids as the fingerprint records them. The new shape is
 * `{floor, project[], all}`; a ledger written before that shape carries a bare array,
 * and reading it as "no rubric at all" would make every legacy snapshot drift.
 */
function rubricSignal(rubric) {
  if (Array.isArray(rubric)) return [['all', rubric.filter((id) => typeof id === 'string' && id !== '').join(',')]];
  if (rubric === null || typeof rubric !== 'object') return [];
  const out = [];
  if (Array.isArray(rubric.floor) && rubric.floor.length > 0) out.push(['floor', rubric.floor.join(',')]);
  if (Array.isArray(rubric.project) && rubric.project.length > 0) {
    out.push(['project', rubric.project.map((d) => (d && typeof d.id === 'string' ? d.id : '')).filter((id) => id !== '').join(',')]);
  }
  if (Array.isArray(rubric.all) && rubric.all.length > 0) out.push(['all', rubric.all.join(',')]);
  return out;
}

/**
 * The declared half, read out of `team-session.json`.
 *
 * Only three projections, and only the fields the Phase 3 probe fills: capabilities,
 * the model per role, the rubric ids. `last_seen_at` and `tasks[]` are rewritten on
 * every touch, so including them would drift the fingerprint on every invocation —
 * a fingerprint that changes when nothing environmental changed is noise, and noise
 * is how a guard gets switched off.
 */
export function declaredFromSession(session) {
  const caps = session && typeof session.capabilities === 'object' && session.capabilities !== null ? session.capabilities : null;
  const capMap = new Map();
  for (const key of ['teammates', 'task_board']) {
    if (caps && typeof caps[key] === 'boolean') capMap.set(key, String(caps[key]));
  }
  const roleMap = new Map();
  if (session && Array.isArray(session.roles)) {
    for (const role of session.roles) {
      if (!role || typeof role.name !== 'string' || role.name === '') continue;
      if (typeof role.model !== 'string' || role.model === '') continue;
      roleMap.set(role.name, role.model);
    }
  }
  return new Map([
    ['declared capabilities', capMap],
    ['declared models', roleMap],
    ['declared review_rubric', new Map(rubricSignal(session ? session.review_rubric : null))]
  ]);
}

/**
 * The canonical text a digest is taken over. `generated_at` is deliberately outside
 * it: the digest identifies an *environment*, and a re-stamped snapshot of an
 * unchanged environment must produce the same one. Sorted by key, so the digest is
 * over content and not over the order someone happened to paste the lines in.
 */
function canonicalText(project, sections) {
  const lines = [`project\t${project}`];
  for (const name of SECTION_ORDER) {
    lines.push(`section\t${name}`);
    for (const [key, value] of sortedEntries(sections.get(name))) lines.push(`${key}\t${value}`);
  }
  return `${lines.join('\n')}\n`;
}

function digestOf(canonical) {
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Build the environment fingerprint block. `now` is injectable so output is testable.
 * Returns `{block, project, fingerprint, sections}`.
 *
 * Two refusals, both of which used to be possible as a half-written block. Without a
 * readable `team-session.json` the declared half is unknown, and emitting the block
 * anyway would record "the team declared nothing" — a claim about a ledger nobody
 * read. Without a `project_path` there is nothing to derive from, and a fingerprint
 * of an empty environment would read as fresh forever.
 */
export function buildFingerprint({
  teamDir,
  now = () => new Date().toISOString(),
  derive = deriveEnvironment,
  declaredFrom = declaredFromSession
}) {
  const sessionPath = path.join(teamDir, 'team-session.json');
  const session = readJsonFile(sessionPath);
  if (session === null) {
    throw new Error(`cannot read ${sessionPath}: the declared half of the fingerprint is the team's own ledger`);
  }
  const project = typeof session.project_path === 'string' && session.project_path !== '' ? session.project_path : null;
  if (project === null) {
    throw new Error('team-session.json has no project_path: the fingerprint has nothing to derive from');
  }
  if (!isDirectory(project)) {
    throw new Error(`project_path is not a directory: ${project}`);
  }
  const posix = toPosix(project);
  const sections = new Map([...derive(project), ...declaredFrom(session)]);
  const fingerprint = digestOf(canonicalText(posix, sections));
  const lines = [FINGERPRINT_HEADER, `project: ${posix}`, `generated_at: ${now()}`, `fingerprint: ${fingerprint}`];
  for (const name of SECTION_ORDER) {
    lines.push(name);
    for (const [key, value] of sortedEntries(sections.get(name))) lines.push(`${key}\t${value}`);
  }
  return { block: ['```' + FINGERPRINT_INFO, ...lines, '```'].join('\n'), project: posix, fingerprint, sections };
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
 * Read a fingerprint block out of a markdown document and say why it could not be read.
 * Returns `{block, defect}` — exactly one is non-null, and every value that leaves
 * here has been validated, for the same reason `readStamp` validates: whatever this
 * function returns reaches a comparison.
 *
 * A missing block is the case worth stating twice. It returns `defect`, never an
 * empty fingerprint: a snapshot that carries no environment claim must not be able
 * to report exit 0, because exit 0 is the one code a caller acts on.
 *
 * Every section is required. An absent `derived stack` is not "this project has no
 * manifest" — that is an *empty* section, which is recorded and distinguishable. An
 * absent section means the block was written by something other than `--stamp`, and
 * the reader is told which one is missing rather than handed a partial fingerprint.
 */
function readFingerprint(markdown) {
  const lines = String(markdown).split('\n');
  const fence = `\`\`\`${FINGERPRINT_INFO}`;
  const starts = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === fence) starts.push(i + 1);
  }
  if (starts.length === 0) return { block: null, defect: 'no environment fingerprint' };
  if (starts.length > 1) return { block: null, defect: 'more than one environment fingerprint' };
  const body = [];
  for (let i = starts[0]; i < lines.length; i += 1) {
    if (lines[i].trim().startsWith('```')) break;
    body.push(lines[i]);
  }
  const trimmed = body.filter((line) => line.trim() !== '');
  if (trimmed.length === 0 || trimmed[0].trim() !== FINGERPRINT_HEADER) {
    return { block: null, defect: 'no readable environment fingerprint' };
  }
  const block = { project: null, generated_at: null, fingerprint: null, sections: new Map() };
  const seen = new Set();
  let current = null;
  for (const line of trimmed.slice(1)) {
    const header = /^(project|generated_at|fingerprint):\s*(.*)$/.exec(line.trim());
    if (header) {
      block[header[1]] = header[2].trim();
      continue;
    }
    const text = line.trim();
    if (/^(derived|declared) [a-z_]+$/.test(text)) {
      if (!SECTION_ORDER.includes(text)) return { block: null, defect: `unknown fingerprint section: ${text}` };
      if (seen.has(text)) return { block: null, defect: `the fingerprint declares ${text} twice` };
      seen.add(text);
      current = text;
      block.sections.set(text, new Map());
      continue;
    }
    if (current === null) return { block: null, defect: `a fingerprint line is outside every section: ${text}` };
    const parts = line.includes('\t') ? line.split('\t') : line.split(/ {2,}/);
    if (parts.length < 2) {
      return { block: null, defect: `a fingerprint line is not "<key><TAB><value>": ${text}` };
    }
    const key = parts[0].trim();
    const value = parts.slice(1).join(' ').trim();
    if (!key) return { block: null, defect: `a fingerprint line has no key: ${text}` };
    if (!value) return { block: null, defect: `the fingerprint value for ${key} is empty` };
    block.sections.get(current).set(key, value);
  }
  for (const name of SECTION_ORDER) {
    if (!seen.has(name)) return { block: null, defect: `the fingerprint has no ${name} section` };
  }
  if (!block.project) return { block: null, defect: 'the fingerprint has no project' };
  if (!isEmittedIso(block.generated_at)) {
    return {
      block: null,
      defect: `generated_at is not the ISO-8601 this script emits (with Z): ${block.generated_at}`
    };
  }
  if (!/^[0-9a-f]{64}$/.test(block.fingerprint)) {
    return { block: null, defect: `fingerprint is not a sha256 digest: ${block.fingerprint}` };
  }
  return { block, defect: null };
}

/**
 * Parse a fingerprint block out of a markdown document. Null when there is no
 * ```fingerprint fence, or when the block cannot be read — the "unverifiable" case,
 * never an empty fingerprint that would compare equal to anything.
 */
export function parseFingerprint(markdown) {
  return readFingerprint(markdown).block;
}

/**
 * Compare a parsed fingerprint against the environment and the ledger it names.
 * Returns `{status, drift, reason}`; drift is `[{section, key, recorded, current}]`.
 *
 * The digest is checked before the signals, and a mismatch is **unverifiable**, not
 * stale. A block that does not hash to its own contents was edited after it was
 * emitted; telling that reader to "regenerate" would launder the edit into a fresh
 * stamp, which is precisely the lie the digest exists to catch. So the tampered case
 * gets its own verdict and never a regeneration instruction.
 */
export function checkFingerprint({
  block,
  snapshotPath,
  derive = deriveEnvironment,
  declaredFrom = declaredFromSession
}) {
  const project = path.resolve(block.project);
  if (!isDirectory(project)) {
    return { status: 'unverifiable', drift: [], reason: `the fingerprinted project is not a directory: ${block.project}` };
  }
  if (digestOf(canonicalText(block.project, block.sections)) !== block.fingerprint) {
    return {
      status: 'unverifiable',
      drift: [],
      reason: 'the environment fingerprint does not match its own contents: it was edited after it was emitted'
    };
  }
  const sessionPath = path.join(path.dirname(snapshotPath), 'team-session.json');
  const session = readJsonFile(sessionPath);
  if (session === null) {
    return { status: 'unverifiable', drift: [], reason: `cannot re-read the declared half: ${sessionPath}` };
  }
  const expected = new Map([...derive(project), ...declaredFrom(session)]);
  const drift = [];
  for (const name of SECTION_ORDER) {
    const recorded = block.sections.get(name) ?? new Map();
    const current = expected.get(name) ?? new Map();
    for (const key of new Set([...recorded.keys(), ...current.keys()])) {
      const before = recorded.has(key) ? recorded.get(key) : null;
      const after = current.has(key) ? current.get(key) : null;
      if (before !== after) drift.push({ section: name, key, recorded: before, current: after });
    }
  }
  if (drift.length > 0) return { status: 'stale', drift, reason: null };
  return { status: 'fresh', drift: [], reason: null };
}

/**
 * Compare a snapshot's stamp against the skill root it names.
 * Returns `{status, entries, fingerprint, reason}`; entries is
 * `[{path, verdict, stamped, current}]`. verdict is one of `ok | newer | missing | added`.
 * `fingerprint` is `{status, drift, reason}` for the environment half, or null when the
 * document could not be read far enough to have one.
 */
export function checkSnapshot({
  snapshotPath,
  statMtime = makeStatMtime(),
  derive = deriveEnvironment,
  declaredFrom = declaredFromSession
}) {
  let text;
  try {
    text = fs.readFileSync(snapshotPath, 'utf8');
  } catch {
    return { status: 'unverifiable', entries: [], fingerprint: null, reason: `snapshot not readable: ${snapshotPath}` };
  }
  const { stamp, defect } = readStamp(text);
  if (!stamp) {
    const suffix = defect === 'more than one staleness stamp'
      ? ': replace the stamp block, do not append to it'
      : '';
    return { status: 'unverifiable', entries: [], fingerprint: null, reason: `${defect} in ${snapshotPath}${suffix}` };
  }
  // Read the fingerprint before touching the filesystem. Both blocks describe the
  // document itself, so a snapshot that is unreadable *as a document* is reported
  // that way rather than as a skill tree that drifted — and a snapshot with no
  // fingerprint at all is unverifiable, never fresh.
  const { block: fingerprintBlock, defect: fingerprintDefect } = readFingerprint(text);
  if (!fingerprintBlock) {
    return {
      status: 'unverifiable',
      entries: [],
      fingerprint: null,
      reason: `${fingerprintDefect} in ${snapshotPath}: regenerate both blocks with --stamp --team-dir <team dir>`
    };
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
  const fingerprint = checkFingerprint({ block: fingerprintBlock, snapshotPath, derive, declaredFrom });
  // "Cannot tell" outranks "changed", in both directions: a fingerprint that cannot be
  // checked is reported as unverifiable even when a source file is also newer, because
  // the reader's next step differs. Regenerating would be wrong if the real problem is
  // an unreadable ledger, and skipping the regeneration would be wrong if it is not.
  if (fingerprint.status === 'unverifiable') {
    return { status: 'unverifiable', entries, fingerprint, reason: fingerprint.reason };
  }
  const bad = entries.filter((entry) => entry.verdict !== 'ok');
  if (bad.length > 0 || fingerprint.status === 'stale') {
    return { status: 'stale', entries, fingerprint, reason: null };
  }
  return { status: 'fresh', entries, fingerprint, reason: null };
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
  //
  // `--team-dir` is no longer banned alongside `--stamp`: it is now how `--stamp` learns
  // which team's ledger the *declared* half of the fingerprint comes from. What stays
  // banned is `--snapshot`, and for the original reason — `--stamp` reads no snapshot,
  // so a file named as a check target would be silently dropped on the floor.
  if (out.stamp && out.snapshot !== null) {
    throw new Error('--stamp prints blocks and checks nothing: it cannot be combined with --snapshot');
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
    process.stdout.write(`snapshot fresh: ${snapshotPath} (${result.entries.length} stamped files match, environment fingerprint re-derives)\n`);
    return;
  }
  if (result.status === 'unverifiable') {
    process.stderr.write(`snapshot unverifiable: ${result.reason}\n`);
    // Same next step as the stale branch, and for the same reason: both outcomes
    // leave the reader with a block to replace, and a reason alone is not an action.
    process.stderr.write('regenerate the snapshot: run this script with --stamp --team-dir <team dir> and replace both blocks\n');
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
  // Which half drifted is the whole report. "The environment changed" sends the reader
  // to re-run the probe and re-pin the roster; "the ledger was rewritten" sends them to
  // re-derive the prompts. One undifferentiated "stale" answers neither.
  for (const item of result.fingerprint?.drift ?? []) {
    const half = item.section.startsWith('derived') ? 'derived' : 'declared';
    process.stderr.write(
      `stale: environment fingerprint drifted — ${item.section}: ${item.key} ` +
      `(recorded ${item.recorded === null ? '(absent)' : item.recorded}, now ${item.current === null ? '(absent)' : item.current}; ${half})\n`
    );
  }
  process.stderr.write('regenerate the snapshot: run this script with --stamp --team-dir <team dir> and replace both blocks\n');
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
    process.stdout.write('usage: snapshot_stale.mjs [--stamp [--team-dir <dir>]] [--skill-root <dir>] [--snapshot <file>|--team-dir <dir>] [--json]\n');
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
    if (args.teamDir === null) {
      // Not an error: a stamp on its own is still a stamp. It is said out loud,
      // because the check fails closed on a snapshot with no fingerprint, and a
      // reader who pasted only this block deserves to know why.
      process.stderr.write('note: no --team-dir, so only the staleness stamp was emitted; the environment fingerprint needs --team-dir to read the team\'s ledger\n');
      return EXIT.fresh;
    }
    let fingerprint;
    try {
      fingerprint = buildFingerprint({ teamDir: args.teamDir });
    } catch (error) {
      // A half-written block would record "the team declared nothing" — a claim about
      // a ledger nobody read. Refusing, and naming the file, is the only honest exit.
      process.stderr.write(`fingerprint failed: ${error.message}\n`);
      return EXIT.unverifiable;
    }
    process.stdout.write(`${fingerprint.block}\n`);
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
