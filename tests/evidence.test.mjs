import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeEvidenceList, validateEvidence } from '../src/evidence.mjs';

test('normalizes minimal evidence', () => {
  const [item] = normalizeEvidenceList([{ summary: '接口字段已确认' }]);
  assert.equal(item.id, 'evidence-1');
  assert.equal(item.source, 'manual');
  assert.equal(item.artifact_type, 'note');
});

test('validates required evidence fields', () => {
  const result = validateEvidence({ id: 'a', source: 'manual', artifact_type: 'note', summary: '' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['summary']);
});
