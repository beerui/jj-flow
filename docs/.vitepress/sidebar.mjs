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
      { text: '首页与全景导览', link: '/' },
      { text: '1 分钟安装与配置', link: '/installation' },
      { text: '第一次使用（完整实战）', link: '/usage' },
      { text: '常见避坑与自检清单', link: '/pitfalls' }
    ]
  },
  {
    text: '工作流',
    items: [
      { text: '命令总览与选型指南', link: '/commands' },
      { text: 'ralph · 单仓任务闭环', link: '/commands/jj-ralph' },
      { text: 'same · 跨仓同源迁移', link: '/commands/jj-same' },
      { text: 'dispatch · 多仓统筹调度', link: '/commands/jj-dispatch' },
      { text: 'review · 只读代码审查', link: '/commands/jj-review' },
      { text: 'end · Git 提交与合并', link: '/commands/jj-end' },
      { text: 'init · 项目地图接入', link: '/commands/jj-init' },
      { text: 'jj · 智能意图分流', link: '/commands/jj' },
      { text: 'coordinate · 动态多角色（可选）', link: '/commands/jj-team-coordinate' },
      { text: 'lifecycle · 标准 SDLC（可选）', link: '/commands/jj-team-lifecycle' },
      { text: 'swarm · 多方案搜索（可选）', link: '/commands/jj-team-swarm' },
      { text: 'evaluated · 交付复盘（可选）', link: '/commands/jj-evaluated' }
    ]
  },
  {
    text: '概念',
    items: [
      { text: '核心术语对照表', link: '/glossary' },
      { text: '证据门禁：什么算做完', link: '/concepts-evidence' },
      { text: '目录结构与文件布局', link: '/concepts-paths' },
      { text: '宿主平台与工作模式', link: '/concepts-hosts' },
      { text: '知识库与记忆热层', link: '/concepts-knowledge' }
    ]
  },
  {
    text: '维护者',
    items: [
      { text: '系统架构总览', link: '/architecture' },
      { text: 'CLI 命令行参考', link: '/commands/cli' },
      { text: '仓库与文档维护', link: '/maintenance' },
      { text: '文档写作规范', link: '/writing-guide' },
      { text: '站点部署（GitHub Pages）', link: '/deployment' },
      { text: '实验场 Sibling 仓库规范', link: '/jj-lab-siblings' },
      { text: '更新日志（近期）', link: '/changelog' },
      { text: '更新日志（历史归档）', link: '/changelog-archive' }
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
      {
        text: '历史验收',
        collapsed: true,
        items: [
          { text: '真实 Host', link: '/milestones/real-host-acceptance' },
          { text: 'M7 半真实 Host', link: '/milestones/m7-acceptance' },
          { text: 'H5 熵清理', link: '/milestones/h5-acceptance' }
        ]
      }
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
