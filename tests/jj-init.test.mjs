import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runCli } from '../src/cli.mjs';
import { guessProjectFamily, guessProjectName, ingestInit, joinInit, previewInit } from '../src/jjInit.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function withEnv(envPatch, fn) {
  const prev = {};
  for (const key of Object.keys(envPatch)) {
    prev[key] = process.env[key];
    if (envPatch[key] === undefined) delete process.env[key];
    else process.env[key] = envPatch[key];
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(envPatch)) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  }
}

function isolatedHome(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-init-'));
  return withEnv({
    JJ_FLOW_HOME: tmp,
    JJ_GLOBAL_CONFIG_DIR: tmp,
    JJ_DISPATCH_CONTROL_ROOT: tmp,
    JJ_PROJECT_MAP: path.join(tmp, 'map.md'),
    PORTFOLIO_KB_ROOT: path.join(tmp, 'knowledge')
  }, () => fn(tmp));
}

function makeRepo(dir, { name, agentsHeading, contribution } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: name || path.basename(dir) }, null, 2) + '\n');
  if (agentsHeading) {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), `# ${agentsHeading}\n`, 'utf8');
  }
  if (contribution) {
    const runDir = path.join(dir, '.workflow', 'ralph', contribution.run_id);
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, 'knowledge-contribution.json'), JSON.stringify(contribution, null, 2) + '\n');
  }
}

test('jj-init skill and command assets exist', () => {
  for (const rel of [
    'skills/jj-init/SKILL.md',
    'skills/jj-init/agents/openai.yaml',
    'claude-commands/jj-init.md',
    'docs/commands/jj-init.md',
    'src/jjInit.mjs'
  ]) {
    assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
  }
  const skill = fs.readFileSync(path.join(root, 'skills/jj-init/SKILL.md'), 'utf8');
  for (const marker of [
    'jj init preview',
    'jj init join',
    'jj init ingest',
    'CHECKPOINT',
    '$jj-ralph',
    'do not invent a Chinese product name',
    'user_view',
    'bin/jj.mjs',
    'user speech wins',
    'suggest'
  ]) {
    assert.match(skill, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(skill, /jj ralph init is this skill/i);
});

test('preview proposes cwd without writing a map row', () => {
  isolatedHome((tmp) => {
    const repo = path.join(tmp, 'seo-daji-web');
    makeRepo(repo, { name: 'seo-daji-web', agentsHeading: 'seo-daji-web 前台规则' });
    const preview = previewInit({ cwd: repo });
    assert.equal(preview.projects.length, 1);
    assert.equal(preview.projects[0].status, 'proposed');
    assert.equal(preview.projects[0].project_key, 'seo-daji-web');
    assert.equal(preview.indexed_count, 0);
    assert.match(preview.user_view, /待加入/);
    assert.match(preview.user_view, /seo-daji-web/);
    assert.doesNotMatch(preview.user_view, /中国大集/);
    const map = fs.readFileSync(preview.home.map_path, 'utf8');
    assert.doesNotMatch(map, /seo-daji-web/);
  });
});

test('guessProjectName uses heading or package, never invents CJK', () => {
  isolatedHome((tmp) => {
    const fromPkg = path.join(tmp, 'seo-daji-web');
    makeRepo(fromPkg, { name: 'seo-daji-web' });
    assert.equal(guessProjectName(fromPkg), 'seo-daji-web');
    assert.doesNotMatch(guessProjectName(fromPkg), /[\u4e00-\u9fff]/);

    const agentRules = path.join(tmp, 'jj-flow');
    makeRepo(agentRules, { name: 'jj-flow', agentsHeading: 'jj-flow agent rules' });
    assert.equal(guessProjectName(agentRules), 'jj-flow');

    const named = path.join(tmp, 'named-repo');
    makeRepo(named, { name: 'named-repo', agentsHeading: '姐姐' });
    assert.equal(guessProjectName(named), '姐姐');
  });
});

test('join then ingest; second join is exists', () => {
  isolatedHome((tmp) => {
    const repo = path.join(tmp, 'seo-daji-web');
    makeRepo(repo, {
      name: 'seo-daji-web',
      contribution: {
        run_id: 'RALPH-enter-form-20260901',
        source: { project_key: 'seo-daji-web', repo_root: repo },
        intent: { title: '动态入驻表单', goal: '动态入驻表单接入' },
        capability_hint: { title: '动态入驻表单接入', keywords: ['enter-form'] },
        candidates: []
      }
    });
    const joined = joinInit({
      cwd: repo,
      projectPath: repo,
      name: '中国大集 PC 前台',
      aliases: ['seo-daji-web', 'daji-web'],
      family: '中国大集'
    });
    assert.equal(joined.status, 'added');
    assert.equal(joined.project.project_key, 'seo-daji-web');
    const again = joinInit({ cwd: repo, projectPath: repo, name: '中国大集 PC 前台' });
    assert.equal(again.status, 'exists');
    const preview = previewInit({ cwd: repo });
    assert.equal(preview.projects[0].status, 'indexed');
    assert.equal(preview.projects[0].knowledge[0].ingested, false);
    const ingested = ingestInit({ cwd: repo, runId: 'RALPH-enter-form-20260901' });
    assert.equal(ingested.status, 'ok');
    assert.ok(ingested.written >= 1);
    const after = previewInit({ cwd: repo });
    assert.equal(after.projects[0].knowledge[0].ingested, true);
  });
});

test('preview and join guess existing family from siblings and name', () => {
  isolatedHome((tmp) => {
    const cluster = path.join(tmp, '2025');
    const pc = path.join(cluster, 'seo-daji-web');
    const admin = path.join(cluster, 'scsk-admin');
    makeRepo(pc, { name: 'seo-daji-web', agentsHeading: '大集pc' });
    makeRepo(admin, { name: 'scsk-admin', agentsHeading: '中国大集管理后台' });
    assert.equal(joinInit({
      cwd: pc,
      projectPath: pc,
      name: '大集pc',
      family: '大集'
    }).status, 'added');

    const preview = previewInit({ cwd: admin });
    assert.equal(preview.projects[0].status, 'proposed');
    assert.equal(preview.projects[0].family, '大集');
    assert.equal(preview.projects[0].family_source, 'guess');
    assert.match(preview.user_view, /家族=大集（建议）/);
    assert.equal(guessProjectFamily(admin, {
      projects: [{ path: pc, family: '大集', heading: '大集' }]
    }).reason, 'sibling-dir');

    const joined = joinInit({ cwd: admin, projectPath: admin, name: '中国大集管理后台' });
    assert.equal(joined.status, 'added');
    assert.equal(joined.project.family, '大集');
    assert.equal(joined.family_source, 'guess');
    const map = fs.readFileSync(joined.map_path, 'utf8');
    assert.match(map, /## 大集/);
    assert.match(map, /中国大集管理后台/);
    assert.doesNotMatch(map.split('## Ungrouped')[1].split('##')[0], /scsk-admin/);
  });
});

test('join without family lands in Ungrouped, not the last family table', () => {
  isolatedHome((tmp) => {
    const pc = path.join(tmp, '2025', 'seo-daji-web');
    const other = path.join(tmp, 'elsewhere', 'solo-app');
    makeRepo(pc, { name: 'seo-daji-web' });
    makeRepo(other, { name: 'solo-app' });
    joinInit({ cwd: pc, projectPath: pc, name: '大集pc', family: '大集' });
    const joined = joinInit({ cwd: other, projectPath: other, name: 'Solo' });
    assert.equal(joined.project.family, '');
    assert.equal(joined.family_source, 'none');
    const map = fs.readFileSync(joined.map_path, 'utf8');
    const ungrouped = map.split('## Ungrouped')[1].split('##')[0];
    assert.match(ungrouped, /Solo/);
    assert.doesNotMatch(map.split('## 大集')[1] || '', /Solo/);
  });
});

test('preview --root lists immediate child repos only', () => {
  isolatedHome((tmp) => {
    const cluster = path.join(tmp, '2025');
    makeRepo(path.join(cluster, 'scsk-admin'), { name: 'scsk-admin' });
    makeRepo(path.join(cluster, 'seo-daji-web'), { name: 'seo-daji-web' });
    fs.mkdirSync(path.join(cluster, 'notes'), { recursive: true });
    fs.writeFileSync(path.join(cluster, 'notes', 'readme.txt'), 'skip');
    const preview = previewInit({ cwd: cluster, root: cluster });
    const keys = preview.projects.map((p) => p.project_key).sort();
    assert.deepEqual(keys, ['scsk-admin', 'seo-daji-web']);
  });
});

test('ungrouped join does not surface family dash', () => {
  isolatedHome((tmp) => {
    const repo = path.join(tmp, 'solo-app');
    makeRepo(repo, { name: 'solo-app' });
    const joined = joinInit({ cwd: repo, projectPath: repo, name: 'Solo' });
    assert.equal(joined.status, 'added');
    assert.equal(joined.project.family, '');
    const preview = previewInit({ cwd: repo });
    assert.equal(preview.projects[0].status, 'indexed');
    assert.equal(preview.projects[0].family, '');
    assert.doesNotMatch(preview.user_view, /家族=-/);
  });
});

test('init join writes configured project_map, not default home map', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-init-map-'));
  const home = path.join(tmp, 'home');
  const alt = path.join(tmp, 'alt');
  const repo = path.join(tmp, 'demo-app');
  makeRepo(repo, { name: 'demo-app' });
  withEnv({
    JJ_FLOW_HOME: home,
    JJ_GLOBAL_CONFIG_DIR: home,
    JJ_DISPATCH_CONTROL_ROOT: home,
    JJ_PROJECT_MAP: path.join(alt, 'map.md'),
    PORTFOLIO_KB_ROOT: path.join(alt, 'knowledge')
  }, () => {
    const joined = joinInit({ cwd: repo, projectPath: repo, name: 'Demo' });
    assert.equal(joined.status, 'added');
    assert.equal(path.resolve(joined.map_path), path.resolve(alt, 'map.md'));
    assert.match(fs.readFileSync(path.join(alt, 'map.md'), 'utf8'), /demo-app/);
    const defaultMap = path.join(home, 'map.md');
    assert.ok(fs.existsSync(defaultMap));
    assert.doesNotMatch(fs.readFileSync(defaultMap, 'utf8'), /demo-app/);
    const preview = previewInit({ cwd: repo });
    assert.equal(preview.projects[0].status, 'indexed');
    assert.equal(path.resolve(preview.home.map_path), path.resolve(alt, 'map.md'));
  });
});

test('jj init CLI preview / join / ingest', () => {
  isolatedHome((tmp) => {
    const repo = path.join(tmp, 'demo-app');
    makeRepo(repo, {
      name: 'demo-app',
      contribution: {
        run_id: 'RALPH-tip-20260901',
        source: { project_key: 'demo-app' },
        intent: { title: 'tip', goal: 'tip 6px' },
        capability_hint: { title: 'tip spacing 6px', keywords: ['tip'] },
        candidates: []
      }
    });
    const previewTextOut = { chunks: [], write(s) { this.chunks.push(s); }, get value() { return this.chunks.join(''); } };
    assert.equal(runCli(['init', 'preview'], { cwd: repo, stdout: previewTextOut }), 0);
    assert.match(previewTextOut.value, /jj-flow 接入提案/);
    assert.match(previewTextOut.value, /待加入/);
    const previewOut = { chunks: [], write(s) { this.chunks.push(s); }, get value() { return this.chunks.join(''); } };
    assert.equal(runCli(['init', 'preview', '--json'], { cwd: repo, stdout: previewOut }), 0);
    const preview = JSON.parse(previewOut.value);
    assert.equal(preview.projects[0].status, 'proposed');
    assert.match(preview.user_view, /待加入/);
    const joinOut = { chunks: [], write(s) { this.chunks.push(s); }, get value() { return this.chunks.join(''); } };
    assert.equal(runCli(['init', 'join', '--path', repo, '--name', 'Demo', '--family', 'demo-family', '--json'], { cwd: repo, stdout: joinOut }), 0);
    assert.equal(JSON.parse(joinOut.value).status, 'added');
    const ingestOut = { chunks: [], write(s) { this.chunks.push(s); }, get value() { return this.chunks.join(''); } };
    assert.equal(runCli(['init', 'ingest', '--run-id', 'RALPH-tip-20260901', '--json'], { cwd: repo, stdout: ingestOut }), 0);
    const ingested = JSON.parse(ingestOut.value);
    assert.equal(ingested.status, 'ok');
    assert.ok(ingested.written >= 1);
  });
});
