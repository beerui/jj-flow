import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDispatch } from '../src/dispatch.mjs';
import { buildExecutionDecision } from '../src/maestroExecution.mjs';
import { getRecipe } from '../src/recipes.mjs';

test('execution decision is ready when guard and Maestro compatibility pass', () => {
  const recipe = getRecipe('delivery');
  const decision = buildExecutionDecision({
    mode: 'delivery',
    guardReport: { status: 'PASS' },
    evidence: [{ artifact_type: 'maestro_compatibility', evidence: { status: 'compatible', compatible: true } }],
    maestroCalls: recipe.maestroCalls
  });

  assert.equal(decision.status, 'ready');
  assert.ok(decision.maestro_calls.some((call) => call.skill === '$quality-review'));
});

test('execution decision is disabled when evidence is pending', () => {
  const decision = buildExecutionDecision({
    mode: 'delivery',
    guardReport: { status: 'PENDING' },
    evidence: [{ artifact_type: 'maestro_compatibility', evidence: { status: 'compatible', compatible: true } }],
    maestroCalls: []
  });

  assert.equal(decision.status, 'disabled');
});

test('execution decision is blocked when guard fails', () => {
  const decision = buildExecutionDecision({
    mode: 'validate',
    guardReport: { status: 'FAIL' },
    evidence: [{ artifact_type: 'maestro_compatibility', evidence: { status: 'compatible', compatible: true } }],
    maestroCalls: []
  });

  assert.equal(decision.status, 'blocked');
});

test('execution decision is blocked when Maestro is unavailable', () => {
  const decision = buildExecutionDecision({
    mode: 'delivery',
    guardReport: { status: 'PASS' },
    evidence: [{ artifact_type: 'maestro_compatibility', evidence: { status: 'missing', compatible: false } }],
    maestroCalls: []
  });

  assert.equal(decision.status, 'blocked');
});

test('dispatch exposes execution decision without executing Maestro', () => {
  const dispatch = buildDispatch({
    mode: 'delivery',
    intent: '审查变更并完成交付',
    evidence: [
      { id: 'ctx', source: 'manual', artifact_type: 'project_context', summary: '项目上下文已发现。' },
      { id: 'design', source: 'manual', artifact_type: 'design_reference', summary: '设计证据已确认。' },
      { id: 'decision', source: 'manual', artifact_type: 'decision_gate', summary: '阻塞决策已隔离。' },
      { id: 'chain', source: 'manual', artifact_type: 'maestro_chain', summary: '调用链已形成。' },
      { id: 'test', source: 'manual', artifact_type: 'test_result', summary: '测试通过。' },
      { id: 'maestro', source: '$jj-validate', artifact_type: 'maestro_compatibility', summary: '兼容。', evidence: { status: 'compatible', compatible: true } }
    ]
  });

  assert.equal(dispatch.execution_decision.status, 'ready');
  assert.equal(dispatch.guard_report.status, 'PASS');
});
