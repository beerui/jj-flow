import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDispatch, renderMarkdown, routeIntent } from '../src/dispatch.mjs';

test('auto routes online ARMS errors to delivery', () => {
  const routed = routeIntent('线上 ARMS goods-detail 500 报错，需要修复');
  assert.equal(routed.mode, 'delivery');
});

test('auto routes knowledge keywords to delivery by default when no stronger mode matches', () => {
  const routed = routeIntent('把这次真实项目经验总结沉淀成规范');
  assert.equal(routed.mode, 'delivery');
});

test('auto routes full delivery requests to delivery', () => {
  const routed = routeIntent('按 PRD、接口文档和设计图端到端交付这个需求');
  assert.equal(routed.mode, 'delivery');
});

test('auto defaults to delivery when no keywords match', () => {
  const routed = routeIntent('随便做一点东西');
  assert.equal(routed.mode, 'delivery');
});

test('auto routes project self-check requests to validate', () => {
  const routed = routeIntent('检查当前项目状态和路线图漂移，给出下一步升级建议');
  assert.equal(routed.mode, 'validate');
});

test('auto routes project evolution requests to evolve', () => {
  const routed = routeIntent('作为项目管理者自我纠正并升级项目功能');
  assert.equal(routed.mode, 'evolve');
});

test('delivery dispatch keeps input parameters minimal', () => {
  const dispatch = buildDispatch({ mode: 'delivery', intent: '完成 AI 获客页面交付' });
  assert.equal(dispatch.mode, 'delivery');
  assert.ok(dispatch.maestro_calls.some((call) => call.skill === '$maestro-analyze'));
  assert.match(dispatch.maestro_prompt, /不要要求用户先传 --prd、--api、--design/);
  assert.match(dispatch.maestro_prompt, /只在交付边界、方案取舍、上线风险或外部权限真正阻塞时询问用户/);
  assert.match(dispatch.maestro_prompt, /禁止使用 maestro explore|禁止调用 maestro explore/);
});

test('delivery dispatch includes yapi and arms optional integration points', () => {
  const dispatch = buildDispatch({ mode: 'delivery', intent: '根据 YApi 接口开发列表页，并处理线上 SLS 异常' });
  assert.equal(dispatch.mode, 'delivery');
  assert.ok(dispatch.maestro_calls.some((call) => call.skill === '$yapi'));
  assert.ok(dispatch.maestro_calls.some((call) => call.skill === '$arms-fix'));
  assert.match(dispatch.maestro_prompt, /YApi|接口/);
});

test('delivery dispatch can capture knowledge after delivery', () => {
  const dispatch = buildDispatch({ mode: 'delivery', intent: '完成交付并沉淀经验' });
  assert.ok(dispatch.maestro_calls.some((call) => call.skill === '$manage-knowhow-capture'));
});

test('auto routes review keywords to delivery', () => {
  const routed = routeIntent('审查当前 diff 的发布风险和质量问题');
  assert.equal(routed.mode, 'delivery');
});

test('delivery dispatch includes quality-review for review work', () => {
  const dispatch = buildDispatch({ mode: 'delivery', intent: '审查 diff 并补齐测试缺口' });
  assert.ok(dispatch.maestro_calls.some((call) => call.skill === '$quality-review'));
});

test('validate dispatch includes project self-check chain', () => {
  const dispatch = buildDispatch({ mode: 'validate', intent: '检查当前项目状态' });
  assert.equal(dispatch.mode, 'validate');
  assert.ok(dispatch.maestro_calls.some((call) => call.skill === '$quality-review'));
  assert.match(dispatch.maestro_prompt, /文档、recipe、guard、测试、workflow 和路线图之间的漂移/);
});

test('evolve dispatch includes self-correction chain', () => {
  const dispatch = buildDispatch({ mode: 'evolve', intent: '基于当前自检结果推进下一项项目管理能力' });
  assert.equal(dispatch.mode, 'evolve');
  assert.ok(dispatch.maestro_calls.some((call) => call.skill === '$maestro-execute'));
  assert.match(dispatch.maestro_prompt, /自我验证、自我纠正、再升级的闭环/);
});

test('rendered dispatch uses Chinese user-facing section titles', () => {
  const markdown = renderMarkdown(buildDispatch({ mode: 'validate', intent: '检查文档语言' }));
  assert.match(markdown, /## 证据门禁/);
  assert.match(markdown, /## 执行决策/);
  assert.match(markdown, /## 知识闭环/);
  assert.match(markdown, /## Maestro 提示词/);
  assert.match(markdown, /证据门禁状态/);
  assert.doesNotMatch(markdown, /## Guard/);
  assert.doesNotMatch(markdown, /Guard 状态/);
  assert.doesNotMatch(markdown, /## Execution Decision/);
  assert.doesNotMatch(markdown, /## Knowledge Loop/);
  assert.doesNotMatch(markdown, /## Maestro Prompt/);
  assert.doesNotMatch(markdown, /\[optional\]/);
});
