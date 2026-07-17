import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { runCli } from '../src/cli.mjs';
import {
  defaultClaudeTarget,
  defaultCodexAgentsTarget,
  defaultCodexTarget,
  defaultSkillTarget,
  installSkill,
  projectClaudeTarget,
  projectCodexAgentsTarget,
  projectCodexTarget,
  projectSkillTarget
} from '../src/installSkill.mjs';
import { extractVersionLog, loadCurrentReleaseLog } from '../src/releaseLog.mjs';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const packageVersion = packageJson.version;
const currentReleaseLog = loadCurrentReleaseLog();

test('published package includes Codex skills and agent profiles', () => {
  assert.ok(packageJson.files.includes('.codex/skills/'));
  assert.ok(packageJson.files.includes('.codex/agents/'));
});

test('jj-same docs describe the complete handoff lifecycle', () => {
  const usage = fs.readFileSync(new URL('../docs/usage.md', import.meta.url), 'utf8');
  const commands = fs.readFileSync(new URL('../docs/commands.md', import.meta.url), 'utf8');

  for (const marker of ['Handoff 标准调用流程', '准备交接', '开始迁移', '更新交接', 'parent_snapshot']) {
    assert.match(usage, new RegExp(marker));
  }
  for (const marker of ['Handoff 标准步骤', 'REUSE', 'REFRESH_SOURCES', 'REBASELINE', 'BLOCKED']) {
    assert.match(commands, new RegExp(marker));
  }
});

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
  assert.equal(
    defaultCodexAgentsTarget({ homeDir: '/home/example', codexHome: '' }),
    path.join('/home/example', '.codex', 'agents')
  );
});

test('project skill target points to project Codex directory', () => {
  const target = projectSkillTarget({ cwd: '/repo/example' });
  assert.equal(target, path.join('/repo/example', '.codex', 'skills'));
  assert.equal(projectCodexTarget({ cwd: '/repo/example' }), target);
  assert.equal(projectCodexAgentsTarget({ cwd: '/repo/example' }), path.join('/repo/example', '.codex', 'agents'));
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
  assert.ok(result.skills.includes('jj-dispatch'));
  assert.ok(result.agents.includes('jj-workflow-reviewer'));
  assert.ok(result.agents.includes('jj-workflow-developer'));
  assert.equal(result.agent_target, path.join(workspace, 'agents'));
  assert.equal(fs.existsSync(path.join(target, 'jj-delivery')), false);
  assert.equal(fs.existsSync(path.join(workspace, 'agents', 'jj-workflow-reviewer.toml')), false);
});

test('installSkill installs global Codex skills and agents under the same CODEX_HOME', () => {
  const workspace = makeWorkspace('jj-flow-install-global-');
  const codexHome = path.join(workspace, '.codex-home');

  const installed = installSkill({ codexHome });

  assert.equal(installed.ok, true);
  assert.equal(installed.target, path.join(codexHome, 'skills'));
  assert.equal(installed.agent_target, path.join(codexHome, 'agents'));
  assert.equal(fs.existsSync(path.join(codexHome, 'skills', 'jj-dispatch', 'SKILL.md')), true);
  assert.equal(fs.existsSync(path.join(codexHome, 'agents', 'jj-workflow-reviewer.toml')), true);
  assert.equal(fs.existsSync(path.join(codexHome, 'agents', 'jj-workflow-developer.toml')), true);
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
  assert.ok(installed.skills.includes('jj-dispatch'));
  assert.equal(fs.existsSync(path.join(target, 'jj', 'SKILL.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'jj-delivery', 'SKILL.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'jj-same', 'SKILL.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'jj-dispatch', 'SKILL.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'jj-dispatch', 'references', 'control-project.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'jj-dispatch', 'references', 'control-plane.schema.json')), true);
  assert.equal(fs.existsSync(path.join(workspace, 'agents', 'jj-workflow-reviewer.toml')), true);
  assert.equal(fs.existsSync(path.join(workspace, 'agents', 'jj-workflow-developer.toml')), true);
  assert.equal(fs.existsSync(path.join(target, 'jj-same', 'references', 'continuous-sync.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'jj-same', 'references', 'handoff-snapshot.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'jj-same', 'references', 'handoff-snapshot.schema.json')), true);
  assert.equal(fs.existsSync(path.join(target, 'jj-same', 'references', 'maestro-artifact-routing.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'jj-same', 'scripts', 'extract_session_evidence.py')), true);
  assert.match(fs.readFileSync(path.join(target, 'jj-delivery', 'SKILL.md'), 'utf8'), /^---\nname: jj-delivery/m);
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /^---\nname: jj-same/m);
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /cj -> dj -> cz/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /handoff_ref/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /更新交接/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /REUSE \/ REFRESH_SOURCES \/ REBASELINE \/ BLOCKED/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /feat\/cj-0717-1 -> feat\/dj-0717-1/);
  assert.doesNotMatch(
    fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'),
    /grill-me|grill-with-doc|maestro-grill/
  );
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /READY_FOR_USER_TEST/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /默认跳过编译、build、浏览器/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /必要时提示用户下一步手动测试/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /不需要时记录 `N\/A` 理由/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /EXECUTION_READY/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /HANDOFF_READY/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /EXECUTE_NOW/);
  assert.match(fs.readFileSync(path.join(target, 'jj-dispatch', 'SKILL.md'), 'utf8'), /PREVIEW/);
  assert.match(fs.readFileSync(path.join(target, 'jj-dispatch', 'SKILL.md'), 'utf8'), /RECONCILE/);
  assert.match(fs.readFileSync(path.join(target, 'jj-dispatch', 'SKILL.md'), 'utf8'), /origin_project/);
  assert.match(fs.readFileSync(path.join(target, 'jj-dispatch', 'SKILL.md'), 'utf8'), /reference_implementation/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same', 'SKILL.md'), 'utf8'), /不得继续用补齐 `.workflow`/);
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
    fs.readFileSync(path.join(target, 'jj-same', 'references', 'handoff-snapshot.md'), 'utf8'),
    /PARTIAL_HANDOFF/
  );
  const handoffSchema = JSON.parse(
    fs.readFileSync(path.join(target, 'jj-same', 'references', 'handoff-snapshot.schema.json'), 'utf8')
  );
  assert.equal(handoffSchema.properties.schema_version.const, 'jj-same/handoff-snapshot/1.0');
  assert.ok(handoffSchema.required.includes('created_at'));
  assert.ok(handoffSchema.required.includes('execution_readiness'));
  assert.deepEqual(handoffSchema.properties.execution_readiness.enum, ['READY', 'BLOCKED']);
  assert.equal(handoffSchema.allOf[0].then.properties.verification.properties.review.enum.includes('PENDING'), true);
  assert.equal(handoffSchema.allOf[1].then.properties.seal_freshness.const, 'FRESH');
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
  assert.ok(blocked.conflicts.some((file) => file.endsWith(path.join('agents', 'jj-workflow-reviewer.toml'))));

  const preview = installSkill({ targetDir: target, dryRun: true });
  assert.equal(preview.ok, true);
  assert.equal(preview.status, 'dry-run');
  assert.ok(preview.conflicts.length > 0);

  const updated = installSkill({ targetDir: target, force: true });
  assert.equal(updated.ok, true);
  assert.equal(updated.status, 'updated');
});

test('an agent-only conflict blocks the whole Codex install until force is used', () => {
  const workspace = makeWorkspace('jj-flow-install-agent-conflict-');
  const skillsTarget = path.join(workspace, 'skills');
  const agentsTarget = path.join(workspace, 'agents');
  const reviewerTarget = path.join(agentsTarget, 'jj-workflow-reviewer.toml');
  fs.mkdirSync(agentsTarget, { recursive: true });
  fs.writeFileSync(reviewerTarget, 'local = true\n');

  const blocked = installSkill({ targetDir: skillsTarget });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 'target-exists');
  assert.ok(blocked.conflicts.includes(reviewerTarget));
  assert.equal(fs.existsSync(path.join(skillsTarget, 'jj', 'SKILL.md')), false);
  assert.equal(fs.readFileSync(reviewerTarget, 'utf8'), 'local = true\n');

  const preview = installSkill({ targetDir: skillsTarget, dryRun: true });
  assert.equal(preview.ok, true);
  assert.ok(preview.conflicts.includes(reviewerTarget));
  assert.equal(fs.existsSync(path.join(skillsTarget, 'jj', 'SKILL.md')), false);

  const updated = installSkill({ targetDir: skillsTarget, force: true });
  assert.equal(updated.ok, true);
  assert.equal(updated.status, 'updated');
  assert.match(fs.readFileSync(reviewerTarget, 'utf8'), /sandbox_mode = "read-only"/);
});

test('installSkill can install Claude slash commands', () => {
  const workspace = makeWorkspace('jj-flow-install-claude-');
  const target = path.join(workspace, 'commands');

  const installed = installSkill({ platform: 'claude', targetDir: target });
  assert.equal(installed.ok, true);
  assert.equal(installed.platform, 'claude');
  assert.ok(installed.commands.includes('jj-delivery'));
  assert.ok(installed.commands.includes('jj-same'));
  assert.equal(installed.commands.includes('jj-dispatch'), false);
  assert.equal(fs.existsSync(path.join(target, 'jj-delivery.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'jj-same.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'jj-dispatch.md')), false);
  assert.match(fs.readFileSync(path.join(target, 'jj-delivery.md'), 'utf8'), /^---\nname: jj-delivery/m);
  assert.match(fs.readFileSync(path.join(target, 'jj-same.md'), 'utf8'), /^---\nname: jj-same/m);
  assert.match(fs.readFileSync(path.join(target, 'jj-same.md'), 'utf8'), /cj -> dj -> cz/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same.md'), 'utf8'), /handoff_ref/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same.md'), 'utf8'), /更新交接/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same.md'), 'utf8'), /PARTIAL_HANDOFF/);
  assert.doesNotMatch(
    fs.readFileSync(path.join(target, 'jj-same.md'), 'utf8'),
    /grill-me|grill-with-doc|maestro-grill/
  );
  assert.match(fs.readFileSync(path.join(target, 'jj-same.md'), 'utf8'), /READY_FOR_USER_TEST/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same.md'), 'utf8'), /默认跳过编译、build、浏览器/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same.md'), 'utf8'), /提示用户下一步手动测试/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same.md'), 'utf8'), /不需要时记录 `N\/A` 理由/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same.md'), 'utf8'), /EXECUTION_READY/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same.md'), 'utf8'), /HANDOFF_READY/);
  assert.match(fs.readFileSync(path.join(target, 'jj-same.md'), 'utf8'), /EXECUTE_NOW/);
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
  assert.equal(fs.existsSync(path.join(codexTarget, 'jj-dispatch', 'SKILL.md')), true);
  assert.equal(fs.existsSync(path.join(workspace, '.codex', 'agents', 'jj-workflow-reviewer.toml')), true);
  assert.equal(fs.existsSync(path.join(workspace, '.codex', 'agents', 'jj-workflow-developer.toml')), true);
  assert.equal(fs.existsSync(path.join(claudeTarget, 'jj-delivery.md')), true);
  assert.equal(fs.existsSync(path.join(claudeTarget, 'jj-same.md')), true);
  assert.equal(fs.existsSync(path.join(claudeTarget, 'jj-dispatch.md')), false);
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
  assert.ok(parsed.skills.includes('jj-dispatch'));
  assert.ok(parsed.agents.includes('jj-workflow-reviewer'));
  assert.equal(parsed.agent_target, path.join(workspace, 'agents'));
  assert.equal(fs.existsSync(path.join(target, 'jj-delivery', 'SKILL.md')), true);
  assert.equal(fs.existsSync(path.join(workspace, 'agents', 'jj-workflow-reviewer.toml')), true);
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
  assert.equal(parsed.agent_target, path.join(workspace, '.codex', 'agents'));
  assert.equal(fs.existsSync(path.join(workspace, '.codex', 'skills', 'jj-delivery')), false);
  assert.equal(fs.existsSync(path.join(workspace, '.codex', 'agents', 'jj-workflow-reviewer.toml')), false);
  assert.equal(fs.existsSync(path.join(workspace, '.claude', 'commands', 'jj-delivery.md')), false);

  const installStdout = createStdout();
  assert.equal(runCli(['install-skill', '--platform', 'all', '--project', '--json'], { cwd: workspace, stdout: installStdout }), 0);
  assert.equal(fs.existsSync(path.join(workspace, '.codex', 'skills', 'jj-delivery', 'SKILL.md')), true);
  assert.equal(fs.existsSync(path.join(workspace, '.codex', 'agents', 'jj-workflow-reviewer.toml')), true);
  assert.equal(fs.existsSync(path.join(workspace, '.claude', 'commands', 'jj-delivery.md')), true);
});

test('CLI help keeps user-facing labels in Chinese', () => {
  const stdout = createStdout();
  const status = runCli(['--help'], { stdout });
  const installStdout = createStdout();
  const installStatus = runCli(['install-skill', '--help'], { stdout: installStdout });

  assert.equal(status, 0);
  assert.equal(installStatus, 0);
  assert.match(stdout.output, /用法：/);
  assert.match(stdout.output, /示例：/);
  assert.match(stdout.output, /--project/);
  assert.match(stdout.output, /\.codex\/agents/);
  assert.match(stdout.output, /\$jj-delivery/);
  assert.match(stdout.output, /\/jj-delivery/);
  assert.doesNotMatch(stdout.output, /Usage:/);
  assert.doesNotMatch(stdout.output, /Examples:/);
  assert.match(installStdout.output, /\.codex\/skills 与 \.codex\/agents/);
  assert.match(installStdout.output, /agent_target/);
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
