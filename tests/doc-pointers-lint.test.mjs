/**
 * doc-pointers-lint.test.mjs — tests for `scripts/lint-doc-pointers.mjs`.
 *
 * The lint reports pointers that do not say which file they mean, and it is a
 * warning on purpose: the bare-basename shorthand is inherited from the specs
 * and has not been changed, so nothing here may be phrased as a verdict and
 * nothing here may fail a gate. Half the cases below therefore assert the
 * *absence* of a finding — the three ways a reader resolves the shorthand
 * without being told — because over-reporting is how a warning becomes noise
 * nobody reads.
 *
 * Each test is also the named killer for exactly one mutation of the lint, so
 * the grouping is not incidental. Where two assertions would share a guard, the
 * one that owns the guard is the one that asserts it and the other says so in a
 * comment: the line number belongs to the token test, the candidate order and
 * the candidate list in the message belong to the finding test, and the file
 * counts belong to the scan-set test. Two consequences are worth naming, because
 * both are easy to "fix" into collateral later:
 *
 *   - the scan-set test plants its reference in the referrer only and makes it
 *     ambiguous, so that breaking any resolution rule leaves it reported and
 *     this test keeps exactly one subject: which files get read;
 *   - the resolution tests plant their reference in the referrer only, so a
 *     second file in the list cannot resolve the same basename a different way
 *     and red the test for a reason it does not name.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EXIT,
  RULE,
  WARNING_NOTE,
  bareBasenameRefs,
  currentRepoFiles,
  lintPointers,
  main,
  report,
} from '../scripts/lint-doc-pointers.mjs';

test('bareBasenameRefs collects backticked file names and ignores paths, globs and words', () => {
  // Only a backticked name with no directory part is the unresolvable form. A
  // path resolves on its own, a glob is not a pointer, a leading hyphen is a
  // flag, and a word with no extension is a word far more often than a path.
  // Plain (unbackticked) text is not collected either: that would make every
  // sentence about `README` a finding.
  const refs = bareBasenameRefs([
    'prose `state.mjs` prose',
    'prose `SKILL.md:52` prose',
    'prose `src/ralph/state.mjs` prose',
    'prose `*.md` prose',
    'prose `--force.md` prose',
    'prose `jj-flow` prose',
    'prose state.mjs prose',
    'prose `docs/commands.md:173` prose',
  ].join('\n'));
  assert.deepEqual(refs, [
    { line: 1, token: 'state.mjs', base: 'state.mjs' },
    { line: 2, token: 'SKILL.md:52', base: 'SKILL.md' },
  ]);
});

test('a bare basename with one candidate is not reported', () => {
  // One candidate resolves itself, whatever directory it is in. That the
  // reference was collected at all is the token test's claim, so it is not
  // re-asserted here: a second assertion on the same counter would hand one
  // mutation two killers.
  const files = ['docs/a.md', 'src/state.mjs'];
  const result = lintPointers(files, { readFile: () => 'see `state.mjs` for the gate' });
  assert.deepEqual(result.findings, []);
});

test('a bare basename with a same-directory candidate is not reported', () => {
  // `SKILL.md` inside `skills/jj-ralph/` is that file. The repo has a dozen of
  // them, and every one of those references is readable without being told.
  const files = [
    'skills/jj-ralph/SKILL.md',
    'skills/jj-dispatch/SKILL.md',
    'skills/jj-end/SKILL.md',
    'skills/jj-evaluated/SKILL.md',
  ];
  const result = lintPointers(files, { readFile: () => 'see `SKILL.md` for the protocol' });
  assert.deepEqual(result.findings, []);
});

test('a bare basename with exactly one ancestor candidate is not reported', () => {
  // `index.md` inside `docs/adr/` is `docs/adr/index.md`, and failing that,
  // `docs/index.md`. One ancestor is enough to resolve it. The reference is
  // planted in the referrer alone: the other two files are candidate-index
  // entries, and letting them speak too would make this test depend on how a
  // *second* file resolves the same basename.
  const near = ['docs/index.md', 'docs/exec-plans/index.md', 'docs/adr/a.md'];
  assert.deepEqual(
    lintPointers(near, { readFile: (file) => (file === 'docs/adr/a.md' ? 'see `index.md`' : '') }).findings,
    [],
  );

  // Two ancestors is not: from `docs/adr/deep/` the shorthand could mean either,
  // and it does not say which.
  const deep = ['docs/index.md', 'docs/adr/index.md', 'docs/adr/deep/a.md'];
  const findings = lintPointers(deep, { readFile: (file) => (file === 'docs/adr/deep/a.md' ? 'see `index.md`' : '') }).findings;
  assert.equal(findings.length, 1);
  assert.equal(findings[0].file, 'docs/adr/deep/a.md');
});

test('a bare basename with several unrelated candidates is reported with all of them', () => {
  // The real shape from this repo: `state.mjs` exists under `src/` and under the
  // ralph skill's bundled lib, so a reader who resolves it the wrong way lands
  // on a file that is current and is not the one that was meant. Both candidates
  // are named; neither is picked.
  const files = [
    'docs/design-docs/ralph-skill-slim.md',
    'src/ralph/state.mjs',
    'skills/jj-ralph/scripts/lib/ralph/state.mjs',
  ];
  const result = lintPointers(files, {
    readFile: (file) => (file === 'docs/design-docs/ralph-skill-slim.md' ? 'the gate lives in `state.mjs`\n' : ''),
  });
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].rule, RULE);
  assert.equal(result.findings[0].file, 'docs/design-docs/ralph-skill-slim.md');
  assert.equal(result.findings[0].token, 'state.mjs');
  assert.deepEqual(result.findings[0].candidates, [
    'skills/jj-ralph/scripts/lib/ralph/state.mjs',
    'src/ralph/state.mjs',
  ]);
  assert.ok(result.findings[0].message.includes('skills/jj-ralph/scripts/lib/ralph/state.mjs'));
  assert.ok(result.findings[0].message.includes('src/ralph/state.mjs'));
  // The candidate index spans every file the repo owns, whatever its extension:
  // both candidates here are `.mjs`, and a `.md`-only index would find none.
  // The list is asserted in sorted order because a candidate list whose order
  // moves between runs cannot be read as a diff. The line number is asserted
  // where it is computed, in the token test above, and the file counts below, so
  // that neither mutation kills two tests.
});

test('a bare basename with no candidate is not reported by this rule', () => {
  // A dangling pointer is a different defect with a different fix, and
  // `docs:check` already catches dead links by building the site.
  const result = lintPointers(['docs/a.md'], { readFile: () => 'see `nowhere.mjs`' });
  assert.deepEqual(result.findings, []);
});

test('only markdown files are scanned for references', () => {
  // The candidate index spans every file the repo owns; the scan does not. A
  // `.mjs` file is full of backticked names that are strings, not pointers, so
  // reading one would report a fixture rather than a document. The one reference
  // is planted in a single referrer and is ambiguous on purpose: it has to stay
  // reported however the resolution rules are broken, so that this test has
  // exactly one subject — which files get read. Every other file is read and
  // says nothing, which is also what proves the counter below counts references
  // rather than files. The counts are asserted here and nowhere else.
  const files = [
    'docs/a.md',
    'skills/jj-ralph/SKILL.md',
    'skills/jj-dispatch/SKILL.md',
    'src/lib.mjs',
    'tests/x.test.mjs',
  ];
  const read = [];
  const result = lintPointers(files, {
    readFile: (file) => {
      read.push(file);
      return file === 'docs/a.md' ? 'see `SKILL.md`' : '';
    },
  });
  assert.deepEqual(read, ['docs/a.md', 'skills/jj-ralph/SKILL.md', 'skills/jj-dispatch/SKILL.md']);
  assert.equal(result.scanned, 3);
  assert.equal(result.references, 1);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].file, 'docs/a.md');
});

test('currentRepoFiles asks git for the repo-owned file set, ignore rules applied', () => {
  const calls = [];
  const exec = (command, args) => {
    calls.push({ command, args });
    return { status: 0, stdout: 'docs/a.md\nsrc/b.mjs\n\n', stderr: '' };
  };
  assert.deepEqual(currentRepoFiles('/repo', { exec }), ['docs/a.md', 'src/b.mjs']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'git');
  // `--exclude-standard` is what keeps generated host install mirrors out of the
  // candidate index; `--others` is what lets the lint see an uncommitted file.
  assert.deepEqual(calls[0].args, ['ls-files', '--cached', '--others', '--exclude-standard']);

  // A lint that silently scans nothing when git fails is worse than one that
  // stops, because an empty candidate index resolves every reference uniquely.
  assert.throws(
    () => currentRepoFiles('/repo', { exec: () => ({ status: 128, stdout: '', stderr: 'not a git repository' }) }),
    /git ls-files failed/,
  );
});

test('the pointer lint warns and never fails a gate', () => {
  // The shorthand this reports on has not been changed, so a gate that failed on
  // it would fail on legal content. That is why there is no failing exit code,
  // and why the report says in words, under the findings it just printed, that
  // it reports candidates rather than judging them.
  const files = [
    'docs/a.md',
    'skills/jj-ralph/SKILL.md',
    'skills/jj-dispatch/SKILL.md',
  ];
  const options = {
    cwd: '/nowhere',
    exec: () => ({ status: 0, stdout: `${files.join('\n')}\n`, stderr: '' }),
    readFile: (file) => (file.endsWith('a.md') ? 'the gate lives in `SKILL.md`\n' : ''),
  };
  const result = lintPointers(files, { readFile: options.readFile });
  assert.equal(result.findings.length, 1);

  // Warnings, not defects: the exit code does not depend on what was found.
  assert.equal(main([], options), EXIT.clean);
  assert.equal(main([], { ...options, readFile: () => 'no pointers here\n' }), EXIT.clean);
  assert.equal(EXIT.clean, 0);

  const rendered = report(result);
  assert.ok(rendered.includes(WARNING_NOTE));
  assert.ok(rendered.includes('does not judge which one was meant'));
  assert.ok(rendered.includes('[pointer-basename-ambiguous] docs/a.md'));
});
