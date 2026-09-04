#!/usr/bin/env node
/**
 * Thin product dispatcher for sibling lab gyms.
 * Fail-closed: never invent ../jj-lab-*, never mkdir homedir / /portfolio/config.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const LAB_ORACLE_REPORT_VERSION = 'jj-flow/lab-oracle-report/1.0';
export const LOOP_L1_S7A_OLD_MARKER = 'task_plan.md/plan.md has no Landed/Superseded after rewrite';
export const LOOP_L1_S7A_LEAN_MARKER = 'lean task_plan.md grew Landed/已落地 after rewrite';
export const LOOP_L1_S7A_OVERLAY_REL = 'scripts/lab-overlays/jj-lab-loop/ed72b08-lean-l1-s7a';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const LOOP_L1_S7A_OVERLAY_DIR = path.join(SCRIPT_DIR, 'lab-overlays', 'jj-lab-loop', 'ed72b08-lean-l1-s7a');

const LAB_IDS = Object.freeze(['loop-gym', 'family-gym']);
const ROOT_ENV = Object.freeze({
  'loop-gym': 'JJ_LAB_LOOP_ROOT',
  'family-gym': 'JJ_LAB_FAMILY_ROOT'
});

function fail(message, extra = {}) {
  return { ok: false, status: 'FAIL', error: message, ...extra };
}

export function isAbsoluteExistingDir(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (!path.isAbsolute(value)) return false;
  try {
    return fs.statSync(value).isDirectory();
  } catch {
    return false;
  }
}

function readRootsFile(filePath) {
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Resolve lab roots. Never concatenates product toplevel with ../jj-lab-* or labs/.
 */
export function resolveLabRoots({
  env = process.env,
  productRoot = process.cwd(),
  lab = null
} = {}) {
  const wanted = lab && LAB_IDS.includes(lab) ? [lab] : [...LAB_IDS];
  const errors = [];
  const roots = {};

  const applyMap = (map, source) => {
    if (!map || typeof map !== 'object') return;
    for (const id of wanted) {
      if (roots[id]) continue;
      const raw = map[id];
      if (typeof raw !== 'string' || !raw.trim()) continue;
      if (!path.isAbsolute(raw)) {
        errors.push(`${source} ${id} is not an absolute path: ${raw}`);
        continue;
      }
      if (!isAbsoluteExistingDir(raw)) {
        errors.push(`${source} ${id} is not an existing directory: ${raw}`);
        continue;
      }
      roots[id] = path.resolve(raw);
    }
  };

  const fromEnv = {};
  for (const id of wanted) {
    const key = ROOT_ENV[id];
    if (env[key]) fromEnv[id] = env[key];
  }
  applyMap(fromEnv, 'env');

  if (env.JJ_LAB_ROOTS_FILE) {
    const file = env.JJ_LAB_ROOTS_FILE;
    if (!path.isAbsolute(file)) {
      errors.push('JJ_LAB_ROOTS_FILE must be an absolute path');
    } else {
      const parsed = readRootsFile(file);
      if (!parsed) errors.push(`JJ_LAB_ROOTS_FILE missing or invalid JSON: ${file}`);
      else applyMap(parsed, 'JJ_LAB_ROOTS_FILE');
    }
  }

  const localFile = path.join(productRoot, 'lab-roots.json');
  if (fs.existsSync(localFile)) {
    const parsed = readRootsFile(localFile);
    if (!parsed) errors.push(`lab-roots.json exists but is invalid JSON: ${localFile}`);
    else applyMap(parsed, 'lab-roots.json');
  }

  for (const id of wanted) {
    if (!roots[id]) {
      errors.push(`missing lab root for ${id} (set ${ROOT_ENV[id]}, JJ_LAB_ROOTS_FILE, or existing lab-roots.json)`);
    }
  }

  return {
    ok: errors.length === 0 && wanted.every((id) => roots[id]),
    roots,
    errors,
    wanted
  };
}

/**
 * Pin ed72b08 still checks leftover Current→Landed. Lean init no longer writes
 * those headings, so CI/local lab:check copies the product overlay onto the
 * loop gym working tree when the old marker is present. No-op once gym lands
 * the lean oracle (marker gone). Never invent sibling paths.
 */
export function applyLoopLeanL1S7aOverlay(loopRoot) {
  const ledger = path.join(loopRoot, 'scripts', 'oracles', 'run-ledger.mjs');
  const lab = path.join(loopRoot, 'scripts', 'lab.mjs');
  const manifest = path.join(loopRoot, 'lab-manifest.json');
  if (!fs.existsSync(ledger) || !fs.existsSync(lab)) {
    return { applied: false, reason: 'missing-oracle' };
  }
  const current = fs.readFileSync(ledger, 'utf8');
  if (current.includes(LOOP_L1_S7A_LEAN_MARKER) || !current.includes(LOOP_L1_S7A_OLD_MARKER)) {
    return { applied: false, reason: 'already-aligned' };
  }
  const srcLedger = path.join(LOOP_L1_S7A_OVERLAY_DIR, 'run-ledger.mjs');
  const srcLab = path.join(LOOP_L1_S7A_OVERLAY_DIR, 'lab.mjs');
  const srcManifest = path.join(LOOP_L1_S7A_OVERLAY_DIR, 'lab-manifest.json');
  if (!fs.existsSync(srcLedger) || !fs.existsSync(srcLab)) {
    return { applied: false, reason: 'missing-overlay' };
  }
  fs.copyFileSync(srcLedger, ledger);
  fs.copyFileSync(srcLab, lab);
  if (fs.existsSync(srcManifest) && fs.existsSync(manifest)) {
    fs.copyFileSync(srcManifest, manifest);
  }
  return { applied: true, reason: 'lean-l1-s7a' };
}

export function assertLabPin(labRoot) {
  const manifestPath = path.join(labRoot, 'lab-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, error: `missing lab-manifest.json under ${labRoot}` };
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return { ok: false, error: `lab-manifest.json unreadable: ${error.message}` };
  }
  const version = typeof manifest.harness_version === 'string' ? manifest.harness_version.trim() : '';
  const commit = typeof manifest.jj_flow_commit === 'string' ? manifest.jj_flow_commit.trim() : '';
  if (!version && !commit) {
    return { ok: false, error: 'lab-manifest.json pin missing (need harness_version and/or jj_flow_commit)' };
  }
  if (commit) {
    const banned = /^(UNPINNED|TODO|main)$/i;
    if (banned.test(commit) || !/^[0-9a-f]{7,40}$/i.test(commit)) {
      return { ok: false, error: `jj_flow_commit pin invalid: ${commit}` };
    }
  }
  return { ok: true, manifest, manifestPath };
}

function parseArgs(argv) {
  const out = { suite: 'mechanical', json: false, lab: null, help: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--suite') out.suite = argv[++i] || out.suite;
    else if (a === '--lab') out.lab = argv[++i] || null;
  }
  return out;
}

export function runLabCheck({
  cwd = process.cwd(),
  env = process.env,
  suite = 'mechanical',
  lab = null,
  json = false
} = {}) {
  const home = os.homedir();
  const forbiddenMk = [
    path.join(home, '.jj-flow'),
    process.platform === 'win32' ? path.resolve('/portfolio/config') : null
  ].filter(Boolean);

  const resolved = resolveLabRoots({ env, productRoot: cwd, lab });
  if (!resolved.ok) {
    return {
      schema_version: LAB_ORACLE_REPORT_VERSION,
      ok: false,
      status: 'FAIL',
      findings: resolved.errors.map((reason) => ({
        rule_id: 'LAB-ROOT-MISSING',
        reason,
        next_action: 'Set JJ_LAB_LOOP_ROOT / JJ_LAB_FAMILY_ROOT to existing absolute directories (or JJ_LAB_ROOTS_FILE / lab-roots.json). Do not guess sibling paths.'
      })),
      labs: [],
      forbidden_mkdir: forbiddenMk
    };
  }

  const labs = [];
  const findings = [];
  const productRoot = path.resolve(cwd);

  for (const id of resolved.wanted) {
    const root = resolved.roots[id];
    const pin = assertLabPin(root);
    if (!pin.ok) {
      findings.push({
        rule_id: 'LAB-PIN-MISSING',
        path: root,
        reason: pin.error,
        next_action: 'Write non-empty harness_version and/or 7–40 hex jj_flow_commit in lab-manifest.json. Do not seed to paper over a missing pin.'
      });
      continue;
    }
    if (id === 'loop-gym') applyLoopLeanL1S7aOverlay(root);
    const runner = path.join(root, 'scripts', 'lab.mjs');
    if (!fs.existsSync(runner)) {
      findings.push({
        rule_id: 'LAB-RUNNER-MISSING',
        path: runner,
        reason: `lab runner missing for ${id}`,
        next_action: 'Add scripts/lab.mjs in the sibling lab repo.'
      });
      continue;
    }
    const args = [runner, 'oracle', '--suite', suite, '--json'];
    if (id === 'loop-gym') args.push('--lab', 'loop-gym');
    if (id === 'family-gym') args.push('--lab', 'family-gym');
    const childEnv = {
      ...env,
      JJ_FLOW_ROOT: productRoot
    };
    if (id === 'loop-gym') childEnv.JJ_LAB_LOOP_ROOT = root;
    if (id === 'family-gym') childEnv.JJ_LAB_FAMILY_ROOT = root;
    const spawned = spawnSync(process.execPath, args, {
      cwd: root,
      env: childEnv,
      encoding: 'utf8',
      timeout: 120000,
      windowsHide: true
    });
    let report = null;
    try {
      report = JSON.parse(spawned.stdout || '{}');
    } catch {
      report = null;
    }
    const labOk = spawned.status === 0 && report && report.ok !== false && report.status !== 'FAIL';
    labs.push({
      id,
      root,
      pin: { harness_version: pin.manifest.harness_version || null, jj_flow_commit: pin.manifest.jj_flow_commit || null },
      exit: spawned.status,
      report
    });
    if (!labOk) {
      findings.push({
        rule_id: 'LAB-ORACLE-FAIL',
        path: root,
        reason: (report && (report.error || report.summary))
          || spawned.stderr
          || `lab ${id} oracle exited ${spawned.status}`,
        next_action: 'Fix the sibling lab oracle; product lab-check does not invent roots or skip pin.'
      });
      if (Array.isArray(report?.findings)) findings.push(...report.findings);
    }
  }

  return {
    schema_version: LAB_ORACLE_REPORT_VERSION,
    ok: findings.length === 0,
    status: findings.length === 0 ? 'PASS' : 'FAIL',
    findings,
    labs,
    jj_flow_root: productRoot,
    forbidden_mkdir: forbiddenMk
  };
}

function renderText(result) {
  if (result.ok) {
    return `lab check passed (${(result.labs || []).map((item) => item.id).join(', ') || 'none'})\n`;
  }
  const lines = ['lab check failed'];
  for (const finding of result.findings || []) {
    lines.push(`- [${finding.rule_id || 'LAB'}] ${finding.path || '.'}: ${finding.reason}`);
    if (finding.next_action) lines.push(`  next: ${finding.next_action}`);
  }
  return `${lines.join('\n')}\n`;
}

const isDirect = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirect) {
  const args = parseArgs(process.argv);
  if (args.help) {
    process.stdout.write(`Usage: node scripts/lab-check.mjs [--suite mechanical] [--lab loop-gym|family-gym] [--json]\n`);
    process.exit(0);
  }
  const result = runLabCheck({
    cwd: process.cwd(),
    suite: args.suite,
    lab: args.lab,
    json: args.json
  });
  if (args.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else process.stdout.write(renderText(result));
  if (!result.ok) process.exitCode = 1;
}
