import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDispatch } from '../src/dispatch.mjs';
import { buildKnowledgeLoopPackage } from '../src/knowledgeLoop.mjs';
import { getRecipe } from '../src/recipes.mjs';

test('completed delivery can be captured as knowhow spec and workflow recipe', () => {
  const recipe = getRecipe('delivery');
  const pkg = buildKnowledgeLoopPackage({
    mode: 'delivery',
    recipe,
    intent: '完成一次端到端交付',
    evidence: [
      { id: 'result', source: 'manual', artifact_type: 'test_result', summary: '测试通过。' }
    ],
    guardReport: { status: 'PASS', results: [] },
    executionDecision: { status: 'ready' }
  });

  assert.equal(pkg.status, 'ready');
  assert.deepEqual(pkg.capture_targets, ['knowhow', 'spec', 'workflow_recipe']);
});

test('team context exposes evidence guard status and next actions', () => {
  const pkg = buildKnowledgeLoopPackage({
    mode: 'delivery',
    recipe: getRecipe('delivery'),
    intent: '开发功能',
    evidence: [{ id: 'api', source: '$yapi', artifact_type: 'yapi_contract', summary: '接口已确认。' }],
    guardReport: {
      status: 'PENDING',
      results: [{ id: 'design-reference-ready', status: 'PENDING', reason: '缺少设计证据。' }]
    },
    executionDecision: { status: 'disabled' }
  });

  assert.equal(pkg.status, 'pending');
  assert.equal(pkg.team_context.guard_status, 'PENDING');
  assert.equal(pkg.team_context.evidence[0].artifact_type, 'yapi_contract');
  assert.match(pkg.team_context.next_actions[0], /design-reference-ready/);
});

test('knowledge loop does not modify Maestro core', () => {
  const pkg = buildKnowledgeLoopPackage({
    mode: 'delivery',
    recipe: getRecipe('delivery'),
    guardReport: { status: 'PASS', results: [] },
    executionDecision: { status: 'disabled' }
  });

  assert.match(pkg.boundary, /Maestro core remains unchanged/);
});

test('dispatch exposes knowledge loop package', () => {
  const dispatch = buildDispatch({
    mode: 'delivery',
    intent: '完成交付',
    evidence: [
      { id: 'ctx', source: 'manual', artifact_type: 'project_context', summary: '项目上下文已发现。' },
      { id: 'design', source: 'manual', artifact_type: 'design_reference', summary: '设计证据已确认。' },
      { id: 'decision', source: 'manual', artifact_type: 'decision_gate', summary: '阻塞决策已隔离。' },
      { id: 'chain', source: 'manual', artifact_type: 'maestro_chain', summary: '调用链已形成。' },
      { id: 'test', source: 'manual', artifact_type: 'test_result', summary: '测试通过。' }
    ]
  });

  assert.equal(dispatch.knowledge_loop.status, 'ready');
  assert.equal(dispatch.knowledge_loop.team_context.guard_status, 'PASS');
});
