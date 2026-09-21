/**
 * doc-tables-lint.test.mjs — tests for `scripts/lint-doc-tables.mjs`.
 *
 * The lint reports *rendered-page* defects, not editorial ones, so every case
 * here is written as "what does the page look like": a row past the header's
 * column count loses its extra cells, a table cut by a blank line renders its
 * tail as a paragraph of literal pipes. A case that only reads wrong in an
 * editor is deliberately absent.
 *
 * Each test is also the named killer for exactly one mutation of the lint, so
 * the grouping is not incidental: a rule that two tests both depend on would
 * turn a single injected defect into two red tests, and then "the red one is
 * the named assertion" could not be proved. Cases that share a guard are
 * therefore one test with two fixtures.
 *
 * Two of these cases exist because an earlier version of the lint got them
 * wrong on this repo's own docs, and both were found by running it, not by
 * reasoning: a blank line between two *adjacent* tables was reported as a cut
 * (284 false positives across the repo), and a fenced table in a CRLF file
 * leaked out of the fence because `.` does not match `\r`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EXIT,
  countSeparators,
  currentDocPaths,
  isDelimiterRow,
  lintDocTables,
  lintTables,
  main,
  report,
} from '../scripts/lint-doc-tables.mjs';

const clean = (lines) => lintTables(lines).findings;

// The repo root, so the wiring test can read `scripts/check-docs.mjs` as text.
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Shared by the two tests that assert the CLI's exit code: one hands `main` the
// defective surface, the other the clean one. They live at module scope because
// the defect half belongs to the rule that produces it, while the clean half
// belongs to the exit code itself.
const defective = '| a | b |\n| --- | --- |\n| 1 | 2 | 3 |\n';
const ok = '| a | b |\n| --- | --- |\n| 1 | 2 |\n';

test('countSeparators treats an escaped pipe as a literal, not a separator', () => {
  // The count is *pipes*, not cells, so a two-cell row `| a | b |` is three:
  // the leading pipe, the one between the cells, the trailing one. GFM renders
  // `\|` as a pipe character inside the cell, so an escaped pipe is not a cell
  // boundary — which is why escaping it is the rendering-preserving fix.
  assert.equal(countSeparators('| a | b |'), 3);
  assert.equal(countSeparators('| a \\| b | c |'), 3);
  assert.equal(countSeparators('| `a|b` | c |'), 4);
  assert.equal(countSeparators('| `a\\|b` | c |'), 3);
  assert.equal(countSeparators('no pipes here'), 0);
});

test('isDelimiterRow accepts the delimiter forms this repo uses', () => {
  assert.ok(isDelimiterRow('| --- | --- |'));
  assert.ok(isDelimiterRow('|---|---|'));
  assert.ok(isDelimiterRow('| :--- | ---: |'));
  assert.ok(isDelimiterRow('  | --- | --- |  '));
  assert.ok(!isDelimiterRow('| text | text |'));
  // Two-or-more hyphens per cell, copied from the R-5 prototype rather than
  // reinvented. Measured against this repo: 480 delimiter rows, 12 distinct
  // cell forms, none with a single hyphen. The boundary is therefore safe here
  // and is a known limitation rather than an accident — see the lint's header.
  assert.ok(!isDelimiterRow('| - | - |'));
  assert.ok(!isDelimiterRow('| :-: | --- |'));
});

test('a row must carry the header\'s pipe count, in either direction', () => {
  // GFM drops the cells past the header's column count, so the third value is
  // silently absent from the page; a short row leaves its last column empty.
  // Both directions are one invariant, so they are one test: a mutation that
  // switches the comparison off must turn exactly one test red.
  // Injected so no test ever needs a repo on disk.
  const options = {
    cwd: '/nowhere',
    manifest: { documentation_policy: { current_roots: ['docs'], excluded_paths: [] } },
    readdir: () => [{ name: 'a.md', isDirectory: () => false }],
    readFile: (file) => (file.endsWith('a.md') ? defective : ok),
  };
  const tooMany = clean([
    '| 命令 | 说明 |',
    '| --- | --- |',
    '| `jj x` | does a thing | and this is silently dropped |',
  ]);
  assert.equal(tooMany.length, 1);
  assert.equal(tooMany[0].rule, 'table-row-separator-mismatch');
  assert.equal(tooMany[0].line, 3);
  assert.equal(tooMany[0].expected, '3 separators');
  assert.equal(tooMany[0].actual, '4 separators');

  const tooFew = clean([
    '| 命令 | 说明 | 备注 |',
    '| --- | --- | --- |',
    '| `jj x` | does a thing |',
  ]);
  assert.equal(tooFew.length, 1);
  assert.equal(tooFew[0].rule, 'table-row-separator-mismatch');
  assert.equal(tooFew[0].line, 3);
  assert.equal(tooFew[0].expected, '4 separators');
  assert.equal(tooFew[0].actual, '3 separators');

  // The gate half of the contract lives here, not in its own test, because an
  // exit code is only observable through a finding, and a finding can only come
  // from one of the lint's rules. Any other rule's fixture would make the
  // "switch the comparison off" mutation kill two tests instead of one, and
  // then "the red one is the named assertion" could not be proved.
  assert.equal(lintDocTables(['docs/a.md'], { readFile: () => defective }).findings.length, 1);
  assert.equal(main(['docs/a.md'], options), EXIT.defects);
});

test('main reports a clean document surface as clean', () => {
  // The other half of the exit-code contract. Returning `defects` when there is
  // nothing to report is the one mutation that can *only* be seen from here:
  // every test that observes a defect already belongs to the rule that produced
  // it. A gate must not be able to read "the docs are fine" as "the docs are
  // broken" either — that is a red build nobody trusts.
  const options = {
    cwd: '/nowhere',
    manifest: { documentation_policy: { current_roots: ['docs'], excluded_paths: [] } },
    readdir: () => [{ name: 'a.md', isDirectory: () => false }],
    readFile: () => ok,
  };
  assert.equal(main([], options), EXIT.clean);
});

test('a table whose rows all match the header produces no findings', () => {
  assert.deepEqual(clean([
    'some prose',
    '',
    '| 命令 | 说明 |',
    '| --- | --- |',
    '| `jj a` | one |',
    '| `jj b` | two |',
    '',
    'more prose',
  ]), []);
});

test('a blank line that ends a table is not a defect', () => {
  // Regression: the first version of this rule reported every blank line after
  // a table, which flagged 284 ordinary table endings in this repo's own docs.
  // A table that is finished is finished; only rows *continuing* after the
  // blank are a defect.
  assert.deepEqual(clean([
    '| 命令 | 说明 |',
    '| --- | --- |',
    '| `jj a` | one |',
    '',
    '### next section',
  ]), []);
});

test('a table cut by a blank line is reported once, at its first continuing row', () => {
  const findings = clean([
    '| 命令 | 说明 |',
    '| --- | --- |',
    '| `jj a` | one |',
    '',
    '| `jj b` | two |',
    '| `jj c` | three |',
  ]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, 'table-cut-by-blank-line');
  assert.equal(findings[0].line, 5);
  // Once, not once per row: the tail renders as one paragraph of literal pipes.
  assert.match(findings[0].message, /blank line at 4/);
  assert.match(findings[0].message, /2 row\(s\)/);
});

test('pipe-looking rows outside any table are reported, not silently dropped', () => {
  const findings = clean([
    'prose prose prose',
    '| a | b |',
    '| c | d |',
  ]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, 'table-row-without-header');
  assert.equal(findings[0].line, 2);
});

test('a table drawn inside a fenced code block is an example, not a table', () => {
  const lines = [
    '```markdown',
    '| 命令 | 说明 |',
    '| --- | --- |',
    '| `jj a` | one | extra |',
    '```',
  ];
  assert.deepEqual(lintTables(lines).findings, []);
  assert.deepEqual(lintTables(lines).tables, []);

  // The same file with CRLF line endings. This is the sharpest regression in
  // the file: `.` does not match `\r` and `$` does not match before one, so an
  // opening fence ending in `\r` failed to match while the closing one
  // (anchored with `\s*$`) still did. On a CRLF file every fence then leaked
  // and the pipes inside it were read as tables — two real false positives in
  // this repo's own docs, both now covered here.
  const crlf = [
    'Some prose.',
    '',
    '```text',
    '| 命令 | 说明 |',
    '| --- | --- |',
    '| `jj a` | one |',
    '```',
    '',
    'Trailing prose.',
  ].map((line) => `${line}\r`);
  assert.deepEqual(lintTables(crlf).findings, []);
  assert.deepEqual(lintTables(crlf).tables, []);
});

test('a CRLF file still lints its real tables', () => {
  // The other half of the CRLF fix: normalising the line endings must not be
  // implemented by ignoring CRLF files. The observable signal here is the
  // *structure* — which tables were found, and how many rows each has — rather
  // than a row finding, because once the endings are normalised a row check is
  // the same code path as on an LF file and the case above already covers it.
  // A mutation that drops CRLF lines instead of trimming them is caught here and
  // only here.
  const { tables, findings } = lintTables([
    '| 命令 | 说明 |',
    '| --- | --- |',
    '| `jj a` | one |',
    '| `jj b` | two |',
  ].map((line) => `${line}\r`));
  assert.deepEqual(findings, []);
  // `headerLine` is deliberately not asserted: which line a header is attributed
  // to is a rule with its own named killer, and it has no CRLF-specific aspect,
  // so pinning it here would make that rule's mutation kill two tests. What is
  // CRLF-specific is that the table is found at all and its rows are counted.
  assert.equal(tables.length, 1);
  assert.equal(tables[0].endLine, 4);
  assert.equal(tables[0].rows, 2);
});

test('a row followed by a delimiter row starts a table, however the row was reached', () => {
  // The header is only known once the delimiter row shows up, so the scan keeps
  // the previous row as a candidate. A blank line *above* a header is ordinary,
  // and a blank line *between two adjacent tables* is ordinary too — requiring
  // the header row to arrive without a preceding blank line is what produced
  // the 284 false positives.
  const { tables, findings } = lintTables([
    '',
    '| a | b |',
    '| --- | --- |',
    '| 1 | 2 |',
    '',
    '| c | d |',
    '| --- | --- |',
    '| 3 | 4 |',
  ]);
  assert.deepEqual(findings, []);
  assert.deepEqual(tables, [
    { file: '(inline)', headerLine: 2, endLine: 4, rows: 1 },
    { file: '(inline)', headerLine: 6, endLine: 8, rows: 1 },
  ]);
});

test('report prints every rule it is handed and never invents one', () => {
  const rendered = report({
    tables: 3,
    scanned: 2,
    findings: [
      { rule: 'table-row-separator-mismatch', file: 'docs/a.md', line: 12, message: 'row has 4 cell separators, header at 9 has 3' },
      { rule: 'table-cut-by-blank-line', file: 'docs/b.md', line: 40, message: '1 row(s) continue the table ended by the blank line at 39' },
    ],
  });
  assert.match(rendered, /doc-tables: 2 defect\(s\) in 2 files/);
  assert.ok(rendered.includes('[table-row-separator-mismatch] docs/a.md:12'));
  assert.ok(rendered.includes('[table-cut-by-blank-line] docs/b.md:40'));
  assert.equal(report({ tables: 0, scanned: 0, findings: [] }), 'doc-tables: clean (0 tables in 0 files)');
  // --json is the raw object, so a caller never has to parse the prose.
  assert.deepEqual(JSON.parse(report({ tables: 1, scanned: 1, findings: [] }, { json: true })), { tables: 1, scanned: 1, findings: [] });
});

test('currentDocPaths reads the repo policy instead of a hardcoded list', () => {
  const manifest = {
    documentation_policy: {
      current_roots: ['docs'],
      current_files: ['README.md'],
      excluded_paths: ['docs/evaluations', 'docs/stale.md'],
    },
  };
  const tree = {
    docs: ['a.md', 'stale.md'],
    'docs/evaluations': ['old.md'],
  };
  // A real filesystem walk would need a repo; the point under test is that the
  // policy's three lists are honoured, so the tree is handed in directly.
  const readdir = (absolute) => {
    const name = absolute.replace(/\\/g, '/').replace(/^\/fake\/?/, '') || '.';
    return (tree[name] || []).map((entry) => ({ name: entry, isDirectory: () => !entry.endsWith('.md') }));
  };
  assert.deepEqual(currentDocPaths('/fake', { manifest, readdir }), ['README.md', 'docs/a.md']);
});

test('docs:check gates on the table lint before it builds the site', () => {
  // A lint nobody runs is a script, not a gate. This is the whole point of
  // deliverable ③, and the end-to-end proof (a defect in docs/commands makes
  // `npm run docs:check` exit 1 before the build starts) is too slow to repeat
  // here — it would cost every run a 40-second vitepress build. What is asserted
  // instead is the wiring that made that run fail fast, so deleting or inverting
  // the hook turns this test red rather than silently unpicking the gate.
  //
  // One test, not two: "the import is gone" and "the gate is gone" are the same
  // wiring being absent, and splitting them would make both fail together.
  const checkDocs = fs.readFileSync(path.join(ROOT, 'scripts/check-docs.mjs'), 'utf8');
  const importAt = checkDocs.indexOf('scripts/lint-doc-tables.mjs');
  assert.notEqual(importAt, -1, 'check-docs.mjs no longer imports the table lint');
  const buildAt = checkDocs.indexOf('vitepress.js');
  assert.notEqual(buildAt, -1, 'check-docs.mjs no longer builds the site');

  // Before, not after: a defect must fail without waiting for the build. A hook
  // placed after it still gates, but only after minutes of wasted work.
  assert.ok(importAt < buildAt, 'the table lint is imported after the site build');

  const hook = checkDocs.slice(importAt, buildAt);
  assert.match(hook, /!==\s*TABLE_LINT\.clean/, 'the lint\'s exit code is not compared against clean');
  assert.ok(hook.includes("failCheck('文档表格结构缺陷"), 'a non-clean lint does not fail the gate');
});
