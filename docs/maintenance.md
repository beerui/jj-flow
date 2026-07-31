# 维护说明

给 **维护 jj-flow 仓库** 的人。

## 文档 SSOT

| 层 | 路径 | 规则 |
|----|------|------|
| 正文 | `docs/**/*.md` | 只改 Markdown |
| 生成器 | `scripts/build-docs.mjs` | 导航、样式、搜索、SPA |
| 产物 | `site/` | `npm run docs:build`；勿手改 |
| 门禁 | `npm run docs:check` · `harness:check` | CI / verify |

侧栏在 `SIDEBAR_GROUPS`；深页在 `DEEP_PAGES`（仍构建）。

### 改哪一页

| 变更 | 先改 |
|------|------|
| 上手 / 安装 | `docs/index.md` · `installation.md` · `usage.md` |
| 工作流行为 | `docs/commands/*` + skill SSOT `.codex/skills/` |
| 架构 | `docs/architecture.md` + 根 `ARCHITECTURE.md` |
| 设计 | `docs/design-docs/*` + 索引 |

## 命令

```bash
npm run docs:check
npm run docs:build
npm run verify
npm run harness:gc
```

改 dispatch 协议额外：`node --test tests/jj-dispatch-contract.test.mjs`。

## Skill SSOT

只编辑 `.codex/skills/`。Claude 仅 `.claude/commands/` 薄入口。  
命令行全集见 [CLI 参考](command-cli.html)（维护/调试用，不写进用户教程）。

## 发布

npm 只走 GitHub Actions `NPM Publish`（`workflow_dispatch`）。

## 已移除入口

`$jj-delivery` / `$jj-validate` / `$jj-evolve` — 勿恢复为活入口。  
维护用 `npm run verify`。
