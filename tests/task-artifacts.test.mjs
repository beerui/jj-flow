import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildTaskArtifacts, writeTaskArtifacts } from '../src/taskArtifacts.mjs';
import { initRun, saveRun } from '../src/ralph.mjs';
import { ensureDispatchRalphRuns, ralphRunIdFromDelivery } from '../src/dispatchRalph.mjs';

test('standard delivery scaffolds task documents under .workflow/tasks', () => {
  const delivery = {
    delivery_id: 'DEL-TASK-001',
    title: '登录标题颜色',
    status: 'DRAFT',
    origin_project: 'source',
    requirement_owner: 'source',
    lead_project: 'source',
    task_mode: 'standard',
    distribution_prompt: {
      summary: '修改登录标题颜色',
      handoff_ref: 'HOF-001',
      risk_points: ['不要改全局 token']
    },
    lead_responsibilities: [{ name: 'development', attempt: 1, depends_on: [] }],
    targets: []
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-task-'));
  const result = writeTaskArtifacts(delivery, { root });
  assert.equal(result.mode, 'standard');
  assert.match(result.directory, /\.workflow[\\/]tasks/);
  assert.ok(fs.existsSync(path.join(result.directory, 'task.md')));
  assert.equal(fs.existsSync(path.join(result.directory, '任务.md')), false);
  const taskMd = fs.readFileSync(path.join(result.directory, 'task.md'), 'utf8');
  assert.match(taskMd, /HOF-001/);
  assert.match(taskMd, /## Goal/);
  assert.match(taskMd, /## 验收/);
  assert.match(taskMd, /## Steps/);
  assert.doesNotMatch(taskMd, /分发提示词/);
  assert.doesNotMatch(taskMd, /ANL-LEAD/);
  assert.equal(fs.existsSync(path.join(result.directory, 'plan.md')), false);
});

test('scaffold writes a task index that resolves the live delivery status', async () => {
  const delivery = {
    delivery_id: 'DEL-TASK-INDEX',
    title: '可恢复任务',
    status: 'APPROVED',
    origin_project: 'source',
    requirement_owner: 'source',
    lead_project: 'source',
    task_mode: 'standard',
    distribution_prompt: { summary: '可恢复任务' },
    lead_responsibilities: [{ name: 'development', attempt: 1, depends_on: [] }],
    targets: []
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-task-index-'));
  const manifest = path.join(root, 'control-plane.json');
  fs.writeFileSync(manifest, '{}', 'utf8');
  const result = writeTaskArtifacts(delivery, { root, taskId: 'TASK-INDEX-001', manifestPath: manifest });
  assert.ok(fs.existsSync(path.join(result.directory, 'task.json')));
  const state = JSON.parse(fs.readFileSync(path.join(result.directory, 'task.json'), 'utf8'));
  assert.equal(state.task_id, 'TASK-INDEX-001');
  assert.equal(state.delivery_id, 'DEL-TASK-INDEX');
  assert.equal(state.manifest_ref, 'control-plane.json');
});

test('quick delivery intentionally skips full task documents', () => {
  const result = buildTaskArtifacts({ delivery_id: 'DEL-QUICK', task_mode: 'quick' });
  assert.equal(result.mode, 'quick');
  assert.deepEqual(result.files, {});
});

test('dispatch Ralph slug strips DEL- and date; each project gets a full run', () => {
  assert.equal(ralphRunIdFromDelivery('DEL-enter-form-h5-20260904'), 'task-enter-form-h5');
  const lead = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-lead-'));
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-tgt-'));
  const control = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-ctl-'));
  try {
    const delivery = {
      delivery_id: 'DEL-enter-form-h5-20260904',
      title: '动态入驻表单交接到 H5',
      task_mode: 'standard',
      lead_project: 'seo-daji-web',
      origin_project: 'seo-daji-web',
      distribution_prompt: {
        summary: 'H5 复用动态表单契约',
        acceptance_criteria: ['三面可编辑', 'extInfo 数组']
      },
      targets: [{ project_id: 'daji-merchants-mobile' }]
    };
    const plane = {
      projects: [
        { id: 'seo-daji-web', path: lead },
        { id: 'daji-merchants-mobile', path: target }
      ]
    };
    const bound = ensureDispatchRalphRuns({ delivery, plane, attach_knowledge: false });
    assert.equal(bound.run_id, 'task-enter-form-h5');
    assert.deepEqual(bound.runs.map((row) => row.action), ['init', 'init']);
    for (const cwd of [lead, target]) {
      const runDir = path.join(cwd, '.workflow', 'ralph', 'task-enter-form-h5');
      assert.ok(fs.existsSync(path.join(runDir, '.state', 'run.json')));
      assert.ok(fs.existsSync(path.join(runDir, 'task_plan.md')));
      assert.ok(fs.existsSync(path.join(runDir, 'progress.md')));
      assert.ok(fs.existsSync(path.join(runDir, 'findings.md')));
      const plan = fs.readFileSync(path.join(runDir, 'task_plan.md'), 'utf8');
      assert.match(plan, /## Goal/);
      assert.match(plan, /## 验收/);
      assert.match(plan, /## Steps/);
      assert.match(plan, /三面可编辑/);
    }
    const again = ensureDispatchRalphRuns({ delivery, plane, attach_knowledge: false });
    assert.deepEqual(again.runs.map((row) => row.action), ['reuse', 'reuse']);
    const scaffold = writeTaskArtifacts(delivery, { root: control, plane, attach_knowledge: false });
    const index = fs.readFileSync(path.join(scaffold.directory, 'task.md'), 'utf8');
    assert.match(index, /统筹索引/);
    assert.match(index, /task-enter-form-h5/);
    assert.match(index, /seo-daji-web/);
    assert.match(index, /daji-merchants-mobile/);
  } finally {
    fs.rmSync(lead, { recursive: true, force: true });
    fs.rmSync(target, { recursive: true, force: true });
    fs.rmSync(control, { recursive: true, force: true });
  }
});

test('dispatch Ralph reuses the only live review-slice even without a thread id', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-slice-'));
  try {
    initRun({
      run_id: 'task-h5-enter-review-fix',
      title: '供应商H5入驻审查三点修复',
      goal: '同一入驻交接',
      project_key: 'daji-merchants-mobile',
      attach_knowledge: false,
      write_intent: false,
      force: true
    }, target);
    const delivery = {
      delivery_id: 'DEL-enter-form-h5-20260904',
      title: '动态入驻表单交接到 H5',
      task_mode: 'standard',
      lead_project: 'daji-merchants-mobile',
      origin_project: 'daji-merchants-mobile',
      lead_responsibilities: [{ name: 'development', attempt: 1, depends_on: [] }],
      targets: []
    };
    const bound = ensureDispatchRalphRuns({
      delivery,
      plane: { projects: [{ id: 'daji-merchants-mobile', path: target }] },
      attach_knowledge: false
    });
    assert.deepEqual(bound.runs.map((row) => row.action), ['reuse-sibling']);
    assert.equal(bound.runs[0].run_id, 'task-h5-enter-review-fix');
    assert.equal(fs.existsSync(path.join(target, '.workflow', 'ralph', 'task-enter-form-h5')), false);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('dispatch Ralph reuses a live sibling bound to the same session thread', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-sib-'));
  try {
    const threadId = '8cca3b80-f99e-427f-bdec-30d1309ffb8a';
    const sibling = initRun({
      run_id: 'task-h5-enter-review-fix',
      title: '供应商H5入驻审查三点修复',
      goal: '同一入驻交接',
      project_key: 'daji-merchants-mobile',
      attach_knowledge: false,
      write_intent: false,
      force: true
    }, target);
    sibling.review = {
      latest_review_id: 'REV-1',
      task_thread_id: threadId,
      reviews: [{
        review_id: 'REV-1',
        path: 'reviews/REV-1.json',
        outcome: 'NEEDS_CHANGES',
        review_scope: 'working_tree',
        task_thread_id: threadId
      }]
    };
    saveRun(sibling, target);
    const delivery = {
      delivery_id: 'DEL-enter-form-h5-20260904',
      title: '动态入驻表单交接到 H5',
      task_mode: 'standard',
      lead_project: 'daji-merchants-mobile',
      origin_project: 'daji-merchants-mobile',
      lead_responsibilities: [{ name: 'development', attempt: 1, thread_id: threadId, depends_on: [] }],
      targets: []
    };
    const plane = {
      projects: [{ id: 'daji-merchants-mobile', path: target }]
    };
    const bound = ensureDispatchRalphRuns({ delivery, plane, attach_knowledge: false });
    assert.deepEqual(bound.runs.map((row) => row.action), ['reuse-sibling']);
    assert.equal(bound.runs[0].run_id, 'task-h5-enter-review-fix');
    assert.equal(bound.runs[0].canonical_run_id, 'task-enter-form-h5');
    assert.equal(fs.existsSync(path.join(target, '.workflow', 'ralph', 'task-enter-form-h5')), false);
    const control = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-task-sib-ctrl-'));
    try {
      const scaffold = writeTaskArtifacts(delivery, { root: control, plane, attach_knowledge: false });
      const index = fs.readFileSync(path.join(scaffold.directory, 'task.md'), 'utf8');
      assert.match(index, /task-h5-enter-review-fix/);
      assert.match(index, /reuse-sibling 时以 `### 各项目 Ralph` 的实际 run_id 为准/);
      assert.match(index, /Ralph run_id：`task-h5-enter-review-fix`/);
    } finally {
      fs.rmSync(control, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('dispatch Ralph reuses a sibling bound only via host.thread_id', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-host-tid-'));
  try {
    const threadId = '8cca3b80-f99e-427f-bdec-30d1309ffb8a';
    const sibling = initRun({
      run_id: 'task-h5-enter-review-fix',
      title: '供应商H5入驻审查三点修复',
      goal: '同一入驻交接',
      project_key: 'daji-merchants-mobile',
      attach_knowledge: false,
      write_intent: false,
      force: true
    }, target);
    sibling.host = { thread_id: threadId };
    saveRun(sibling, target);
    const delivery = {
      delivery_id: 'DEL-enter-form-h5-20260904',
      title: '动态入驻表单交接到 H5',
      task_mode: 'standard',
      lead_project: 'daji-merchants-mobile',
      origin_project: 'daji-merchants-mobile',
      lead_responsibilities: [{ name: 'development', attempt: 1, thread_id: threadId, depends_on: [] }],
      targets: []
    };
    const bound = ensureDispatchRalphRuns({
      delivery,
      plane: { projects: [{ id: 'daji-merchants-mobile', path: target }] },
      attach_knowledge: false
    });
    assert.deepEqual(bound.runs.map((row) => row.action), ['reuse-sibling']);
    assert.equal(bound.runs[0].run_id, 'task-h5-enter-review-fix');
    assert.equal(fs.existsSync(path.join(target, '.workflow', 'ralph', 'task-enter-form-h5')), false);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});
