import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildTaskArtifacts, writeTaskArtifacts } from '../src/taskArtifacts.mjs';

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
  assert.match(fs.readFileSync(path.join(result.directory, 'task.md'), 'utf8'), /HOF-001/);
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
