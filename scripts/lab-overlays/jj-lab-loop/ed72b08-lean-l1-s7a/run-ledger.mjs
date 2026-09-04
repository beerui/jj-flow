import crypto from 'node:crypto';
import fs from 'node:fs';
import { finding, ralphRunJsonPath } from '../lib/lab-util.mjs';

export function gatesHash(run) {
  return crypto.createHash('sha256').update(JSON.stringify(run.gates || {})).digest('hex');
}

export function runJsonPath(cwd, runId) {
  return ralphRunJsonPath(cwd, runId);
}

export function loadRunFile(cwd, runId) {
  return JSON.parse(fs.readFileSync(runJsonPath(cwd, runId), 'utf8'));
}

export function checkResumeAbandon({ resumeThrew, abandonThrew, recoverOk, sameId, mapMergeThrew }) {
  const findings = [];
  if (resumeThrew !== true) findings.push(finding('L1-S6', 'resume without reason did not throw', 'resumeRun requires reason.'));
  if (abandonThrew !== true) findings.push(finding('L1-S6', 'abandon without reason did not throw', 'abandonRun requires reason.'));
  if (!sameId) findings.push(finding('L1-S6', 'resume did not keep run_id', 'Same-run resume is required.'));
  if (!mapMergeThrew) findings.push(finding('L1-S6', 'map-merge after abandon did not throw', 'ABANDONED runs cannot map-merge.'));
  if (!recoverOk) findings.push(finding('L1-S6', 'resume after abandon failed', 'abandon is soft; resumeRun must recover.'));
  return { ok: findings.length === 0, findings };
}

export function checkCurrentPolicy(planText, progressText = '') {
  const findings = [];
  const lean = /^## Steps\s*$/m.test(planText) && !/^## 计划\s*$/m.test(planText);
  if (lean) {
    if (
      /^### (已落地|已取代)\s*$/m.test(planText)
      || /^## Landed\b/m.test(planText)
      || /^## Superseded\b/m.test(planText)
    ) {
      findings.push(finding(
        'L1-S7a',
        'lean task_plan.md grew Landed/已落地 after rewrite',
        'Park the old Goal under a dated progress section, not in the live plan.'
      ));
    }
    if (/\bREQ-\d+/.test(planText) && /evidence_class/i.test(planText)) {
      findings.push(finding(
        'L1-S7a',
        'lean task_plan.md grew a REQ ledger',
        'Do not add REQ/evidence_class tables to the live plan.'
      ));
    }
    if (!/^## \d{4}-\d{2}-\d{2} — approach change\s*$/m.test(progressText)) {
      findings.push(finding(
        'L1-S7a',
        'progress.md has no dated approach-change section after Goal rewrite',
        'Append ## YYYY-MM-DD — approach change with the previous Goal.'
      ));
    }
    return { ok: findings.length === 0, findings };
  }
  const zhCurrent = [...planText.matchAll(/^### 当前\s*$/gm)];
  if (zhCurrent.length > 1) {
    const first = zhCurrent[0].index;
    const second = zhCurrent[1].index;
    const between = planText.slice(0, second);
    if (!/^### (已落地|已取代)\s*$/m.test(between.slice(first))) {
      findings.push(finding('L1-S7a', 'second ### 当前 appeared before old block was 已落地/已取代', 'Move 当前 → 已落地/已取代 first.'));
    }
  }
  const current = [...planText.matchAll(/^## Current\b/gm)];
  if (current.length > 1) {
    const first = current[0].index;
    const second = current[1].index;
    const between = planText.slice(0, second);
    if (!/^## (Landed|Superseded)\b/m.test(between.slice(first))) {
      findings.push(finding('L1-S7a', 'second ## Current appeared before old block was Landed/Superseded', 'Move Current → Landed/Superseded first.'));
    }
  }
  const hasLanded = /^### (已落地|已取代)\s*$/m.test(planText)
    || /^## Landed\b/m.test(planText)
    || /^## Superseded\b/m.test(planText);
  if (!hasLanded) {
    findings.push(finding('L1-S7a', 'task_plan.md/plan.md has no Landed/Superseded after rewrite', 'Preserve old Current under Landed or Superseded.'));
  }
  return { ok: findings.length === 0, findings };
}
