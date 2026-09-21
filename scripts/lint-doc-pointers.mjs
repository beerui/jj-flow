#!/usr/bin/env node
/**
 * lint-doc-pointers.mjs — bare-basename pointer lint for this repo's own docs.
 *
 * WHY THIS EXISTS. A reference written as `state.mjs` does not say which file it
 * means. In this repo the same basename lives in two homes — `src/ralph/state.mjs`
 * and `skills/jj-ralph/scripts/lib/ralph/state.mjs` — and a reader who resolves it
 * the wrong way lands on a file that exists, is current, and is not the one that
 * was meant. That is the failure mode: not a broken link, a *plausible* one.
 *
 * WHAT IT DOES NOT CLAIM. This is a warning, not a verdict. The bare-basename
 * shorthand is inherited from the specs (`specs/state-layout.md` writes full paths
 * but its restatements abbreviate to `role.md`), so a bare basename is a
 * convention that has not been changed, not a mistake that has been proven. The
 * lint therefore lists the candidates and stops. It never says which one was
 * meant, it never fails a gate, and it has no failing exit code at all.
 *
 * Two ways a reader resolves the shorthand without being told, so neither is
 * reported: the candidate in the *same directory* as the referring file
 * (`SKILL.md` inside `skills/jj-ralph/`), and the single candidate in an
 * *ancestor* directory (`index.md` inside `docs/adr/` is `docs/adr/index.md`,
 * falling back to `docs/index.md`). What is left — several candidates, none of
 * them local — is the case where the shorthand genuinely does not decide.
 *
 * WHAT IT DOES NOT LOOK AT, so they are not discovered later as surprises:
 *   - a basename with no candidate anywhere is not reported by this rule. It is a
 *     dangling pointer, which is a different defect with a different fix, and
 *     `docs:check` already catches dead links by building the site.
 *   - markdown link targets (`[x](index.md)`) are not collected. Those *do* have
 *     a resolution rule — relative to the referring file — so they are not the
 *     unresolvable form this lint is about.
 *   - unbackticked names are not collected, and neither are names without an
 *     extension (`README`, `jj-flow`), which are words far more often than paths.
 *   - fenced code blocks are scanned. Measured against this repo that yields zero
 *     extra findings today, so there is no fence handling to get wrong; a fenced
 *     *illustration* of a bad pointer would be reported, and that is the price of
 *     the simplicity.
 *   - `docs:check` does not run this. Hooking a warning-level lint into a gate
 *     would turn every one of these into a red build, which is exactly what the
 *     unchanged convention forbids.
 *
 * Usage:
 *   node scripts/lint-doc-pointers.mjs [--json] [path ...]
 *
 * Exit codes:
 *   0  always. Warnings are printed; they never fail anything.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Warning level, stated as a constant so it cannot drift: there is no failing
 * exit code. `main` returns this whatever it finds.
 */
export const EXIT = { clean: 0 };

/** The rule id. One rule, because there is one thing being reported. */
export const RULE = 'pointer-basename-ambiguous';

/**
 * Printed under every non-empty report. It is the reason this file is a lint and
 * not a gate, so it says plainly that it reports candidates and does not judge.
 */
export const WARNING_NOTE = 'doc-pointers: warning level — this reports candidates, it does not judge which one was meant; the bare-basename shorthand is inherited from the specs and has not been changed yet, so nothing here is a defect and nothing here fails a gate';

/** A backticked token, e.g. `` `state.mjs` `` or `` `SKILL.md:52` ``. */
const BACKTICK_TOKEN = /`([^`\n]+)`/g;

/**
 * A file name with no directory part, optionally carrying a `:line` or
 * `:line-line` suffix. No `/` or `\` (that would make it a path, which resolves
 * fine), no `*` (a glob is not a pointer), no leading `-` (that is a flag), and
 * the extension is required.
 */
const BARE_FILE = /^([A-Za-z0-9_.][A-Za-z0-9._-]*\.[A-Za-z0-9]{1,8})(?::(\d+)(?:-(\d+))?)?$/;

/**
 * Every backticked bare-basename reference in one file's text.
 *
 * Pure: no I/O and no repo, so a test can hand it a string and assert on exactly
 * the references it meant to provoke. Line numbers are 1-based and computed from
 * the match offset, so a file that mixes fences, tables and prose still reports
 * where the token actually is.
 *
 * Returns one entry per reference: `{ line, token, base }`.
 */
export function bareBasenameRefs(text) {
  const refs = [];
  for (const match of text.matchAll(BACKTICK_TOKEN)) {
    const token = match[1].trim();
    const parsed = BARE_FILE.exec(token);
    if (!parsed) continue;
    refs.push({
      line: text.slice(0, match.index).split('\n').length,
      token,
      base: parsed[1],
    });
  }
  return refs;
}

/**
 * Classify one bare-basename reference against the repo's file list.
 *
 * `unique`, `local` and `ancestor` are all "a reader can resolve this"; only
 * `ambiguous` is "the shorthand does not say". `unresolved` is a separate class
 * that this lint deliberately does not report — see the header.
 *
 * Private on purpose: the observable behaviour is "reported or not", and each of
 * the four classes is pinned by a separate absence-of-finding test in
 * `tests/doc-pointers-lint.test.mjs`. Exporting it would tempt a caller to
 * re-derive the semantics instead of using the one implementation.
 */
function resolveBasename(referrer, candidates) {
  if (candidates.length === 0) return 'unresolved';
  if (candidates.length === 1) return 'unique';
  const dir = path.posix.dirname(referrer);
  if (candidates.some((file) => path.posix.dirname(file) === dir)) return 'local';
  const ancestors = candidates.filter((file) => dir.startsWith(`${path.posix.dirname(file)}/`));
  return ancestors.length === 1 ? 'ancestor' : 'ambiguous';
}

/**
 * The repo's own file set, from git rather than from an invented skip list.
 *
 * `--exclude-standard` is the load-bearing flag: it is what keeps generated host
 * install mirrors (`.grok/`, `.qoder/`, `.claude/`) out of the candidate index.
 * AGENTS.md forbids treating those as repo SSOT, and counting them would triple
 * every candidate list and report references that are unambiguous on disk.
 * `--others` is what lets the lint see a file that has not been committed yet,
 * which is how it audits its own batch.
 */
export function currentRepoFiles(cwd = process.cwd(), { exec = spawnSync } = {}) {
  const run = exec('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd, encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`git ls-files failed: ${String(run.stderr || '').trim()}`);
  return String(run.stdout).split('\n').map((line) => line.trim()).filter(Boolean);
}

/**
 * Lint a set of files. Pure apart from `readFile`, which a test can replace.
 *
 * The one file list does two jobs: it is the scan set (its markdown files) and
 * the candidate index (all of it). That is deliberate — a pointer's candidates
 * are every file the repo owns, whatever its extension, so a reference to
 * `state.mjs` must be able to resolve against a `.mjs` file.
 *
 * Returns `{ findings, references, scanned }`.
 */
export function lintPointers(files, { readFile = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8') } = {}) {
  const index = new Map();
  for (const file of files) {
    const base = path.posix.basename(file);
    if (!index.has(base)) index.set(base, []);
    index.get(base).push(file);
  }

  const findings = [];
  let references = 0;
  let scanned = 0;
  for (const doc of files) {
    if (!doc.endsWith('.md')) continue;
    scanned += 1;
    for (const ref of bareBasenameRefs(readFile(doc))) {
      references += 1;
      const candidates = [...(index.get(ref.base) || [])].sort();
      if (resolveBasename(doc, candidates) !== 'ambiguous') continue;
      findings.push({
        rule: RULE,
        file: doc,
        line: ref.line,
        token: ref.token,
        base: ref.base,
        candidates,
        message: `\`${ref.token}\` names ${candidates.length} files: ${candidates.join(', ')}; the bare basename does not say which one was meant`,
      });
    }
  }
  return { findings, references, scanned };
}

export function report(result, { json = false } = {}) {
  if (json) return JSON.stringify(result, null, 2);
  const head = `doc-pointers: ${result.findings.length} ambiguous bare-basename reference(s) in ${result.scanned} files (${result.references} checked)`;
  if (!result.findings.length) return `${head}\n${WARNING_NOTE}`;
  const lines = [head];
  for (const item of result.findings) {
    lines.push(`  [${item.rule}] ${item.file}:${item.line} — ${item.message}`);
  }
  lines.push(WARNING_NOTE);
  return lines.join('\n');
}

export function main(argv, { cwd = process.cwd(), exec, readFile } = {}) {
  const json = argv.includes('--json');
  const paths = argv.filter((token) => !token.startsWith('-'));
  const files = paths.length ? paths : currentRepoFiles(cwd, { exec });
  const result = lintPointers(files, {
    readFile: readFile || ((file) => fs.readFileSync(path.join(cwd, file), 'utf8')),
  });
  process.stdout.write(`${report(result, { json })}\n`);
  // Warnings, not defects: the exit code does not depend on what was found.
  return EXIT.clean;
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
