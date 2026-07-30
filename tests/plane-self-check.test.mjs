import assert from 'node:assert/strict';
import test from 'node:test';
import { checkPlaneTerminalIntegrity } from '../.codex/skills/jj-dispatch/scripts/plane-self-check.mjs';

test('plane-self-check flags synthetic session ids and VERIFIED without produced_commit', () => {
  const plane = {
    schema_version: 'jj-flow/control-plane/1.0',
    revision: 1,
    control_project: { id: 'c', name: 'c', path: '/c' },
    projects: [{ id: 'cj-web', name: 'cj', path: '/cj', status: 'active' }],
    deliveries: [
      {
        delivery_id: 'DEL-test',
        status: 'VERIFIED',
        targets: [
          {
            project_id: 'cj-web',
            status: 'VERIFIED'
          }
        ],
        dispatch_intents: [
          {
            task_key: 'DEL-test/cj-web/development/1',
            project_id: 'cj-web',
            responsibility: 'development',
            attempt: 1,
            status: 'BOUND',
            host_id: 'grok-build',
            thread_id: 'session-acceptor-tag-cj-dev-20260730',
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
            project_id: 'cj-web',
            status: 'VERIFIED',
            checkpoint: { commit: sha, reviewed_commit: sha },
            last_result: { commit: sha, reviewed_commit: sha }
          }
        ],
        dispatch_intents: [
          {
            task_key: 'DEL-ok/cj-web/development/1',
            project_id: 'cj-web',
            responsibility: 'development',
            attempt: 1,
            status: 'BOUND',
            host_id: 'grok-build',
            thread_id: '019fb288-5e92-7a73-bb0a-b6d6edfe1420',
            result: { outcome: 'DONE', produced_commit: sha }
          }
        ]
      }
    ]
  };

  const result = checkPlaneTerminalIntegrity(plane);
  assert.equal(result.ok, true, JSON.stringify(result.findings, null, 2));
});
