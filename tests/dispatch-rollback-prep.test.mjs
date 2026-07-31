import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRollbackPrep,
  buildRollbackPrepFromPlane,
  recommendGitStrategy
} from '../src/dispatchRollbackPrep.mjs';

test('local clean tip recommends reset (G-menu [2])', () => {
  const rec = recommendGitStrategy({
    project_id: 'dj-web',
    path: 'D:/a/dj-web',
    task_shas: ['9093b961dd5eadd88bcc70a7ab2ee64720ae22b2'],
    ahead: 1,
    pushed: false,
    tip_is_task_only: true,
    on_integration: false,
    dirty: false
  });
  assert.equal(rec.recommended, 'reset');
  assert.ok(rec.options.includes('reset'));
  assert.ok(rec.commands.some((c) => c.includes('reset --hard')));
});

test('on integration recommends revert not reset', () => {
  const rec = recommendGitStrategy({
    project_id: 'dj-web',
    path: 'D:/a/dj-web',
    task_shas: ['9093b961dd5eadd88bcc70a7ab2ee64720ae22b2'],
    on_integration: true,
    dirty: false
  });
  assert.equal(rec.recommended, 'revert');
  assert.ok(!rec.options.includes('reset'));
  assert.ok(rec.commands.some((c) => c.includes('revert')));
});

test('readme-pnpm style multi-repo fixture matches path-B probes', () => {
  const prep = buildRollbackPrep({
    delivery_id: 'DEL-readme-pnpm-install-20260731',
    reason: 'fixture: post-reopen path B decision',
    repos: [
      {
        project_id: 'cj-web',
        path: 'D:/a/cj-web',
        branch: 'feat/cj-0731-lyj',
        task_shas: ['1ec732bd60cf5c526f1699d9b4381bc19149cb46'],
        ahead: 1,
        pushed: false,
        tip_is_task_only: true,
        on_integration: false,
        dirty: false
      },
      {
        project_id: 'dj-web',
        path: 'D:/a/dj-web',
        branch: 'feat/dj-0731-lyj',
        task_shas: ['9093b961dd5eadd88bcc70a7ab2ee64720ae22b2'],
        ahead: 1,
        pushed: false,
        tip_is_task_only: true,
        on_integration: false,
        dirty: false
      },
      {
        project_id: 'cz-broker-web',
        path: 'D:/a/cz-broker-web',
        branch: 'feat/cz-0731-lyj',
        task_shas: ['f7fbe8818acbd526f739f41bafe7374ef3c32061'],
        ahead: 1,
        pushed: false,
        tip_is_task_only: true,
        on_integration: false,
        dirty: false
      }
    ]
  });
  assert.equal(prep.executes_git, false);
  assert.equal(prep.user_confirmation_required, true);
  assert.equal(prep.summary.any_reset_recommended, true);
  assert.deepEqual(prep.summary.recommended_actions, [
    'cj-web:reset',
    'dj-web:reset',
    'cz-broker-web:reset'
  ]);
  for (const repo of prep.repos) {
    assert.equal(repo.recommended, 'reset');
    assert.match(repo.commands[0], /reset --hard HEAD~1/);
  }
});

test('buildRollbackPrepFromPlane attaches lead + target shas', () => {
  const plane = {
    projects: [
      { id: 'C', path: 'D:/C' },
      { id: 'A', path: 'D:/A' }
    ],
    deliveries: [{
      delivery_id: 'DEL-x',
      lead_project: 'C',
      reference_implementation: { commit: 'cccccccc3333333' },
      targets: [{
        project_id: 'A',
        commit: 'aaaaaaaa1111111',
        intended_branch: 'feat/a'
      }],
      dispatch_intents: [{
        project_id: 'A',
        access: 'write',
        responsibility: 'development',
        result: { produced_commit: 'aaaaaaaa1111111' }
      }]
    }]
  };
  const prep = buildRollbackPrepFromPlane(plane, {
    deliveryId: 'DEL-x',
    probes: {
      C: { ahead: 1, pushed: false, tip_is_task_only: true, on_integration: false, dirty: false },
      A: { ahead: 1, pushed: false, tip_is_task_only: true, on_integration: false, dirty: false }
    }
  });
  assert.equal(prep.repos.length, 2);
  assert.ok(prep.repos.every((r) => r.recommended === 'reset'));
});
