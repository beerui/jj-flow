import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGuardReport } from '../src/guards.mjs';
import { buildKnowledgeLoopPackage } from '../src/knowledgeLoop.mjs';
import { getRecipe } from '../src/recipes.mjs';
import { buildExecutionDecision } from '../src/executionDecision.mjs';

test('knowledge loop is pending until guards pass', () => {
  const recipe = getRecipe('same');
  const pack = buildKnowledgeLoopPackage({
    mode: 'same',
    recipe,
    intent: '迁移',
    evidence: [],
    guardReport: buildGuardReport(recipe, []),
    executionDecision: { status: 'disabled' }
  });
  assert.equal(pack.status, 'pending');
});

test('knowledge loop is ready when same guards pass', () => {
  const recipe = getRecipe('same');
  const evidence = [
    { id: 'intent', source: 'user', artifact_type: 'source_materials', summary: '会话与需求。' },
    { id: 'ctx', source: 'repo', artifact_type: 'context_package', summary: '上下文包。' },
    { id: 'chain', source: '$jj-same', artifact_type: 'workflow_chain', summary: '调用链完成。' },
    { id: 'plan', source: 'plan', artifact_type: 'test_plan', summary: '聚焦验证。' },
    { id: 'decision', source: 'user', artifact_type: 'decision_gate', summary: '无阻塞决策。' }
  ];
  const guardReport = buildGuardReport(recipe, evidence);
  const executionDecision = buildExecutionDecision({
    mode: 'same',
    guardReport,
    evidence,
    skillCalls: recipe.skillCalls
  });
  const pack = buildKnowledgeLoopPackage({
    mode: 'same',
    recipe,
    intent: '迁移并沉淀',
    evidence,
    guardReport,
    executionDecision
  });
  assert.equal(pack.status, 'ready');
  assert.ok(pack.capture_targets.includes('knowhow'));
  assert.doesNotMatch(pack.boundary, /Maestro|maestro/);
});
