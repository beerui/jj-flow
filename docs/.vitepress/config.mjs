import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';
import { redirects } from './redirects.mjs';
import { sidebar } from './sidebar.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SITE_URL = 'https://beerui.github.io/jj-flow/';
const GITHUB_URL = 'https://github.com/beerui/jj-flow';

// 排除清单与 harness 共用同一真源：docs/other、docs/evaluations
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'harness-manifest.json'), 'utf8'));
const srcExclude = (manifest.documentation_policy?.excluded_paths || []).map((p) => `${p.replace(/^docs\//, '')}/**`);

export default defineConfig({
  lang: 'zh-CN',
  title: 'jj-flow',
  description: '面向多仓库项目族的对话式研发编排工作流——让改功能、跨仓迁移、多仓调度与 Git 收工可核对、可续接',
  base: '/jj-flow/',
  srcExclude,
  outDir: '../site',
  sitemap: { hostname: SITE_URL },
  // WSL 上编辑 /mnt/* 的仓库时 inotify 不可用，热更新改轮询
  vite: { server: { watch: { usePolling: Boolean(process.env.WSL_DISTRO_NAME) } } },
  themeConfig: {
    siteTitle: 'jj-flow 文档',
    nav: [
      {
        text: '快速上手',
        items: [
          { text: '首页与全景导览', link: '/' },
          { text: '1 分钟安装与配置', link: '/installation' },
          { text: '第一次使用（完整实战）', link: '/usage' },
          { text: '常见避坑与自检清单', link: '/pitfalls' }
        ]
      },
      {
        text: '核心工作流',
        items: [
          { text: '命令总览与选型指南', link: '/commands' },
          { text: 'ralph · 单仓任务闭环', link: '/commands/jj-ralph' },
          { text: 'same · 跨仓同源迁移', link: '/commands/jj-same' },
          { text: 'dispatch · 多仓统筹调度', link: '/commands/jj-dispatch' },
          { text: 'review · 只读代码审查', link: '/commands/jj-review' },
          { text: 'end · Git 提交与合并', link: '/commands/jj-end' },
          { text: 'init · 项目地图接入', link: '/commands/jj-init' },
          { text: 'jj · 智能意图分流', link: '/commands/jj' }
        ]
      },
      {
        text: '核心概念',
        items: [
          { text: '核心术语对照表', link: '/glossary' },
          { text: '证据门禁：什么算做完', link: '/concepts-evidence' },
          { text: '目录结构与文件布局', link: '/concepts-paths' },
          { text: '宿主平台与工作模式', link: '/concepts-hosts' },
          { text: '知识库与记忆热层', link: '/concepts-knowledge' }
        ]
      },
      {
        text: '维护与参考',
        items: [
          { text: '系统架构总览', link: '/architecture' },
          { text: 'CLI 命令行参考', link: '/commands/cli' },
          { text: '仓库与文档维护', link: '/maintenance' },
          { text: '文档写作规范', link: '/writing-guide' },
          { text: '更新日志', link: '/changelog' }
        ]
      }
    ],
    socialLinks: [{ icon: 'github', link: GITHUB_URL }],
    sidebar,
    outline: { level: [2, 3], label: '本页目录' },
    editLink: { pattern: `${GITHUB_URL}/edit/main/docs/:path`, text: '在 GitHub 上编辑此页' },
    docFooter: { prev: '上一页', next: '下一页' },
    footer: {
      message: '基于 MIT 协议发布 · 以持久文件与 Git 证据驱动的多项目研发工作流',
      copyright: 'Copyright © 2026 jj-flow contributors'
    },
    sidebarMenuLabel: '文档目录',
    returnToTopLabel: '回到顶部',
    darkModeSwitchLabel: '外观主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
          modal: {
            displayDetails: '显示详情',
            resetButtonTitle: '清空查询',
            backButtonTitle: '关闭',
            noResultsText: '未找到相关内容',
            footer: {
              selectText: '打开',
              selectKeyAriaLabel: '回车',
              navigateText: '切换',
              navigateUpKeyAriaLabel: '上',
              navigateDownKeyAriaLabel: '下',
              closeText: '关闭',
              closeKeyAriaLabel: 'esc'
            }
          }
        },
        miniSearch: {
          options: {
            // 中文按词切分。VitePress 会把该函数序列化到客户端，因此必须自包含、不引用外部变量。
            tokenize: (text) => {
              if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
                const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
                return Array.from(segmenter.segment(text))
                  .filter((s) => s.isWordLike)
                  .map((s) => s.segment.toLowerCase());
              }
              return text.toLowerCase().split(/[\n\r\p{Z}\p{P}]+/u).filter(Boolean);
            }
          }
        }
      }
    }
  },
  buildEnd(siteConfig) {
    writeRedirectPages(siteConfig.outDir);
  }
});

function writeRedirectPages(outDir) {
  for (const [from, to] of Object.entries(redirects)) {
    const target = path.posix.relative(path.posix.dirname(from), to);
    const file = path.join(outDir, from);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, redirectHtml(target, new URL(to, SITE_URL).href));
  }
}

function redirectHtml(target, canonical) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url=${target}">
  <link rel="canonical" href="${canonical}">
  <title>页面已移动 · jj-flow</title>
</head>
<body>
  <p>页面已移动到 <a href="${target}">${target}</a>。</p>
</body>
</html>
`;
}
