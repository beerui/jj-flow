#!/usr/bin/env node
/**
 * Agent-only integrity check for control-plane.json (users do not run this).
 *
 * Exit 0: no terminal-integrity findings.
 * Exit 1: findings that block claiming VERIFIED / honest BOUND.
 * Exit 2: usage / IO error.
 *
 * Usage:
 *   node skills/jj-dispatch/scripts/plane-self-check.mjs --manifest <path>
 *   node ... --manifest <path> --json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SYNTHETIC_SESSION = /^session-[a-z0-9][a-z0-9._-]*-\d{8}$/i;

function parseArgs(argv) {
  const out = { manifest: null, json: false, help: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') out.json = true;
    else if (a === '--manifest' || a === '-m') out.manifest = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
    else if (!a.startsWith('-') && !out.manifest) out.manifest = a;
  }
  return out;
}

/**
 * Soft terminal integrity (agent write path). Does not replace full validateControlPlane.
 * @param {object} plane
 * @param {{ controlRoot?: string|null }} [options] optional control root for C4 file existence checks
 * @returns {{ ok: boolean, findings: Array<{ code: string, message: string, path?: string }> }}
 */
export function checkPlaneTerminalIntegrity(plane, options = {}) {
  const findings = [];
  const controlRoot = options.controlRoot || options.control_root || null;
  if (!plane || typeof plane !== 'object') {
    return { ok: false, findings: [{ code: 'PLANE_INVALID', message: 'plane must be an object' }] };
  }
  const deliveries = Array.isArray(plane.deliveries) ? plane.deliveries : [];
  for (const d of deliveries) {
    const did = d?.delivery_id || '(unknown-delivery)';
    const intents = Array.isArray(d.dispatch_intents) ? d.dispatch_intents : [];
    const targets = Array.isArray(d.targets) ? d.targets : [];

    for (const intent of intents) {
      const key = intent?.task_key || `${did}/?`;
      const host = intent?.host_id;
      const tid = intent?.thread_id;
      if (intent?.status === 'BOUND' || intent?.status === 'COMPLETED') {
        if (typeof tid === 'string' && SYNTHETIC_SESSION.test(tid)) {
          findings.push({
            code: 'SYNTHETIC_THREAD_ID',
            path: key,
            message: `BOUND/COMPLETED intent has synthetic thread_id "${tid}" (use real host session/thread id; same-session may share one real id)`
          });
        } else if (host === 'grok-build' && typeof tid === 'string' && tid.startsWith('session-')) {
          findings.push({
            code: 'SYNTHETIC_THREAD_ID',
            path: key,
            message: `grok-build thread_id looks invented: "${tid}"`
          });
        }
      }

      // C4: active BOUND grok intents should use attestation *files* (including review/read).
      if (host === 'grok-build' && intent?.status === 'BOUND') {
        const ref = intent.sandbox_evidence_ref;
        if (!ref || typeof ref !== 'string' || !ref.trim()) {
          findings.push({
            code: 'MISSING_ATTESTATION_REF',
            path: key,
            message: 'BOUND grok-build intent requires sandbox_evidence_ref (prefer attestations/{task_key_safe}.json)'
          });
        } else if (isHostSessionStringRef(ref)) {
          findings.push({
            code: 'ATTESTATION_REF_NOT_FILE',
            path: key,
            message: `sandbox_evidence_ref "${ref}" is a host:string; write attestations/{task_key_safe}.json for development *and* review (C4)`
          });
        } else if (controlRoot && looksLikeAttestationPath(ref)) {
          const abs = path.isAbsolute(ref) ? ref : path.resolve(controlRoot, ref);
          if (!fs.existsSync(abs)) {
            findings.push({
              code: 'ATTESTATION_FILE_MISSING',
              path: key,
              message: `attestation file not found: ${ref}`
            });
          }
        }
      }

      const responsibility = intent?.responsibility;
      const outcome = intent?.result?.outcome;
      const produced = intent?.result?.produced_commit ?? intent?.result?.commit ?? null;
      if (responsibility === 'development' && (outcome === 'DONE' || intent?.status === 'COMPLETED')) {
        const target = targets.find((t) => t.project_id === intent.project_id);
        if (target?.status === 'VERIFIED' && !isCommit(produced)) {
          findings.push({
            code: 'VERIFIED_WITHOUT_PRODUCED_COMMIT',
            path: key,
            message: `target ${intent.project_id} is VERIFIED but development intent has no produced_commit`
          });
        }
      }
    }

    for (const target of targets) {
      const tpath = `${did}/${target?.project_id || '?'}`;
      if (target?.status !== 'VERIFIED') continue;

      const commit = target?.checkpoint?.commit
        ?? target?.last_result?.commit
        ?? target?.commit
        ?? null;
      const reviewed = target?.checkpoint?.reviewed_commit
        ?? target?.last_result?.reviewed_commit
        ?? target?.reviewed_commit
        ?? null;

      if (!isCommit(commit)) {
        findings.push({
          code: 'VERIFIED_MISSING_COMMIT',
          path: tpath,
          message: 'VERIFIED target requires commit (≥7 char sha) on checkpoint/last_result'
        });
      }
      if (!isCommit(reviewed)) {
        findings.push({
          code: 'VERIFIED_MISSING_REVIEWED_COMMIT',
          path: tpath,
          message: 'VERIFIED target requires reviewed_commit'
        });
      }
      if (isCommit(commit) && isCommit(reviewed) && commit !== reviewed) {
        findings.push({
          code: 'VERIFIED_COMMIT_MISMATCH',
          path: tpath,
          message: `commit (${commit}) !== reviewed_commit (${reviewed})`
        });
      }

      const maxDevAttempt = maxAttempt(intents, target.project_id, 'development');
      const devIntent = intents.find(
        (i) => i.project_id === target.project_id
          && i.responsibility === 'development'
          && (i.attempt == null || Number(i.attempt) === maxDevAttempt)
      );
      const produced = devIntent?.result?.produced_commit ?? devIntent?.result?.commit ?? null;
      if (isCommit(commit) && isCommit(produced) && !shaMatch(commit, produced)) {
        findings.push({
          code: 'VERIFIED_PRODUCED_MISMATCH',
          path: tpath,
          message: `target commit (${commit}) !== development produced_commit (${produced})`
        });
      }
      if (!isCommit(produced)) {
        findings.push({
          code: 'VERIFIED_WITHOUT_PRODUCED_COMMIT',
          path: tpath,
          message: 'VERIFIED but no development produced_commit on intent; do not hand-edit status — use reopenTarget after restoring a valid plane, or supply real commit evidence'
        });
      }

      // Soft hint: missing commit evidence is a reopen candidate, not a silent JSON edit.
      if (!isCommit(commit) || !isCommit(produced)) {
        findings.push({
          code: 'VERIFIED_REOPEN_SUGGESTED',
          path: tpath,
          message: 'false or incomplete VERIFIED — prefer reopenTarget / supersedeVerified (attempt++, events, clear approval) over hand-editing status fields'
        });
      }
    }

    if (d.status === 'VERIFIED') {
      const bad = targets.filter((t) => !['VERIFIED', 'NO_CHANGE_REQUIRED'].includes(t?.status));
      if (bad.length) {
        findings.push({
          code: 'DELIVERY_VERIFIED_TARGET_NOT_SUCCESS',
          path: did,
          message: `delivery VERIFIED but targets not success: ${bad.map((t) => `${t.project_id}:${t.status}`).join(', ')}`
        });
      }
    }

  }

  return { ok: findings.length === 0, findings };
}

/**
 * C5: map terminal integrity findings to ok|degraded|fail.
 * hard = synthetic session / VERIFIED evidence failures.
 */
export function gradePlaneTerminalIntegrity(plane, options = {}) {
  const result = checkPlaneTerminalIntegrity(plane, options);
  if (result.ok) {
    return { grade: 'ok', ok: true, findings: [] };
  }
  const hard = result.findings.some((f) => isHardIntegrityCode(f.code));
  return {
    grade: hard ? 'fail' : 'degraded',
    ok: false,
    findings: result.findings
  };
}

function isHardIntegrityCode(code) {
  if (!code) return false;
  return code === 'SYNTHETIC_THREAD_ID'
    || code === 'PLANE_INVALID'
    || code === 'DELIVERY_VERIFIED_TARGET_NOT_SUCCESS'
    || String(code).startsWith('VERIFIED_');
}

function isHostSessionStringRef(ref) {
  const s = String(ref || '');
  return s.startsWith('host:') && !s.includes('.json') && !s.includes('/attestations/');
}

function looksLikeAttestationPath(ref) {
  const s = String(ref || '').replace(/\\/g, '/');
  return s.includes('attestations/') || s.endsWith('.json');
}

function isCommit(v) {
  return typeof v === 'string' && v.length >= 7;
}

function shaMatch(a, b) {
  if (!a || !b) return false;
  const x = String(a).toLowerCase();
  const y = String(b).toLowerCase();
  return x === y || x.startsWith(y) || y.startsWith(x);
}

function maxAttempt(intents, projectId, responsibility) {
  let m = 1;
  for (const i of intents) {
    if (i.project_id === projectId && i.responsibility === responsibility && Number(i.attempt) > m) {
      m = Number(i.attempt);
    }
  }
  return m;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.manifest) {
    process.stderr.write(
      'Usage: node plane-self-check.mjs --manifest <control-plane.json> [--json]\n'
    );
    process.exit(args.help ? 0 : 2);
  }
  const abs = path.resolve(args.manifest);
  if (!fs.existsSync(abs)) {
    process.stderr.write(`manifest not found: ${abs}\n`);
    process.exit(2);
  }
  let plane;
  try {
    plane = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    process.stderr.write(`failed to parse JSON: ${e.message}\n`);
    process.exit(2);
  }

  const result = checkPlaneTerminalIntegrity(plane, { controlRoot: path.dirname(abs) });
  const graded = gradePlaneTerminalIntegrity(plane, { controlRoot: path.dirname(abs) });
  if (args.json) {
    process.stdout.write(`${JSON.stringify({ manifest: abs, ...result, integrity_grade: graded.grade }, null, 2)}\n`);
  } else if (result.ok) {
    process.stdout.write(`plane-self-check: OK grade=ok (${abs})\n`);
  } else {
    process.stdout.write(`plane-self-check: FAIL grade=${graded.grade} (${result.findings.length} findings)\n`);
    for (const f of result.findings) {
      process.stdout.write(`- [${f.code}] ${f.path || ''} ${f.message}\n`);
    }
  }
  process.exit(result.ok ? 0 : 1);
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
const self = path.resolve(fileURLToPath(import.meta.url));
if (entry === self) {
  main();
}
