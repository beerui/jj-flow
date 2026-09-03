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

// 排除清单与 harness 共用同一真源：docs/other、docs/evaluations、docs/skill-zh-bridge
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'harness-manifest.json'), 'utf8'));
const srcExclude = (manifest.documentation_policy?.excluded_paths || []).map((p) => `${p.replace(/^docs\//, '')}/**`);

export default defineConfig({
  lang: 'zh-CN',
  title: 'jj-flow',
  description: '用对话做项目族编排工作流',
  base: '/jj-flow/',
  srcExclude,
  outDir: '../site',
  sitemap: { hostname: SITE_URL },
  // WSL 上编辑 /mnt/* 的仓库时 inotify 不可用，热更新改轮询
  vite: { server: { watch: { usePolling: Boolean(process.env.WSL_DISTRO_NAME) } } },
  themeConfig: {
    nav: [
      { text: '安装', link: '/installation' },
      { text: '第一次使用', link: '/usage' },
      { text: '更新日志', link: '/changelog' }
    ],
    socialLinks: [{ icon: 'github', link: GITHUB_URL }],
    sidebar,
    outline: { level: [2, 3], label: '本页目录' },
    editLink: { pattern: `${GITHUB_URL}/edit/main/docs/:path`, text: '在 GitHub 上编辑此页' },
    docFooter: { prev: '上一页', next: '下一页' },
    sidebarMenuLabel: '目录',
    returnToTopLabel: '回到顶部',
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色',
    darkModeSwitchTitle: '切换到深色',
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
          modal: {
            displayDetails: '显示详情',
            resetButtonTitle: '清空',
            backButtonTitle: '关闭',
            noResultsText: '没有找到',
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
