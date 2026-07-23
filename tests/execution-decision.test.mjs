import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExecutionDecision } from '../src/executionDecision.mjs';
import { buildGuardReport } from '../src/guards.mjs';
import { getRecipe } from '../src/recipes.mjs';

test('failing guards block execution', () => {
  const recipe = getRecipe('same');
  const decision = buildExecutionDecision({
    mode: 'same',
    guardReport: { status: 'FAIL', results: [] },
    skillCalls: recipe.skillCalls
  });
  assert.equal(decision.status, 'blocked');
  assert.ok(decision.skill_calls.length > 0);
});

test('pending guards disable execution', () => {
  const recipe = getRecipe('same');
  const decision = buildExecutionDecision({
    mode: 'same',
    guardReport: buildGuardReport(recipe, []),
    skillCalls: recipe.skillCalls
  });
  assert.equal(decision.status, 'disabled');
});

test('passing same guards yields ready without external tool gate', () => {
  const recipe = getRecipe('same');
  const evidence = [
    { id: 'intent', source: 'user', artifact_type: 'source_materials', summary: '会话与需求。' },
    { id: 'ctx', source: 'repo', artifact_type: 'context_package', summary: '上下文包。' },
    { id: 'chain', source: '$jj-same', artifact_type: 'workflow_chain', summary: '调用链完成。' },
    { id: 'plan', source: 'plan', artifact_type: 'test_plan', summary: '聚焦验证。' },
    { id: 'decision', source: 'user', artifact_type: 'decision_gate', summary: '无阻塞决策。' }
  ];
  const decision = buildExecutionDecision({
    mode: 'same',
    guardReport: buildGuardReport(recipe, evidence),
    evidence,
    skillCalls: recipe.skillCalls
  });
  assert.equal(decision.status, 'ready');
  assert.match(decision.reason, /可进入实施/);
});
