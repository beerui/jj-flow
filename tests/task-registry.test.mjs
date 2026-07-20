import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runCli } from '../src/cli.mjs';
import { taskStatus } from '../src/taskRegistry.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-task-registry-'));
  fs.mkdirSync(path.join(root, '.workflow', 'tasks', 'TASK-001'), { recursive: true });
  fs.writeFileSync(path.join(root, 'control-plane.json'), JSON.stringify({
    revision: 4,
    deliveries: [{
      delivery_id: 'DEL-001',
      title: '恢复跨会话任务',
      status: 'RUNNING',
      task_mode: 'standard',
      targets: [{ project_id: 'app', status: 'RUNNING', responsibilities: [{ name: 'development', phase: 'development', status: 'RUNNING', attempt: 1 }] }]
    }]
  }), 'utf8');
  fs.writeFileSync(path.join(root, '.workflow', 'tasks', 'TASK-001', 'task.json'), JSON.stringify({
    schema_version: 'jj-flow/task-state/1.0',
    task_id: 'TASK-001',
    delivery_id: 'DEL-001',
    title: '恢复跨会话任务',
    status: 'DRAFT',
    task_mode: 'standard',
    manifest_ref: 'control-plane.json',
    task_document_ref: '.workflow/tasks/TASK-001/task.md',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z'
  }), 'utf8');
  fs.writeFileSync(path.join(root, '.workflow', 'tasks', 'TASK-001', 'task.md'), '# 恢复跨会话任务\n', 'utf8');
  return root;
}

test('task status resolves live status from manifest by task id only', () => {
  const root = fixture();
  const result = taskStatus({ root, taskId: 'TASK-001' });
  assert.equal(result.status, 'RUNNING');
  assert.equal(result.revision, 4);
  assert.equal(result.next_action, 'TICK');
});

test('jj task context prints compact resumable context without manifest arguments', () => {
  const root = fixture();
  let output = '';
  runCli(['task', 'context', '--task', 'TASK-001'], { cwd: root, stdout: { write(value) { output += value; } } });
  assert.match(output, /任务 ID：TASK-001/);
  assert.match(output, /当前状态：RUNNING/);
  assert.match(output, /# 恢复跨会话任务/);
});
