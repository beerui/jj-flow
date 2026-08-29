#!/usr/bin/env node
/**
 * Full-corpus ralph memory extract + retrieve eval.
 *
 * Rules from jj-multica:
 *   extract  — Gate B (hasRealLesson + score >= 60); 宁可 0 条
 *   retrieve — CJK bigram / skip-1, strong >= 5, InjectSoftCap = 5, adopt=0
 *   cases    — shared low-freq files, time-ordered, exclude_self, must_inject_any
 *   trust    — fill-rate / pairwise Jaccard / single-memory frequency
 *              (ground truth is noisy on hot files)
 *
 * Usage:
 *   node eval/ralph-memory/run-eval.mjs
 *   node eval/ralph-memory/run-eval.mjs --roots D:\\a,D:\\2025
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gateLesson, isProcessNarration } from '../../src/memoryExtract.mjs';
import {
  INJECT_SOFT_CAP,
  MIN_RELATED_SCORE,
  rankIndexHits
} from '../../src/memoryRetrieve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../.tmp/ralph-memory-eval');
const DEFAULT_ROOTS = ['D:\\a', 'D:\\2025'];
const SKIP_PROJECTS = new Set(['jj-flow']);
const MIN_FILE_FREQ = 2;
const MAX_FILE_FREQ = 8;
const MAX_EXPECTED = 8;
const HAS_CJK = /[\u4e00-\u9fff]/;

function parseArgs(argv) {
  const out = { roots: DEFAULT_ROOTS };
  for (let i = 2; i < argv.length; i += 1) {
    const [k, inline] = argv[i].split('=');
    const take = () => (inline !== undefined ? inline : argv[++i]);
    if (k === '--roots') out.roots = take().split(',').map((s) => s.trim()).filter(Boolean);
  }
  return out;
}

function clip(s, n) {
  const text = String(s ?? '').trim().replace(/\s+/g, ' ');
  return [...text].length <= n ? text : [...text].slice(0, n).join('');
}

function walkNamed(dir, name, acc = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const ent of entries) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkNamed(full, name, acc);
    else if (ent.name === name) acc.push(full);
  }
  return acc;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function sourceRank(file) {
  const n = file.replaceAll('\\', '/');
  if (n.includes('/archive/')) return 1;
  if (n.includes('/completed/')) return 2;
  return 3;
}

function discoverRepos(roots) {
  const out = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    let ents;
    try {
      ents = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of ents) {
      if (!ent.isDirectory() || SKIP_PROJECTS.has(ent.name)) continue;
      const ralph = path.join(root, ent.name, '.workflow', 'ralph');
      if (fs.existsSync(ralph)) out.push({ project: ent.name, ralph, repo: path.join(root, ent.name) });
    }
  }
  return out;
}

function loadRuns(repos) {
  const runs = new Map();
  const put = (key, next, file) => {
    const prev = runs.get(key);
    if (!prev) {
      runs.set(key, { ...next, _rank: sourceRank(file), _file: file });
      return;
    }
    const rank = sourceRank(file);
    const richer = (next.lessons.length + (next.capability ? 1 : 0)) - (prev.lessons.length + (prev.capability ? 1 : 0));
    if (rank > prev._rank || (rank === prev._rank && richer > 0) || (rank === prev._rank && richer === 0 && next.createdAt > prev.createdAt)) {
      runs.set(key, { ...next, _rank: rank, _file: file });
    }
  };

  for (const repo of repos) {
    for (const file of walkNamed(repo.ralph, 'run.json')) {
      const j = readJson(file);
      if (!j?.run_id) continue;
      const key = `${repo.project}::${j.run_id}`;
      put(key, {
        runId: j.run_id,
        project: repo.project,
        title: String(j.title || '').trim(),
        goal: String(j.goal || '').trim(),
        createdAt: j.created_at || '',
        files: (j.scope?.in || []).filter((p) => p && String(p).includes('.')),
        lessons: [],
        capability: null
      }, file);
    }
    for (const file of walkNamed(repo.ralph, 'knowledge-contribution.json')) {
      const j = readJson(file);
      if (!j?.run_id) continue;
      const key = `${repo.project}::${j.run_id}`;
      let r = runs.get(key);
      if (!r) {
        r = {
          runId: j.run_id,
          project: repo.project,
          title: String(j.intent?.title || '').trim(),
          goal: String(j.intent?.goal || '').trim(),
          createdAt: j.created_at || '',
          files: [],
          lessons: [],
          capability: null,
          _rank: sourceRank(file),
          _file: file
        };
        runs.set(key, r);
      }
      if (!r.createdAt) r.createdAt = j.created_at || '';
      const extra = new Set(r.files);
      for (const c of j.candidates || []) {
        for (const p of c.provenance?.files || []) if (p) extra.add(p);
      }
      r.files = [...extra];
      for (const c of j.candidates || []) {
        const text = String(c.summary || c.title || '').trim();
        if (!text) continue;
        if (c.type === 'lesson') {
          r.lessons.push({
            title: clip(c.title || text, 80),
            body: text,
            keywords: c.keywords || []
          });
        } else if (c.type === 'capability' && !r.capability) {
          r.capability = {
            title: clip(c.title || text, 80),
            body: text,
            keywords: c.keywords || []
          };
        }
      }
    }
  }
  return [...runs.values()].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function buildLibrary(runs) {
  const shorts = [];
  const memByRun = {};
  for (const r of runs) {
    const push = (m, kind, suffix) => {
      const ref = `${r.project}/${r.runId}#${suffix}`;
      shorts.push({
        ref,
        project_id: r.project,
        run_id: r.runId,
        created_at: r.createdAt,
        kind,
        layer: 'how',
        scope: 'project',
        status: 'confirmed',
        adopt_count: 0,
        title: m.title,
        when_to_inject: '',
        body: m.body
      });
      (memByRun[`${r.project}::${r.runId}`] ??= []).push(ref);
    };
    r.lessons.forEach((l, i) => push(l, 'pit', `L${i}`));
    if (r.capability) push(r.capability, 'practice', 'C');
  }
  return { shorts, memByRun };
}

function buildCases(runs, memByRun) {
  const freq = {};
  for (const r of runs) {
    const m = (freq[r.project] ??= {});
    for (const f of r.files) m[f] = (m[f] || 0) + 1;
  }
  const isSignal = (project, f) => {
    const n = freq[project]?.[f] ?? 0;
    return n >= MIN_FILE_FREQ && n <= MAX_FILE_FREQ;
  };
  const cases = [];
  for (const r of runs) {
    const card = [r.title, r.goal].filter(Boolean).join('，');
    if (!card || !HAS_CJK.test(card)) continue;
    const signal = r.files.filter((f) => isSignal(r.project, f));
    if (!signal.length) continue;
    const expected = new Set();
    const via = new Set();
    for (const prev of runs) {
      if (prev.project !== r.project || prev.runId === r.runId) continue;
      if (String(prev.createdAt) >= String(r.createdAt)) continue;
      const shared = prev.files.filter((f) => signal.includes(f));
      if (!shared.length) continue;
      for (const ref of memByRun[`${prev.project}::${prev.runId}`] || []) expected.add(ref);
      for (const f of shared) via.add(f);
    }
    if (!expected.size || expected.size > MAX_EXPECTED) continue;
    cases.push({
      id: `T-${r.project}-${r.runId}`,
      type: 'real-recall',
      query: { card: clip(card, 160), project_id: r.project },
      expect: {
        must_inject_any: [...expected],
        max_inject: Math.max(3, expected.size + 2)
      },
      exclude_self: memByRun[`${r.project}::${r.runId}`] || [],
      evidence: { shared_files: [...via], expected_from_runs: expected.size }
    });
  }
  return cases;
}

function robustnessCases(shorts) {
  const out = [];
  const pid = shorts.find((s) => HAS_CJK.test(s.body))?.project_id || shorts[0]?.project_id || '';
  const edges = [
    ['X-sym', '！！！？？？……——', 0],
    ['X-num', '12345 67890 2026', 0],
    ['X-off', '今天天气不错，适合出门散步晒太阳', 0]
  ];
  for (const [id, card, max] of edges) {
    out.push({
      id,
      type: 'edge',
      query: { card, project_id: pid },
      expect: { max_inject: max },
      exclude_self: []
    });
  }
  out.push({
    id: 'X-long',
    type: 'edge',
    query: { card: '优化详情页性能与交互细节，'.repeat(40), project_id: pid },
    expect: { max_inject: INJECT_SOFT_CAP },
    exclude_self: []
  });
  return out;
}

function shortToRow(s) {
  return {
    id: s.ref,
    title: s.title,
    whenToInject: s.when_to_inject,
    body: s.body,
    sourceProjectId: s.project_id,
    status: 'confirmed',
    scope: 'project',
    layer: s.layer,
    adoptCount: 0,
    score: 0
  };
}

function retrieveNew(card, projectId, rows, cap = INJECT_SOFT_CAP) {
  const hits = rankIndexHits({ text: card, projectId }, rows);
  return hits.slice(0, cap).map((h) => h.id);
}

/** Pre-fix attach: whitespace tokens + same-project bonus, dump 12 if empty. */
function retrieveOld(card, projectId, shorts, cap = 12) {
  const needle = String(card || '').toLowerCase().trim();
  const tokens = needle.split(/\s+/).filter(Boolean);
  const pool = shorts.filter((s) => s.project_id === projectId);
  const scored = pool.map((s) => {
    const text = `${s.title} ${s.body} ${s.when_to_inject}`.toLowerCase();
    let score = 8 + 4 + 3;
    for (const t of tokens) if (text.includes(t)) score += 3;
    if (needle && text.includes(needle)) score += 5;
    return { id: s.ref, score };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  let out = scored.filter((r) => {
    if (!needle) return true;
    const s = pool.find((x) => x.ref === r.id);
    const text = `${s.title} ${s.body}`.toLowerCase();
    return tokens.some((t) => text.includes(t)) || text.includes(needle) || r.score > 0;
  });
  if (!out.length) out = scored;
  return out.slice(0, cap).map((r) => r.id);
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  return inter / new Set([...A, ...B]).size;
}

function evaluateRetrieve(label, cases, shorts, fn) {
  const rows = shorts.map(shortToRow);
  const injected = [];
  const gotByCase = [];
  let recalled = 0;
  let overMax = 0;
  let zeroMiss = 0;
  const freq = new Map();
  for (const c of cases) {
    const self = new Set(c.exclude_self || []);
    const raw = fn(c.query.card, c.query.project_id, label === 'old' ? shorts : rows);
    const got = raw.filter((id) => !self.has(id));
    injected.push(got.length);
    gotByCase.push({ id: c.id, type: c.type, got, want: c.expect.must_inject_any || [], max: c.expect.max_inject });
    for (const id of got) freq.set(id, (freq.get(id) || 0) + 1);
    const want = c.expect.must_inject_any || [];
    if (c.type === 'edge') {
      if (typeof c.expect.max_inject === 'number' && got.length > c.expect.max_inject) overMax += 1;
      continue;
    }
    if (want.length && want.some((id) => got.includes(id))) recalled += 1;
    else if (want.length && got.length < (c.expect.max_inject || INJECT_SOFT_CAP)) zeroMiss += 1;
    if (typeof c.expect.max_inject === 'number' && got.length > c.expect.max_inject) overMax += 1;
  }
  const real = cases.filter((c) => c.type === 'real-recall');
  const realInjected = injected.slice(0, real.length);
  const avg = realInjected.length ? realInjected.reduce((a, b) => a + b, 0) / realInjected.length : 0;
  const filled = realInjected.filter((n) => n >= INJECT_SOFT_CAP).length;
  let jacSum = 0;
  let jacN = 0;
  let jacMax = 0;
  const realGots = gotByCase.filter((g) => cases.find((c) => c.id === g.id)?.type === 'real-recall');
  for (let i = 0; i < realGots.length; i += 1) {
    for (let j = i + 1; j < realGots.length; j += 1) {
      const v = jaccard(realGots[i].got, realGots[j].got);
      jacSum += v;
      jacN += 1;
      if (v > jacMax) jacMax = v;
    }
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
  const edgeFail = gotByCase.filter((g) => {
    const c = cases.find((x) => x.id === g.id);
    return c?.type === 'edge' && typeof c.expect.max_inject === 'number' && g.got.length > c.expect.max_inject;
  });
  return {
    label,
    real_cases: real.length,
    avg_inject: Number(avg.toFixed(2)),
    fill_cap: `${filled}/${real.length}`,
    recall_any: `${recalled}/${real.length}`,
    zero_miss: zeroMiss,
    over_max: overMax,
    jaccard_avg: jacN ? Number((jacSum / jacN).toFixed(3)) : 0,
    jaccard_max: Number(jacMax.toFixed(3)),
    top_memory: top ? { id: top[0], n: top[1], of: real.length } : null,
    edge_fail: edgeFail.map((g) => ({ id: g.id, n: g.got.length, got: g.got.slice(0, 3) })),
    samples: gotByCase.filter((g) => cases.find((c) => c.id === g.id)?.type === 'real-recall').slice(0, 8)
  };
}

function evaluateExtract(runs) {
  const lessons = [];
  const capabilities = [];
  for (const r of runs) {
    const taskTexts = [r.title, r.goal, r.capability?.title, r.capability?.body].filter(Boolean);
    const keptBodies = [];
    for (const l of r.lessons) {
      const gated = gateLesson(l.body, { taskTexts, existing: keptBodies });
      if (gated.keep) keptBodies.push(gated.body);
      lessons.push({
        project: r.project,
        run_id: r.runId,
        text: l.body,
        keep: gated.keep,
        total: gated.score.total,
        reason: gated.score.reason || '',
        narration: isProcessNarration(l.body)
      });
    }
    if (r.capability) {
      const gated = gateLesson(r.capability.body);
      capabilities.push({
        project: r.project,
        run_id: r.runId,
        text: r.capability.body,
        keep: gated.keep,
        total: gated.score.total,
        reason: gated.score.reason || ''
      });
    }
  }
  const kept = lessons.filter((x) => x.keep);
  const dropped = lessons.filter((x) => !x.keep);
  const reasons = {};
  for (const d of dropped) reasons[d.reason || 'below Gate B'] = (reasons[d.reason || 'below Gate B'] || 0) + 1;
  return {
    lesson_n: lessons.length,
    lesson_keep: kept.length,
    lesson_drop: dropped.length,
    keep_rate: lessons.length ? Number((kept.length / lessons.length).toFixed(3)) : 0,
    drop_reasons: reasons,
    capability_n: capabilities.length,
    capability_keep: capabilities.filter((x) => x.keep).length,
    drop_samples: dropped.slice(0, 12).map((x) => ({ project: x.project, total: x.total, reason: x.reason, text: clip(x.text, 80) })),
    keep_samples: kept.slice(0, 8).map((x) => ({ project: x.project, total: x.total, text: clip(x.text, 80) }))
  };
}

function main() {
  const args = parseArgs(process.argv);
  const repos = discoverRepos(args.roots);
  const runs = loadRuns(repos);
  const { shorts, memByRun } = buildLibrary(runs);
  const realCases = buildCases(runs, memByRun);
  const cases = [...realCases, ...robustnessCases(shorts)];
  const extract = evaluateExtract(runs);
  const runByKey = new Map(runs.map((r) => [`${r.project}::${r.runId}`, r]));
  const gatedShorts = shorts.filter((s) => {
    const r = runByKey.get(`${s.project_id}::${s.run_id}`);
    const taskTexts = r ? [r.title, r.goal, r.capability?.title, r.capability?.body].filter(Boolean) : [];
    if (s.kind === 'practice') {
      return gateLesson(s.body, { taskTexts }).keep || Boolean(s.body);
    }
    return gateLesson(s.body, { taskTexts }).keep;
  });
  const retrieveUngatedNew = evaluateRetrieve('new', cases, shorts, (card, pid, rows) => retrieveNew(card, pid, rows));
  const retrieveGatedNew = evaluateRetrieve('new-gated', cases, gatedShorts, (card, pid, rows) => retrieveNew(card, pid, rows));
  const retrieveLegacy = evaluateRetrieve('old', cases, shorts, (card, pid, list) => retrieveOld(card, pid, list));

  const byProj = {};
  for (const r of runs) {
    const b = (byProj[r.project] ??= { runs: 0, lessons: 0, caps: 0 });
    b.runs += 1;
    b.lessons += r.lessons.length;
    if (r.capability) b.caps += 1;
  }

  const report = {
    generated_at: new Date().toISOString(),
    roots: args.roots,
    repos: repos.length,
    unique_runs: runs.length,
    shorts: shorts.length,
    gated_shorts: gatedShorts.length,
    real_cases: realCases.length,
    projects: byProj,
    extract,
    retrieve: {
      old: retrieveLegacy,
      new_ungated: retrieveUngatedNew,
      new_gated_lessons: retrieveGatedNew
    },
    constants: {
      min_related: MIN_RELATED_SCORE,
      inject_soft_cap: INJECT_SOFT_CAP,
      min_file_freq: MIN_FILE_FREQ,
      max_file_freq: MAX_FILE_FREQ
    }
  };

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, 'library.json'), `${JSON.stringify({ shorts }, null, 0)}\n`);
  fs.writeFileSync(path.join(OUT, 'cases.json'), `${JSON.stringify({ cases: realCases }, null, 0)}\n`);

  const lines = [];
  lines.push(`# ralph memory eval`);
  lines.push('');
  lines.push(`repos ${repos.length}  unique runs ${runs.length}  shorts ${shorts.length} (gated lessons+cap ${gatedShorts.length})  real-recall cases ${realCases.length}`);
  lines.push('');
  lines.push('## projects');
  for (const p of Object.keys(byProj).sort()) {
    const b = byProj[p];
    lines.push(`- ${p}: runs=${b.runs} lessons=${b.lessons} capability=${b.caps}`);
  }
  lines.push('');
  lines.push('## extract (Gate B on stored lessons)');
  lines.push(`- lessons ${extract.lesson_n} keep ${extract.lesson_keep} drop ${extract.lesson_drop} keep_rate ${extract.keep_rate}`);
  lines.push(`- drop reasons: ${JSON.stringify(extract.drop_reasons)}`);
  lines.push(`- capability summaries keep ${extract.capability_keep}/${extract.capability_n} (not auto-injected as lessons)`);
  lines.push('');
  lines.push('## retrieve (adopt=0)');
  for (const row of [retrieveLegacy, retrieveUngatedNew, retrieveGatedNew]) {
    lines.push(`- **${row.label}** avg_inject=${row.avg_inject} fill_cap=${row.fill_cap} recall_any=${row.recall_any} zero_miss=${row.zero_miss} over_max=${row.over_max} jaccard_avg=${row.jaccard_avg} jaccard_max=${row.jaccard_max} top=${row.top_memory ? `${row.top_memory.n}/${row.top_memory.of}` : '-'} edge_fail=${row.edge_fail.length}`);
  }
  lines.push('');
  lines.push(`wrote ${path.join(OUT, 'report.json')}`);
  const md = lines.join('\n');
  fs.writeFileSync(path.join(OUT, 'REPORT.md'), `${md}\n`);
  console.log(md);
}

main();
