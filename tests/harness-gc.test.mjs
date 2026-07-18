import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { runCli } from '../src/cli.mjs';
import { HARNESS_GC_REPORT_VERSION, runHarnessGc } from '../src/harnessGc.mjs';

test('current repository passes read-only Harness GC with an A score', () => {
  const workflowPath = path.join(process.cwd(), '.workflow');
  const existedBefore = fs.existsSync(workflowPath);
  const report = runHarnessGc();
  assert.equal(report.schema_version, HARNESS_GC_REPORT_VERSION);
  assert.equal(report.status, 'PASS', JSON.stringify(report.findings, null, 2));
  assert.ok(report.score >= 95, `expected score >= 95, got ${report.score}`);
  assert.equal(report.grade, 'A');
  assert.equal(report.read_only, true);
  assert.equal(report.auto_fix, false);
  assert.equal(fs.existsSync(workflowPath), existedBefore);
  assert.equal(existedBefore, false);
});

test('harness-gc CLI emits structured JSON', () => {
  const stdout = captureStdout();
  assert.equal(runCli(['harness-gc', '--json'], { stdout }), 0);
  const report = JSON.parse(stdout.value);
  assert.equal(report.status, 'PASS');
  assert.equal(report.read_only, true);
});

test('Harness GC fails closed when the Harness check reports a P1 drift', () => {
  const report = runHarnessGc({
    harnessCheck: () => ({
      findings: [{
        rule_id: 'HNS-TEST-001',
        path: 'harness-manifest.json',
        reason: 'injected drift',
        next_action: 'repair the manifest'
      }]
    })
  });
  assert.equal(report.status, 'FAIL');
  assert.ok(report.findings.some((finding) => finding.rule_id === 'GC-HNS-TEST-001' && finding.severity === 'P1'));
});

function captureStdout() {
  return {
    value: '',
    write(chunk) {
      this.value += chunk;
    }
  };
}
