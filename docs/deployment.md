# 部署（GitHub Pages）

文档站由 CI 构建 `site/` 发布到 GitHub Pages。

```bash
npm run docs:build   # 本地预览
npm run docs:check   # 不写 site/ 的校验构建
```

源：`docs/**` + `scripts/build-docs.mjs`。  
首页：https://beerui.github.io/jj-flow/index.html

详见仓库 Actions 与 [维护说明](maintenance.md)。
