import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMaestroCompatibilityEvidence } from '../src/maestroCompatibility.mjs';

test('reports compatible Maestro CLI version', () => {
  const evidence = buildMaestroCompatibilityEvidence({
    runCommand: () => ({ status: 0, output: '0.5.45', error: '', errorCode: null })
  });

  assert.equal(evidence.artifact_type, 'maestro_compatibility');
  assert.equal(evidence.evidence.status, 'compatible');
  assert.equal(evidence.evidence.compatible, true);
});

test('reports missing Maestro CLI with remediation', () => {
  const evidence = buildMaestroCompatibilityEvidence({
    runCommand: () => ({ status: null, output: '', error: 'not found', errorCode: 'ENOENT' })
  });

  assert.equal(evidence.evidence.status, 'missing');
  assert.equal(evidence.evidence.compatible, false);
  assert.ok(evidence.next_steps.length > 0);
});

test('reports incompatible Maestro CLI version', () => {
  const evidence = buildMaestroCompatibilityEvidence({
    runCommand: () => ({ status: 0, output: '0.4.99', error: '', errorCode: null })
  });

  assert.equal(evidence.evidence.status, 'incompatible');
  assert.equal(evidence.evidence.compatible, false);
  assert.match(evidence.summary, /低于最低版本/);
});

test('reports blocked Maestro CLI version check', () => {
  const evidence = buildMaestroCompatibilityEvidence({
    runCommand: () => ({ status: null, output: '', error: 'spawn EPERM', errorCode: 'EPERM' })
  });

  assert.equal(evidence.evidence.status, 'blocked');
  assert.equal(evidence.evidence.compatible, false);
  assert.match(evidence.summary, /阻止/);
});
