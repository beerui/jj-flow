import assert from 'node:assert/strict';
import test from 'node:test';
import { runCli } from '../src/cli.mjs';
import { buildDispatch } from '../src/dispatch.mjs';
import { buildProjectEvolutionEvidence } from '../src/projectEvolution.mjs';
import { makeProjectFixture } from './helpers/project-fixture.mjs';

test('project evolution evidence turns validation into an upgrade plan', () => {
  const cwd = makeProjectFixture();
  const evidence = buildProjectEvolutionEvidence({
    cwd,
    intent: '基于当前自检结果推进下一项项目管理能力'
  });
  const types = evidence.map((item) => item.artifact_type);

  assert.ok(types.includes('validation_summary'));
  assert.ok(types.includes('correction_backlog'));
  assert.ok(types.includes('roadmap_alignment'));
  assert.ok(types.includes('evolution_plan'));
  assert.ok(types.includes('manager_boundary'));
  assert.ok(types.includes('test_plan'));
});

test('project evolution evidence passes evolve guards', () => {
  const cwd = makeProjectFixture();
  const evidence = buildProjectEvolutionEvidence({ cwd });
  const dispatch = buildDispatch({ mode: 'evolve', intent: '推进项目自身迭代', evidence, cwd });

  assert.equal(dispatch.mode, 'evolve');
  assert.equal(dispatch.guard_report.status, 'PASS');
});

test('CLI evolve attaches project evolution evidence', () => {
  const cwd = makeProjectFixture();
  const stdout = createStdout();
  const status = runCli(['evolve', '基于当前自检结果推进下一项项目管理能力', '--json'], { cwd, stdout });
  const parsed = JSON.parse(stdout.output);

  assert.equal(status, 0);
  assert.equal(parsed.mode, 'evolve');
  assert.equal(parsed.guard_report.status, 'PASS');
  assert.ok(parsed.evidence.some((item) => item.artifact_type === 'evolution_plan'));
});

function createStdout() {
  return {
    output: '',
    write(chunk) {
      this.output += chunk;
    }
  };
}
