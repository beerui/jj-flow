# 维护说明

给 **维护 jj-flow 仓库** 的人。

## 文档 SSOT

| 层 | 路径 | 规则 |
|----|------|------|
| 正文 | `docs/**/*.md` | 只改 Markdown；内链写源文件相对路径（如 `../commands/jj-ralph.md`） |
| 站点声明 | `docs/.vitepress/config.mjs` · `docs/.vitepress/sidebar.mjs` · `docs/.vitepress/redirects.mjs` | 配置 / 侧栏 / 旧地址跳转 |
| 产物 | `site/` | `npm run docs:build`；勿手改；不入库 |
| 门禁 | `npm run docs:check` · `harness:check` · `harness:gc` | CI / verify |

新增顶层页面：放文件 + 在 `docs/.vitepress/sidebar.mjs` 对应分组加一行；`design-docs/`、`exec-plans/`、`adr/` 下的文件自动进侧栏（标题取首个 `#`）。忘了加侧栏，`docs:check` 与 `harness:gc` 都会报。构建即校验：内链指向不存在的页面会让 `docs:check` 失败。

两条写作限制：正文不要出现双花括号（VitePress 会当 Vue 插值，行内代码也不豁免，只有围栏代码块安全）；`CHANGELOG.md` 会被 `docs/changelog.md` 包含进站点，里面的链接只能写绝对 URL。

本地写文档：`npm run docs:dev`（热更新；WSL 下自动改为轮询）。发布前 `npm run docs:preview` 看构建产物——站点带 `/jj-flow/` 前缀，不能直接双击 `site/index.html`。

### 改哪一页

| 变更 | 先改 |
|------|------|
| 上手 / 安装 | `docs/index.md` · `installation.md` · `usage.md` |
| 工作流行为 | `docs/commands/*` + skill SSOT `skills/` |
| 架构 | `docs/architecture.md` + 根 `ARCHITECTURE.md` |
| 设计 | `docs/design-docs/*` + 索引 |

## 命令

```bash
npm run docs:dev
npm run docs:check
npm run docs:build
npm run docs:preview
npm run verify
npm run lab:check
npm run harness:gc
```

`npm run verify` 含 `lab:check`。本地须设绝对 `JJ_LAB_LOOP_ROOT` / `JJ_LAB_FAMILY_ROOT`（或已存在的 `lab-roots.json`）；CI 由 `prepare-lab-roots` 注入。缺根 fail-closed。

改 dispatch 协议额外：`node --test tests/jj-dispatch-contract.test.mjs`。

## Skill SSOT

只编辑 `skills/`。Claude 仅 `.claude/commands/` 薄入口。  
命令行全集见 [CLI 参考](commands/cli.md)（维护/调试用，不写进用户教程）。

## 发布

npm 只走 GitHub Actions `NPM Publish`（`workflow_dispatch`）。

## 已移除入口

`$jj-delivery` / `$jj-validate` / `$jj-evolve` — 勿恢复为活入口。  
维护用 `npm run verify`。
