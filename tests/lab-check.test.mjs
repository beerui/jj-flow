import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  applyLoopLeanL1S7aOverlay,
  LOOP_L1_S7A_LEAN_MARKER,
  LOOP_L1_S7A_OLD_MARKER,
  LOOP_L1_S7A_OVERLAY_REL
} from '../scripts/lab-check.mjs';

test('loop L1-S7a overlay replaces leftover Landed oracle and is idempotent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-lab-overlay-'));
  try {
    const oracleDir = path.join(root, 'scripts', 'oracles');
    fs.mkdirSync(oracleDir, { recursive: true });
    fs.writeFileSync(path.join(oracleDir, 'run-ledger.mjs'), `export function checkCurrentPolicy() { return '${LOOP_L1_S7A_OLD_MARKER}'; }\n`);
    fs.writeFileSync(path.join(root, 'scripts', 'lab.mjs'), 'export const stale = true;\n');
    fs.writeFileSync(path.join(root, 'lab-manifest.json'), '{}\n');

    const first = applyLoopLeanL1S7aOverlay(root);
    assert.equal(first.applied, true);
    assert.equal(first.reason, 'lean-l1-s7a');
    const ledger = fs.readFileSync(path.join(oracleDir, 'run-ledger.mjs'), 'utf8');
    assert.match(ledger, /approach change/);
    assert.ok(ledger.includes(LOOP_L1_S7A_LEAN_MARKER));
    assert.match(fs.readFileSync(path.join(root, 'scripts', 'lab.mjs'), 'utf8'), /new goal after rewrite/);
    assert.match(fs.readFileSync(path.join(root, 'lab-manifest.json'), 'utf8'), /lean Goal rewrite/);

    const second = applyLoopLeanL1S7aOverlay(root);
    assert.equal(second.applied, false);
    assert.equal(second.reason, 'already-aligned');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('loop L1-S7a overlay no-ops when oracle files are missing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-lab-overlay-missing-'));
  try {
    const result = applyLoopLeanL1S7aOverlay(root);
    assert.equal(result.applied, false);
    assert.equal(result.reason, 'missing-oracle');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('product ships the lean L1-S7a overlay next to lab-check', () => {
  const overlayDir = path.join(process.cwd(), LOOP_L1_S7A_OVERLAY_REL);
  const ledger = fs.readFileSync(path.join(overlayDir, 'run-ledger.mjs'), 'utf8');
  const lab = fs.readFileSync(path.join(overlayDir, 'lab.mjs'), 'utf8');
  assert.match(ledger, /approach change/);
  assert.ok(ledger.includes(LOOP_L1_S7A_LEAN_MARKER));
  assert.match(lab, /new goal after rewrite/);
});
