import fs from 'node:fs';
import path from 'node:path';

const MODES_TEXT = 'delivery feat fix knowhow review validate evolve';

const DOC_FILES = [
  'README.md',
  'docs/index.md',
  'docs/installation.md',
  'docs/usage.md',
  'docs/commands.md',
  'docs/glossary.md',
  'docs/architecture.md',
  'docs/project-plan.md',
  'docs/maintenance.md',
  'docs/deployment.md',
  'docs/adr/0001-thin-maestro-adapter.md',
  '.codex/skills/jj/SKILL.md',
  '.codex/skills/jj-auto/SKILL.md',
  '.codex/skills/jj-delivery/SKILL.md',
  '.codex/skills/jj-validate/SKILL.md',
  '.codex/skills/jj-evolve/SKILL.md',
  '.codex/skills/jj-feat/SKILL.md',
  '.codex/skills/jj-fix/SKILL.md',
  '.codex/skills/jj-knowhow/SKILL.md',
  '.codex/skills/jj-review/SKILL.md',
  '.claude/commands/jj.md',
  '.claude/commands/jj-auto.md',
  '.claude/commands/jj-delivery.md',
  '.claude/commands/jj-validate.md',
  '.claude/commands/jj-evolve.md',
  '.claude/commands/jj-feat.md',
  '.claude/commands/jj-fix.md',
  '.claude/commands/jj-knowhow.md',
  '.claude/commands/jj-review.md'
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
  'src/projectEvolution.mjs',
  'src/projectValidation.mjs',
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
  'tests/project-evolution.test.mjs',
  'tests/project-validation.test.mjs'
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
            success_criteria: []
          }
        ]
      }
    ]
  });

  for (const file of DOC_FILES) {
    writeText(path.join(root, file), `${MODES_TEXT}\nMaestro 上层\n不 fork Maestro core\n不把 /jj-* 做成重型编排引擎\n不重复\n上层协议\n安装 你需要给什么 使用方案 你会得到什么\n`);
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
