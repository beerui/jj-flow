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
    mode: 'feat',
    recipe: getRecipe('feat'),
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
    mode: 'knowhow',
    recipe: getRecipe('knowhow'),
    guardReport: { status: 'PASS', results: [] },
    executionDecision: { status: 'disabled' }
  });

  assert.match(pkg.boundary, /Maestro core remains unchanged/);
});

test('dispatch exposes knowledge loop package', () => {
  const dispatch = buildDispatch({
    mode: 'review',
    intent: '审查交付',
    evidence: [
      { id: 'diff', source: 'git', artifact_type: 'diff', summary: 'diff 已审查。' },
      { id: 'test', source: 'manual', artifact_type: 'test_result', summary: '测试通过。' }
    ]
  });

  assert.equal(dispatch.knowledge_loop.status, 'ready');
  assert.equal(dispatch.knowledge_loop.team_context.guard_status, 'PASS');
});
