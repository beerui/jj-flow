import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import test from 'node:test';
import { runCli } from '../src/cli.mjs';
import { HOST_TRIAL_REPORT_VERSION, runHostTrial } from '../src/hostTrialRunner.mjs';

test('semi-real host trial completes A2/A3 with temporary Git side effects only', () => {
  const before = hostTrialTempRoots();
  const report = runHostTrial();
  assert.equal(report.schema_version, HOST_TRIAL_REPORT_VERSION);
  assert.equal(report.status, 'PASS', JSON.stringify(report.earliest_violation, null, 2));
  assert.equal(report.mode, 'semi-real');
  assert.equal(report.host.real_git, true);
  assert.equal(report.host.real_worktree, true);
  assert.equal(report.host.codex_app_threads, false);
  assert.equal(report.recovery.resume_action, 'RECONCILE_THREAD');
  assert.deepEqual(report.review_loop.outcomes, ['NEEDS_CHANGES', 'PASS']);
  assert.equal(report.control_plane.delivery_status, 'VERIFIED');
  assert.equal(report.cleanup.temporary_root_removed, true);
  assert.deepEqual(hostTrialTempRoots(), before);
});

test('host trial is deterministic apart from its runner fingerprint', () => {
  const first = runHostTrial();
  const second = runHostTrial();
  assert.equal(first.status, 'PASS');
  assert.equal(second.status, 'PASS');
  assert.deepEqual(second, first);
});

test('host-trial CLI emits structured JSON', () => {
  const stdout = captureStdout();
  assert.equal(runCli(['host-trial', 'run', '--json'], { stdout }), 0);
  const report = JSON.parse(stdout.value);
  assert.equal(report.status, 'PASS');
  assert.equal(report.cleanup.status, 'PASS');
});

function hostTrialTempRoots() {
  return fs.readdirSync(os.tmpdir())
    .filter((entry) => entry.startsWith('jj-flow-host-trial-'))
    .sort();
}

function captureStdout() {
  return {
    value: '',
    write(chunk) {
      this.value += chunk;
    }
  };
}
