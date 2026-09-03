# 部署（GitHub Pages）

文档站由 CI 构建 `site/` 发布到 GitHub Pages。

```bash
npm run docs:build     # 构建到 site/
npm run docs:preview   # 预览构建产物（带 /jj-flow/ 前缀）
npm run docs:check     # 不写 site/ 的校验构建：侧栏覆盖 + dead link + 跳转页
```

源：`docs/**`（站点声明在 `docs/.vitepress/`）。  
首页：https://beerui.github.io/jj-flow/index.html

详见仓库 Actions 与 [维护说明](maintenance.md)。
