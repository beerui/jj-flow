import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { runCli } from '../src/cli.mjs';
import { defaultSkillTarget, installSkill, projectSkillTarget } from '../src/installSkill.mjs';

test('default skill target points to Codex skill directory', () => {
  const target = defaultSkillTarget({ homeDir: '/home/example', codexHome: '' });
  assert.equal(target, path.join('/home/example', '.codex', 'skills', 'jj'));
});

test('project skill target points to project Codex directory', () => {
  const target = projectSkillTarget({ cwd: '/repo/example' });
  assert.equal(target, path.join('/repo/example', '.codex', 'skills', 'jj'));
});

test('installSkill dry run does not write files', () => {
  const workspace = makeWorkspace('jj-flow-install-');
  const target = path.join(workspace, 'skills', 'jj');
  const result = installSkill({ targetDir: target, dryRun: true });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'dry-run');
  assert.equal(fs.existsSync(target), false);
});

test('installSkill copies the jj skill and blocks accidental overwrite', () => {
  const workspace = makeWorkspace('jj-flow-install-');
  const target = path.join(workspace, 'skills', 'jj');

  const installed = installSkill({ targetDir: target });
  assert.equal(installed.ok, true);
  assert.equal(installed.status, 'installed');
  assert.equal(fs.existsSync(path.join(target, 'SKILL.md')), true);

  const blocked = installSkill({ targetDir: target });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 'target-exists');

  const updated = installSkill({ targetDir: target, force: true });
  assert.equal(updated.ok, true);
  assert.equal(updated.status, 'updated');
});

test('CLI install-skill returns structured output', () => {
  const workspace = makeWorkspace('jj-flow-install-cli-');
  const target = path.join(workspace, 'skills', 'jj');
  const stdout = createStdout();
  const status = runCli(['install-skill', '--target', target, '--json'], { stdout });

  const parsed = JSON.parse(stdout.output);
  assert.equal(status, 0);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.status, 'installed');
  assert.equal(fs.existsSync(path.join(target, 'SKILL.md')), true);
});

test('CLI install-skill can target the current project', () => {
  const workspace = makeWorkspace('jj-flow-install-project-');
  const stdout = createStdout();
  const status = runCli(['install-skill', '--project', '--dry-run', '--json'], { cwd: workspace, stdout });

  const parsed = JSON.parse(stdout.output);
  assert.equal(status, 0);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.status, 'dry-run');
  assert.equal(parsed.target, path.join(workspace, '.codex', 'skills', 'jj'));
  assert.equal(fs.existsSync(parsed.target), false);
});

test('CLI help keeps user-facing labels in Chinese', () => {
  const stdout = createStdout();
  const status = runCli(['--help'], { stdout });

  assert.equal(status, 0);
  assert.match(stdout.output, /用法：/);
  assert.match(stdout.output, /示例：/);
  assert.match(stdout.output, /--project/);
  assert.doesNotMatch(stdout.output, /Usage:/);
  assert.doesNotMatch(stdout.output, /Examples:/);
});

test('CLI install-skill exits non-zero when target exists without force', () => {
  const workspace = makeWorkspace('jj-flow-install-cli-');
  const target = path.join(workspace, 'skills', 'jj');
  installSkill({ targetDir: target });

  const stdout = createStdout();
  const status = runCli(['install-skill', '--target', target], { stdout });

  assert.equal(status, 1);
  assert.match(stdout.output, /Target already exists/);
});

function createStdout() {
  return {
    output: '',
    write(chunk) {
      this.output += chunk;
    }
  };
}

function makeWorkspace(prefix) {
  const root = path.join(process.cwd(), '.tmp');
  fs.mkdirSync(root, { recursive: true });
  return fs.mkdtempSync(path.join(root, prefix));
}
