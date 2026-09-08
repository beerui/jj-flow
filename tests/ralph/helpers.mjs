import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRunEventsText } from '../../src/ralph.mjs';
import * as ralphApi from '../../src/ralph.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

export function ledgerText(cwd, runId) {
  return readRunEventsText(runId, cwd);
}

export function readJson(rel) {
  return JSON.parse(read(rel));
}

export function withEnv(envPatch, fn) {
  const prev = {};
  for (const key of Object.keys(envPatch)) {
    prev[key] = process.env[key];
    if (envPatch[key] === undefined) delete process.env[key];
    else process.env[key] = envPatch[key];
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(envPatch)) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  }
}

export function withoutLocalPortfolio(fn) {
  return withEnv({
    JJ_GLOBAL_CONFIG_DIR: undefined,
    DAJI_CONFIG_DIR: undefined,
    RALPH_KNOWLEDGE_HOOK: undefined,
    RALPH_KNOWLEDGE_HOOK_CMD: undefined
  }, fn);
}

export function writeConversationPlan(cwd, runId, {
  goal = 'Update the visible label',
  acceptance = '1. [x] The label matches the request',
  steps = '1. [x] Update `README.md`',
  questions = ''
} = {}) {
  const text = ['## Goal', '', goal, '', '## 存疑', '', questions, '', '## 验收', '', acceptance, '', '## Steps', '', steps, ''].join('\n');
  fs.writeFileSync(path.join(cwd, '.workflow', 'ralph', runId, 'task_plan.md'), text);
  return text;
}

export function seedCapabilityMap(cwd) {
  const map = ralphApi.createEmptyMap();
  map.capabilities = Array.from({ length: 7 }, (_, i) => ({
    id: 'CAP-discovery-' + i,
    title: 'catalog capability ' + i,
    summary: 'Reusable catalog result',
    keywords: ['catalog', i === 6 ? 'specialcap' : 'ordinary'],
    status: 'done',
    run_refs: ['task-history-' + i, 'task-history-shared'],
    lessons: ['Keep discovery optional']
  }));
  ralphApi.saveMap(map, cwd);
  return map;
}

export function writeLegacyActive(cwd, runId, extra = {}) {
  const dir = path.join(cwd, '.workflow', 'ralph', runId);
  fs.mkdirSync(dir, { recursive: true });
  const sample = JSON.parse(fs.readFileSync(path.join(root, 'examples/ralph/sample-run.json'), 'utf8'));
  const run = { ...sample, run_id: runId, title: extra.title || sample.title };
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify(run, null, 2));
  fs.writeFileSync(path.join(dir, 'analyze.md'), '## Analyze\n\nmust login\n');
  fs.writeFileSync(path.join(dir, 'plan.md'), '## Plan\n\n## Current\n- `src/a.js`\n');
  fs.writeFileSync(path.join(dir, 'acceptance.md'), '## Acceptance\n\nok\n');
  fs.writeFileSync(path.join(dir, 'progress.md'), '- init\n');
  return dir;
}

export function liteAcceptanceTable(evidence) {
  return [
    '## 验收',
    '',
    '### 当前',
    '',
    '| 项 | must_id | evidence_class | 结果 | 证据 |',
    '| --- | --- | --- | --- | --- |',
    '| title persist | REQ-001 | write-then-read | PASS | ' + evidence + ' |',
    ''
  ].join('\n');
}

export function makeNextRun(patch = {}) {
  return {
    run_id: 'task-next-sample',
    status: 'IN_PROGRESS',
    phase: 'ACCEPT',
    gates: { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PENDING', archive: 'PENDING' },
    review: null,
    archive: null,
    ...patch
  };
}
