import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { collectPortEvidence } from '../skills/jj-same/scripts/collect-port-evidence.mjs';

const scriptDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../skills/jj-same/scripts',
);
const mjsPath = path.join(scriptDir, 'collect-port-evidence.mjs');
const shPath = path.join(scriptDir, 'collect-port-evidence.sh');
const ps1Path = path.join(scriptDir, 'collect-port-evidence.ps1');

function run(cmd, args, options = {}) {
  return spawnSync(cmd, args, {
    encoding: 'utf8',
    windowsHide: true,
    ...options,
  });
}

function git(repo, args) {
  const result = run('git', ['-C', repo, ...args]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function initRepo(root, name) {
  const repo = path.join(root, name);
  fs.mkdirSync(repo, { recursive: true });
  git(repo, ['init']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'jj-flow test']);
  // Avoid platform-dependent default branch surprises.
  git(repo, ['checkout', '-b', 'master']);
  return repo;
}

function writeCommit(repo, relativePath, content, message) {
  const absolute = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content, 'utf8');
  git(repo, ['add', relativePath]);
  git(repo, ['commit', '-m', message]);
}

test('collect-port-evidence multi-env assets exist', () => {
  assert.equal(fs.existsSync(mjsPath), true);
  assert.equal(fs.existsSync(shPath), true);
  assert.equal(fs.existsSync(ps1Path), true);
  assert.match(fs.readFileSync(shPath, 'utf8'), /collect-port-evidence\.mjs/);
  assert.match(fs.readFileSync(ps1Path, 'utf8'), /collect-port-evidence\.mjs/);
});

test('collectPortEvidence reports commits and path relations', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-port-evidence-'));
  try {
    const source = initRepo(root, 'source');
    writeCommit(
      source,
      'package.json',
      JSON.stringify(
        {
          name: 'source-app',
          dependencies: { vue: '3.4.0', 'vue-router': '4.0.0', pinia: '2.0.0' },
          devDependencies: { vite: '5.0.0' },
        },
        null,
        2,
      ),
      'chore: bootstrap source',
    );
    writeCommit(source, 'src/a.js', 'export const a = 1;\n', 'feat: add a');
    const base = git(source, ['rev-parse', 'HEAD']);

    writeCommit(source, 'src/a.js', 'export const a = 2;\n', 'feat: change a');
    writeCommit(source, 'src/b.js', 'export const b = 1;\n', 'feat: add b');
    const feature = git(source, ['rev-parse', 'HEAD']);

    const target = initRepo(root, 'target');
    writeCommit(
      target,
      'package.json',
      JSON.stringify(
        {
          name: 'target-app',
          dependencies: { vue: '3.4.0', 'vue-router': '4.0.0' },
          devDependencies: { vite: '5.0.0' },
        },
        null,
        2,
      ),
      'chore: bootstrap target',
    );
    // same content as source base, different from feature tip
    writeCommit(target, 'src/a.js', 'export const a = 1;\n', 'feat: seed a');

    const report = collectPortEvidence({
      sourceRepo: source,
      sourceBase: base,
      sourceRef: feature,
      targetRepo: target,
      targetRef: 'HEAD',
    });

    assert.match(report.markdown, /# Port evidence/);
    assert.match(report.markdown, /Source stack: source-app; vue 3\.4\.0/);
    assert.match(report.markdown, /Target stack: target-app; vue 3\.4\.0/);
    assert.match(report.markdown, /feat: change a/);
    assert.match(report.markdown, /feat: add b/);
    assert.match(report.markdown, /src\/a\.js/);
    assert.match(report.markdown, /different blob/);
    assert.match(report.markdown, /src\/b\.js/);
    assert.match(report.markdown, /missing/);

    const cli = run(process.execPath, [
      mjsPath,
      '--source-repo',
      source,
      '--source-base',
      base,
      '--source-ref',
      feature,
      '--target-repo',
      target,
      '--target-ref',
      'HEAD',
    ]);
    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stdout, /# Port evidence/);
    assert.match(cli.stdout, /different blob/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('collect-port-evidence.mjs --help exits 0', () => {
  const result = run(process.execPath, [mjsPath, '--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--source-repo/);
});
