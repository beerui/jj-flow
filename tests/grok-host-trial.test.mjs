import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runCli } from '../src/cli.mjs';
import { evaluateGrokWave2Evidence, inspectGrokWave2Milestone, WAVE2_TRIAL_REL } from '../src/grokHostAdapter.mjs';
import {
  GROK_TRIAL_REPORT_VERSION,
  renderGrokTrialText,
  resolveGrokTrialSession,
  runGrokHostTrial,
  writeGrokTrialReport
} from '../src/grokHostTrialRunner.mjs';

const TEST_SESSION = '019f0000-0000-7000-8000-aaaaaaaaaaaa';
const LIVE_LIKE_ENV = {
  GROK_SESSION_ID: TEST_SESSION,
  GROK_AGENT: '1',
  GROK_PROJECTS_ROOT: 'D:/a'
};

test('missing session fails closed and does not write milestone JSON', () => {
  const before = productTrialExists();
  const report = runGrokHostTrial({ sessionId: '', env: {} });
  assert.equal(report.status, 'FAIL');
  assert.equal(report.mode, 'real-grok');
  assert.equal(report.adapter, 'grok-build');
  assert.equal(report.wave2_closed, false);
  assert.equal(report.session_id, null);
  assert.equal(report.earliest_violation.rule_id, 'HST-SESSION-001');
  assert.equal(productTrialExists(), before);
  assert.throws(
    () => writeGrokTrialReport(report, { cwd: os.tmpdir() }),
    /without a real session_id/
  );
});

test('placeholder session-<slug>-YYYYMMDD fails closed', () => {
  const resolved = resolveGrokTrialSession({ sessionId: 'session-readme-pnpm-20260731', env: {} });
  assert.equal(resolved.ok, false);
  assert.equal(resolved.rule_id, 'HST-SESSION-002');
  const report = runGrokHostTrial({
    sessionId: 'session-readme-pnpm-20260731',
    env: { GROK_SESSION_ID: 'session-readme-pnpm-20260731' }
  });
  assert.equal(report.status, 'FAIL');
  assert.match(report.earliest_violation.reason, /placeholder/);
});

test('host-trial thread id is rejected', () => {
  const resolved = resolveGrokTrialSession({ sessionId: 'thread-h4-analysis-1', env: {} });
  assert.equal(resolved.ok, false);
  assert.equal(resolved.rule_id, 'HST-SESSION-003');
});

test('real-grok protocol completes create/bind/RECONCILE/rework without writing product evidence', () => {
  const before = productTrialExists();
  const tempsBefore = grokTrialTempRoots();
  const report = runGrokHostTrial({ sessionId: TEST_SESSION, env: LIVE_LIKE_ENV });
  assert.equal(report.status, 'PASS', JSON.stringify(report.earliest_violation, null, 2));
  assert.equal(report.schema_version, GROK_TRIAL_REPORT_VERSION);
  assert.equal(report.mode, 'real-grok');
  assert.equal(report.adapter, 'grok-build');
  assert.equal(report.host_id, 'grok-build');
  assert.equal(report.handle_kind, 'session');
  assert.equal(report.session_id, TEST_SESSION);
  assert.equal(report.host.adapter, 'grok-build');
  assert.equal(report.host.codex_app_threads, false);
  assert.equal(report.reconcile, true);
  assert.equal(report.duplicate_create_count, 0);
  assert.equal(report.review_rework, true);
  assert.equal(report.wave2_closed, false);
  assert.equal(report.max_unattended_level, 'A1');
  assert.equal(report.milestone_status, 'in_progress');
  assert.equal(report.host.effective_boundary_source, 'grok-session-env');
  assert.equal(report.recovery.resume_action, 'RECONCILE_THREAD');
  assert.deepEqual(report.review_loop.outcomes, ['NEEDS_CHANGES', 'PASS']);
  assert.equal(report.control_plane.delivery_status, 'VERIFIED');
  assert.ok(report.sandbox_evidence_ref);
  assert.match(report.sandbox_evidence_ref, /attestations/);
  const evaluation = evaluateGrokWave2Evidence(report);
  assert.equal(evaluation.ok, true, evaluation.errors.join('; '));
  assert.equal(evaluation.closed, false);
  assert.equal(productTrialExists(), before);
  assert.deepEqual(grokTrialTempRoots(), tempsBefore);
  const text = renderGrokTrialText(report);
  assert.match(text, /real-grok/);
  assert.match(text, /wave2_closed: false/);
});

test('write-report only lands under an explicit cwd and never claims Wave 2 closed', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-grok-trial-report-'));
  try {
    const before = productTrialExists();
    const report = runGrokHostTrial({ sessionId: TEST_SESSION, env: LIVE_LIKE_ENV });
    const written = writeGrokTrialReport(report, { cwd: temp });
    assert.equal(path.normalize(written), path.normalize(path.join(temp, WAVE2_TRIAL_REL)));
    const json = JSON.parse(fs.readFileSync(written, 'utf8'));
    assert.equal(json.status, 'PASS');
    assert.equal(json.wave2_closed, false);
    assert.equal(productTrialExists(), before);
    const milestone = inspectGrokWave2Milestone({ cwd: temp });
    assert.equal(milestone.closed, false);
    assert.equal(milestone.status, 'evaluable');
    assert.equal(milestone.max_unattended_level, 'A1');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 8, retryDelay: 25 });
  }
});

test('grok-trial CLI emits JSON and fails closed without session', () => {
  const prevSession = process.env.GROK_SESSION_ID;
  const prevAgent = process.env.GROK_AGENT;
  delete process.env.GROK_SESSION_ID;
  delete process.env.GROK_AGENT;
  try {
    const stdout = captureStdout();
    assert.equal(runCli(['grok-trial', 'run', '--json'], { stdout }), 1);
    const report = JSON.parse(stdout.value);
    assert.equal(report.status, 'FAIL');
    assert.equal(report.earliest_violation.rule_id, 'HST-SESSION-001');
  } finally {
    if (prevSession !== undefined) process.env.GROK_SESSION_ID = prevSession;
    if (prevAgent !== undefined) process.env.GROK_AGENT = prevAgent;
  }
});

test('grok-trial CLI with --session-id completes without writing product JSON', () => {
  const before = productTrialExists();
  const stdout = captureStdout();
  assert.equal(runCli(['grok-trial', 'run', '--json', '--session-id', TEST_SESSION], { stdout }), 0);
  const report = JSON.parse(stdout.value);
  assert.equal(report.status, 'PASS', JSON.stringify(report.earliest_violation, null, 2));
  assert.equal(report.mode, 'real-grok');
  assert.equal(productTrialExists(), before);
});

function productTrialExists() {
  return fs.existsSync(path.resolve(process.cwd(), WAVE2_TRIAL_REL));
}

function grokTrialTempRoots() {
  return fs.readdirSync(os.tmpdir())
    .filter((entry) => entry.startsWith('jj-flow-grok-trial-'))
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
