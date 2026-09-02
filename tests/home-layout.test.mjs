import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { defaultJjFlowHome, ensureJjFlowHome } from '../src/homeLayout.mjs';
import { resolveGlobalConfigDir, resolveKnowledgeRoot, resolveProjectMapPath } from '../src/namingConfig.mjs';
import { ingestContribution } from '../src/homeKnowledge.mjs';
import {
  appendProjectMapRow,
  familyOfProjectKey,
  familyProjectKeys,
  findProjectByCwd,
  isGroupedFamily,
  parseProjectMap
} from '../src/projectMap.mjs';
import { attachKnowledgeRefs } from '../src/portfolioKnowledge.mjs';
import { rankIndexHits, knowledgeItemToRow } from '../src/memoryRetrieve.mjs';
import { invokeKnowledgeContributeHook } from '../src/ralph.mjs';
import { runCli } from '../src/cli.mjs';

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

test('product default config dir is ~/.jj-flow, not /portfolio/config', () => {
  withEnv({
    JJ_GLOBAL_CONFIG_DIR: undefined,
    DAJI_CONFIG_DIR: undefined,
    JJ_FLOW_HOME: undefined
  }, () => {
    assert.equal(resolveGlobalConfigDir(), path.join(os.homedir(), '.jj-flow'));
    assert.equal(defaultJjFlowHome(), path.join(os.homedir(), '.jj-flow'));
    assert.notEqual(resolveGlobalConfigDir(), path.resolve('/portfolio/config'));
  });
});

test('ensureJjFlowHome creates map + knowledge without clobbering', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-home-'));
  const first = ensureJjFlowHome({ root: tmp });
  assert.equal(first.root, path.resolve(tmp));
  assert.ok(fs.existsSync(first.map_path));
  assert.ok(fs.existsSync(path.join(first.knowledge_root, 'index', 'search.json')));
  assert.ok(fs.existsSync(first.naming_path));
  fs.writeFileSync(first.map_path, '# kept\n', 'utf8');
  const second = ensureJjFlowHome({ root: tmp });
  assert.equal(second.created.map, false);
  assert.equal(fs.readFileSync(first.map_path, 'utf8'), '# kept\n');
});

test('map add then lookup; ungrouped is not family-shared', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-map-'));
  const home = ensureJjFlowHome({ root: tmp });
  const admin = path.join(tmp, 'scsk-admin');
  const pc = path.join(tmp, 'seo-daji-web');
  fs.mkdirSync(admin);
  fs.mkdirSync(pc);
  const added = appendProjectMapRow({
    mapPath: home.map_path,
    name: '大集后管',
    aliases: ['scsk-admin'],
    projectPath: admin,
    family: '中国大集'
  });
  assert.equal(added.status, 'added');
  const again = appendProjectMapRow({
    mapPath: home.map_path,
    name: '大集后管',
    projectPath: admin,
    family: '中国大集'
  });
  assert.equal(again.status, 'exists');
  appendProjectMapRow({
    mapPath: home.map_path,
    name: '大集PC',
    aliases: ['seo-daji-web'],
    projectPath: pc,
    family: '中国大集'
  });
  const map = parseProjectMap(home.map_path);
  const hit = findProjectByCwd(admin, { map });
  assert.equal(hit.project_key, 'scsk-admin');
  assert.equal(hit.family, '中国大集');
  assert.equal(map.projects.length, 2);
});

test('placeholder family dash is ungrouped and not family-shared', () => {
  assert.equal(isGroupedFamily('-'), false);
  assert.equal(isGroupedFamily('Ungrouped'), false);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-map-ungrouped-'));
  const home = ensureJjFlowHome({ root: tmp });
  const a = path.join(tmp, 'repo-a');
  const b = path.join(tmp, 'repo-b');
  fs.mkdirSync(a);
  fs.mkdirSync(b);
  appendProjectMapRow({ mapPath: home.map_path, name: 'A', projectPath: a });
  appendProjectMapRow({ mapPath: home.map_path, name: 'B', projectPath: b });
  assert.match(fs.readFileSync(home.map_path, 'utf8'), /\| - \| - \|/);
  const map = parseProjectMap(home.map_path);
  assert.equal(map.projects.length, 2);
  assert.equal(map.projects[0].family, '');
  assert.equal(map.projects[1].family, '');
  assert.equal(familyOfProjectKey('repo-a', { map }), '');
  assert.deepEqual(familyProjectKeys('-', { map }), []);
  assert.deepEqual(familyProjectKeys('Ungrouped', { map }), []);

  ingestContribution({
    run_id: 'RALPH-tip-20260901',
    source: { project_key: 'repo-a', repo_root: a },
    intent: { title: 'tip spacing', goal: 'tip 6px' },
    capability_hint: { title: 'tip spacing 6px', keywords: ['tip'] },
    candidates: []
  }, { knowledgeRoot: home.knowledge_root, projectKey: 'repo-a' });

  withEnv({
    JJ_GLOBAL_CONFIG_DIR: tmp,
    JJ_DISPATCH_CONTROL_ROOT: tmp,
    PORTFOLIO_KB_ROOT: home.knowledge_root,
    JJ_PROJECT_MAP: home.map_path,
    JJ_FLOW_HOME: tmp
  }, () => {
    const pack = attachKnowledgeRefs({
      q: 'tip spacing 6px',
      project: 'repo-b',
      portfolioRoot: home.knowledge_root,
      cwd: b
    });
    assert.equal(pack.match.family, '');
    assert.deepEqual(pack.match.family_projects, []);
    assert.equal(pack.knowledge_refs.length, 0, JSON.stringify(pack.knowledge_refs));
  });
});

test('home ingest + family retrieve shares sibling, not other family', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-kb-fam-'));
  const home = ensureJjFlowHome({ root: tmp });
  const admin = path.join(tmp, 'scsk-admin');
  const pc = path.join(tmp, 'seo-daji-web');
  fs.mkdirSync(admin);
  fs.mkdirSync(pc);
  appendProjectMapRow({ mapPath: home.map_path, name: '后管', projectPath: admin, family: '中国大集' });
  appendProjectMapRow({ mapPath: home.map_path, name: 'PC', projectPath: pc, family: '中国大集' });
  const ingested = ingestContribution({
    run_id: 'RALPH-enter-form-20260901',
    source: { project_key: 'scsk-admin', repo_root: admin },
    intent: { title: '动态入驻表单', goal: '后管动态入驻表单 schema 写入' },
    capability_hint: { title: '动态入驻表单 schema 写入', keywords: ['enter-form'] },
    candidates: []
  }, { knowledgeRoot: home.knowledge_root, projectKey: 'scsk-admin' });
  assert.ok(ingested.written >= 1);

  withEnv({
    JJ_GLOBAL_CONFIG_DIR: tmp,
    JJ_DISPATCH_CONTROL_ROOT: tmp,
    PORTFOLIO_KB_ROOT: home.knowledge_root,
    JJ_PROJECT_MAP: home.map_path,
    JJ_FLOW_HOME: tmp
  }, () => {
    const pack = attachKnowledgeRefs({
      q: '动态入驻表单 schema 写入',
      project: 'seo-daji-web',
      portfolioRoot: home.knowledge_root,
      cwd: pc
    });
    assert.equal(pack.status, 'ready', pack.reason);
    assert.ok(pack.knowledge_refs.length >= 1);
  });

  const rows = [
    knowledgeItemToRow({
      id: 'cap-other',
      title: '动态入驻表单',
      summary: '动态入驻表单 schema',
      status: 'active',
      scope: 'project',
      project_key: 'cj-web',
      family: '承接'
    })
  ];
  const hits = rankIndexHits({
    text: '动态入驻表单 schema',
    projectId: 'seo-daji-web',
    familyId: '中国大集',
    familyProjectIds: ['scsk-admin', 'seo-daji-web']
  }, rows);
  assert.equal(hits.length, 0);
});

test('jj home init and map add via CLI', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-cli-home-'));
  withEnv({
    JJ_FLOW_HOME: tmp,
    JJ_GLOBAL_CONFIG_DIR: tmp,
    JJ_DISPATCH_CONTROL_ROOT: tmp,
    JJ_PROJECT_MAP: path.join(tmp, 'map.md')
  }, () => {
    const stdout = { chunks: [], write(s) { this.chunks.push(s); }, get value() { return this.chunks.join(''); } };
    assert.equal(runCli(['home', 'init', '--json'], { stdout }), 0);
    const home = JSON.parse(stdout.value);
    assert.equal(path.resolve(home.root), path.resolve(tmp));
    const addOut = { chunks: [], write(s) { this.chunks.push(s); }, get value() { return this.chunks.join(''); } };
    const repo = path.join(tmp, 'demo-app');
    fs.mkdirSync(repo);
    assert.equal(runCli(['map', 'add', '--path', repo, '--name', 'Demo', '--family', 'demo-family', '--json'], { cwd: repo, stdout: addOut }), 0);
    const added = JSON.parse(addOut.value);
    assert.equal(added.status, 'added');
    const lookOut = { chunks: [], write(s) { this.chunks.push(s); }, get value() { return this.chunks.join(''); } };
    assert.equal(runCli(['map', 'lookup', '--json'], { cwd: repo, stdout: lookOut }), 0);
    const looked = JSON.parse(lookOut.value);
    assert.equal(looked.indexed, true);
    assert.equal(looked.project.project_key, 'demo-app');
  });
});

test('builtin contribute hook ingests into home knowledge without kb CLI', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-hook-home-'));
  const home = ensureJjFlowHome({ root: tmp });
  withEnv({
    JJ_FLOW_HOME: tmp,
    JJ_GLOBAL_CONFIG_DIR: tmp,
    PORTFOLIO_KB_ROOT: home.knowledge_root,
    JJ_PROJECT_MAP: home.map_path
  }, () => {
    const result = invokeKnowledgeContributeHook(path.join(tmp, 'pkg.json'), {
      run_id: 'RALPH-tip-20260901',
      source: { project_key: 'demo-app' },
      intent: { title: 'tip spacing', goal: 'tip 6px' },
      capability_hint: { title: 'tip spacing 6px', keywords: ['tip'] },
      candidates: []
    }, { mode: 'cli', cli: null, cwd: tmp });
    assert.equal(result.status, 'ok', result.reason);
    assert.equal(result.command, 'builtin-home-knowledge');
    assert.ok(result.written >= 1);
    const search = JSON.parse(fs.readFileSync(path.join(home.knowledge_root, 'index', 'search.json'), 'utf8'));
    assert.ok(search.items.some((item) => item.project_key === 'demo-app' && item.status === 'active'));
  });
});

test('default knowledge and map roots resolve under ~/.jj-flow when env is empty', () => {
  withEnv({
    JJ_GLOBAL_CONFIG_DIR: undefined,
    DAJI_CONFIG_DIR: undefined,
    JJ_FLOW_HOME: undefined,
    PORTFOLIO_KB_ROOT: undefined,
    JJ_PROJECT_MAP: undefined,
    JJ_DISPATCH_CONTROL_ROOT: undefined,
    JJ_PORTFOLIO_ROOT: undefined
  }, () => {
    const home = path.join(os.homedir(), '.jj-flow');
    assert.equal(resolveKnowledgeRoot(), path.join(home, 'knowledge'));
    assert.equal(resolveProjectMapPath(), path.join(home, 'map.md'));
  });
});
