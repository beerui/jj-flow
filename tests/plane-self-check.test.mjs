import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkPlaneTerminalIntegrity,
  gradePlaneTerminalIntegrity
} from '../skills/jj-dispatch/scripts/plane-self-check.mjs';

test('plane-self-check flags synthetic session ids and VERIFIED without produced_commit', () => {
  const plane = {
    schema_version: 'jj-flow/control-plane/1.0',
    revision: 1,
    control_project: { id: 'c', name: 'c', path: '/c' },
    projects: [{ id: 'project-a', name: 'pa', path: '/pa', status: 'active' }],
    deliveries: [
      {
        delivery_id: 'DEL-test',
        status: 'VERIFIED',
        targets: [
          {
            project_id: 'project-a',
            status: 'VERIFIED'
          }
        ],
        dispatch_intents: [
          {
            task_key: 'DEL-test/project-a/development/1',
            project_id: 'project-a',
            responsibility: 'development',
            attempt: 1,
            status: 'BOUND',
            host_id: 'grok-build',
            thread_id: 'session-acceptor-tag-pa-dev-20260730',
            result: { outcome: 'DONE', produced_commit: null }
          }
        ]
      }
    ]
  };

  const result = checkPlaneTerminalIntegrity(plane);
  assert.equal(result.ok, false);
  const codes = new Set(result.findings.map((f) => f.code));
  assert.ok(codes.has('SYNTHETIC_THREAD_ID'));
  assert.ok(codes.has('VERIFIED_MISSING_COMMIT') || codes.has('VERIFIED_WITHOUT_PRODUCED_COMMIT'));
  assert.ok(codes.has('VERIFIED_REOPEN_SUGGESTED'));
});

test('plane-self-check accepts real session + matching produced_commit', () => {
  const sha = 'f68b7043f18d0151873d5da726267344df7d6763';
  const plane = {
    deliveries: [
      {
        delivery_id: 'DEL-ok',
        status: 'VERIFIED',
        targets: [
          {
            project_id: 'project-a',
            status: 'VERIFIED',
            checkpoint: { commit: sha, reviewed_commit: sha },
            last_result: { commit: sha, reviewed_commit: sha }
          }
        ],
        dispatch_intents: [
          {
            task_key: 'DEL-ok/project-a/development/1',
            project_id: 'project-a',
            responsibility: 'development',
            attempt: 1,
            status: 'BOUND',
            host_id: 'grok-build',
            thread_id: '019fb288-5e92-7a73-bb0a-b6d6edfe1420',
            sandbox_evidence_ref: '.workflow/dispatch/DEL-ok/attestations/DEL-ok__project-a__development__1.json',
            result: { outcome: 'DONE', produced_commit: sha }
          }
        ]
      }
    ]
  };

  const result = checkPlaneTerminalIntegrity(plane);
  assert.equal(result.ok, true, JSON.stringify(result.findings, null, 2));
  assert.equal(gradePlaneTerminalIntegrity(plane).grade, 'ok');
});

test('plane-self-check C4 flags BOUND review host:string attestation; grades fail on synthetic', () => {
  const plane = {
    deliveries: [{
      delivery_id: 'DEL-c4',
      status: 'RUNNING',
      targets: [{ project_id: 'project-a', status: 'RUNNING' }],
      dispatch_intents: [
        {
          task_key: 'DEL-c4/project-a/review/1',
          project_id: 'project-a',
          responsibility: 'review',
          status: 'BOUND',
          host_id: 'grok-build',
          thread_id: '019fb288-5e92-7a73-bb0a-b6d6edfe1420',
          sandbox_evidence_ref: 'host:grok-build:session:019fb288-5e92-7a73-bb0a-b6d6edfe1420'
        }
      ]
    }]
  };
  const result = checkPlaneTerminalIntegrity(plane);
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((f) => f.code === 'ATTESTATION_REF_NOT_FILE'));

  const badVerified = {
    deliveries: [{
      delivery_id: 'DEL-c5',
      status: 'VERIFIED',
      targets: [{ project_id: 'x', status: 'VERIFIED' }],
      dispatch_intents: []
    }]
  };
  assert.equal(gradePlaneTerminalIntegrity(badVerified).grade, 'fail');
});
