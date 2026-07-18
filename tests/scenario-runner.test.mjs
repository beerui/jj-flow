import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { replayTrace, TRACE_SCHEMA_VERSION } from '../src/dispatchTrace.mjs';
import { runAllScenarios, runScenario, SCENARIO_IDS, SCENARIO_REPORT_VERSION } from '../src/scenarioRunner.mjs';
import { validateHandoffSnapshot } from '../src/handoffContract.mjs';
import { runCli } from '../src/cli.mjs';

test('all registered scenarios pass without external side effects', () => {
  const suite = runAllScenarios();
  assert.equal(suite.status, 'PASS', JSON.stringify(suite.reports.map((item) => item.earliest_violation), null, 2));
  assert.deepEqual(suite.reports.map((item) => item.scenario), [...SCENARIO_IDS]);
  for (const report of suite.reports) {
    assert.equal(report.schema_version, SCENARIO_REPORT_VERSION);
    assert.equal(report.isolated, true);
    assert.equal(report.side_effects, 'none');
    assert.equal(report.trace.schema_version, TRACE_SCHEMA_VERSION);
    assert.equal(replayTrace(report.trace).status, 'PASS');
  }
});

test('scenario traces are semantically deterministic', () => {
  const first = runScenario('dispatch-happy-path');
  const second = runScenario('dispatch-happy-path');
  assert.equal(first.status, 'PASS');
  assert.equal(second.status, 'PASS');
  assert.equal(first.trace.initial_hash, second.trace.initial_hash);
  assert.equal(first.trace.final_hash, second.trace.final_hash);
  assert.deepEqual(first.trace.steps.map((step) => step.output_hash), second.trace.steps.map((step) => step.output_hash));
});

test('trace replay fails at the earliest tampered step and executes no host actions', () => {
  const report = runScenario('dispatch-interrupted-resume');
  const tampered = structuredClone(report.trace);
  tampered.steps[1].input.capabilities = [];
  const replay = replayTrace(tampered);
  assert.equal(replay.status, 'FAIL');
  assert.equal(replay.findings[0].step, 2);
  assert.match(replay.findings[0].rule_id, /^TRACE-/);
  assert.equal(replay.external_actions_suppressed, 0);
});

test('handoff validator fails closed when READY evidence is incomplete', () => {
  const snapshot = readJson(path.join(process.cwd(), 'examples/scenarios/jj-same-handoff-snapshot.json'));
  const schema = readJson(path.join(process.cwd(), '.codex/skills/jj-same/references/handoff-snapshot.schema.json'));
  snapshot.requirement_ledger.unresolved.push({ id: 'REQ-X', requirement_ref: 'REQ-X', status: 'UNRESOLVED' });
  const validation = validateHandoffSnapshot(snapshot, schema);
  assert.equal(validation.status, 'FAIL');
  assert.ok(validation.findings.some((finding) => finding.rule_id === 'HOF-READY-002'));
});

test('scenario runner does not create repository-local state directories', () => {
  const before = fs.existsSync(path.join(process.cwd(), '.workflow'));
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-flow-scenario-test-'));
  try {
    const report = runScenario('same-handoff-contract');
    assert.equal(report.status, 'PASS');
    assert.equal(fs.readdirSync(tempRoot).length, 0);
    assert.equal(fs.existsSync(path.join(process.cwd(), '.workflow')), before);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('CLI exposes scenario checks and read-only trace replay', () => {
  const scenarioStdout = captureStdout();
  assert.equal(runCli(['scenario', 'check', '--json'], { stdout: scenarioStdout }), 0);
  const scenarioCheck = JSON.parse(scenarioStdout.value);
  assert.equal(scenarioCheck.status, 'PASS');
  assert.ok(scenarioCheck.reports.every((item) => item.trace === null));

  const report = runScenario('dispatch-interrupted-resume');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-flow-trace-cli-'));
  const tracePath = path.join(tempDir, 'trace.json');
  fs.writeFileSync(tracePath, `${JSON.stringify(report.trace, null, 2)}\n`, 'utf8');
  try {
    const traceStdout = captureStdout();
    assert.equal(runCli(['trace', 'replay', tracePath, '--json'], { stdout: traceStdout }), 0);
    const replay = JSON.parse(traceStdout.value);
    assert.equal(replay.status, 'PASS');
    assert.ok(replay.external_actions_suppressed > 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('trace CLI resolves relative files from the supplied cwd', () => {
  const report = runScenario('dispatch-interrupted-resume');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-flow-trace-cwd-'));
  fs.writeFileSync(path.join(tempDir, 'trace.json'), `${JSON.stringify(report.trace, null, 2)}\n`, 'utf8');
  try {
    const stdout = captureStdout();
    assert.equal(runCli(['trace', 'replay', 'trace.json', '--json'], { cwd: tempDir, stdout }), 0);
    assert.equal(JSON.parse(stdout.value).status, 'PASS');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function captureStdout() {
  return {
    value: '',
    write(chunk) {
      this.value += chunk;
    }
  };
}
