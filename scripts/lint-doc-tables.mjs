#!/usr/bin/env node
/**
 * lint-doc-tables.mjs — GFM table-structure lint for this repo's current docs.
 *
 * WHY THIS EXISTS. A Markdown table whose rows do not carry the header's pipe
 * count is not a cosmetic problem: GFM drops cells beyond the header's column
 * count, so a row like `| a | b | c |` under a two-column header renders with
 * `c` gone, and a table cut by a blank line renders its remainder as a
 * paragraph of literal pipes. Both are silent — the file reads fine in an
 * editor and the page is wrong. `docs:check` builds the site but asserts only
 * that a handful of artifacts exist, so it never noticed.
 *
 * The semantics below are copied from the R-5 measurement prototype rather than
 * reinvented, because getting GFM right is the whole job:
 *   - a pipe escaped as `\|` is a literal pipe, not a cell separator, so escapes
 *     are stripped before counting. (Escaping inside a code span renders
 *     identically, so fixing a row this way never changes what the page shows.)
 *   - a table needs a header row followed by a delimiter row; a delimiter row
 *     with no header above it is not a table.
 *   - a blank line ends a table.
 *   - a pipe-looking line outside any table renders as literal text.
 *
 * WHAT IT DOES NOT CLAIM. It reports structural defects, not intent. A row that
 * legitimately has fewer cells is not "wrong" in an editor, but it *is* wrong on
 * the rendered page, and that is the only thing being asserted here.
 *
 * KNOWN LIMITS, so they are not discovered later as surprises:
 *   - a delimiter cell needs two or more hyphens (`| :-: |` is not a delimiter
 *     row here, so such a table's rows are reported as headerless). Measured
 *     against this repo: 480 delimiter rows, none using a single hyphen.
 *   - a table cut by a blank line whose continuation is exactly one row
 *     followed by a delimiter row reads as a new, legal table, and is not
 *     flagged. That is the price of not knowing a table's intent.
 *   - alignment, colspan and HTML tables are out of scope: only pipe tables.
 *
 * Usage:
 *   node scripts/lint-doc-tables.mjs [--json] [path ...]
 *
 * Exit codes:
 *   0  no structural defects
 *   1  at least one defect; each is printed with file, line and the pipe counts
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const EXIT = { clean: 0, defects: 1 };

/** A delimiter row: `| --- | :-: |` and friends. Must also look like a row. */
const DELIMITER_ROW = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** Opening fence: ``` or ~~~ (3+), optionally with an info string. */
const OPEN_FENCE = /^\s*(`{3,}|~{3,})(.*)$/;

/** Closing fence: the same character, at least as long, nothing after it. */
const CLOSING_FENCE = /^\s*(`{3,}|~{3,})\s*$/;

/**
 * Count the pipes that act as cell separators, ignoring `\|`.
 *
 * `\|` is a literal pipe in GFM, so a code span like `` `a|b` `` inside a table
 * cell must be written `` `a\|b` `` — the rendered text is identical either way,
 * which is why every fix this lint asks for is rendering-preserving.
 */
export function countSeparators(line) {
  const withoutEscapes = line.replace(/\\\|/g, '');
  return (withoutEscapes.match(/\|/g) || []).length;
}

/** True when the line is a GFM table delimiter row. */
export function isDelimiterRow(line) {
  return DELIMITER_ROW.test(line);
}

/**
 * Scan one file's lines for table defects. Pure: no I/O, so a test can hand it
 * a string array and assert on exactly the findings it meant to provoke.
 *
 * Returns `{ tables, findings }`:
 *   tables   — every header+delimiter block found, with its line range and row count
 *   findings — one per defect, each `{ rule, line, file, message, expected, actual }`
 *
 * A blank line ends a table, and that is normal — a blank line *before* a table's
 * header is normal too. It is a defect only when rows continue after the blank:
 * GFM renders those as a paragraph of literal pipes. So the state machine closes
 * the table silently, remembers that a blank line did it, and reports the rows
 * that turn up on the far side of that particular blank line.
 */
export function lintTables(lines, { file = '(inline)' } = {}) {
  const findings = [];
  const tables = [];

  // Normalise CRLF up front. `.` does not match `\r`, so on a CRLF file the
  // opening-fence pattern silently fails to match while the closing one still
  // does — every fence then leaks and the pipes inside it are read as tables.
  const source = lines.map((line) => line.replace(/\r$/, ''));

  let fence = null;        // { marker } while inside a fenced code block
  let header = null;       // { line, separators } of the table currently being read
  let run = null;          // rows seen outside any table: { first, count, afterCut }
  let cutBlank = null;     // blank line that just ended a table, if that is why
  let rows = 0;

  const finding = (rule, line, message, expected, actual) =>
    findings.push({ rule, line, file, message, expected, actual });

  const flushRun = () => {
    if (!run) return;
    if (run.afterCut !== null) {
      finding(
        'table-cut-by-blank-line',
        run.first,
        `${run.count} row(s) continue the table ended by the blank line at ${run.afterCut}; they render as literal pipes, not as table rows`,
        'no blank line inside a table',
        `${run.count} row(s) from line ${run.first}`,
      );
    } else {
      finding(
        'table-row-without-header',
        run.first,
        `${run.count} pipe-looking row(s) outside any table; they render as literal pipes, not as table rows`,
        'inside a header+delimiter table',
        `${run.count} row(s) from line ${run.first}`,
      );
    }
    run = null;
  };

  const closeTable = (endLine) => {
    if (header) tables.push({ file, headerLine: header.line, endLine, rows });
    header = null;
    rows = 0;
  };

  lines.forEach((_, index) => {
    const no = index + 1;
    const text = source[index];

    // --- code fences: a table drawn inside a fence is an example, not a table ---
    if (fence) {
      const closing = CLOSING_FENCE.exec(text);
      if (closing && closing[1][0] === fence.marker[0] && closing[1].length >= fence.marker.length) fence = null;
      return;
    }
    const opening = OPEN_FENCE.exec(text);
    if (opening) {
      fence = { marker: opening[1] };
      return;
    }

    const trimmed = text.trim();
    const looksLikeRow = trimmed.startsWith('|');

    if (header) {
      if (trimmed === '' || !looksLikeRow) {
        closeTable(no - 1);
        if (trimmed === '') {
          // A blank line is the only thing that can split a table. It is set
          // here rather than inside `closeTable` because this is the only branch
          // that returns before `cutBlank` is cleared at the bottom of the loop:
          // a table that ends because prose started was finished, not cut, and
          // its `cutBlank` is cleared in the same iteration it was set.
          cutBlank = no;
        }
        // fall through: this line still has to be classified below
      } else {
        const separators = countSeparators(text);
        if (separators !== header.separators) {
          finding(
            'table-row-separator-mismatch',
            no,
            `row has ${separators} cell separators, header at ${header.line} has ${header.separators}; GFM drops the cells past the header's column count`,
            `${header.separators} separators`,
            `${separators} separators`,
          );
        }
        rows += 1;
        return;
      }
    }

    if (trimmed === '') {
      flushRun();
      return;
    }

    if (looksLikeRow && isDelimiterRow(text)) {
      // One row followed by a delimiter row is a header: a table starts here.
      // A blank line above a header is ordinary, so it is not held against it.
      if (run && run.count === 1) {
        header = { line: run.first, separators: countSeparators(source[run.first - 1]) };
        rows = 0;
      } else {
        flushRun();
      }
      run = null;
      cutBlank = null;
      return;
    }

    if (looksLikeRow) {
      if (run) run.count += 1;
      else run = { first: no, count: 1, afterCut: cutBlank };
      cutBlank = null;
      return;
    }

    flushRun();
    cutBlank = null;
  });

  closeTable(lines.length);
  flushRun();

  return { tables, findings };
}

/**
 * The repo's own declared current-documentation surface, read from
 * `harness-manifest.json` rather than hardcoded — the same policy `docs:check`
 * already honours. Dated reports under `excluded_paths` stay out of scope:
 * they are historical evidence, not current documentation.
 */
export function currentDocPaths(cwd, {
  manifest = readJson(path.join(cwd, 'harness-manifest.json')),
  readdir = (absolute) => fs.readdirSync(absolute, { withFileTypes: true }),
} = {}) {
  const policy = manifest.documentation_policy || {};
  const roots = policy.current_roots || ['docs'];
  const excluded = policy.excluded_paths || [];
  const files = [];

  const visit = (relative) => {
    const absolute = path.join(cwd, relative);
    let entries;
    try {
      entries = readdir(absolute);
    } catch {
      return;
    }
    for (const entry of entries) {
      const child = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (entry.name.endsWith('.md') && !excluded.some((entry_) => child === entry_ || child.startsWith(`${entry_}/`))) files.push(child);
    }
  };

  for (const root of roots) visit(root);
  for (const file of policy.current_files || []) {
    if (file.endsWith('.md') && !excluded.some((entry) => file === entry || file.startsWith(`${entry}/`))) files.push(file);
  }

  return [...new Set(files)].sort();
}

/** Lint a set of files. Pure apart from `readFile`, which a test can replace. */
export function lintDocTables(paths, { cwd = process.cwd(), readFile = (file) => fs.readFileSync(path.join(cwd, file), 'utf8') } = {}) {
  const findings = [];
  let tables = 0;
  for (const file of paths) {
    const result = lintTables(readFile(file).split('\n'), { file });
    tables += result.tables.length;
    findings.push(...result.findings);
  }
  return { findings, tables, scanned: paths.length };
}

export function report(result, { json = false } = {}) {
  if (json) return JSON.stringify(result, null, 2);
  if (!result.findings.length) return `doc-tables: clean (${result.tables} tables in ${result.scanned} files)`;
  const lines = [`doc-tables: ${result.findings.length} defect(s) in ${result.scanned} files`];
  for (const item of result.findings) {
    lines.push(`  [${item.rule}] ${item.file}:${item.line} — ${item.message}`);
  }
  return lines.join('\n');
}

export function main(argv, {
  cwd = process.cwd(),
  manifest,
  readdir,
  readFile = (file) => fs.readFileSync(path.join(cwd, file), 'utf8'),
} = {}) {
  const json = argv.includes('--json');
  const paths = argv.filter((token) => !token.startsWith('-'));
  const targets = paths.length ? paths : currentDocPaths(cwd, { manifest, readdir });
  const result = lintDocTables(targets, { cwd, readFile });
  process.stdout.write(`${report(result, { json })}\n`);
  return result.findings.length ? EXIT.defects : EXIT.clean;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
