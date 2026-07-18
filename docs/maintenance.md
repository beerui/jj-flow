# 维护说明

本文给 **维护 jj-flow 仓库的人** 用：如何改文档、如何检查、发布时注意什么。

## 文档所有权（Source of truth）

| 层级 | 路径 | 规则 |
|------|------|------|
| 唯一正文源 | `docs/**/*.md` | 只改 Markdown，不手改 `site/` HTML |
| 站点生成器 | `scripts/build-docs.mjs` | 导航注册、样式、搜索、表格/链接渲染 |
| 生成产物 | `site/` | `npm run docs:build` 输出；CI Pages 部署用；**勿手工维护** |
| 结构门禁 | `scripts/check-project.mjs` | 必需文档文件存在；已删除命令页不得回流 |
| 本地/CI 检查 | `npm run docs:check` | 完整构建 + 搜索索引 + 主路径与嵌套路径校验 |

### 什么时候改哪一页

| 变更类型 | 先改 |
|----------|------|
| 用户怎么开始用 | `docs/usage.md`、`docs/installation.md`、`docs/index.md` |
| 新命令或改命令行为 | `docs/commands.md` + `docs/commands/<name>.md`，并在 `build-docs.mjs` 的 `NAV_GROUPS` 注册 |
| 产品定位 / 架构边界 | `docs/architecture.md`、`README.md`、`AGENTS.md` |
| 维护流程本身 | 本页 + 必要时 `docs/deployment.md` |
| 历史草稿 | 放 `docs/other/`，**不要**挂进主导航 |

`docs/other/*` 是历史长文，不是当前产品主路径。

## 构建与检查

```bash
# 只检查文档站（临时目录构建，不写 site/）
npm run docs:check

# 写出可浏览的 site/
npm run docs:build

# 全仓门禁（测试 + 结构检查 + 文档检查）
npm run verify

# 只读持续熵清理与质量评分
npm run harness:gc
```

修改调度协议后额外：

```bash
node --test tests/jj-dispatch-contract.test.mjs
git diff --check
```

文档站专项回归：

```bash
node --test tests/docs-site.test.mjs
```

`harness:gc` 中 P0/P1 会阻断，P2/P3 只提示小批次维护候选。首版明确禁用自动修复；基线位于 `docs/milestones/h5-gc-baseline.json`，runner 变化后必须重新生成。

## 新增一页文档的清单

1. 在 `docs/` 写 Markdown（链接用站内 `.html` 目标，如 `command-jj-same.html`）。  
2. 在 `scripts/build-docs.mjs` → `NAV_GROUPS` 注册 `title` / `source` / `output`。  
3. 若属于用户必读，从 `docs/index.md` 或 `docs/commands.md` 链过去。  
4. 跑 `npm run docs:check`（嵌套路径如 `milestones/` 会自动用 `../` 修资产与导航）。  
5. 用户可见能力变更：先更新 `docs/usage.md` 与命令页，再改代码。

## 分支与提交

- Conventional Commits：`feat:` / `fix:` / `docs:` / `test:` / `chore:`  
- 中文摘要即可，例如：`docs: 修正嵌套页资源路径`

## 发布相关工作流

- `ci.yml`：PR / push 跑测试  
- `pages.yml`：构建并部署文档站  
- `release-please.yml` / `npm-publish.yml`：版本与 npm  

文档-only 改动不必单独发 npm；用户说「发布」时再升版本。

## 已移除入口（勿恢复为活入口）

不要在主导航或首页 CTA 链到：

- `$jj-delivery` / `$jj-validate` / `$jj-evolve`  
- 以及更早的 feat / fix / knowhow / auto / review  

控制面 `delivery_id` 是调度任务身份，不是对话命令。维护本仓用 `npm run verify`，不要假设仍有 `$jj-validate` 对话入口。
