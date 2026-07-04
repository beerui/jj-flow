import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGuardReport } from '../src/guards.mjs';
import { getRecipe } from '../src/recipes.mjs';

test('missing evidence keeps required guards pending', () => {
  const report = buildGuardReport(getRecipe('feat'), []);
  assert.equal(report.status, 'PENDING');
  assert.ok(report.results.some((item) => item.id === 'yapi-contract-ready' && item.status === 'PENDING'));
});

test('pending evidence is never converted into pass by label alone', () => {
  const report = buildGuardReport(getRecipe('fix'), [{
    id: 'rum-1',
    source: 'manual',
    artifact_type: 'note',
    summary: '有人说线上可能报错',
    guard_results: [{ id: 'arms-fingerprint-ready', status: 'PENDING' }]
  }]);

  assert.ok(report.results.some((item) => item.id === 'arms-fingerprint-ready' && item.status === 'PENDING'));
});

test('real yapi evidence passes yapi guard but not all feature guards', () => {
  const report = buildGuardReport(getRecipe('feat'), [{
    id: 'api-1',
    source: '$yapi',
    artifact_type: 'yapi_contract',
    summary: '列表接口字段已拉取'
  }]);

  assert.ok(report.results.some((item) => item.id === 'yapi-contract-ready' && item.status === 'PASS'));
  assert.equal(report.status, 'PENDING');
});

test('feature evidence can require api design and tests together', () => {
  const report = buildGuardReport(getRecipe('feat'), [
    { id: 'scope', source: 'manual', artifact_type: 'project_scope', summary: '列表页范围已确认。' },
    { id: 'api', source: '$yapi', artifact_type: 'yapi_contract', summary: '接口字段已拉取。' },
    { id: 'design', source: 'mastergo', artifact_type: 'design_reference', summary: '设计稿已确认。' },
    { id: 'test', source: 'manual', artifact_type: 'test_plan', summary: '验证方式已明确。' },
    { id: 'record', source: '$sd-zentao-cli', artifact_type: 'delivery_record', summary: '交付记录已同步。' }
  ]);

  assert.ok(report.results.some((item) => item.id === 'design-reference-ready' && item.status === 'PASS'));
  assert.equal(report.status, 'PASS');
});

test('fix evidence requires arms root cause and tests', () => {
  const report = buildGuardReport(getRecipe('fix'), [
    { id: 'arms', source: '$arms-fix', artifact_type: 'arms_sls', summary: 'ARMS 指纹已确认。' },
    { id: 'root', source: 'manual', artifact_type: 'root_cause', summary: '根因已定位。' },
    { id: 'test', source: 'manual', artifact_type: 'test_result', summary: '复现路径已验证。' }
  ]);

  assert.equal(report.status, 'PASS');
});

test('knowledge and review evidence keep source traceability', () => {
  const knowhow = buildGuardReport(getRecipe('knowhow'), [
    { id: 'target', source: 'manual', artifact_type: 'knowledge_target', summary: '沉淀目标明确。' },
    { id: 'dialogue', source: 'codex', artifact_type: 'dialogue_summary', summary: '对话来源已记录。' }
  ]);
  const review = buildGuardReport(getRecipe('review'), [
    { id: 'diff', source: 'git', artifact_type: 'diff', summary: 'diff 已审查。' },
    { id: 'test', source: 'manual', artifact_type: 'test_result', summary: '验证结果已记录。' }
  ]);

  assert.equal(knowhow.status, 'PASS');
  assert.equal(review.status, 'PASS');
});

test('delivery does not require fixed input parameters', () => {
  const report = buildGuardReport(getRecipe('delivery'), []);

  assert.ok(report.results.some((item) => item.id === 'minimal-input-contract' && item.status === 'PASS'));
  assert.ok(report.results.some((item) => item.id === 'source-materials-discovered' && item.status === 'PENDING'));
  assert.equal(report.status, 'PENDING');
});

test('validation failure evidence makes project self-check fail', () => {
  const report = buildGuardReport(getRecipe('validate'), [{
    id: 'docs-reference',
    source: '$jj validate',
    artifact_type: 'validation_failure',
    summary: '命令文档缺少 validate。'
  }]);

  assert.ok(report.results.some((item) => item.id === 'docs-code-aligned' && item.status === 'FAIL'));
  assert.equal(report.status, 'FAIL');
});

test('complete validation evidence passes project self-check guards', () => {
  const report = buildGuardReport(getRecipe('validate'), [
    { id: 'project-state', source: '$jj validate', artifact_type: 'project_state', summary: 'package.json 已读取。' },
    { id: 'workflow-state', source: '$jj validate', artifact_type: 'workflow_state', summary: '.workflow/state.json 已读取。' },
    { id: 'docs-reference', source: '$jj validate', artifact_type: 'docs_reference', summary: '命令文档齐备。' },
    { id: 'recipe-registry', source: '$jj validate', artifact_type: 'recipe_registry', summary: 'recipe 已注册。' },
    { id: 'phase-readiness', source: '$jj validate', artifact_type: 'phase_readiness', summary: '当前 phase 已审计。' },
    { id: 'maestro-compatibility', source: '$jj validate', artifact_type: 'maestro_compatibility', summary: 'Maestro 兼容性已报告。' },
    { id: 'test-coverage', source: '$jj validate', artifact_type: 'test_coverage', summary: '测试文件齐备。' },
    { id: 'verification-command', source: '$jj validate', artifact_type: 'verification_command', summary: 'verify 可用。' },
    { id: 'next-recommendation', source: '$jj validate', artifact_type: 'next_recommendation', summary: '下一步已推导。' }
  ]);

  assert.equal(report.status, 'PASS');
});

test('complete evolution evidence passes project evolution guards', () => {
  const report = buildGuardReport(getRecipe('evolve'), [
    { id: 'validation-summary', source: '$jj evolve', artifact_type: 'validation_summary', summary: '已复用 validate evidence。' },
    { id: 'correction-backlog', source: '$jj evolve', artifact_type: 'correction_backlog', summary: '已生成 correction backlog。' },
    { id: 'roadmap-alignment', source: '$jj evolve', artifact_type: 'roadmap_alignment', summary: '已对齐 roadmap。' },
    { id: 'evolution-plan', source: '$jj evolve', artifact_type: 'evolution_plan', summary: '已形成升级计划。' },
    { id: 'manager-boundary', source: '$jj evolve', artifact_type: 'manager_boundary', summary: '保持 Maestro 上层协议边界。' },
    { id: 'evolution-test-plan', source: '$jj evolve', artifact_type: 'test_plan', summary: '验证命令已明确。' }
  ]);

  assert.equal(report.status, 'PASS');
});
