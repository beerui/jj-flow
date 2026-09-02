import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  HOT_MEMORY_MAX_ENTRIES,
  appendFindingsEntry,
  appendHotMemoryEntries,
  confirmHotMemoryEntry,
  countFindingHeadings,
  defaultFindingsStub,
  extractReusableRulesFromFindings,
  formatHotMemoryMarkdown,
  nextFindingId,
  parseHotMemoryFile,
  parseProgressDraft,
  pruneHotMemory,
  retrieveHotMemory,
  slugProjectKey
} from '../src/memoryHotLayer.mjs';
import {
  FINDING_HINT,
  archiveRun,
  initRun,
  recordDeliverAttempt,
  recordFinding,
  resumeRun,
  rollbackPhase,
  saveRun,
  setGate
} from '../src/ralph.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function withHome(fn) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-hot-home-'));
  const prev = process.env.JJ_FLOW_HOME;
  process.env.JJ_FLOW_HOME = home;
  return Promise.resolve()
    .then(() => fn(home))
    .finally(() => {
      if (prev === undefined) delete process.env.JJ_FLOW_HOME;
      else process.env.JJ_FLOW_HOME = prev;
      fs.rmSync(home, { recursive: true, force: true });
    });
}

test('slugProjectKey strips Windows-invalid chars and empty → unknown-project', () => {
  assert.equal(slugProjectKey(''), 'unknown-project');
  assert.equal(slugProjectKey(null), 'unknown-project');
  assert.equal(slugProjectKey('Seo Daji/Web:prod'), 'seo-daji-web-prod');
});

test('parseHotMemoryFile round-trips confirmed flag and backref', () => {
  const text = [
    '# Hot memory · demo',
    '',
    '- [ ] 2026-09-02 · task-a · 外部接口 path 未确认前不落码（→ F-002） @ .workflow/ralph/RALPH-x/findings.md#F-002',
    '- [x] 2026-09-01 · task-b · 过期审核响应不写共享状态 @ findings.md#F-001'
  ].join('\n');
  const entries = parseHotMemoryFile(text);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].confirmed, false);
  assert.equal(entries[0].task_key, 'task-a');
  assert.equal(entries[0].backref, '.workflow/ralph/RALPH-x/findings.md#F-002');
  assert.equal(entries[1].confirmed, true);
  assert.equal(entries[1].rule, '过期审核响应不写共享状态');
});

test('appendHotMemoryEntries dedupes similar rules and drops oldest unconfirmed at cap', async () => {
  await withHome(async (home) => {
    const first = appendHotMemoryEntries('demo-proj', [
      { date: '2026-09-01', task_key: 't1', rule: '外部接口 path 未确认前不落码' }
    ], { home });
    assert.equal(first.added, 1);
    const dup = appendHotMemoryEntries('demo-proj', [
      { date: '2026-09-02', task_key: 't2', rule: '外部接口 path 未确认前不落码' }
    ], { home });
    assert.equal(dup.added, 0);
    assert.equal(dup.skipped, 1);
    const cjkPair = appendHotMemoryEntries('cjk-proj', [
      { date: '2026-09-01', task_key: 't', rule: '必须先确认 path 再落码' },
      { date: '2026-09-01', task_key: 't', rule: '必须先确认 schema 再落码' }
    ], { home });
    assert.equal(cjkPair.added, 2);

    const many = [];
    for (let i = 0; i < HOT_MEMORY_MAX_ENTRIES; i += 1) {
      many.push({
        date: '2026-09-01',
        task_key: 't',
        rule: `forbid leaking field${i} into api${i}`
      });
    }
    const filled = appendHotMemoryEntries('cap-proj', many, { home });
    assert.equal(filled.added, HOT_MEMORY_MAX_ENTRIES);
    confirmHotMemoryEntry('cap-proj', 'forbid leaking field0 into api0', { home });
    const overflow = appendHotMemoryEntries('cap-proj', [
      { date: '2026-09-02', task_key: 't', rule: 'forbid writing templatePath into audit fallback' }
    ], { home });
    assert.equal(overflow.added, 1);
    const entries = parseHotMemoryFile(fs.readFileSync(overflow.file, 'utf8'));
    assert.equal(entries.length, HOT_MEMORY_MAX_ENTRIES);
    assert.ok(entries.some((entry) => entry.confirmed && entry.rule.includes('field0')));
    assert.ok(entries.some((entry) => entry.rule.includes('templatePath')));
  });
});

test('retrieveHotMemory ranks confirmed first and does not pad empty query', async () => {
  await withHome(async (home) => {
    appendHotMemoryEntries('seo-daji-web', [
      { date: '2026-09-01', task_key: 't1', rule: '动态入驻表单 schema 未确认前不落码' },
      { date: '2026-09-02', task_key: 't2', rule: '模板 query 只传已选 countryCode' }
    ], { home });
    confirmHotMemoryEntry('seo-daji-web', 'countryCode', { home });
    const empty = retrieveHotMemory({ projectKey: 'seo-daji-web', query: '', home });
    assert.equal(empty.hits.length, 0);
    const hits = retrieveHotMemory({
      projectKey: 'seo-daji-web',
      query: '动态入驻表单 schema countryCode 模板',
      home
    });
    assert.ok(hits.hits.length >= 1);
    assert.equal(hits.hits[0].confirmed, true);
    assert.match(formatHotMemoryMarkdown(hits.hits), /hot_memory/);
  });
});

test('extractReusableRulesFromFindings reads ## 可复用结论 and skips (none)', () => {
  const stub = defaultFindingsStub({ taskKey: 'RALPH-x' });
  assert.equal(extractReusableRulesFromFindings(stub).length, 0);
  assert.match(stub, /\| --- \| --- \| --- \|/);
  const filled = [
    '# findings',
    '',
    '## 踩坑与因果',
    '### F-002 外部接口 path 未确认前不落码',
    '',
    '## 可复用结论',
    '- 外部接口 path 未确认前不落码（F-002）',
    '- REV-8 F-1 只读上传仍走 OSS（F-006）',
    '',
    '## 验证'
  ].join('\n');
  const rules = extractReusableRulesFromFindings(filled, {
    taskKey: 'RALPH-x',
    backrefBase: '.workflow/ralph/RALPH-x/findings.md'
  });
  assert.equal(rules.length, 2);
  assert.match(rules[0].backref, /#F-002$/);
  assert.match(rules[1].backref, /#F-006$/);
});

test('appendFindingsEntry numbers F-00N and can add reusable rule', () => {
  const first = appendFindingsEntry('', {
    phenomenon: '模板 path 猜错',
    cause: '未登录 YApi',
    action: '按 YApi 原文写 path',
    scope: '独立动态入驻页',
    evidence: 'REV-2',
    rule: '外部接口 path 未确认前不落码'
  });
  assert.equal(first.id, 'F-001');
  assert.equal(countFindingHeadings(first.text), 1);
  const second = appendFindingsEntry(first.text, {
    phenomenon: 'countryCode 泄漏',
    cause: '从 audit 兜底',
    action: '只传已选 countryCode',
    scope: '模板 GET',
    rule: '模板 query 只传已选 countryCode'
  });
  assert.equal(second.id, 'F-002');
  assert.equal(nextFindingId(second.text), 'F-003');
  const withInline = appendFindingsEntry(second.text, {
    phenomenon: 'REV-8 F-1 loadAuditRecord；F-2 只读上传仍走 OSS',
    cause: '共享状态',
    action: 'loadSeq 挡住审核回填',
    scope: 'audit 共享状态'
  });
  assert.equal(withInline.id, 'F-003');
  assert.equal(nextFindingId(withInline.text), 'F-004');
  const rules = extractReusableRulesFromFindings(second.text);
  assert.equal(rules.length, 2);
});

test('parseProgressDraft keeps the latest complete failed_must / over_claimed pair', () => {
  const draft = parseProgressDraft([
    '- failed_must: old',
    '- over_claimed: old-claim',
    '- failed_must: REQ-002 countryCode 泄漏',
    '- over_claimed: 未测 page 拼接'
  ].join('\n'));
  assert.equal(draft.failed_must, 'REQ-002 countryCode 泄漏');
  assert.equal(draft.over_claimed, '未测 page 拼接');
  const mixed = parseProgressDraft([
    '- failed_must: old',
    '- over_claimed: old-claim',
    '- failed_must: incomplete-latest'
  ].join('\n'));
  assert.equal(mixed.failed_must, 'old');
  assert.equal(mixed.over_claimed, 'old-claim');
});

test('archive promotes ## 可复用结论; missing findings is silent skip', async () => {
  await withHome(async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-hot-arch-'));
    try {
      const runId = 'task-hot-promote';
      initRun({
        run_id: runId,
        title: '动态入驻表单',
        goal: 'schema 驱动动态表单',
        project_key: 'seo-daji-web',
        attach_knowledge: false
      }, cwd);
      const findingsPath = path.join(cwd, '.workflow', 'ralph', 'tasks', runId, 'findings.md');
      fs.writeFileSync(findingsPath, [
        '# findings',
        '',
        '## 踩坑与因果',
        '### F-002 外部接口 path 未确认前不落码',
        '- 现象: path 猜错',
        '- 原因: 未登录 YApi',
        '- 对策: 按原文写',
        '- 适用范围: 模板 GET',
        '- 证据: REV-2',
        '',
        '## 可复用结论',
        '- 外部接口 path 未确认前不落码（F-002）',
        ''
      ].join('\n'), 'utf8');
      const runPath = path.join(cwd, '.workflow', 'ralph', 'tasks', runId, '.state', 'run.json');
      const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
      run.gates = { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PASS', archive: 'PENDING' };
      saveRun(run, cwd);
      const archived = archiveRun(runId, { cwd });
      assert.equal(archived.hot_memory.added, 1);
      const hits = retrieveHotMemory({
        projectKey: 'seo-daji-web',
        query: '外部接口 path 未确认前不落码 模板'
      });
      assert.ok(hits.hits.some((hit) => hit.rule.includes('外部接口 path')));

      const otherId = 'task-hot-skip';
      initRun({
        run_id: otherId,
        title: 'skip',
        goal: 'no findings promote',
        project_key: 'seo-daji-web',
        attach_knowledge: false
      }, cwd);
      fs.rmSync(path.join(cwd, '.workflow', 'ralph', 'tasks', otherId, 'findings.md'));
      const other = JSON.parse(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', 'tasks', otherId, '.state', 'run.json'), 'utf8'));
      other.gates = { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PASS', archive: 'PENDING' };
      saveRun(other, cwd);
      const skipped = archiveRun(otherId, { cwd });
      assert.equal(skipped.hot_memory.status, 'skipped');
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});

test('init/resume write hot_memory progress; finding command prefills from progress', async () => {
  await withHome(async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-hot-init-'));
    try {
      appendHotMemoryEntries('seo-daji-web', [
        { date: '2026-09-01', task_key: 'old', rule: '动态入驻表单 schema 未确认前不落码' }
      ]);
      const runId = 'task-hot-init';
      const run = initRun({
        run_id: runId,
        title: '动态入驻表单 schema',
        goal: 'schema 驱动渲染',
        project_key: 'seo-daji-web',
        attach_knowledge: false
      }, cwd);
      const progress = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', 'tasks', runId, 'progress.md'), 'utf8');
      assert.match(progress, /hot_memory:/);
      const analyze = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', 'tasks', runId, 'task_plan.md'), 'utf8');
      assert.match(analyze, /## hot_memory/);
      assert.equal(run.artifact_refs.analyze, 'task_plan.md');

      fs.appendFileSync(
        path.join(cwd, '.workflow', 'ralph', 'tasks', runId, 'progress.md'),
        '- failed_must: REQ-002 countryCode 泄漏\n- over_claimed: 未测 page 拼接\n',
        'utf8'
      );
      const recorded = recordFinding(runId, {
        action: '只传已选 countryCode',
        scope: '模板 GET',
        evidence: 'test 14/14',
        rule: '模板 query 只传已选 countryCode'
      }, cwd);
      assert.equal(recorded.id, 'F-001');
      const findings = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', 'tasks', runId, 'findings.md'), 'utf8');
      assert.match(findings, /现象: REQ-002 countryCode 泄漏/);
      assert.match(findings, /原因: 未测 page 拼接/);

      const runPath = path.join(cwd, '.workflow', 'ralph', 'tasks', runId, '.state', 'run.json');
      const loaded = JSON.parse(fs.readFileSync(runPath, 'utf8'));
      loaded.gates = { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PASS', archive: 'PENDING' };
      saveRun(loaded, cwd);
      archiveRun(runId, { cwd });
      const resumed = resumeRun(runId, { reason: '继续动态入驻表单 schema', cwd });
      assert.equal(resumed.action, 'resume');
      assert.ok(Array.isArray(resumed.hot_memory?.hits));
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});

test('deliver-attempt improved=false and rollback emit finding_hint until an F entry exists', async () => {
  await withHome(async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-hot-hint-'));
    try {
      const runId = 'task-hot-hint';
      initRun({
        run_id: runId,
        title: 'hint',
        goal: 'soft finding hint',
        project_key: 'demo-hint',
        attach_knowledge: false
      }, cwd);
      const attempt = recordDeliverAttempt(runId, { improved: false, cwd, paths: [] });
      assert.equal(attempt.finding_hint, FINDING_HINT);
      setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
      const rolled = rollbackPhase(runId, { toPhase: 'ANALYZE', reason: 'retry analyze', cwd });
      assert.equal(rolled.finding_hint, FINDING_HINT);
      const findingsPath = path.join(cwd, '.workflow', 'ralph', 'tasks', runId, 'findings.md');
      fs.writeFileSync(findingsPath, [
        defaultFindingsStub({ taskKey: runId }),
        '### F-001 验收漏测',
        '- 现象: 验收漏测',
        '- 原因: 只测了 helper',
        '- 对策: 补 page 级断言',
        '- 适用范围: 动态入驻页',
        '- 证据:',
        ''
      ].join('\n'), 'utf8');
      const headingOnly = recordDeliverAttempt(runId, { improved: false, cwd, paths: [] });
      assert.equal(headingOnly.finding_hint, FINDING_HINT);
      recordFinding(runId, {
        phenomenon: '验收漏测',
        cause: '只测了 helper',
        action: '补 page 级断言',
        scope: '动态入驻页'
      }, cwd);
      const findings = fs.readFileSync(findingsPath, 'utf8');
      assert.match(findings, /## 可复用结论\n- 补 page 级断言（动态入驻页）（F-00/);
      const after = recordDeliverAttempt(runId, { improved: false, cwd, paths: [] });
      assert.equal(after.finding_hint, null);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});

test('ralph and dispatch skills mention hot memory injection', () => {
  const ralph = fs.readFileSync(path.join(root, 'skills/jj-ralph/SKILL.md'), 'utf8');
  const dispatch = fs.readFileSync(path.join(root, 'skills/jj-dispatch/SKILL.md'), 'utf8');
  assert.match(ralph, /ralph_ops\.mjs finding/);
  assert.match(ralph, /~\/\.jj-flow\/memory/);
  assert.match(ralph, /knowledge-confirm/);
  assert.match(dispatch, /~\/\.jj-flow\/memory/);
  assert.match(dispatch, /Hot memory/);
});

test('pruneHotMemory keeps confirmed and drops oldest unconfirmed', async () => {
  await withHome(async (home) => {
    appendHotMemoryEntries('prune-proj', [
      { date: '2026-09-01', task_key: 't', rule: '第一条必须先确认 path' },
      { date: '2026-09-02', task_key: 't', rule: '第二条必须先确认 schema' }
    ], { home });
    confirmHotMemoryEntry('prune-proj', '第一条必须先确认 path', { home });
    const pruned = pruneHotMemory('prune-proj', { home, maxEntries: 1 });
    assert.equal(pruned.dropped, 1);
    assert.equal(pruned.kept, 1);
    const { entries } = {
      entries: parseHotMemoryFile(fs.readFileSync(
        path.join(home, 'memory', 'prune-proj.md'),
        'utf8'
      ))
    };
    assert.equal(entries.length, 1);
    assert.equal(entries[0].confirmed, true);
  });
});
