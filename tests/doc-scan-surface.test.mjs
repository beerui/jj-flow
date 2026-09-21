/**
 * doc-scan-surface.test.mjs — tests for `scripts/doc-scan-surface.mjs`.
 *
 * The guard's whole value is that it can go red, so most of this file is negative
 * controls: a gap with no name, a gap whose naming rules have been stripped, and a
 * file the table lint audits but git does not own. A version of this script that
 * always prints `unexplained 0` would pass every positive case here and be worth
 * nothing, which is why the positive case also asserts the gap is non-empty.
 *
 * The fixtures inject at the two seams the script exposes — `exec` for the pointer
 * lint's `git ls-files`, `manifest` for the table lint's `documentation_policy` —
 * so no test writes into the repo. The trailing-slash case is not hypothetical: the
 * first real run of this guard reported 100 unexplained files because the manifest
 * entries were written `skills/` and the matching semantics (borrowed from
 * `excluded_paths`) append a separator, making the pattern `skills//`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EXIT,
  explainingRule,
  main,
  pointerDocSurface,
  report,
  scanSurfaceDiff,
  tableDocSurface,
} from '../scripts/doc-scan-surface.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** `currentRepoFiles`' exec contract, stubbed: a git that prints one file list. */
const gitListing = (files) => () => ({ status: 0, stdout: `${files.join('\n')}\n`, stderr: '' });

/** A throwaway repo holding exactly these paths, so `currentDocPaths` walks for real. */
function fixture(files) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-surface-'));
  for (const file of files) {
    const full = path.join(cwd, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, '# fixture\n', 'utf8');
  }
  return cwd;
}

const policy = (extra = {}) => ({
  current_roots: ['docs'],
  current_files: [],
  excluded_paths: [],
  non_documentation_paths: [],
  ...extra,
});

test("the repo's own two surfaces really differ, and every file in the gap is named", () => {
  const diff = scanSurfaceDiff(ROOT);
  // A gap of zero would make every other test here vacuous: there would be nothing
  // left to explain, and `unexplained 0` would hold for a script that does nothing.
  assert.ok(diff.difference > 0, 'the two lints must not already scan the same surface');
  assert.deepEqual(diff.unexplained, []);
  assert.deepEqual(diff.onlyInTable, []);
  assert.equal(diff.explained.length, diff.onlyInPointer.length);
  // Both rules earn their place: each explains at least one file.
  assert.ok(diff.byRule.non_documentation_paths > 0);
  assert.ok(diff.byRule.excluded_paths > 0);
});

test('explainingRule matches the path itself or anything under it — and a trailing slash is not a prefix', () => {
  const rules = { excluded_paths: ['docs/other'], non_documentation_paths: ['skills', 'CHANGELOG.md'] };
  assert.equal(explainingRule('docs/other/x.md', rules), 'excluded_paths');
  assert.equal(explainingRule('skills/a/b.md', rules), 'non_documentation_paths');
  assert.equal(explainingRule('CHANGELOG.md', rules), 'non_documentation_paths');
  // Same first segment, not the same directory.
  assert.equal(explainingRule('skills-thing.md', rules), null);
  assert.equal(explainingRule('skillsof/x.md', rules), null);
  assert.equal(explainingRule('README.md', rules), null);
  // The trap that cost a real run: the semantics append a separator, so the entry
  // 'skills/' builds the pattern 'skills//' and matches nothing at all.
  assert.equal(explainingRule('skills/a.md', { non_documentation_paths: ['skills/'] }), null);
});

test('a file only the pointer lint sees, that no rule names, is unexplained and fails', () => {
  const files = ['docs/a.md', 'zzz-new-thing/README.md'];
  const cwd = fixture(files);
  const options = { exec: gitListing(files), manifest: { documentation_policy: policy() } };
  const diff = scanSurfaceDiff(cwd, options);
  assert.deepEqual(diff.onlyInPointer, ['zzz-new-thing/README.md']);
  assert.deepEqual(diff.unexplained, ['zzz-new-thing/README.md']);
  assert.equal(diff.explained.length, 0);
  assert.equal(main([], { cwd, ...options }), EXIT.unexplained);
});

test('a file only the table lint sees is a gap, not a choice — git cannot audit it', () => {
  // There is deliberately no explanation rule for this direction. A document the
  // pointer lint cannot index is a hole in the pointer lint's coverage, and letting
  // a manifest key paper over it would hide exactly the drift this guard counts.
  const files = ['docs/a.md'];
  const cwd = fixture([...files, 'docs/untracked.md']);
  const options = {
    exec: gitListing(files),
    manifest: { documentation_policy: policy({ current_files: ['docs/untracked.md'] }) },
  };
  const diff = scanSurfaceDiff(cwd, options);
  assert.deepEqual(diff.onlyInTable, ['docs/untracked.md']);
  assert.deepEqual(diff.unexplained, []);
  assert.equal(main([], { cwd, ...options }), EXIT.unexplained);
});

test('stripping the two rules turns the whole gap unexplained, so they carry the explanation', () => {
  const files = ['docs/a.md', 'skills/jj/SKILL.md', 'CHANGELOG.md', 'docs/other/old.md'];
  const cwd = fixture(files);
  const named = scanSurfaceDiff(cwd, {
    exec: gitListing(files),
    manifest: {
      documentation_policy: policy({
        excluded_paths: ['docs/other'],
        non_documentation_paths: ['skills', 'CHANGELOG.md'],
      }),
    },
  });
  assert.deepEqual(named.unexplained, []);
  assert.deepEqual(named.byRule, { excluded_paths: 1, non_documentation_paths: 2 });

  const stripped = scanSurfaceDiff(cwd, {
    exec: gitListing(files),
    manifest: { documentation_policy: policy() },
  });
  // `docs/other/old.md` is deliberately absent: with `excluded_paths` also gone, the
  // table walk reads it from `docs/`, so it is in BOTH surfaces and there is no gap
  // to explain. Only the two files the table surface structurally cannot reach —
  // a file outside any current root, and the root changelog — remain.
  assert.deepEqual(stripped.unexplained, ['CHANGELOG.md', 'skills/jj/SKILL.md']);
});

test('report prints the counts when clean and names every unexplained file when not', () => {
  const files = ['docs/a.md', 'zzz/x.md'];
  const cwd = fixture(files);
  const clean = scanSurfaceDiff(cwd, {
    exec: gitListing(files),
    manifest: { documentation_policy: policy({ non_documentation_paths: ['zzz'] }) },
  });
  const cleanText = report(clean);
  assert.match(cleanText, /doc-scan-surface: pointer lint 2 files, table lint 1 files, difference 1/);
  assert.match(cleanText, /explained 1 \(non_documentation_paths=1\), unexplained 0/);

  const dirty = scanSurfaceDiff(cwd, {
    exec: gitListing(files),
    manifest: { documentation_policy: policy() },
  });
  const dirtyText = report(dirty);
  assert.match(dirtyText, /\[UNEXPLAINED\] zzz\/x\.md/);
  assert.match(dirtyText, /unexplained 1, unexplained-in-table 0/);
  // It must say how to fix it, or the red is just an accusation.
  assert.match(dirtyText, /non_documentation_paths/);
});

test('both surfaces are read from their own source, not from a third list', () => {
  const cwd = fixture(['docs/a.md', 'skills/b.md']);
  assert.deepEqual(pointerDocSurface(cwd, { exec: gitListing(['docs/a.md', 'skills/b.md', 'src/x.mjs']) }), [
    'docs/a.md',
    'skills/b.md',
  ]);
  assert.deepEqual(
    tableDocSurface(cwd, { manifest: { documentation_policy: policy({ non_documentation_paths: ['skills'] }) } }),
    ['docs/a.md']
  );
});

test('the manifest key exists, every entry is on disk, and none of it is current documentation', () => {
  // This is the pairing the guard depends on. The contradiction half is not
  // hypothetical either: the first version declared `skills` non-documentation while
  // `current_files` still hand-listed four `skills/*/SKILL.md`, and `harness:check`
  // caught it as four HNS-DOC-011 findings.
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'harness-manifest.json'), 'utf8'));
  const entries = manifest.documentation_policy.non_documentation_paths;
  assert.ok(Array.isArray(entries) && entries.length > 0, 'non_documentation_paths must be declared');
  for (const entry of entries) {
    assert.ok(fs.existsSync(path.join(ROOT, entry)), `${entry} 不在盘上`);
  }
  const surface = new Set(tableDocSurface(ROOT, { manifest }));
  assert.ok(surface.size > 0);
  for (const entry of entries) {
    for (const file of surface) {
      assert.ok(!(file === entry || file.startsWith(`${entry}/`)), `${file} 同时是当前文档和 ${entry}`);
    }
  }
});

test('the schema permits the key, so the manifest and the schema cannot drift apart', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/harness-manifest.schema.json'), 'utf8'));
  const properties = schema.properties.documentation_policy.properties;
  assert.ok(properties.non_documentation_paths, 'schema must declare non_documentation_paths');
  // additionalProperties: false means an undeclared key is a schema violation, which
  // is what makes this test the thing that notices a manifest-only edit.
  assert.equal(schema.properties.documentation_policy.additionalProperties, false);
});

test('docs:check runs the guard before it builds, so a gap fails fast', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts/check-docs.mjs'), 'utf8');
  const guardAt = source.indexOf('scripts/doc-scan-surface.mjs');
  const buildAt = source.indexOf('vitepress.js');
  assert.ok(guardAt > 0, 'docs:check must invoke doc-scan-surface');
  assert.ok(buildAt > guardAt, 'the guard must run before the multi-minute build');
  assert.match(source, /SURFACE\.clean/);
});
