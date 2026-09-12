import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runCli } from '../../src/cli.mjs';
import {
  TASK_PLAN_REL,
  initRun,
  recordReview,
  validateRun,
  setGate,
  loadRun
} from '../../src/ralph.mjs';
import { ledgerText } from './helpers.mjs';

test('recordReview maps HIGH/MEDIUM/LOW to lowercase severities', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-review-high-'));
  try {
    const runId = 'task-review-high';
    initRun({ run_id: runId, title: 'high alias', goal: 'map HIGH', attach_knowledge: false }, cwd);
    const result = recordReview(runId, {
      cwd,
      outcome: 'NEEDS_CHANGES',
      summary: 'block',
      findings: [{
        id: 'F-1',
        severity: 'HIGH',
        file: 'src/a.js',
        line: 1,
        description: 'user-visible leak',
        status: 'OPEN',
        acceptance: 'hide it'
      }]
    });
    assert.equal(result.report.findings[0].severity, 'high');
    const disk = JSON.parse(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, '.state', 'reviews', 'REV-1.json'), 'utf8'));
    assert.equal(disk.findings[0].severity, 'high');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('review-record associates task/review threads on ralph run', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-review-'));
  const chunks = [];
  const stdout = { write: (text) => chunks.push(text) };
  try {
    const runId = 'task-review-demo';
    assert.equal(runCli(['ralph', 'init', '--run-id', runId, '--title', 'review demo', '--goal', 'link sessions', '--json'], { cwd, stdout }), 0);
    chunks.length = 0;
    assert.equal(runCli(['ralph', 'review-record', '--run-id', runId, '--outcome', 'PASS', '--reviewed-commit', 'abcdef1234567', '--task-thread', '019f8c85-8c32-72c3-b62b-ee9f0753a9e7', '--review-thread', '019f8cb8-14e9-79b3-bf40-30ba6c89ef2c', '--summary', 'ok', '--json'], { cwd, stdout }), 0);
    const payload = JSON.parse(chunks[chunks.length - 1]);
    assert.equal(payload.report.review_id, 'REV-1');
    assert.equal(payload.report.outcome, 'PASS');
    assert.equal(payload.report.task_thread_id, '019f8c85-8c32-72c3-b62b-ee9f0753a9e7');
    assert.equal(payload.report.review_thread_id, '019f8cb8-14e9-79b3-bf40-30ba6c89ef2c');
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', runId, '.state', 'reviews', 'REV-1.json')));
    const run = JSON.parse(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json'), 'utf8'));
    assert.equal(run.review.latest_review_id, 'REV-1');
    assert.equal(run.artifact_refs.latest_review_ref, 'reviews/REV-1.json');
    assert.deepEqual(validateRun(run), []);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('review-record persists source and host_review provenance', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-review-prov-'));
  const chunks = [];
  const stdout = { write: (text) => chunks.push(text) };
  try {
    const runId = 'task-review-prov';
    assert.equal(runCli(['ralph', 'init', '--run-id', runId, '--title', 'review provenance', '--goal', 'keep host source', '--json'], { cwd, stdout }), 0);
    chunks.length = 0;
    const hostJson = JSON.stringify({
      method: 'skill',
      entry: 'review',
      artifact_paths: ['tmp/host-review.md'],
      note: 'mapped from host builtin'
    });
    assert.equal(runCli([
      'ralph', 'review-record',
      '--run-id', runId,
      '--outcome', 'PASS',
      '--reviewed-commit', 'abcdef1234567',
      '--summary', 'host mapped',
      '--source', 'host_builtin',
      '--host-review-json', hostJson,
      '--json'
    ], { cwd, stdout }), 0);
    const payload = JSON.parse(chunks[chunks.length - 1]);
    assert.equal(payload.report.source, 'host_builtin');
    assert.equal(payload.report.host_review.method, 'skill');
    assert.equal(payload.report.host_review.entry, 'review');
    assert.deepEqual(payload.report.host_review.artifact_paths, ['tmp/host-review.md']);
    const disk = JSON.parse(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, '.state', 'reviews', 'REV-1.json'), 'utf8'));
    assert.equal(disk.source, 'host_builtin');
    assert.equal(disk.host_review.entry, 'review');
    const progress = ledgerText(cwd, runId);
    assert.match(progress, /source=host_builtin/);
    const run = JSON.parse(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json'), 'utf8'));
    assert.equal(run.review.reviews[0].source, 'host_builtin');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('recordReview PASS sets accept_layers.judgment for strict accept path', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-review-judgment-'));
  try {
    const runId = 'task-review-judgment';
    initRun({
      run_id: runId,
      title: 'review judgment',
      goal: 'auto judgment from review',
      capability_ids: ['CAP-rj'],
      attach_knowledge: false,
      intensity: 'strict'
    }, cwd);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    setGate(runId, { gate: 'deliver', status: 'PASS', cwd });
    assert.equal(loadRun(runId, cwd).accept_layers.judgment, 'PENDING');
    recordReview(runId, { cwd, outcome: 'PASS', summary: 'ok', findings: [] });
    const after = loadRun(runId, cwd);
    assert.equal(after.accept_layers.judgment, 'PASS');
    assert.equal(after.accept_layers.judgment_mode, 'review');
    const accepted = setGate(runId, { gate: 'accept', status: 'PASS', cwd });
    assert.equal(accepted.run.gates.accept, 'PASS');

    recordReview(runId, {
      cwd,
      outcome: 'NEEDS_CHANGES',
      summary: 'fix',
      findings: [{
        id: 'F-1',
        severity: 'high',
        file: 'src/a.js',
        line: 1,
        description: 'bug',
        status: 'OPEN',
        acceptance: 'fix it'
      }]
    });
    assert.equal(loadRun(runId, cwd).accept_layers.judgment, 'FAIL');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('review findings support pass/importance, nit cap, and skip generated paths', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-review-policy-'));
  try {
    const runId = 'task-review-policy';
    initRun({ run_id: runId, title: 'review policy', goal: 'nits', attach_knowledge: false }, cwd);
    const nits = [];
    for (let i = 1; i <= 7; i += 1) {
      nits.push({
        id: 'F-N' + i,
        severity: 'info',
        importance: 'nit',
        file: 'src/a.js',
        line: i,
        description: 'style ' + i,
        status: 'OPEN',
        acceptance: 'optional'
      });
    }
    nits.push({
      id: 'F-GEN',
      severity: 'low',
      file: 'src/gen/types.js',
      line: 1,
      description: 'generated',
      status: 'OPEN',
      acceptance: 'skip'
    });
    const result = recordReview(runId, {
      cwd,
      outcome: 'PASS',
      summary: 'nits only',
      findings: nits,
      include_compliance: false
    });
    const waived = result.report.findings.filter((item) => item.status === 'WAIVED');
    const open = result.report.findings.filter((item) => item.status === 'OPEN');
    assert.equal(open.length, 0);
    assert.equal(waived.length, 7);
    assert.equal(result.report.findings.some((item) => item.file === 'src/gen/types.js'), false);
    assert.equal(result.report.outcome, 'PASS');

    const capId = 'task-review-nitcap';
    initRun({ run_id: capId, title: 'nit cap', goal: 'cap', attach_knowledge: false }, cwd);
    const cap = recordReview(capId, {
      cwd,
      outcome: 'NEEDS_CHANGES',
      summary: 'nits plus important',
      include_compliance: false,
      findings: [
        ...nits,
        {
          id: 'F-IMP',
          severity: 'high',
          pass: 'bugs',
          importance: 'important',
          file: 'src/a.js',
          line: 9,
          description: 'broken',
          status: 'OPEN',
          acceptance: 'fix'
        }
      ]
    });
    assert.equal(cap.report.findings.filter((item) => item.importance === 'nit' && item.status === 'OPEN').length, 5);
    assert.equal(cap.report.findings.filter((item) => item.importance === 'nit' && item.status === 'WAIVED').length, 2);

    const flipId = 'task-review-important-pass';
    initRun({ run_id: flipId, title: 'important pass', goal: 'flip', attach_knowledge: false }, cwd);
    const flip = recordReview(flipId, {
      cwd,
      outcome: 'PASS',
      summary: 'important still open',
      include_compliance: false,
      findings: [{
        id: 'F-IMP-PASS',
        severity: 'high',
        pass: 'bugs',
        importance: 'important',
        file: 'src/a.js',
        line: 1,
        description: 'broken',
        status: 'OPEN',
        acceptance: 'fix'
      }]
    });
    assert.equal(flip.report.outcome, 'NEEDS_CHANGES');

    const planId = 'task-review-plan-file';
    initRun({ run_id: planId, title: 'plan finding', goal: 'keep task_plan.md', attach_knowledge: false }, cwd);
    const planFinding = recordReview(planId, {
      cwd,
      outcome: 'NEEDS_CHANGES',
      summary: 'compliance vs Current',
      include_compliance: false,
      findings: [{
        id: 'F-COMPLIANCE-PLAN',
        severity: 'high',
        pass: 'compliance',
        importance: 'important',
        file: TASK_PLAN_REL,
        line: 1,
        description: 'diff misses Current',
        status: 'OPEN',
        acceptance: 'align Current'
      }]
    });
    assert.equal(planFinding.report.findings.some((item) => item.file === TASK_PLAN_REL && item.status === 'OPEN'), true);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
