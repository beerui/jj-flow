import test from 'node:test';
import assert from 'node:assert/strict';
import { getRecipe } from '../src/recipes.mjs';
import { buildKnowledgeLoopPackage } from '../src/knowledgeLoop.mjs';
import { buildGuardReport } from '../src/guards.mjs';
import { buildExecutionDecision } from '../src/maestroExecution.mjs';

test('completed same migration can be captured as knowhow spec and workflow recipe', () => {
  const recipe = getRecipe('same');
  const evidence = [
    { id: 'intent', source: 'user', artifact_type: 'user_intent', summary: '迁移完成。' },
    { id: 'source', source: 'git', artifact_type: 'source_materials', summary: '源资料齐备。' },
    { id: 'decisions', source: 'user', artifact_type: 'decision_gate', summary: '范围已确认。' },
    { id: 'chain', source: '$jj-same', artifact_type: 'maestro_chain', summary: '调用链完成。' },
    { id: 'tests', source: 'manual', artifact_type: 'test_result', summary: '聚焦测试通过。' },
    {
      id: 'maestro',
      source: 'jj-flow-check',
      artifact_type: 'maestro_compatibility',
      summary: '兼容。',
      evidence: { status: 'compatible', compatible: true }
    }
  ];
  const guardReport = buildGuardReport(recipe, evidence);
  const executionDecision = buildExecutionDecision({
    mode: 'same',
    guardReport,
    evidence,
    maestroCalls: recipe.maestroCalls
  });
  const pack = buildKnowledgeLoopPackage({
    mode: 'same',
    recipe,
    intent: '完成迁移并沉淀经验',
    evidence,
    guardReport,
    executionDecision
  });

  assert.equal(pack.status, 'ready');
  assert.ok(pack.capture_targets.includes('knowhow'));
  assert.ok(pack.capture_targets.includes('spec'));
  assert.ok(pack.capture_targets.includes('workflow_recipe'));
});

test('pending same guards keep knowledge loop pending', () => {
  const recipe = getRecipe('same');
  const pack = buildKnowledgeLoopPackage({
    mode: 'same',
    recipe,
    intent: '开始迁移',
    evidence: [],
    guardReport: buildGuardReport(recipe, []),
    executionDecision: buildExecutionDecision({
      mode: 'same',
      guardReport: buildGuardReport(recipe, []),
      evidence: [],
      maestroCalls: recipe.maestroCalls
    })
  });
  assert.equal(pack.status, 'pending');
  assert.ok(pack.team_context.next_actions.length > 0);
});
