# 站点部署（GitHub Pages）

`jj-flow` 文档站通过 GitHub Actions 工作流（`.github/workflows/pages.yml`）自动构建并发布至 GitHub Pages。

* **线上访问地址**：[https://beerui.github.io/jj-flow/index.html](https://beerui.github.io/jj-flow/index.html)
* **站点源码目录**：`docs/**`（VitePress 配置位于 `docs/.vitepress/`）
* **静态构建产物**：`site/`（仅在构建时生成，已在 `.gitignore` 中忽略，不提交进 Git 仓库）

## 一、本地开发、校验与预览命令

在提交文档改动前，建议在本地依次运行以下命令：

```bash
# 1. 启动本地热更新开发服务器（边改边看）
npm run docs:dev

# 2. 运行文档门禁校验（检查侧栏双向覆盖、GFM 表格语法、CHANGELOG 切分与死链，不写 site/）
npm run docs:check

# 3. 正式构建静态产物到 site/ 目录
npm run docs:build

# 4. 启动本地静态预览服务器（模拟线上 /jj-flow/ 路径前缀）
npm run docs:preview
```

::: tip 为什么不能直接双击打开 `site/index.html`？
因为线上站点部署在 GitHub Pages 的二级路径 `/jj-flow/` 下（`config.mjs` 中配置了 `base: '/jj-flow/'`），静态资源均带有该前缀。本地验证构建产物时，请使用 `npm run docs:preview` 通过内置 HTTP 服务访问。
:::

## 二、CI 自动发布流程（`.github/workflows/pages.yml`）

当代码合入 `main` 分支（或手动触发 `workflow_dispatch`）时，GitHub Actions 会自动执行以下步骤：

1. 根据 `.nvmrc` 安装指定版本的 Node.js 并执行 `npm ci`。
2. 运行 `npm run docs:build` 生成静态站点至 `site/`（包括在 `buildEnd` 钩子中按 `docs/.vitepress/redirects.mjs` 自动生成的历史 URL 跳转页与 `sitemap.xml`）。
3. 通过 `actions/upload-pages-artifact` 与 `actions/deploy-pages` 将 `site/` 发布到 `github-pages` 环境。

## 相关阅读

* [仓库与文档维护指南](maintenance.md)
* [文档写作规范](writing-guide.md)
