// 侧栏纯数据模块：不 import vitepress，供 config.mjs / scripts/check-docs.mjs / src/harnessGc.mjs 共用。
// 顶层五组手工维护；设计文档 / 执行计划 / ADR 从目录自动生成（标题取首个一级标题）。
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DOCS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function titleOf(file) {
  const match = fs.readFileSync(file, 'utf8').match(/^#\s+(.+?)\s*$/m);
  const raw = match ? match[1] : path.basename(file, '.md');
  return raw.replace(/`/g, '').replace(/^Exec plan\s*[—-]\s*/i, '');
}

/** 目录下除 index.md 外的 .md → 侧栏条目；order 'asc' | 'desc' 按文件名 */
function dirEntries(relDir, order = 'asc') {
  const abs = path.join(DOCS_DIR, relDir);
  const files = fs.readdirSync(abs).filter((f) => f.endsWith('.md') && f !== 'index.md').sort();
  if (order === 'desc') files.reverse();
  return files.map((f) => ({ text: titleOf(path.join(abs, f)), link: `/${relDir}/${f.replace(/\.md$/, '')}` }));
}

export const sidebar = [
  {
    text: '开始',
    items: [
      { text: '首页', link: '/' },
      { text: '安装', link: '/installation' },
      { text: '第一次使用', link: '/usage' },
      { text: '常见踩坑', link: '/pitfalls' }
    ]
  },
  {
    text: '工作流',
    items: [
      { text: '命令总览', link: '/commands' },
      { text: 'init · 接入地图', link: '/commands/jj-init' },
      { text: 'ralph · 单仓闭环', link: '/commands/jj-ralph' },
      { text: 'same · 同源迁移', link: '/commands/jj-same' },
      { text: 'dispatch · 多仓调度', link: '/commands/jj-dispatch' },
      { text: 'review · 审查落盘', link: '/commands/jj-review' },
      { text: 'end · 收工合分支', link: '/commands/jj-end' },
      { text: 'jj · 帮你选路', link: '/commands/jj' },
      { text: 'evaluated · 复盘（可选）', link: '/commands/jj-evaluated' },
      { text: 'coordinate · 多角色（可选）', link: '/commands/jj-team-coordinate' },
      { text: 'lifecycle · SDLC（可选）', link: '/commands/jj-team-lifecycle' },
      { text: 'swarm · 搜索（可选）', link: '/commands/jj-team-swarm' }
    ]
  },
  {
    text: '概念',
    items: [
      { text: '术语表', link: '/glossary' },
      { text: '证据怎么算数', link: '/concepts-evidence' },
      { text: '目录怎么放', link: '/concepts-paths' },
      { text: '宿主与 Mode S', link: '/concepts-hosts' },
      { text: '知识库', link: '/concepts-knowledge' },
      { text: 'Loop 与 Graph', link: '/loop-graph-guide' },
      { text: '记忆速览', link: '/memory-knowledge-guide' }
    ]
  },
  {
    text: '维护者',
    items: [
      { text: '架构', link: '/architecture' },
      { text: '维护说明', link: '/maintenance' },
      { text: 'CLI 参考', link: '/commands/cli' },
      { text: '部署', link: '/deployment' },
      { text: '实验场 sibling 仓', link: '/jj-lab-siblings' },
      { text: '更新日志', link: '/changelog' }
    ]
  },
  {
    text: '参考',
    items: [
      { text: '设计文档', collapsed: true, items: [{ text: '总览', link: '/design-docs/' }, ...dirEntries('design-docs')] },
      {
        text: '执行计划',
        collapsed: true,
        items: [
          { text: '总览', link: '/exec-plans/' },
          ...dirEntries('exec-plans/active', 'desc'),
          ...dirEntries('exec-plans/completed', 'desc')
        ]
      },
      { text: 'ADR', collapsed: true, items: [{ text: '总览', link: '/adr/' }, ...dirEntries('adr')] },
      { text: '项目规划', link: '/project-plan' },
      { text: '真实 Host', link: '/milestones/real-host-acceptance' },
      { text: 'M7 半真实 Host', link: '/milestones/m7-acceptance' },
      { text: 'H5 熵清理', link: '/milestones/h5-acceptance' },
      { text: 'M6 调度', link: '/milestones/m6-acceptance' }
    ]
  }
];

/** 侧栏覆盖到的源文件（仓库相对、posix），供覆盖校验 */
export function sidebarDocPaths() {
  const out = [];
  const walk = (items) => {
    for (const item of items) {
      if (item.link) out.push(linkToDocPath(item.link));
      if (item.items) walk(item.items);
    }
  };
  walk(sidebar);
  return out;
}

function linkToDocPath(link) {
  const rel = link === '/' ? 'index' : link.replace(/^\//, '').replace(/\/$/, '/index');
  return `docs/${rel}.md`;
}

// `node docs/.vitepress/sidebar.mjs` → 打印覆盖清单 JSON（同步脚本用 spawnSync 读取）
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(sidebarDocPaths())}\n`);
}
