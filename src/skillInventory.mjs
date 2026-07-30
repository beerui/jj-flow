import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, '..');

export const SKILL_INVENTORY_SCHEMA_VERSION = 'jj-flow/skill-inventory/1.0';
/** Historical path; universal skill SSOT for Codex / Qoder / Grok install. */
export const CANONICAL_SKILLS_ROOT_REL = '.codex/skills';
export const CLAUDE_COMMANDS_ROOT_REL = '.claude/commands';
export const SKILL_INVENTORY_REL = 'skill-inventory.json';

export function skillInventoryPath(cwd = PROJECT_ROOT) {
  return path.join(cwd, SKILL_INVENTORY_REL);
}

export function loadSkillInventory(cwd = PROJECT_ROOT) {
  const filePath = skillInventoryPath(cwd);
  if (!fs.existsSync(filePath)) {
    throw new Error('missing skill-inventory.json at ' + SKILL_INVENTORY_REL);
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const errors = validateSkillInventoryDocument(raw);
  if (errors.length) throw new Error('invalid skill-inventory.json: ' + errors.join('; '));
  return raw;
}

export function validateSkillInventoryDocument(doc) {
  const errors = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return ['inventory must be object'];
  if (doc.schema_version !== SKILL_INVENTORY_SCHEMA_VERSION) {
    errors.push('schema_version must be ' + SKILL_INVENTORY_SCHEMA_VERSION);
  }
  if (doc.canonical_skills_root !== CANONICAL_SKILLS_ROOT_REL) {
    errors.push('canonical_skills_root must be ' + CANONICAL_SKILLS_ROOT_REL);
  }
  if (doc.claude_commands_root !== CLAUDE_COMMANDS_ROOT_REL) {
    errors.push('claude_commands_root must be ' + CLAUDE_COMMANDS_ROOT_REL);
  }
  if (!Array.isArray(doc.install_discipline) || !doc.install_discipline.length) {
    errors.push('install_discipline required');
  }
  if (!Array.isArray(doc.skills) || !doc.skills.length) errors.push('skills required');
  else {
    const seen = new Set();
    for (const [i, skill] of doc.skills.entries()) {
      if (!skill?.id || !/^jj(-[a-z0-9]+)*$/.test(skill.id)) errors.push('skills[' + i + '].id invalid');
      if (skill?.id && seen.has(skill.id)) errors.push('duplicate skill id ' + skill.id);
      if (skill?.id) seen.add(skill.id);
      if (skill?.claude_command != null && skill.claude_command !== null) {
        if (typeof skill.claude_command !== 'string' || !/^jj(-[a-z0-9]+)*\.md$/.test(skill.claude_command)) {
          errors.push('skills[' + i + '].claude_command invalid');
        }
        if (skill.claude_command && skill.id && skill.claude_command !== skill.id + '.md') {
          errors.push('skills[' + i + '].claude_command must match ' + skill.id + '.md');
        }
      }
      if (!Array.isArray(skill?.platforms) || !skill.platforms.length) {
        errors.push('skills[' + i + '].platforms required');
      }
    }
  }
  return errors;
}

export function listFilesystemSkillIds(cwd = PROJECT_ROOT) {
  const root = path.join(cwd, CANONICAL_SKILLS_ROOT_REL);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .filter((entry) => fs.existsSync(path.join(root, entry.name, 'SKILL.md')))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

export function listFilesystemClaudeCommands(cwd = PROJECT_ROOT) {
  const root = path.join(cwd, CLAUDE_COMMANDS_ROOT_REL);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name.startsWith('jj'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Parity check: inventory ↔ filesystem skills ↔ Claude thin commands.
 * @returns {{ ok: boolean, findings: Array<object>, inventory: object|null, skills_on_disk: string[], claude_commands_on_disk: string[] }}
 */
export function checkSkillInventory({ cwd = PROJECT_ROOT } = {}) {
  const findings = [];
  const add = (rule_id, target, reason, next_action) => {
    findings.push({ rule_id, path: target, reason, next_action });
  };

  let inventory = null;
  try {
    inventory = loadSkillInventory(cwd);
  } catch (error) {
    add(
      'SKI-INV-001',
      SKILL_INVENTORY_REL,
      error.message,
      '恢复 skill-inventory.json 并与 .codex/skills 对齐。'
    );
    return {
      ok: false,
      findings,
      inventory: null,
      skills_on_disk: listFilesystemSkillIds(cwd),
      claude_commands_on_disk: listFilesystemClaudeCommands(cwd)
    };
  }

  const skillsRoot = path.join(cwd, CANONICAL_SKILLS_ROOT_REL);
  if (!fs.existsSync(skillsRoot)) {
    add(
      'SKI-SSOT-001',
      CANONICAL_SKILLS_ROOT_REL,
      '权威 skill 根目录不存在。',
      '恢复 .codex/skills（多端 SSOT，名称历史遗留）。'
    );
  }

  const onDisk = listFilesystemSkillIds(cwd);
  const invIds = inventory.skills.map((item) => item.id).sort((a, b) => a.localeCompare(b));
  const onDiskSet = new Set(onDisk);
  const invSet = new Set(invIds);

  for (const id of invIds) {
    if (!onDiskSet.has(id)) {
      add(
        'SKI-PARITY-001',
        path.join(CANONICAL_SKILLS_ROOT_REL, id),
        '清单有 skill，磁盘缺少 SKILL.md 目录：' + id,
        '创建 .codex/skills/' + id + '/SKILL.md 或从 skill-inventory.json 移除。'
      );
    } else {
      const skillMd = path.join(skillsRoot, id, 'SKILL.md');
      if (!fs.existsSync(skillMd)) {
        add(
          'SKI-PARITY-002',
          path.join(CANONICAL_SKILLS_ROOT_REL, id, 'SKILL.md'),
          'skill 目录缺少 SKILL.md：' + id,
          '补齐 SKILL.md。'
        );
      }
    }
  }

  for (const id of onDisk) {
    if (!invSet.has(id)) {
      add(
        'SKI-PARITY-003',
        path.join(CANONICAL_SKILLS_ROOT_REL, id),
        '磁盘有 skill 未登记清单：' + id,
        '写入 skill-inventory.json 并声明 claude_command / platforms。'
      );
    }
  }

  const claudeOnDisk = listFilesystemClaudeCommands(cwd);
  const claudeSet = new Set(claudeOnDisk);

  for (const skill of inventory.skills) {
    if (skill.claude_command) {
      if (!claudeSet.has(skill.claude_command)) {
        add(
          'SKI-CLAUDE-001',
          path.join(CLAUDE_COMMANDS_ROOT_REL, skill.claude_command),
          '清单要求 Claude 薄入口但文件缺失：' + skill.claude_command,
          '新增 .claude/commands/' + skill.claude_command + '（薄路由，勿复制完整 skill 规程）。'
        );
      }
      if (!skill.platforms?.includes('claude')) {
        add(
          'SKI-CLAUDE-002',
          SKILL_INVENTORY_REL,
          skill.id + ' 有 claude_command 但 platforms 未含 claude',
          '在 platforms 中加入 claude 或清空 claude_command。'
        );
      }
    } else if (skill.platforms?.includes('claude')) {
      add(
        'SKI-CLAUDE-003',
        SKILL_INVENTORY_REL,
        skill.id + ' platforms 含 claude 但 claude_command 为 null',
        '补 claude_command 或从 platforms 去掉 claude。'
      );
    }
  }

  // Unexpected Claude jj* commands not in inventory (except allow none)
  const expectedClaude = new Set(
    inventory.skills.filter((item) => item.claude_command).map((item) => item.claude_command)
  );
  for (const name of claudeOnDisk) {
    if (!expectedClaude.has(name)) {
      add(
        'SKI-CLAUDE-004',
        path.join(CLAUDE_COMMANDS_ROOT_REL, name),
        'Claude 命令未在 skill-inventory 登记：' + name,
        '登记到 skill-inventory.json 或删除孤儿 command。'
      );
    }
  }

  // Package publish surface
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    const files = packageJson.files || [];
    if (!files.some((item) => String(item).replace(/\\/g, '/').includes('.codex/skills'))) {
      add(
        'SKI-PKG-001',
        'package.json',
        'package.json files 未包含 .codex/skills/（发布会丢 SSOT）。',
        '把 .codex/skills/ 加入 package.json files。'
      );
    }
    if (!files.some((item) => String(item).replace(/\\/g, '/').includes('.claude/commands'))) {
      add(
        'SKI-PKG-002',
        'package.json',
        'package.json files 未包含 .claude/commands/。',
        '把 .claude/commands/ 加入 package.json files。'
      );
    }
  } catch (error) {
    add('SKI-PKG-003', 'package.json', '无法读取 package.json：' + error.message, '修复 package.json。');
  }

  return {
    ok: findings.length === 0,
    findings,
    inventory,
    skills_on_disk: onDisk,
    claude_commands_on_disk: claudeOnDisk,
    install_discipline: inventory.install_discipline || []
  };
}
