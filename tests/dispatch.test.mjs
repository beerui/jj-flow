import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDispatch, routeIntent, renderMarkdown } from '../src/dispatch.mjs';

test('auto routes migration keywords to same', () => {
  const routed = routeIntent('把承接前台的密码更新迁移到兑接前台并建立 handoff');
  assert.equal(routed.mode, 'same');
});

test('auto routes sync keywords to same', () => {
  const routed = routeIntent('同步 SYNC-silence-login 到目标项目');
  assert.equal(routed.mode, 'same');
});

test('auto defaults to same when no keywords match', () => {
  const routed = routeIntent('随便做点什么');
  assert.equal(routed.mode, 'same');
  assert.match(routed.reason, /同源迁移/);
});

test('same dispatch keeps input parameters minimal', () => {
  const dispatch = buildDispatch({ mode: 'same', intent: '从会话 019f 迁移密码更新提醒' });
  assert.equal(dispatch.mode, 'same');
  assert.equal(dispatch.recipe.id, 'cross-project-same');
  assert.ok(dispatch.maestro_calls.some((call) => call.skill === '$maestro-analyze'));
  assert.ok(dispatch.maestro_calls.some((call) => call.skill === '$maestro-execute'));
  assert.ok(dispatch.maestro_prompt.includes('五项门禁') || dispatch.maestro_prompt.includes('EXECUTION_READY') || dispatch.maestro_prompt.includes('同源'));
});

test('same dispatch includes quality-review', () => {
  const dispatch = buildDispatch({ mode: 'same', intent: '迁移后审查 diff 并补齐测试缺口' });
  assert.ok(dispatch.maestro_calls.some((call) => call.skill === '$quality-review'));
});

test('same dispatch can capture knowledge after migration', () => {
  const dispatch = buildDispatch({ mode: 'same', intent: '完成迁移并沉淀经验' });
  assert.ok(dispatch.knowledge_loop);
  assert.equal(dispatch.mode, 'same');
});

test('renderMarkdown includes same mode heading', () => {
  const markdown = renderMarkdown(buildDispatch({ mode: 'same', intent: '准备交接' }));
  assert.match(markdown, /# \/jj-same/);
  assert.match(markdown, /Maestro 调用/);
});
