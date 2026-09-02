import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  SCORE_DISCARD_BELOW,
  futureReuseVeto,
  gateLesson,
  hasRealLesson,
  isProcessNarration,
  isThisTimeOnly,
  scoreDraft
} from '../src/memoryExtract.mjs';
import { initRun, loadRun, saveRun, finalizeRun, buildKnowledgeContribution, KNOWLEDGE_CONTRIBUTION_DEGRADED_REASON } from '../src/ralph.mjs';

test('hasRealLesson drops empty / this-time-only / short notes', () => {
  assert.equal(hasRealLesson(''), false);
  assert.equal(hasRealLesson('无'), false);
  assert.equal(hasRealLesson('仅本次改这一处'), false);
  assert.equal(hasRealLesson('durable'), false);
  assert.equal(hasRealLesson('tip bottom uses 6px not 8px'), true);
});

test('process narration is not a reusable lesson', () => {
  assert.equal(isProcessNarration('没有第 3 条'), true);
  assert.equal(isProcessNarration('不用再改了'), true);
  assert.equal(isThisTimeOnly('仅本次'), true);
  const sc = scoreDraft({ title: '没有第 3 条', body: '不用再改。本卡已经落地。' });
  assert.ok(sc.total < SCORE_DISCARD_BELOW);
  assert.ok(!gateLesson('没有第 3 条。不用再改。').keep);
});

test('durable rule with identifier passes Gate B', () => {
  const gated = gateLesson('tip bottom uses 6px not 8px; do not ship 8px');
  assert.equal(gated.keep, true);
  assert.ok(gated.score.total >= SCORE_DISCARD_BELOW);
});

test('human-locked 2026-08-29 keep/drop (换一张卡还得遵守 vs 本卡备忘)', () => {
  const golden = JSON.parse(
    fs.readFileSync(new URL('./fixtures/extract-future-reuse.golden.json', import.meta.url), 'utf8')
  );
  for (const row of golden.keep) {
    const gated = gateLesson(row.text);
    assert.equal(gated.keep, true, `must keep ${row.id}: ${row.text.slice(0, 40)}`);
  }
  for (const row of golden.drop) {
    const gated = gateLesson(row.text, { taskTexts: row.taskTexts || [] });
    assert.equal(gated.keep, false, `must drop ${row.id}: ${row.text.slice(0, 40)}`);
  }
});

test('future-reuse: constraint keeps, this-change nit / observation drops', () => {
  assert.equal(futureReuseVeto('validateForm 的 regionStatus 协议是 { level: { status } }，组件侧必须包装再发出'), '');
  assert.equal(gateLesson('控件区分组只在 widget-registry.category 上做，不要把 category 写入 createField 或 schema').keep, true);
  assert.ok(futureReuseVeto('console-main is the only vertical scroller'));
  assert.equal(gateLesson('console-main is the only vertical scroller').keep, false);
  assert.ok(futureReuseVeto('把提示改成有效！只加结尾「！」'));
  assert.equal(gateLesson('把提示改成有效！只加结尾「！」').keep, false);
  assert.equal(gateLesson('tip bottom uses 6px not 8px').keep, true);
  assert.equal(
    gateLesson('Never zero .t-dialog padding or rebuild dialog chrome; use TDesign header/footer/close-btn').keep,
    true
  );
});

test('rule about Closeout survives; task restatement and near-dup drop', () => {
  const closeoutRule = gateLesson('无写盘工具的回合不要自动 Closeout');
  assert.equal(closeoutRule.keep, true);
  const restated = gateLesson('手机号+区号固定组件（后管占位）', {
    taskTexts: ['手机号+区号固定组件（后管占位）']
  });
  assert.equal(restated.keep, false);
  const dup = gateLesson('tip bottom uses 6px not 8px; do not ship 8px', {
    existing: ['tip bottom uses 6px not 8px; do not ship 8px']
  });
  assert.equal(dup.keep, false);
});

test('finalize drops narration lessons from contribution candidates', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-extract-'));
  try {
    const runId = 'task-extract-gate';
    initRun({
      run_id: runId,
      title: 'tip down',
      goal: 'move tip 6px',
      capability_ids: ['CAP-tip'],
      attach_knowledge: false,
      intensity: 'tiny'
    }, cwd);
    const run = loadRun(runId, cwd);
    run.gates = { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PASS', archive: 'PENDING' };
    run.phase = 'ACCEPT';
    saveRun(run, cwd);
    const result = finalizeRun(runId, {
      cwd,
      modules: ['src/tip.vue'],
      lessons: ['tip bottom uses 6px not 8px', '没有第 3 条', '仅本次改这一处'],
      force: true
    });
    assert.equal(result.contribution_path, null);
    assert.equal(result.contribute_hook.status, 'skipped');
    assert.equal(result.contribute_hook.reason, KNOWLEDGE_CONTRIBUTION_DEGRADED_REASON);
    const contrib = buildKnowledgeContribution(loadRun(runId, cwd), {
      cwd,
      modules: ['src/tip.vue'],
      lessons: ['tip bottom uses 6px not 8px', '没有第 3 条', '仅本次改这一处']
    });
    assert.ok(contrib.candidates.some((c) => c.type === 'capability'));
    assert.ok(contrib.candidates.some((c) => c.type === 'lesson' && /6px/.test(c.summary)));
    assert.ok(!contrib.candidates.some((c) => /没有第/.test(c.summary || '')));
    assert.ok(!contrib.candidates.some((c) => /仅本次/.test(c.summary || '')));
    assert.ok(Array.isArray(contrib.extract_audit));
    assert.ok(contrib.extract_audit.some((row) => /没有第|仅本次/.test(row.text || '')));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
