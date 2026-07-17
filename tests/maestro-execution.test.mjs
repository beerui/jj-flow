import test from 'node:test';
import assert from 'node:assert/strict';
import { getRecipe } from '../src/recipes.mjs';
import { buildGuardReport } from '../src/guards.mjs';
import { buildExecutionDecision } from '../src/maestroExecution.mjs';

test('missing maestro compatibility disables execution', () => {
  const recipe = getRecipe('same');
  const decision = buildExecutionDecision({
    mode: 'same',
    guardReport: buildGuardReport(recipe, []),
    evidence: [],
    maestroCalls: recipe.maestroCalls
  });
  assert.equal(decision.status, 'disabled');
});

test('failing guards block execution even when maestro is compatible', () => {
  const recipe = getRecipe('same');
  const decision = buildExecutionDecision({
    mode: 'same',
    guardReport: { status: 'FAIL', results: [] },
    evidence: [
      {
        id: 'maestro',
        source: 'jj-flow-check',
        artifact_type: 'maestro_compatibility',
        summary: '兼容。',
        evidence: { status: 'compatible', compatible: true }
      }
    ],
    maestroCalls: recipe.maestroCalls
  });
  assert.equal(decision.status, 'blocked');
});

test('passing same guards with maestro compatibility yields ready', () => {
  const recipe = getRecipe('same');
  const evidence = [
    { id: 'intent', source: 'user', artifact_type: 'user_intent', summary: '迁移。' },
    { id: 'source', source: 'git', artifact_type: 'source_materials', summary: '源资料齐备。' },
    { id: 'decisions', source: 'user', artifact_type: 'decision_gate', summary: '范围已确认。' },
    { id: 'chain', source: '$jj-same', artifact_type: 'maestro_chain', summary: '调用链完成。' },
    { id: 'tests', source: 'manual', artifact_type: 'test_plan', summary: '测试已规划。' },
    {
      id: 'maestro',
      source: 'jj-flow-check',
      artifact_type: 'maestro_compatibility',
      summary: '兼容。',
      evidence: { status: 'compatible', compatible: true }
    }
  ];
  const decision = buildExecutionDecision({
    mode: 'same',
    guardReport: buildGuardReport(recipe, evidence),
    evidence,
    maestroCalls: recipe.maestroCalls
  });
  assert.equal(decision.status, 'ready');
});
