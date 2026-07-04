import { buildProjectValidationEvidence } from './projectValidation.mjs';

export function buildProjectEvolutionEvidence({
  cwd = process.cwd(),
  intent = '',
  validationEvidence = buildProjectValidationEvidence({ cwd })
} = {}) {
  const validationFailures = collectValidationFailures(validationEvidence);
  const nextRecommendation = validationEvidence.find((item) => item.id === 'next-recommendation');
  const phaseReadiness = validationEvidence.find((item) => item.id === 'phase-readiness')?.evidence || null;
  const nextPhase = nextRecommendation?.evidence?.next_phase || null;
  const warnings = nextRecommendation?.evidence?.warnings || [];
  const correctionItems = buildCorrectionItems({ validationFailures, phaseReadiness, warnings });
  const planItems = buildPlanItems({ validationFailures, phaseReadiness, nextPhase });

  return [
    {
      id: 'validation-summary',
      source: '$jj evolve',
      artifact_type: 'validation_summary',
      path: '.',
      summary: validationFailures.length
        ? `复用 validate evidence，发现 ${validationFailures.length} 个需要优先修正的问题。`
        : '复用 validate evidence，当前没有自检失败项。',
      evidence: {
        validation_status: validationFailures.length ? 'FAIL' : 'PASS',
        validation_failures: validationFailures,
        phase_readiness: phaseReadiness,
        validation_evidence_ids: validationEvidence.map((item) => item.id)
      }
    },
    {
      id: 'correction-backlog',
      source: '$jj evolve',
      artifact_type: 'correction_backlog',
      path: '.',
      summary: validationFailures.length
        ? '已把自检失败项转换成 correction backlog。'
        : '当前 correction backlog 为空，转入下一项路线图升级。',
      evidence: {
        items: correctionItems,
        priority_rule: '先修正 FAIL，再处理 PENDING，最后推进下一项 roadmap phase。'
      },
      next_steps: correctionItems
    },
    {
      id: 'roadmap-alignment',
      source: '$jj evolve',
      artifact_type: nextPhase || phaseReadiness?.complete ? 'roadmap_alignment' : 'validation_failure',
      path: '.workflow/state.json',
      summary: nextPhase
        ? `升级计划对齐 ${nextPhase.milestone_id}/${nextPhase.id} ${nextPhase.name}。`
        : phaseReadiness?.complete
          ? '路线图所有 phase 已完成，进入维护和真实项目试运行。'
        : '缺少可对齐的下一项 roadmap phase。',
      evidence: {
        next_phase: nextPhase,
        roadmap_complete: Boolean(phaseReadiness?.complete)
      }
    },
    {
      id: 'evolution-plan',
      source: '$jj evolve',
      artifact_type: 'evolution_plan',
      path: '.',
      summary: intent
        ? `已基于用户迭代目标生成升级计划：${intent}`
        : '已基于当前自检和路线图生成升级计划。',
      evidence: {
        intent,
        plan_items: planItems,
        acceptance: planItems
      },
      next_steps: planItems
    },
    {
      id: 'manager-boundary',
      source: '$jj evolve',
      artifact_type: 'manager_boundary',
      path: 'docs/project-plan.md',
      summary: '升级仍保持 jj-flow 是 Maestro 上层协议，不替代 Maestro core 或重写通用执行引擎。',
      evidence: {
        keep_thin_adapter: true,
        forbidden_scope: [
          '不 fork Maestro core',
          '不把所有工具重新实现一遍',
          '不把 /jj 做成重型编排引擎'
        ]
      }
    },
    {
      id: 'evolution-test-plan',
      source: '$jj evolve',
      artifact_type: 'test_plan',
      path: 'package.json',
      summary: '升级完成后需要运行 npm run verify、docs build 和对应 CLI smoke test。',
      evidence: {
        commands: [
          'npm run verify',
          'npm run docs:build',
          'node bin/jj.mjs evolve "基于当前自检结果推进下一项项目管理能力" --json'
        ]
      },
      next_steps: [
        '运行 npm run verify',
        '运行 npm run docs:build',
        '运行 evolve CLI smoke test'
      ]
    }
  ];
}

function collectValidationFailures(evidence) {
  const failures = [];

  for (const item of evidence || []) {
    if (item.artifact_type !== 'validation_failure') continue;
    if (Array.isArray(item.evidence?.failures)) {
      failures.push(...item.evidence.failures);
    } else if (item.summary) {
      failures.push(item.summary);
    }
  }

  return [...new Set(failures)];
}

function buildCorrectionItems({ validationFailures, phaseReadiness, warnings }) {
  if (validationFailures.length) return validationFailures;
  if (phaseReadiness?.incomplete?.length) {
    return phaseReadiness.incomplete.map((item) => `补齐当前 phase 成功标准：${item}`);
  }
  if (phaseReadiness?.status === 'PASS' && phaseReadiness.phase) {
    return [`当前 phase ${phaseReadiness.phase.milestone_id}/${phaseReadiness.phase.id} 成功标准已满足，建议标记完成并推进依赖阶段。`];
  }
  if (phaseReadiness?.complete) {
    return ['路线图所有 phase 已完成，进入维护和真实项目试运行。'];
  }
  if (warnings.length) return warnings;

  return ['当前未发现自检失败项，按 workflow 下一阶段推进项目能力升级。'];
}

function buildPlanItems({ validationFailures, phaseReadiness, nextPhase }) {
  if (validationFailures.length) return validationFailures.map((item) => `修正：${item}`);
  if (phaseReadiness?.incomplete?.length) return phaseReadiness.incomplete.map((item) => `完成：${item}`);
  if (phaseReadiness?.status === 'PASS' && phaseReadiness.phase) {
    return [`完成：将 ${phaseReadiness.phase.milestone_id}/${phaseReadiness.phase.id} ${phaseReadiness.phase.name} 标记为完成，并重新运行 $jj validate。`];
  }
  if (phaseReadiness?.complete) return ['维护：用真实项目运行 $jj delivery、$jj validate 和 $jj evolve，收集下一轮改进证据。'];
  if (nextPhase?.success_criteria?.length) return nextPhase.success_criteria.map((item) => `完成：${item}`);

  return ['补齐可证明的下一步路线图或人工决策。'];
}
