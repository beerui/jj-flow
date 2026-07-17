import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGuardReport, evaluateGuard } from '../src/guards.mjs';
import { getRecipe } from '../src/recipes.mjs';

test('missing evidence keeps required same guards pending', () => {
  const report = buildGuardReport(getRecipe('same'), []);
  assert.equal(report.status, 'PENDING');
  assert.ok(report.results.every((item) => item.status === 'PENDING' || item.status === 'PASS'));
  assert.ok(report.results.some((item) => item.id === 'source-materials-discovered' && item.status === 'PENDING'));
});

test('evidence-not-guessed requires summaries', () => {
  const empty = evaluateGuard('evidence-not-guessed', []);
  assert.equal(empty.status, 'PENDING');

  const withSummary = evaluateGuard('evidence-not-guessed', [
    { id: 'a', source: 'manual', artifact_type: 'note', summary: '已核对源 commit。' }
  ]);
  assert.equal(withSummary.status, 'PASS');
});

test('delivery-recorded accepts zentao evidence', () => {
  const delivery = evaluateGuard('delivery-recorded', [
    { id: 'record', source: '$sd-zentao-cli', artifact_type: 'delivery_record', summary: '交付记录已同步。' }
  ]);
  assert.equal(delivery.status, 'PASS');
});

test('same does not require fixed input parameters', () => {
  const report = buildGuardReport(getRecipe('same'), []);
  assert.ok(report.results.some((item) => item.id === 'evidence-not-guessed'));
});

test('same guards pass with full migration evidence set', () => {
  const report = buildGuardReport(getRecipe('same'), [
    { id: 'intent', source: 'user', artifact_type: 'user_intent', summary: '迁移密码更新。' },
    { id: 'source', source: 'git', artifact_type: 'source_materials', summary: '源 commit 与 diff 已核对。' },
    { id: 'decisions', source: 'user', artifact_type: 'decision_gate', summary: '目标仅兑接前台。' },
    { id: 'chain', source: '$jj-same', artifact_type: 'maestro_chain', summary: '调用链已形成。' },
    { id: 'tests', source: 'manual', artifact_type: 'test_plan', summary: '聚焦单测已规划。' }
  ]);
  assert.equal(report.status, 'PASS');
});
