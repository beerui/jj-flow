import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runCli } from '../src/cli.mjs';
import { buildDispatch } from '../src/dispatch.mjs';
import { buildProjectValidationEvidence } from '../src/projectValidation.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('project validation evidence reflects current repository state', () => {
  const evidence = buildProjectValidationEvidence({ cwd: ROOT });
  const types = evidence.map((item) => item.artifact_type);

  assert.ok(types.includes('project_state'));
  assert.ok(types.includes('workflow_state'));
  assert.ok(types.includes('docs_reference'));
  assert.ok(types.includes('recipe_registry'));
  assert.ok(types.includes('phase_readiness'));
  assert.ok(types.includes('maestro_compatibility'));
  assert.ok(types.includes('test_coverage'));
  assert.ok(types.includes('verification_command'));
  assert.ok(types.includes('next_recommendation'));
  assert.equal(types.includes('validation_failure'), false);
});

test('validation evidence can pass validate dispatch guards', () => {
  const evidence = buildProjectValidationEvidence({ cwd: ROOT });
  const dispatch = buildDispatch({ mode: 'validate', intent: '检查当前项目状态', evidence, cwd: ROOT });

  assert.equal(dispatch.mode, 'validate');
  assert.equal(dispatch.guard_report.status, 'PASS');
});

test('CLI validate attaches project validation evidence', () => {
  const stdout = createStdout();
  const status = runCli(['validate', '检查当前项目状态', '--json'], { cwd: ROOT, stdout });
  const parsed = JSON.parse(stdout.output);

  assert.equal(status, 0);
  assert.equal(parsed.mode, 'validate');
  assert.equal(parsed.guard_report.status, 'PASS');
  assert.ok(parsed.evidence.some((item) => item.artifact_type === 'project_state'));
});

function createStdout() {
  return {
    output: '',
    write(chunk) {
      this.output += chunk;
    }
  };
}
