import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { initRun, loadRun, validateRun } from '../src/ralph.mjs';
import { attachKnowledgeRefs } from '../src/portfolioKnowledge.mjs';
import { buildKnowledgeLoopPackage } from '../src/knowledgeLoop.mjs';

test('attachKnowledgeRefs reads portfolio index when available', () => {
  const pack = attachKnowledgeRefs({ q: '零息', project: 'project-a', limit: 5 });
  assert.ok(['ready', 'empty', 'unavailable'].includes(pack.status));
  assert.ok(Array.isArray(pack.knowledge_refs));
  if (pack.status === 'ready') {
    assert.ok(pack.knowledge_refs.length >= 1);
    assert.ok(pack.knowledge_refs[0]);
  }
});

test('ralph init auto-writes knowledge_refs into run.json', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-knowledge-'));
  try {
    const run = initRun({
      run_id: 'task-knowledge-wire',
      title: '零息协议 URL',
      goal: '验证 knowledge_refs 自动挂载',
      project: 'project-a',
      force: true
    }, cwd);
    assert.ok(Array.isArray(run.knowledge_refs));
    const errors = validateRun(run);
    assert.deepEqual(errors, []);
    const loaded = loadRun(run.run_id, cwd);
    assert.ok(Array.isArray(loaded.knowledge_refs));
    const analyze = fs.readFileSync(path.join(cwd, '.workflow/ralph/tasks', run.run_id, 'task_plan.md'), 'utf8');
    assert.match(analyze, /knowledge_refs/);
    const attachPath = path.join(cwd, '.workflow/ralph/tasks', run.run_id, 'knowledge-attach.json');
    assert.equal(fs.existsSync(attachPath), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('knowledge loop package includes knowledge_refs field', () => {
  const pack = buildKnowledgeLoopPackage({
    mode: 'ralph',
    recipe: { id: 'ralph' },
    intent: '零息',
    project: 'project-a',
    evidence: [],
    guardReport: { status: 'PENDING', results: [] },
    executionDecision: { status: 'disabled' }
  });
  assert.ok(Array.isArray(pack.knowledge_refs));
  assert.ok(pack.portfolio_knowledge);
});
