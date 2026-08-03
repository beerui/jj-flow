import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  attestationRelativePath,
  buildGrokAttestation,
  isAttestationFileRef,
  taskKeyToSafeName,
  writeGrokAttestation
} from '../src/dispatchAttestation.mjs';
import {
  checkPlaneTerminalIntegrity,
  gradePlaneTerminalIntegrity
} from '../skills/jj-dispatch/scripts/plane-self-check.mjs';
import {
  setIntegrityGrade,
  setRemoteCloseout,
  createControlPlane,
  validateControlPlane
} from '../src/dispatchControlPlane.mjs';

const fixture = JSON.parse(
  fs.readFileSync(new URL('./fixtures/jj-dispatch-control-plane.json', import.meta.url), 'utf8')
);

test('C4 path helpers map task_key to attestations file ref', () => {
  assert.equal(taskKeyToSafeName('DEL-x/a/review/1'), 'DEL-x__a__review__1');
  assert.equal(
    attestationRelativePath('DEL-x', 'DEL-x/a/review/1'),
    '.workflow/dispatch/DEL-x/attestations/DEL-x__a__review__1.json'
  );
  assert.equal(isAttestationFileRef('.workflow/dispatch/DEL-x/attestations/x.json'), true);
  assert.equal(isAttestationFileRef('host:grok-build:session:019f-…'), false);
});

test('C4 writeGrokAttestation writes review file and plane-self-check accepts file ref', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-att-'));
  try {
    const taskKey = 'DEL-c4/project-a/review/1';
    const sessionId = '019fb288-5e92-7a73-bb0a-b6d6edfe1420';
    const { rel } = writeGrokAttestation(root, {
      deliveryId: 'DEL-c4',
      task_key: taskKey,
      session_id: sessionId,
      access: 'read',
      project_path: '/portfolio/project-a'
    });
    assert.ok(fs.existsSync(path.join(root, rel)));
    const payload = buildGrokAttestation({
      task_key: taskKey,
      session_id: sessionId,
      access: 'read'
    });
    assert.equal(payload.agent_name, 'jj-workflow-reviewer');
    assert.equal(payload.sandbox_mode, 'read-only');

    const plane = {
      deliveries: [{
        delivery_id: 'DEL-c4',
        status: 'RUNNING',
        targets: [{ project_id: 'project-a', status: 'RUNNING' }],
        dispatch_intents: [{
          task_key: taskKey,
          project_id: 'project-a',
          responsibility: 'review',
          status: 'BOUND',
          host_id: 'grok-build',
          thread_id: sessionId,
          sandbox_evidence_ref: rel
        }]
      }]
    };
    const check = checkPlaneTerminalIntegrity(plane, { controlRoot: root });
    assert.equal(check.ok, true, JSON.stringify(check.findings));
    assert.equal(gradePlaneTerminalIntegrity(plane, { controlRoot: root }).grade, 'ok');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('C5 setIntegrityGrade and C6 setRemoteCloseout round-trip on valid plane', () => {
  let plane = createControlPlane(fixture);
  plane = setIntegrityGrade(plane, {
    deliveryId: 'DEL-001',
    grade: 'degraded',
    findings: [{ code: 'NOTE', message: 'soft' }]
  });
  assert.equal(plane.deliveries[0].integrity_grade, 'degraded');
  assert.equal(plane.deliveries[0].integrity.grade, 'degraded');
  plane = setRemoteCloseout(plane, {
    deliveryId: 'DEL-001',
    pushed: true,
    merged_to: 'dev',
    note: 'landed task-scoped'
  });
  assert.equal(plane.deliveries[0].remote_closeout.pushed, true);
  assert.equal(plane.deliveries[0].remote_closeout.merged_to, 'dev');
  assert.equal(validateControlPlane(plane).ok, true);
  assert.ok(plane.events.some((e) => e.type === 'INTEGRITY_GRADE_SET'));
  assert.ok(plane.events.some((e) => e.type === 'REMOTE_CLOSEOUT_SET'));
});
