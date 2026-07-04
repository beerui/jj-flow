import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { normalizeEvidenceList, validateEvidence } from '../src/evidence.mjs';
import { buildProviderEvidence, buildProviderEvidenceBatch, PROVIDER_SPECS } from '../src/evidenceProviders.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'evidence-providers.json'), 'utf8'));

test('each provider success fixture produces standard evidence JSON', () => {
  for (const [provider, spec] of Object.entries(PROVIDER_SPECS)) {
    const evidence = buildProviderEvidence(provider, fixtures[provider].success);
    const [normalized] = normalizeEvidenceList([evidence]);

    assert.equal(normalized.artifact_type, spec.artifactType);
    assert.equal(normalized.guard_results[0].status, 'PASS');
    assert.equal(validateEvidence(evidence).ok, true);
  }
});

test('missing fields stay pending instead of becoming pass', () => {
  for (const provider of Object.keys(PROVIDER_SPECS)) {
    const evidence = buildProviderEvidence(provider, fixtures[provider].missingFields);

    assert.equal(evidence.artifact_type, 'provider_partial');
    assert.equal(evidence.guard_results[0].status, 'PENDING');
    assert.ok(evidence.evidence.missing_fields.length > 0);
    assert.equal(validateEvidence(evidence).ok, true);
  }
});

test('partial evidence stays pending instead of becoming pass', () => {
  for (const provider of Object.keys(PROVIDER_SPECS)) {
    const evidence = buildProviderEvidence(provider, fixtures[provider].partial);

    assert.equal(evidence.artifact_type, 'provider_partial');
    assert.equal(evidence.guard_results[0].status, 'PENDING');
    assert.ok(evidence.next_steps.length > 0);
  }
});

test('tool failure becomes fail evidence', () => {
  for (const provider of Object.keys(PROVIDER_SPECS)) {
    const evidence = buildProviderEvidence(provider, fixtures[provider].failure);

    assert.equal(evidence.artifact_type, 'provider_failure');
    assert.equal(evidence.guard_results[0].status, 'FAIL');
    assert.ok(evidence.next_steps.length > 0);
  }
});

test('batch conversion covers all provider fixture cases', () => {
  const evidence = buildProviderEvidenceBatch(fixtures);

  assert.equal(evidence.length, Object.keys(PROVIDER_SPECS).length * 4);
  assert.ok(evidence.some((item) => item.artifact_type === 'yapi_contract'));
  assert.ok(evidence.some((item) => item.artifact_type === 'arms_sls'));
  assert.ok(evidence.some((item) => item.artifact_type === 'zentao_task'));
  assert.ok(evidence.some((item) => item.artifact_type === 'provider_partial'));
  assert.ok(evidence.some((item) => item.artifact_type === 'provider_failure'));
});
