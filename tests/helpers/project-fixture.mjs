import fs from 'node:fs';
import path from 'node:path';

const MODES_TEXT = 'same jj-same jj-dispatch';

const DOC_FILES = [
  'README.md',
  'docs/index.md',
  'docs/installation.md',
  'docs/usage.md',
  'docs/commands.md',
  'docs/commands/jj.md',
  'docs/commands/jj-same.md',
  'docs/commands/jj-dispatch.md',
  'docs/commands/cli.md',
  'docs/glossary.md',
  'docs/architecture.md',
  'docs/project-plan.md',
  'docs/maintenance.md',
  'docs/deployment.md',
  'docs/adr/0002-project-family-control-plane.md',
  'docs/adr/0001-thin-maestro-adapter.md',
  '.codex/skills/jj/SKILL.md',
  '.codex/skills/jj-same/SKILL.md',
  '.codex/skills/jj-dispatch/SKILL.md',
  '.codex/skills/jj-dispatch/agents/openai.yaml',
  '.codex/agents/jj-workflow-reviewer.toml',
  '.codex/agents/jj-workflow-developer.toml',
  '.codex/skills/jj-dispatch/references/control-project.md',
  '.codex/skills/jj-dispatch/references/control-plane.schema.json',
  '.claude/commands/jj.md',
  '.claude/commands/jj-same.md'
];

const SOURCE_FILES = [
  'bin/jj.mjs',
  'src/cli.mjs',
  'src/dispatch.mjs',
  'src/recipes.mjs',
  'src/guards.mjs',
  'src/evidence.mjs',
  'src/evidenceProviders.mjs',
  'src/installSkill.mjs',
  'src/knowledgeLoop.mjs',
  'src/maestroCompatibility.mjs',
  'src/maestroExecution.mjs',
  'src/projectValidation.mjs',
  'src/dispatchControlPlane.mjs',
  'scripts/build-docs.mjs',
  'scripts/check-project.mjs',
  '.github/workflows/ci.yml',
  '.github/workflows/pages.yml',
  '.github/workflows/release-please.yml',
  'release-please-config.json',
  '.release-please-manifest.json'
];

const TEST_FILES = [
  'tests/dispatch.test.mjs',
  'tests/evidence-providers.test.mjs',
  'tests/guards.test.mjs',
  'tests/install-skill.test.mjs',
  'tests/knowledge-loop.test.mjs',
  'tests/maestro-compatibility.test.mjs',
  'tests/maestro-execution.test.mjs',
  'tests/project-validation.test.mjs',
  'tests/jj-dispatch-contract.test.mjs',
  'tests/fixtures/jj-dispatch-control-plane.json'
];

export function makeProjectFixture() {
  const workspaceRoot = path.join(process.cwd(), '.tmp');
  fs.mkdirSync(workspaceRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(workspaceRoot, 'jj-flow-project-'));

  writeJson(path.join(root, 'package.json'), {
    name: '@shendu-sdt/jj-flow',
    version: '0.1.1-beta.0',
    scripts: {
      test: 'node --test tests/*.test.mjs',
      check: 'node scripts/check-project.mjs',
      'docs:check': 'node scripts/build-docs.mjs --check',
      verify: 'npm test && npm run check && npm run docs:check'
    }
  });

  writeJson(path.join(root, '.workflow/state.json'), {
    status: 'ready',
    current_milestone: 'M1',
    milestones: [
      {
        id: 'M1',
        name: 'fixture milestone',
        phases: [
          {
            id: 'P1',
            slug: 'fixture-phase',
            name: 'fixture phase',
            status: 'completed',
            requirements: ['REQ-A1'],
            success_criteria: []
          }
        ]
      }
    ]
  });
  writeText(
    path.join(root, '.workflow/roadmap.md'),
    '## 需求映射\n| 需求 | 原始需求 | Phase |\n| --- | --- | --- |\n| REQ-A1 | fixture requirement | P1 |\n\n| 里程碑 | 阶段 | 状态 | 进度 |\n| --- | --- | --- | --- |\n| M1 | P1 fixture phase | completed | 100% |\n'
  );
  writeText(path.join(root, '.workflow/project.md'), '- REQ-A1：fixture requirement\n');

  for (const file of DOC_FILES) {
    writeText(path.join(root, file), `${MODES_TEXT}\n项目族编排\n不 fork Maestro core\n不把 /jj-* 做成重型编排引擎\n可选\n安装 你需要给什么 使用方案 你会得到什么\n`);
  }

  for (const file of SOURCE_FILES) {
    writeText(path.join(root, file), `${MODES_TEXT}\nverify check docs:check pages release-please release-please-config.json command assets\n`);
  }

  for (const file of TEST_FILES) {
    writeText(path.join(root, file), 'project validation command assets\n');
  }

  return root;
}

function writeJson(file, value) {
  writeText(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
