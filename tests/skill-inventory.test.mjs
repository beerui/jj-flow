import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CANONICAL_SKILLS_ROOT_REL,
  CLAUDE_COMMAND_MAX_LINES,
  checkSkillInventory,
  listFilesystemClaudeCommands,
  listFilesystemSkillIds,
  loadSkillInventory,
  SKILL_INVENTORY_SCHEMA_VERSION,
  validateSkillInventoryDocument
} from '../src/skillInventory.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('skill-inventory.json loads and matches schema version', () => {
  const inv = loadSkillInventory(root);
  assert.equal(inv.schema_version, SKILL_INVENTORY_SCHEMA_VERSION);
  assert.equal(inv.canonical_skills_root, CANONICAL_SKILLS_ROOT_REL);
  assert.deepEqual(validateSkillInventoryDocument(inv), []);
});

test('repository skill inventory parity is clean', () => {
  const result = checkSkillInventory({ cwd: root });
  assert.equal(result.ok, true, JSON.stringify(result.findings, null, 2));
  assert.ok(result.skills_on_disk.includes('jj-end'));
  assert.ok(result.claude_commands_on_disk.includes('jj-end.md'));
  assert.ok(result.skills_on_disk.includes('jj-dispatch'));
});

test('filesystem skill list matches inventory ids', () => {
  const inv = loadSkillInventory(root);
  const disk = listFilesystemSkillIds(root);
  assert.deepEqual(disk, inv.skills.map((item) => item.id).sort((a, b) => a.localeCompare(b)));
});

test('claude commands required by inventory exist', () => {
  const inv = loadSkillInventory(root);
  const disk = new Set(listFilesystemClaudeCommands(root));
  for (const skill of inv.skills) {
    if (skill.claude_command) assert.ok(disk.has(skill.claude_command), skill.claude_command);
  }
});

test('checkSkillInventory fails when skill missing from inventory', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ski-'));
  try {
    fs.mkdirSync(path.join(cwd, '.codex', 'skills', 'jj-orphan'), { recursive: true });
    fs.writeFileSync(path.join(cwd, '.codex', 'skills', 'jj-orphan', 'SKILL.md'), '# orphan\n', 'utf8');
    fs.mkdirSync(path.join(cwd, '.claude', 'commands'), { recursive: true });
    fs.copyFileSync(path.join(root, 'skill-inventory.json'), path.join(cwd, 'skill-inventory.json'));
    // minimal package.json for pkg checks
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({
      name: 'tmp',
      files: ['.codex/skills/', '.claude/commands/']
    }), 'utf8');
    // also need inventory skills present or more findings — copy inventory expects all skills
    // Use empty inventory-like failure: only orphan on disk vs full inventory → many missing, plus PARITY-003
    const result = checkSkillInventory({ cwd });
    assert.equal(result.ok, false);
    assert.ok(result.findings.some((item) => item.rule_id === 'SKI-PARITY-003' || item.rule_id === 'SKI-PARITY-001'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('checkSkillInventory fails SKI-CLAUDE-005 when claude command exceeds thin budget', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ski-claude-'));
  try {
    const skillId = 'jj-demo';
    fs.mkdirSync(path.join(cwd, '.codex', 'skills', skillId), { recursive: true });
    fs.writeFileSync(path.join(cwd, '.codex', 'skills', skillId, 'SKILL.md'), '# demo\n', 'utf8');
    fs.mkdirSync(path.join(cwd, '.claude', 'commands'), { recursive: true });
    const fatLines = Array.from({ length: CLAUDE_COMMAND_MAX_LINES + 5 }, (_, i) => `line ${i + 1}`);
    fs.writeFileSync(
      path.join(cwd, '.claude', 'commands', skillId + '.md'),
      fatLines.join('\n') + '\n',
      'utf8'
    );
    fs.writeFileSync(path.join(cwd, 'skill-inventory.json'), JSON.stringify({
      schema_version: SKILL_INVENTORY_SCHEMA_VERSION,
      canonical_skills_root: CANONICAL_SKILLS_ROOT_REL,
      claude_commands_root: '.claude/commands',
      install_discipline: ['edit .codex/skills only'],
      skills: [{
        id: skillId,
        claude_command: skillId + '.md',
        platforms: ['claude', 'codex']
      }]
    }, null, 2), 'utf8');
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({
      name: 'tmp',
      files: ['.codex/skills/', '.claude/commands/']
    }), 'utf8');

    const result = checkSkillInventory({ cwd });
    assert.equal(result.ok, false);
    const finding = result.findings.find((item) => item.rule_id === 'SKI-CLAUDE-005');
    assert.ok(finding, JSON.stringify(result.findings, null, 2));
    assert.match(finding.reason, /超过/);
    assert.match(finding.next_action, /瘦身|pointer/i);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('repository jj-same Claude command is within thin budget', () => {
  const sameCmd = path.join(root, '.claude', 'commands', 'jj-same.md');
  assert.ok(fs.existsSync(sameCmd));
  const text = fs.readFileSync(sameCmd, 'utf8');
  const lineCount = text.length === 0 ? 0 : text.replace(/\n$/, '').split('\n').length;
  assert.ok(
    lineCount <= CLAUDE_COMMAND_MAX_LINES,
    'jj-same.md has ' + lineCount + ' lines, budget is ' + CLAUDE_COMMAND_MAX_LINES
  );
});
