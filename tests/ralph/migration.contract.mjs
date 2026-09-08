import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  RALPH_RUN_SCHEMA_VERSION,
  initRun,
  saveRun,
  readRunArtifactText,
  loadRun,
  listRuns,
  locateRalphRuns,
  migrateRuns,
  adoptRun,
  getStatus,
  writeHandoffPackage,
  renderRalphStatusText,
  pruneArchive
} from '../../src/ralph.mjs';
import { root, writeLegacyActive } from './helpers.mjs';

test('listRuns marks active RALPH-* as needs_migrate and does not hide them (B8)', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-b8-'));
  try {
    writeLegacyActive(cwd, 'RALPH-login-reminder-20260722');
    const rows = listRuns(cwd);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].run_id, 'RALPH-login-reminder-20260722');
    assert.equal(rows[0].needs_migrate, true);
    assert.equal(rows[0].layout, 'legacy-active');
    assert.throws(() => loadRun('RALPH-login-reminder-20260722', cwd), /jj ralph migrate/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('locateRalphRuns finds new layout and leftover archive each once', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-locate-'));
  try {
    initRun({ run_id: 'task-login-reminder', title: 'new layout', goal: 'task dir', attach_knowledge: false }, cwd);
    const leftoverDir = path.join(cwd, '.workflow', 'ralph', 'archive', '2026-07-22-login-reminder');
    fs.mkdirSync(leftoverDir, { recursive: true });
    const sample = JSON.parse(fs.readFileSync(path.join(root, 'examples/ralph/sample-run.json'), 'utf8'));
    fs.writeFileSync(path.join(leftoverDir, 'run.json'), JSON.stringify(sample, null, 2));
    const located = locateRalphRuns(cwd);
    const fresh = located.filter((row) => row.run_id === 'task-login-reminder' && (row.layout === 'task' || row.layout === 'active' || row.layout === 'live'));
    const archived = located.filter((row) => row.layout === 'archive' && row.readonly);
    assert.equal(fresh.length, 1);
    assert.equal(archived.length, 1);
    const leftover = loadRun('RALPH-login-reminder-20260722', cwd);
    assert.ok(leftover._readonly_archive_path);
    assert.throws(() => saveRun(leftover, cwd), /read-only archive/);
    fs.writeFileSync(path.join(leftoverDir, 'progress.md'), '- init leftover\n');
    fs.writeFileSync(path.join(leftoverDir, 'plan.md'), '## 计划\n\n### 当前\n- `src/a.js`\n');
    fs.writeFileSync(path.join(leftoverDir, 'analyze.md'), '## 分析\n');
    fs.writeFileSync(path.join(leftoverDir, 'acceptance.md'), '## 验收\n');
    assert.match(readRunArtifactText(leftover, 'progress', cwd), /init leftover/);
    const status = getStatus({ runId: leftover.run_id, cwd });
    assert.match(String(status.path || '').replaceAll('\\', '/'), /archive\//);
    assert.throws(() => writeHandoffPackage(leftover.run_id, { cwd }), /read-only archive/);
    assert.equal(fs.existsSync(path.join(cwd, '.workflow', 'ralph', leftover.run_id)), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('ralph migrate 1:1 moves RALPH-* into tasks/task-* and leaves archive leftover', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-migrate-'));
  try {
    writeLegacyActive(cwd, 'RALPH-login-reminder-20260722');
    const leftoverDir = path.join(cwd, '.workflow', 'ralph', 'archive', '2026-07-22-login-reminder');
    fs.mkdirSync(leftoverDir, { recursive: true });
    fs.writeFileSync(path.join(leftoverDir, 'marker.txt'), 'keep-me\n');
    const result = migrateRuns({ cwd });
    assert.equal(result.count, 1);
    assert.equal(result.runs[0].to, 'task-login-reminder');
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'task-login-reminder', '.state', 'run.json')));
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'task-login-reminder', 'task_plan.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'migrated', 'RALPH-login-reminder-20260722')) || fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'migrated', 'login-reminder-20260722')));
    assert.equal(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'RALPH-login-reminder-20260722')), false);
    const live = loadRun('task-login-reminder', cwd);
    assert.equal(live.schema_version, RALPH_RUN_SCHEMA_VERSION);
    assert.match(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', 'task-login-reminder', 'task_plan.md'), 'utf8'), /## 分析/);
    assert.equal(fs.readFileSync(path.join(leftoverDir, 'marker.txt'), 'utf8'), 'keep-me\n');
    const listed = listRuns(cwd);
    assert.equal(listed.some((row) => row.needs_migrate), false);
    assert.equal(listed.some((row) => String(row.run_id).startsWith('.migrated-') || String(row.path || '').includes('/migrated/')), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('migrate shelters leftover .migrated-* and parks COMPLETED out of leftover tasks/', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-migrate-tidy-'));
  try {
    const leftover = path.join(cwd, '.workflow', 'ralph', '.migrated-RALPH-old-form-20260825');
    fs.mkdirSync(leftover, { recursive: true });
    fs.writeFileSync(path.join(leftover, 'run.json'), '{}\n');

    const liveId = 'task-live-form';
    initRun({ run_id: liveId, title: 'live', goal: 'keep active', attach_knowledge: false }, cwd);
    const liveRoot = path.join(cwd, '.workflow', 'ralph', liveId);
    const liveNested = path.join(cwd, '.workflow', 'ralph', 'tasks', liveId);
    fs.mkdirSync(path.dirname(liveNested), { recursive: true });
    fs.renameSync(liveRoot, liveNested);

    const doneId = 'task-done-form';
    initRun({ run_id: doneId, title: 'done', goal: 'park me', attach_knowledge: false }, cwd);
    const done = loadRun(doneId, cwd);
    done.status = 'COMPLETED';
    done.phase = 'ARCHIVE';
    saveRun(done, cwd);
    const doneRoot = path.join(cwd, '.workflow', 'ralph', doneId);
    const doneNested = path.join(cwd, '.workflow', 'ralph', 'tasks', doneId);
    fs.renameSync(doneRoot, doneNested);

    const result = migrateRuns({ cwd });
    assert.equal(result.sheltered.length, 1);
    assert.equal(result.sheltered[0].to.replaceAll('\\', '/'), '.workflow/ralph/migrated/RALPH-old-form-20260825');
    assert.equal(fs.existsSync(leftover), false);
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'migrated', 'RALPH-old-form-20260825', 'run.json')));
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', liveId, '.state', 'run.json')));
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'completed', doneId, '.state', 'run.json')));
    assert.equal(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'tasks')), false);
    assert.equal(loadRun(doneId, cwd).last_archive_path.replaceAll('\\', '/'), '.workflow/ralph/completed/' + doneId);
    assert.equal(result.parked.some((row) => row.run_id === doneId), true);
    const listed = listRuns(cwd);
    assert.equal(listed.some((row) => String(row.path || '').includes('.migrated-') || String(row.path || '').includes('/migrated/')), false);
    assert.equal(listed.find((row) => row.run_id === liveId).layout, 'active');
    assert.equal(listed.find((row) => row.run_id === doneId).layout, 'completed');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('init same task_key resumes; adopt --absorb is refused', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-adopt-'));
  try {
    initRun({ run_id: 'task-enter-form-dynamic', title: 'form', goal: 'schema', attach_knowledge: false }, cwd);
    assert.throws(
      () => initRun({ run_id: 'task-enter-form-dynamic', title: 'form', goal: 'schema', attach_knowledge: false }, cwd),
      /resume the same task_key/
    );
    const refused = adoptRun({ cwd, task: 'task-enter-form-dynamic', absorb: 'task-other' });
    assert.equal(refused.ok, false);
    assert.equal(refused.status, 'refused');
    assert.match(refused.example, /jj ralph adopt --task task-enter-form-dynamic --absorb/);
    writeLegacyActive(cwd, 'RALPH-enter-form-20260901', { title: 'legacy form' });
    const adopted = adoptRun({ cwd, task: 'task-enter-form-legacy', from: 'RALPH-enter-form-20260901' });
    assert.equal(adopted.ok, true);
    assert.equal(adopted.to, 'task-enter-form-legacy');
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'task-enter-form-legacy', '.state', 'run.json')));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('adopt --task refuses to clobber a live dest; leftover archive status is readonly', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-adopt-guard-'));
  try {
    initRun({ run_id: 'task-enter-form-dynamic', title: 'form', goal: 'schema', attach_knowledge: false }, cwd);
    const livePath = path.join(cwd, '.workflow', 'ralph', 'task-enter-form-dynamic', '.state', 'run.json');
    const before = fs.readFileSync(livePath, 'utf8');
    writeLegacyActive(cwd, 'RALPH-enter-form-20260901', { title: 'legacy form' });
    const clobber = adoptRun({ cwd, task: 'task-enter-form-dynamic', from: 'RALPH-enter-form-20260901' });
    assert.equal(clobber.ok, false);
    assert.equal(clobber.status, 'refused');
    assert.equal(clobber.dest, 'task-enter-form-dynamic');
    assert.equal(fs.readFileSync(livePath, 'utf8'), before);
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'RALPH-enter-form-20260901', 'run.json')));
    const listed = getStatus({ cwd });
    assert.match(renderRalphStatusText(listed), /needs_migrate/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('migrate --prune-archive dry-run by default; --yes deletes 1.0 archive/ snapshots', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-prune-'));
  try {
    const snap = path.join(cwd, '.workflow', 'ralph', 'archive', '2026-01-01-old');
    fs.mkdirSync(snap, { recursive: true });
    fs.writeFileSync(path.join(snap, 'marker.txt'), 'keep-until-yes\n');
    const dry = pruneArchive({ cwd, confirm: false });
    assert.equal(dry.dry_run, true);
    assert.equal(dry.count, 1);
    assert.ok(fs.existsSync(path.join(snap, 'marker.txt')));
    const viaMigrate = migrateRuns({ cwd, prune_archive: true, yes: false });
    assert.equal(viaMigrate.prune_archive.dry_run, true);
    assert.ok(fs.existsSync(path.join(snap, 'marker.txt')));
    const deleted = migrateRuns({ cwd, prune_archive: true, yes: true });
    assert.equal(deleted.prune_archive.dry_run, false);
    assert.equal(deleted.prune_archive.count, 1);
    assert.ok(!fs.existsSync(snap));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
