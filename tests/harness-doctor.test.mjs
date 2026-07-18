import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectHarnessRepository, DOCTOR_SCHEMA_VERSION, renderDoctorText } from '../src/harnessDoctor.mjs';
import { runCli } from '../src/cli.mjs';

test('doctor reports the current repository from versioned Harness truth', () => {
  const result = inspectHarnessRepository();
  assert.equal(result.schema_version, DOCTOR_SCHEMA_VERSION);
  assert.equal(result.ok, true, JSON.stringify(result.findings, null, 2));
  assert.equal(result.status, 'READY');
  assert.equal(result.harness.status, 'PASS');
  assert.equal(result.repository.git.available, true);
  assert.equal(result.autonomy.available_level, 'A1');
  assert.ok(result.capabilities.some((item) => item.id === 'harness-check'));
});

test('doctor blocks when a forbidden local state path exists', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-flow-doctor-'));
  copyHarnessFixture(tempRoot);
  fs.mkdirSync(path.join(tempRoot, '.workflow'));
  try {
    const result = inspectHarnessRepository({ cwd: tempRoot, runCommand: fakeGitRunner });
    assert.equal(result.ok, false);
    assert.equal(result.status, 'BLOCKED');
    assert.equal(result.autonomy.available_level, 'A0');
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-STATE-001'));
    assert.match(renderDoctorText(result), /HNS-STATE-001/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('doctor CLI emits structured JSON and stays read-only', () => {
  const before = fs.existsSync(path.join(process.cwd(), '.workflow'));
  const stdout = captureStdout();
  const status = runCli(['doctor', '--json'], { stdout });
  const result = JSON.parse(stdout.value);
  assert.equal(status, 0);
  assert.equal(result.status, 'READY');
  assert.equal(fs.existsSync(path.join(process.cwd(), '.workflow')), before);
});

function copyHarnessFixture(target) {
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'harness-manifest.json'), 'utf8'));
  const files = [
    'package.json',
    manifest.$schema,
    ...manifest.record_system.maps.map((item) => item.path),
    ...manifest.record_system.authorities.map((item) => item.path),
    ...manifest.record_system.historical_paths.map((item) => item.path),
    ...manifest.required_links.map((item) => item.source)
  ];
  for (const file of new Set(files)) {
    const source = path.join(process.cwd(), file);
    const destination = path.join(target, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(source, destination, { recursive: true });
  }
  fs.writeFileSync(path.join(target, 'harness-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

function fakeGitRunner(command, args) {
  if (command !== 'git') return { status: 1, stdout: '' };
  const operation = args.slice(2).join(' ');
  if (operation === 'rev-parse --show-toplevel') return { status: 0, stdout: 'fixture\n' };
  if (operation === 'branch --show-current') return { status: 0, stdout: 'test\n' };
  if (operation === 'rev-parse --short=12 HEAD') return { status: 0, stdout: '123456789abc\n' };
  if (operation === 'status --porcelain') return { status: 0, stdout: '' };
  return { status: 1, stdout: '' };
}

function captureStdout() {
  return {
    value: '',
    write(chunk) {
      this.value += chunk;
    }
  };
}
