import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runCli } from '../src/cli.mjs';

test('jj task assign prints only the task title and flow', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-flow-cli-'));
  const manifest = path.join(root, 'control-plane.json');
  const taskDir = path.join(root, '.workflow', 'tasks', 'TASK-DEL-001');
  fs.mkdirSync(taskDir, { recursive: true });
  fs.writeFileSync(path.join(taskDir, 'task.md'), '# 修改登录标题\n\n不展示的正文。\n', 'utf8');
  fs.writeFileSync(manifest, JSON.stringify({ deliveries: [{ delivery_id: 'DEL-001', title: '旧标题', status: 'APPROVED' }] }), 'utf8');
  let output = '';
  runCli([
    'task', 'assign', '--manifest', 'control-plane.json', '--delivery', 'DEL-001', '--task', 'TASK-DEL-001'
  ], { cwd: root, stdout: { write(value) { output += value; } } });

  assert.match(output, /任务：修改登录标题/);
  assert.match(output, /任务 ID：TASK-DEL-001/);
  assert.doesNotMatch(output, /不展示的正文/);
});
