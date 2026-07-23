import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGuardReport } from '../src/guards.mjs';
import { getRecipe } from '../src/recipes.mjs';

test('missing evidence keeps required same guards pending', () => {
  const recipe = getRecipe('same');
  const report = buildGuardReport(recipe, []);
  assert.equal(report.status, 'PENDING');
  assert.ok(report.results.every((item) => item.status === 'PENDING' || item.status === 'PASS'));
});

test('evidence-not-guessed requires summaries', () => {
  const recipe = getRecipe('same');
  const report = buildGuardReport(recipe, [
    { id: 'a', source: 'x', artifact_type: 'source_materials', summary: '' }
  ]);
  const guard = report.results.find((item) => item.id === 'evidence-not-guessed');
  assert.equal(guard.status, 'PENDING');
});

test('delivery-recorded accepts zentao evidence', () => {
  const recipe = {
    ...getRecipe('same'),
    guards: ['delivery-recorded']
  };
  const report = buildGuardReport(recipe, [
    { id: 'z', source: '$sd-zentao-cli', artifact_type: 'zentao_task', summary: '任务已登记。' }
  ]);
  assert.equal(report.status, 'PASS');
});

test('same does not require fixed input parameters', () => {
  const recipe = getRecipe('same');
  assert.ok(recipe.inputPolicy.some((item) => item.includes('不要要求用户先传固定')));
});

test('same guards pass with full migration evidence set', () => {
  const recipe = getRecipe('same');
  const report = buildGuardReport(recipe, [
    { id: 'intent', source: 'user', artifact_type: 'source_materials', summary: '需求与会话。' },
    { id: 'ctx', source: 'repo', artifact_type: 'context_package', summary: '上下文。' },
    { id: 'chain', source: '$jj-same', artifact_type: 'workflow_chain', summary: '调用链已形成。' },
    { id: 'plan', source: 'plan', artifact_type: 'test_plan', summary: '验证计划。' },
    { id: 'decision', source: 'user', artifact_type: 'decision_gate', summary: '无阻塞决策。' }
  ]);
  assert.equal(report.status, 'PASS');
  assert.ok(report.results.every((item) => item.status === 'PASS'));
  assert.ok(!recipe.guards.some((id) => id.includes('maestro')));
});
