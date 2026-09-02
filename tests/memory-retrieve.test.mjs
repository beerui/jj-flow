import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  INJECT_SOFT_CAP,
  MIN_RELATED_SCORE,
  rankIndex,
  rankIndexHits
} from '../src/memoryRetrieve.mjs';
import { attachKnowledgeRefs } from '../src/portfolioKnowledge.mjs';

function row(partial) {
  return {
    kind: 'practice',
    scope: 'project',
    sourceProjectId: 'prj_a',
    status: 'confirmed',
    ...partial
  };
}

test('rankIndex: Gate B score only breaks ties among equal relevance', () => {
  const q = { text: '详情页 删除 更多 确认', projectId: 'prj_a' };
  const base = {
    title: '详情页删除放在更多里，确认后才删',
    whenToInject: '做同一类事情时',
    body: '更多菜单里点删除，确认框再点一次。',
    scope: 'project',
    sourceProjectId: 'prj_a',
    status: 'confirmed'
  };
  const weak = row({ ...base, id: 'exp_weak', score: 62 });
  const strong = row({ ...base, id: 'exp_strong', score: 91 });
  let got = rankIndex(q, [weak, strong]);
  assert.equal(got[0], 'exp_strong');

  const offTopic = row({
    id: 'exp_offtopic',
    title: '按钮圆角 6px',
    body: '只改样式，和详情页无关。',
    score: 99
  });
  got = rankIndex(q, [offTopic, weak]);
  assert.equal(got[0], 'exp_weak');
  assert.ok(!got.includes('exp_offtopic') || got[0] !== 'exp_offtopic');

  const adopted = row({ ...base, id: 'exp_adopted', score: 61, adoptCount: 3 });
  got = rankIndex(q, [strong, adopted]);
  assert.equal(got[0], 'exp_adopted');
});

test('rankIndex: same-family related can inject; other-family still drops', () => {
  const q = { text: '动态入驻表单 schema', projectId: 'seo-daji-web', familyId: '中国大集', familyProjectIds: ['scsk-admin', 'seo-daji-web'] };
  const sibling = row({
    id: 'exp_admin',
    title: '动态入驻表单 schema 写入',
    body: '后管粘贴 schema 写入画布。',
    sourceProjectId: 'scsk-admin',
    familyId: '中国大集'
  });
  const other = row({
    id: 'exp_cj',
    title: '动态入驻表单 schema 写入',
    body: '承接无关条目。',
    sourceProjectId: 'cj-web',
    familyId: '承接'
  });
  const got = rankIndex(q, [sibling, other]);
  assert.ok(got.includes('exp_admin'));
  assert.ok(!got.includes('exp_cj'));
});

test('rankIndex: same-project confirmed only; drafts/user/global/other-project drop', () => {
  const q = { text: 'SQLite persist closeout 抽取 条目', projectId: 'prj_a' };
  const rows = [
    row({ id: 'exp_other_prj', title: 'SQLite persist closeout 抽取', sourceProjectId: 'prj_b' }),
    row({ id: 'exp_draft', title: 'SQLite persist closeout 抽取', status: 'draft' }),
    row({ id: 'exp_rejected', title: 'SQLite persist closeout 抽取', status: 'rejected' }),
    row({ id: 'exp_global', title: 'SQLite persist 约束', whenToInject: '抽取 closeout', scope: 'global' }),
    row({ id: 'exp_user', title: 'persist 后再抽取', whenToInject: 'SQLite closeout', scope: 'user' }),
    row({ id: 'exp_unrelated', title: '按钮颜色改 6px', whenToInject: 'css tip' }),
    row({ id: 'exp_card', title: 'SQLite persist 这件事本身', whenToInject: 'closeout', layer: 'card' }),
    row({ id: 'exp_proj', title: 'SQLite persist 要先落盘', whenToInject: 'closeout 抽取' })
  ];
  const got = rankIndex(q, rows);
  assert.ok(got.includes('exp_proj'));
  for (const id of ['exp_other_prj', 'exp_draft', 'exp_rejected', 'exp_global', 'exp_user', 'exp_unrelated', 'exp_card']) {
    assert.ok(!got.includes(id), id);
  }
});

test('rankIndex: zero related drops high adopt', () => {
  const got = rankIndex({ text: 'SQLite persist', projectId: 'prj_a' }, [
    row({ id: 'exp_hot_css', title: '按钮圆角', body: '只改样式。', adoptCount: 8 }),
    row({ id: 'exp_sql', title: 'SQLite persist', body: '先 Persist。' })
  ]);
  assert.deepEqual(got, ['exp_sql']);
});

test('rankIndex: empty query or unrelated Chinese query injects nothing', () => {
  const rows = [row({ id: 'exp_sql', title: 'SQLite persist' })];
  assert.deepEqual(rankIndex({ text: '按钮圆角 6px', projectId: 'prj_a' }, rows), []);
  assert.deepEqual(rankIndex({ text: '  ', projectId: 'prj_a' }, rows), []);
  assert.deepEqual(rankIndex({ text: 'SQLite persist', projectId: '' }, rows), []);
});

test('rankIndex: 发版 skip-bigram still bridges 发布版本', () => {
  const got = rankIndex({ text: '这次发版要走灰度', projectId: 'prj_a' }, [
    row({
      id: 'exp_release',
      title: '发布版本先灰度再全量',
      whenToInject: '上线时',
      body: '灰度一天没有异常再放全量。'
    }),
    row({ id: 'exp_skill', title: '按做成 skill 来落盘', whenToInject: '做类似事情时' })
  ]);
  assert.equal(got[0], 'exp_release');
});

test('rankIndex: 打包 hits body mention', () => {
  const got = rankIndex({ text: '打包', projectId: 'prj_pack' }, [
    row({
      id: 'exp_release',
      title: '发布版本',
      body: '用户给出版本号，需先对齐 dev，再分别打出 Linux 与 Windows 两个平台包。',
      sourceProjectId: 'prj_pack'
    }),
    row({
      id: 'exp_skill',
      title: '按做成 skill 来落盘',
      body: '把本机 Win/Linux 打包与交包流程写成可触发的 SKILL。',
      sourceProjectId: 'prj_pack'
    }),
    row({
      id: 'exp_color',
      title: '按钮颜色改 6px',
      body: '只改样式，不要动打包。',
      sourceProjectId: 'prj_other'
    })
  ]);
  assert.ok(got.includes('exp_skill') || got.includes('exp_release'));
  assert.ok(!got.includes('exp_color'));
});

test('rankIndex: adopted unrelated cannot outrank title match', () => {
  const got = rankIndex({
    text: '重构订单结算接口\n结算耗时要压到三百毫秒以内，改动不影响既有对账逻辑',
    projectId: 'prj_a'
  }, [
    row({
      id: 'exp_logo',
      title: '首页 logo 动效不要用大幅缩放',
      whenToInject: '做首页视觉时',
      body: '两百毫秒的淡入就够了，缩放超过 1.2 倍在低端机上会掉帧',
      adoptCount: 3
    }),
    row({
      id: 'exp_settle',
      title: '订单结算接口重构后要先跑对账',
      whenToInject: '改结算链路时',
      body: '结算改动必须回归对账，否则差异要到月底才暴露。'
    })
  ]);
  assert.equal(got[0], 'exp_settle');
});

test('rankIndex: single-rune pile cannot pass MinRelatedScore', () => {
  const got = rankIndex({ text: '在重构时要保两份做法', projectId: 'prj_a' }, [
    row({
      id: 'exp_noise',
      title: '做猫咪头像不要缩放',
      whenToInject: '在视觉稿定稿时',
      body: '两版对比保留一份。',
      adoptCount: 9
    })
  ]);
  assert.deepEqual(got, []);
});

test('rankIndexHits exposes strong score at or above MinRelatedScore', () => {
  const hits = rankIndexHits({ text: 'SQLite persist', projectId: 'prj_a' }, [
    row({ id: 'exp_sql', title: 'SQLite persist', body: '先 Persist。' })
  ]);
  assert.equal(hits.length, 1);
  assert.ok(hits[0].strong >= MIN_RELATED_SCORE);
});

test('attachKnowledgeRefs uses retrieve: no same-project dump, cap 5, unrelated empty', () => {
  const kb = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-kb-'));
  try {
    fs.mkdirSync(path.join(kb, 'index'), { recursive: true });
    const junk = [
      '0724 零息交易上周上线归档',
      'aliyun-tracker 安装源改为阿里云私服',
      '表单筛选/输入 36px 高度 + 14px 字号位置清单',
      '询单票面信息已回复未打勾',
      'judgeShowConsultText 订单号为空排查',
      '识票列表模式承兑人类型标签',
      '定向接单价格变化弹窗 NaN 日志定位',
      '订单变更弹窗价格与年化利率',
      '支付密码弹窗自动聚焦',
      '支付提示图标与首行文字对齐',
      '零息订单业务协议 URL 取后端字段',
      'README npm install 改为 pnpm install'
    ].map((title, i) => ({
      id: `cap-cj-web-junk-${i}`,
      type: 'capability',
      status: 'active',
      scope: 'project',
      project_key: 'cj-web',
      title,
      summary: title
    }));
    const related = {
      id: 'cap-cj-web-quote-due',
      type: 'capability',
      status: 'active',
      scope: 'project',
      project_key: 'cj-web',
      title: '报价申请未到期商票调整到期日',
      summary: '报价申请中含未到期商票时展示提示，并支持通过票据信息表的调整到期日操作修改票据到期日'
    };
    fs.writeFileSync(
      path.join(kb, 'index', 'search.json'),
      JSON.stringify({ items: [...junk, related] })
    );

    const miss = attachKnowledgeRefs({
      q: '报价申请未到期商票调整到期日',
      project: 'cj-web',
      portfolioRoot: kb,
      title: '报价申请未到期商票调整到期日',
      goal: '含未到期商票时展示提示并调整到期日'
    });
    assert.equal(miss.status, 'ready');
    assert.ok(miss.knowledge_refs.includes('cap-cj-web-quote-due'));
    assert.ok(miss.knowledge_refs.length <= INJECT_SOFT_CAP);
    assert.ok(!miss.knowledge_refs.some((id) => id.startsWith('cap-cj-web-junk-')));

    const weather = attachKnowledgeRefs({
      q: '今天天气不错，适合出门散步晒太阳',
      project: 'cj-web',
      portfolioRoot: kb
    });
    assert.equal(weather.status, 'empty');
    assert.deepEqual(weather.knowledge_refs, []);

    const dump = attachKnowledgeRefs({
      q: '商票标签颜色调整为#0076f6',
      project: 'cj-web',
      portfolioRoot: kb
    });
    assert.ok(dump.knowledge_refs.length <= INJECT_SOFT_CAP);
    assert.ok(!dump.knowledge_refs.includes('cap-cj-web-junk-0'));
  } finally {
    fs.rmSync(kb, { recursive: true, force: true });
  }
});
