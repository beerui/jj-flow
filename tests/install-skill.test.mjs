import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { runCli } from '../src/cli.mjs';
import {
  defaultClaudeTarget,
  defaultCodexTarget,
  defaultSkillTarget,
  installSkill,
  projectClaudeTarget,
  projectCodexTarget,
  projectSkillTarget
} from '../src/installSkill.mjs';
import { extractVersionLog, loadCurrentReleaseLog } from '../src/releaseLog.mjs';

const packageVersion = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const currentReleaseLog = loadCurrentReleaseLog();

test('release log parser supports Release Please headings', () => {
  const changelog = [
    '# Changelog',
    '',
    '## [1.2.3](https://example.test/releases/tag/v1.2.3) (2026-07-13)',
    '',
    '- 新增安装后版本日志。',
    '',
    '## 1.2.2',
    '',
    '- 上一版本。'
  ].join('\n');

  assert.equal(extractVersionLog(changelog, '1.2.3'), '- 新增安装后版本日志。');
});

test('default skill target points to Codex skill directory', () => {
  const target = defaultSkillTarget({ homeDir: '/home/example', codexHome: '' });
  assert.equal(target, path.join('/home/example', '.codex', 'skills'));
  assert.equal(defaultCodexTarget({ homeDir: '/home/example', codexHome: '' }), target);
});

test('project skill target points to project Codex directory', () => {
  const target = projectSkillTarget({ cwd: '/repo/example' });
  assert.equal(target, path.join('/repo/example', '.codex', 'skills'));
  assert.equal(projectCodexTarget({ cwd: '/repo/example' }), target);
});

test('Claude command targets point to Claude commands directories', () => {
  assert.equal(defaultClaudeTarget({ homeDir: '/home/example', claudeHome: '' }), path.join('/home/example', '.claude', 'commands'));
  assert.equal(projectClaudeTarget({ cwd: '/repo/example' }), path.join('/repo/example', '.claude', 'commands'));
});

test('installSkill dry run does not write files', () => {
  const workspace = makeWorkspace('jj-flow-install-');
  const target = path.join(workspace, 'skills');
  const result = installSkill({ targetDir: target, dryRun: true });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'dry-run');
  assert.ok(result.skills.includes('jj-delivery'));
  assert.ok(result.skills.includes('jj-same'));
  assert.equal(fs.existsSync(path.join(target, 'jj-delivery')), false);
});

test('installSkill copies bundled Codex skills and blocks accidental overwrite', () => {
  const workspace = makeWorkspace('jj-flow-install-');
  const target = path.join(workspace, 'skills');

  const installed = installSkill({ targetDir: target });
  assert.equal(installed.ok, true);
  assert.equal(installed.status, 'installed');
  assert.ok(installed.skills.includes('jj'));
  assert.ok(installed.skills.includes('jj-delivery'));
  assert.ok(installed.skills.includes('jj-same'));
  assert.equal(fs.existsSync(path.join(target, 'jj', 'SKILL.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'jj-delivery', 'SKILL.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'jj-same', 'SKILL.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'jj-same', 'references', 'continuous-sync.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'jj-same', 'references', 'maestro-artifact-routing.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'jj-same', 'scripts', 'extract_session_evidence.py')), true);
  assert.match(fs.readFileSync(path.join(target, 'jj-delivery', 'SKILL.md'), 'utf8'), /^---\nname: jj-delivery/m);
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /^---\nname: jj-same/m);
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /cj -> dj -> cz/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /feat\/cj-0717-1 -> feat\/dj-0717-1/);
  assert.doesNotMatch(
    fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'),
    /grill-me|grill-with-doc|maestro-grill/
  );
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /READY_FOR_USER_TEST/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /默认跳过编译、build、浏览器/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /必要时提示用户下一步手动测试/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /不需要时记录 `N\/A` 理由/);
  for (const skill of ['jj-delivery', 'jj-feat', 'jj-fix']) {
    const content = fs.readFileSync(path.join(target, skill, 'SKILL.md'), 'utf8');
    assert.match(content, /\$jj-same/);
    assert.match(content, /分析阶段/);
  }
  assert.match(
    fs.readFileSync(path.join(target, 'jj-same', 'references', 'continuous-sync.md'), 'utf8'),
    /last_source_head\.\.current_source_head/
  );
  assert.match(
    fs.readFileSync(path.join(target, 'jj-same', 'references', 'continuous-sync.md'), 'utf8'),
    /READY_FOR_USER_TEST/
  );
  assert.match(
    fs.readFileSync(path.join(target, 'jj-same', 'references', 'maestro-artifact-routing.md'), 'utf8'),
    /家族协调计划/
  );
  assert.match(
    fs.readFileSync(path.join(target, 'jj-same', 'references', 'project-family.md'), 'utf8'),
    /feat\/cj-0717-1 -> feat\/dj-0717-1 -> feat\/cz-0717-1/
  );
  assert.doesNotMatch(
    fs.readFileSync(path.join(target, 'jj-same', 'references', 'project-family.md'), 'utf8'),
    /grill-me|grill-with-doc|maestro-grill/
  );
  assert.doesNotMatch(fs.readFileSync(path.join(target, 'jj-delivery', 'SKILL.md'), 'utf8'), /jj-delivery\s+"/);

  const blocked = installSkill({ targetDir: target });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 'target-exists');
  assert.ok(blocked.conflicts.some((file) => file.endsWith(path.join('skills', 'jj'))));

  const preview = installSkill({ targetDir: target, dryRun: true });
  assert.equal(preview.ok, true);
  assert.equal(preview.status, 'dry-run');
  assert.ok(preview.conflicts.length > 0);

  const updated = installSkill({ targetDir: target, force: true });
  assert.equal(updated.ok, true);
  assert.equal(updated.status, 'updated');
});

test('installSkill can install Claude slash commands', () => {
  const workspace = makeWorkspace('jj-flow-install-claude-');
  const target = path.join(workspace, 'commands');

  const installed = installSkill({ platform: 'claude', targetDir: target });
  assert.equal(installed.ok, true);
  assert.equal(installed.platform, 'claude');
  assert.ok(installed.commands.includes('jj-delivery'));
  assert.ok(installed.commands.includes('jj-same'));
  assert.equal(fs.existsSync(path.join(target, 'jj-delivery.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'jj-same.md')), true);
  assert.match(fs.readFileSync(path.join(target, 'jj-delivery.md'), 'utf8'), /^---\nname: jj-delivery/m);
  assert.match(fs.readFileSync(path.join(target, 'jj-same.md'), 'utf8'), /^---\nname: jj-same/m);
  assert.match(fs.readFileSync(path.join(target, 'jj-same.md'), 'utf8'), /cj -> dj -> cz/);
  assert.doesNotMatch(
    fs.readFileSync(path.join(target, 'jj-same.md'), 'utf8'),
    /grill-me|grill-with-doc|maestro-grill/
  );
  assert.match(fs.readFileSync(path.join(target, 'jj-same.md'), 'utf8'), /READY_FOR_USER_TEST/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same.md'), 'utf8'), /默认跳过编译、build、浏览器/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same.md'), 'utf8'), /提示用户下一步手动测试/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same.md'), 'utf8'), /不需要时记录 `N\/A` 理由/);
  for (const command of ['jj-delivery.md', 'jj-feat.md', 'jj-fix.md']) {
    const content = fs.readFileSync(path.join(target, command), 'utf8');
    assert.match(content, /\/jj-same/);
    assert.match(content, /分析阶段/);
  }
  assert.doesNotMatch(fs.readFileSync(path.join(target, 'jj-delivery.md'), 'utf8'), /jj-delivery\s+"/);
});

test('installSkill can install Codex skills and Claude commands together', () => {
  const workspace = makeWorkspace('jj-flow-install-all-');
  const codexTarget = path.join(workspace, '.codex', 'skills');
  const claudeTarget = path.join(workspace, '.claude', 'commands');

  const installed = installSkill({
    platform: 'all',
    codexTargetDir: codexTarget,
    claudeTargetDir: claudeTarget
  });

  assert.equal(installed.ok, true);
  assert.equal(installed.platform, 'all');
  assert.equal(fs.existsSync(path.join(codexTarget, 'jj-delivery', 'SKILL.md')), true);
  assert.equal(fs.existsSync(path.join(codexTarget, 'jj-same', 'SKILL.md')), true);
  assert.equal(fs.existsSync(path.join(claudeTarget, 'jj-delivery.md')), true);
  assert.equal(fs.existsSync(path.join(claudeTarget, 'jj-same.md')), true);
});

test('CLI install-skill returns structured output', () => {
  const workspace = makeWorkspace('jj-flow-install-cli-');
  const target = path.join(workspace, 'skills');
  const stdout = createStdout();
  const status = runCli(['install-skill', '--target', target, '--json'], { stdout });

  const parsed = JSON.parse(stdout.output);
  assert.equal(status, 0);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.status, 'installed');
  assert.equal(parsed.version, packageVersion);
  assert.equal(parsed.release_notes, currentReleaseLog.release_notes);
  assert.ok(parsed.skills.includes('jj-delivery'));
  assert.ok(parsed.skills.includes('jj-same'));
  assert.equal(fs.existsSync(path.join(target, 'jj-delivery', 'SKILL.md')), true);
});

test('CLI install-skill prints latest version log after install and update', () => {
  const workspace = makeWorkspace('jj-flow-install-log-');
  const target = path.join(workspace, 'skills');
  const installStdout = createStdout();
  const updateStdout = createStdout();

  assert.equal(runCli(['install-skill', '--target', target], { stdout: installStdout }), 0);
  assert.ok(installStdout.output.includes(`版本日志（${packageVersion}）`));
  assert.ok(installStdout.output.includes(currentReleaseLog.release_notes));

  assert.equal(runCli(['install-skill', '--target', target, '--force'], { stdout: updateStdout }), 0);
  assert.match(updateStdout.output, /Updated jj assets/);
  assert.ok(updateStdout.output.includes(`版本日志（${packageVersion}）`));
});

test('CLI install-skill omits version log for dry run and failed install', () => {
  const workspace = makeWorkspace('jj-flow-install-no-log-');
  const target = path.join(workspace, 'skills');
  const previewStdout = createStdout();
  const failedStdout = createStdout();

  assert.equal(runCli(['install-skill', '--target', target, '--dry-run'], { stdout: previewStdout }), 0);
  assert.doesNotMatch(previewStdout.output, /版本日志/);

  installSkill({ targetDir: target });
  assert.equal(runCli(['install-skill', '--target', target], { stdout: failedStdout }), 1);
  assert.doesNotMatch(failedStdout.output, /版本日志/);
});

test('CLI install-skill can install Claude command assets', () => {
  const workspace = makeWorkspace('jj-flow-install-cli-');
  const target = path.join(workspace, 'commands');
  const stdout = createStdout();
  const status = runCli(['install-skill', '--platform', 'claude', '--target', target, '--json'], { stdout });
  const parsed = JSON.parse(stdout.output);

  assert.equal(status, 0);
  assert.equal(parsed.ok, true);
  assert.ok(parsed.commands.includes('jj-delivery'));
  assert.ok(parsed.commands.includes('jj-same'));
  assert.equal(fs.existsSync(path.join(target, 'jj-delivery.md')), true);
});

test('CLI install-skill can target the current project', () => {
  const workspace = makeWorkspace('jj-flow-install-project-');
  const stdout = createStdout();
  const status = runCli(['install-skill', '--platform', 'all', '--project', '--dry-run', '--json'], { cwd: workspace, stdout });

  const parsed = JSON.parse(stdout.output);
  assert.equal(status, 0);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.status, 'dry-run');
  assert.deepEqual(parsed.target, [
    path.join(workspace, '.codex', 'skills'),
    path.join(workspace, '.claude', 'commands')
  ]);
  assert.equal(fs.existsSync(path.join(workspace, '.codex', 'skills', 'jj-delivery')), false);
  assert.equal(fs.existsSync(path.join(workspace, '.claude', 'commands', 'jj-delivery.md')), false);
});

test('CLI help keeps user-facing labels in Chinese', () => {
  const stdout = createStdout();
  const status = runCli(['--help'], { stdout });

  assert.equal(status, 0);
  assert.match(stdout.output, /用法：/);
  assert.match(stdout.output, /示例：/);
  assert.match(stdout.output, /--project/);
  assert.match(stdout.output, /\$jj-delivery/);
  assert.match(stdout.output, /\/jj-delivery/);
  assert.doesNotMatch(stdout.output, /Usage:/);
  assert.doesNotMatch(stdout.output, /Examples:/);
});

test('CLI install-skill exits non-zero when target exists without force', () => {
  const workspace = makeWorkspace('jj-flow-install-cli-');
  const target = path.join(workspace, 'skills');
  installSkill({ targetDir: target });

  const stdout = createStdout();
  const status = runCli(['install-skill', '--target', target], { stdout });

  assert.equal(status, 1);
  assert.match(stdout.output, /Target jj asset already exists/);
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
