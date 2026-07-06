import fs from 'node:fs';
import process from 'node:process';
import { buildDispatch, MODE_CHOICES, renderMarkdown } from './dispatch.mjs';
import { installSkill, projectClaudeTarget, projectCodexTarget } from './installSkill.mjs';
import { buildProjectEvolutionEvidence } from './projectEvolution.mjs';
import { buildProjectValidationEvidence } from './projectValidation.mjs';

export function runCli(rawArgs = [], { cwd = process.cwd(), stdout = process.stdout } = {}) {
  const args = [...rawArgs];

  if (args[0] === 'install-skill') {
    return runInstallSkill(args.slice(1), { cwd, stdout });
  }

  if (args.includes('--help') || args.includes('-h')) {
    printHelp(stdout);
    return 0;
  }

  const options = parseArgs(args, cwd, { defaultMode: 'auto' });
  if (shouldAttachProjectEvolutionEvidence(options)) {
    options.evidence = [
      ...buildProjectEvolutionEvidence({ cwd: options.cwd, intent: options.intent }),
      ...options.evidence
    ];
  } else if (shouldAttachProjectValidationEvidence(options)) {
    options.evidence = [
      ...buildProjectValidationEvidence({ cwd: options.cwd }),
      ...options.evidence
    ];
  }
  const dispatch = buildDispatch(options);

  if (options.json) {
    stdout.write(`${JSON.stringify(dispatch, null, 2)}\n`);
  } else {
    stdout.write(renderMarkdown(dispatch));
  }

  return 0;
}

export function parseArgs(rawArgs, defaultCwd = process.cwd(), { defaultMode = 'auto' } = {}) {
  const rest = [...rawArgs];
  let mode = defaultMode;
  let json = false;
  let cwd = defaultCwd;
  let evidence = [];

  if (rest[0] && MODE_CHOICES.includes(rest[0])) {
    mode = rest.shift();
  }

  const words = [];
  while (rest.length) {
    const arg = rest.shift();
    if (arg === '--json') {
      json = true;
      continue;
    }
    if (arg === '--cwd') {
      cwd = rest.shift() || cwd;
      continue;
    }
    if (arg === '--evidence') {
      const file = rest.shift();
      if (!file) throw new Error('--evidence requires a file path');
      evidence = readEvidence(file);
      continue;
    }
    words.push(arg);
  }

  return { mode, intent: words.join(' ').trim(), evidence, cwd, json };
}

function shouldAttachProjectValidationEvidence(options) {
  if (options.evidence.length) return false;
  if (options.mode === 'validate') return true;
  return /(^|\s)(validate|自检|项目状态|漂移|升级建议|路线图|roadmap)(\s|$)/i.test(options.intent);
}

function shouldAttachProjectEvolutionEvidence(options) {
  if (options.mode === 'evolve') return true;
  return /(^|\s)(evolve|自我进化|迭代|升级项目|项目管理者|管理者|自我纠正|长期规划|correction|backlog)(\s|$)/i.test(options.intent);
}

function readEvidence(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : parsed.evidence;
}

function runInstallSkill(rawArgs, { cwd = process.cwd(), stdout } = {}) {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printInstallHelp(stdout);
    return 0;
  }

  const options = parseInstallArgs(rawArgs, cwd);
  const result = installSkill(options);

  if (options.json) {
    stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    stdout.write(`${result.message}\n`);
  }

  return result.ok ? 0 : 1;
}

function parseInstallArgs(rawArgs, cwd = process.cwd()) {
  const rest = [...rawArgs];
  const options = {
    targetDir: undefined,
    platform: 'codex',
    project: false,
    force: false,
    dryRun: false,
    json: false
  };

  while (rest.length) {
    const arg = rest.shift();
    if (arg === '--target') {
      const target = rest.shift();
      if (!target) throw new Error('--target requires a directory path');
      if (options.project) throw new Error('--target cannot be used with --project');
      if (options.platform === 'all') throw new Error('--target cannot be used with --platform all');
      options.targetDir = target;
      continue;
    }
    if (arg === '--platform') {
      const platform = rest.shift();
      if (!platform) throw new Error('--platform requires codex, claude, or all');
      if (!['codex', 'claude', 'all'].includes(platform)) {
        throw new Error('--platform must be codex, claude, or all');
      }
      if (options.targetDir && platform === 'all') {
        throw new Error('--platform all cannot be used with --target');
      }
      options.platform = platform;
      continue;
    }
    if (arg === '--project') {
      if (options.targetDir) throw new Error('--project cannot be used with --target');
      options.project = true;
      options.codexTargetDir = projectCodexTarget({ cwd });
      options.claudeTargetDir = projectClaudeTarget({ cwd });
      continue;
    }
    if (arg === '--force') {
      options.force = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    throw new Error(`Unknown install-skill option: ${arg}`);
  }

  return options;
}

function printHelp(stdout) {
  stdout.write(`jj-flow\n\n用法：\n  jj install-skill [--platform codex|claude|all] [--project | --target dir] [--force] [--dry-run] [--json]\n\n说明：\n  npx/CLI 只负责安装和维护调试。真实使用入口在 Codex 里是 $jj-delivery，在 Claude Code 里是 /jj-delivery。\n\n示例：\n  npx @shendu-sdt/jj-flow@beta install-skill\n  npx @shendu-sdt/jj-flow@beta install-skill --platform claude\n  npx @shendu-sdt/jj-flow@beta install-skill --platform all --project\n`);
}

function printInstallHelp(stdout) {
  stdout.write(`jj install-skill\n\n用法：\n  jj install-skill [--platform codex|claude|all] [--project | --target dir] [--force] [--dry-run] [--json]\n\n选项：\n  --platform    安装目标。codex 安装 .codex/skills，claude 安装 .claude/commands，all 同时安装两者。默认：codex\n  --project     安装到当前项目的 .codex/skills 或 .claude/commands。\n  --target dir  安装到自定义根目录；不能和 --platform all 一起使用。\n  --force       目标资产已存在时覆盖文件。\n  --dry-run     只显示将发生什么，不写文件。\n  --json        输出结构化结果。\n`);
}
