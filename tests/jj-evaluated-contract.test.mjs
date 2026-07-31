import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptsDir = path.join(root, '.codex', 'skills', 'jj-evaluated', 'scripts');
const validateScript = path.join(scriptsDir, 'episode-validate.mjs');
const opsScript = path.join(scriptsDir, 'evaluated_ops.mjs');
const skillMd = path.join(root, '.codex', 'skills', 'jj-evaluated', 'SKILL.md');
const fixturePath = path.join(root, 'tests', 'fixtures', 'evaluated-episode.valid.json');

function runNode(script, args, options = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    cwd: options.cwd || root,
    env: process.env
  });
}

test('valid episode fixture validates with exit 0', () => {
  const result = runNode(validateScript, [fixturePath, '--json']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.errors.length, 0);
  assert.ok(payload.event_count >= 1);
});

test('missing clock_quality fails validation', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-eval-missing-'));
  try {
    const badPath = path.join(cwd, 'bad.json');
    fs.writeFileSync(
      badPath,
      JSON.stringify({
        episode_id: 'EP-bad',
        events: [
          {
            event_id: 'evt-1',
            episode_id: 'EP-bad',
            kind: 'agent_turn',
            timestamp_provenance: 'thread'
          }
        ]
      }),
      'utf8'
    );
    const result = runNode(validateScript, [badPath, '--json']);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, false);
    assert.ok(
      payload.errors.some(
        (e) => e.path.includes('clock_quality') || e.message.includes('clock_quality')
      ),
      JSON.stringify(payload.errors)
    );
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('evaluated_ops validate delegates to episode-validate', () => {
  const result = runNode(opsScript, ['validate', '--episode', fixturePath, '--json']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
});

test('check-split with complete keys succeeds', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-eval-split-ok-'));
  try {
    const manifest = path.join(cwd, 'split.json');
    fs.writeFileSync(
      manifest,
      JSON.stringify({
        optimization: ['EP-a', 'EP-b'],
        holdout: ['EP-c'],
        regression: ['EP-d']
      }),
      'utf8'
    );
    const result = runNode(opsScript, ['check-split', '--manifest', manifest, '--json']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, true);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('check-split missing holdout fails', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-eval-split-bad-'));
  try {
    const manifest = path.join(cwd, 'split.json');
    fs.writeFileSync(
      manifest,
      JSON.stringify({
        search: ['EP-a'],
        regression: ['EP-b']
      }),
      'utf8'
    );
    const result = runNode(opsScript, ['check-split', '--manifest', manifest, '--json']);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, false);
    assert.ok(
      payload.errors.some((e) => e.code === 'MISSING_HOLDOUT' || e.path.includes('holdout')),
      JSON.stringify(payload.errors)
    );
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('check-split rejects overlapping ids', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-eval-split-overlap-'));
  try {
    const manifest = path.join(cwd, 'split.json');
    fs.writeFileSync(
      manifest,
      JSON.stringify({
        optimization: ['EP-shared'],
        holdout: ['EP-shared'],
        regression: []
      }),
      'utf8'
    );
    const result = runNode(opsScript, ['check-split', '--manifest', manifest, '--json']);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.ok(payload.errors.some((e) => e.code === 'OVERLAPPING_ID'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('init-report creates report.md', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-eval-report-'));
  try {
    const out = path.join(cwd, 'evaluated-out');
    const result = runNode(opsScript, [
      'init-report',
      '--out',
      out,
      '--episode-id',
      'EP-test-report'
    ]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.episode_id, 'EP-test-report');
    assert.ok(fs.existsSync(payload.path));
    assert.equal(path.basename(payload.path), 'report.md');
    const body = fs.readFileSync(payload.path, 'utf8');
    assert.match(body, /EP-test-report/);
    assert.match(body, /Baseline table/i);
    assert.match(body, /Promotion status/i);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('skill description does not claim Claude /jj-evaluated slash', () => {
  const text = fs.readFileSync(skillMd, 'utf8');
  // Frontmatter description must not advertise /jj-evaluated as the entry
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(fm, 'SKILL.md frontmatter missing');
  const descriptionLine = fm[1]
    .split(/\r?\n/)
    .find((line) => line.startsWith('description:'));
  assert.ok(descriptionLine, 'description field missing');
  assert.equal(
    /through\s+\/jj-evaluated|Use.*\/jj-evaluated/.test(descriptionLine),
    false,
    `description still routes via Claude-style slash: ${descriptionLine}`
  );
  assert.match(text, /experimental/i);
  assert.match(text, /no Claude/i);
  assert.ok(
    !text.includes('through /jj-evaluated'),
    'body must not claim through /jj-evaluated'
  );
});

test('empty episode file fails', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-eval-empty-'));
  try {
    const emptyPath = path.join(cwd, 'empty.json');
    fs.writeFileSync(emptyPath, '', 'utf8');
    const result = runNode(validateScript, [emptyPath, '--json']);
    assert.notEqual(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
