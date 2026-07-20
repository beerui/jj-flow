import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildTaskAssignment,
  readTaskTitle,
  renderDispatchSummary,
  renderTaskAssignment,
  taskDocumentPath
} from '../src/taskPresentation.mjs';

test('task title reads only the markdown main heading', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-flow-task-'));
  const file = taskDocumentPath(root, 'TASK-001');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '# 登录标题颜色\n\n正文不应进入用户摘要。\n', 'utf8');

  assert.equal(readTaskTitle({ root, taskId: 'TASK-001' }), '登录标题颜色');
});

test('task assignment exposes title and flow without document content', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-flow-assign-'));
  const file = taskDocumentPath(root, 'TASK-DEL-001');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '# 登录标题颜色\n\n秘密正文\n', 'utf8');
  const assignment = buildTaskAssignment({
    root,
    taskId: 'TASK-DEL-001',
    delivery: { delivery_id: 'DEL-001', status: 'APPROVED' },
    manifestPath: '.workflow/dispatch/DEL-001/control-plane.json'
  });

  const output = renderTaskAssignment(assignment);
  assert.match(output, /任务：登录标题颜色/);
  assert.match(output, /PREVIEW → APPROVE → DISPATCH → TICK/);
  assert.doesNotMatch(output, /秘密正文/);
});

test('dispatch summary keeps completion output compact', () => {
  const output = renderDispatchSummary({
    status: 'VERIFIED',
    persisted: true,
    actions: [{ task_key: 'DEL-001/A/development/1' }],
    decision_required: [],
    next_wait: []
  }, { title: '登录标题颜色' });

  assert.match(output, /任务：登录标题颜色/);
  assert.match(output, /已分配：1 个任务/);
  assert.doesNotMatch(output, /DEL-001\/A\/development\/1/);
});
