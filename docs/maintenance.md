# 维护说明

给 **维护 jj-flow 仓库** 的人。

## 文档 SSOT

| 层 | 路径 | 规则 |
|----|------|------|
| 正文 | `docs/**/*.md` | 只改 Markdown；内链写源文件相对路径（如 `../commands/jj-ralph.md`） |
| 站点声明 | `docs/.vitepress/config.mjs`、`docs/.vitepress/sidebar.mjs`、`docs/.vitepress/redirects.mjs` | 配置 / 侧栏 / 旧地址跳转 |
| 产物 | `site/` | `npm run docs:build`；勿手动改；不入库 |
| 门禁 | `npm run docs:check`、`harness:check`、`harness:gc` | CI / verify |

新增顶层页面：放文件 + 在 `docs/.vitepress/sidebar.mjs` 对应分组加一行；`design-docs/`、`exec-plans/`、`adr/` 下的文件自动进侧栏（标题取首个 `#`）。忘了加侧栏，`docs:check` 与 `harness:gc` 都会报。构建即校验：内链指向不存在的页面会让 `docs:check` 失败。

两条写作限制：正文不要出现双花括号（VitePress 会当 Vue 插值，行内代码也不豁免，只有围栏代码块安全）；`CHANGELOG.md` 会被 `docs/changelog.md` 包含进站点，里面的链接只能写绝对 URL。

本地写文档：`npm run docs:dev`（热更新；WSL 下自动改为轮询）。发布前 `npm run docs:preview` 看构建产物——站点带 `/jj-flow/` 前缀，不能直接双击 `site/index.html`。

### 改哪一页

| 变更 | 先改 |
|------|------|
| 上手 / 安装 | `docs/index.md`、`installation.md`、`usage.md` |
| 工作流行为 | `docs/commands/*` + skill SSOT `skills/` |
| 架构 | `docs/architecture.md` + 根 `ARCHITECTURE.md` |
| 设计 | `docs/design-docs/*` + 索引 |

## 文档地图

| 章节 | 受众 | 用法 | 内容边界 |
|------|------|------|----------|
| 开始 | 新用户 | 第一次接触，从安装到走完第一个需求 | 只讲上手，不展开协议细节 |
| 工作流 | 日常用户 | 按入口查写法与边界 | 12 个命令页 + 总览；对话路径优先，CLI 细节归维护者 |
| 概念 | 想懂「为什么」的用户 | 理解证据、目录、宿主差异、知识与记忆机制 | 术语 / 证据 / 目录 / 宿主 / 知识与记忆，共 5 页 |
| 维护者 | 改本仓库的人 | 架构、CLI 参考、写作规范、发布 | 事实源校准页（`commands/cli.md` 按 `src/cli.mjs` 校准） |
| 参考 | 深究者 | 设计文档、执行计划、ADR、历史验收 | 历史产物折叠归组，不与新文档混排 |

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

`npm run verify` 的组成：`ralph:check` + `end:check` + 全量测试 + `check` + `harness:check` + `harness:gc` + `scenario:check` + `host:trial` + `docs:check` + `evaluated:check` + `lab:check`。本地须设绝对 `JJ_LAB_LOOP_ROOT` / `JJ_LAB_FAMILY_ROOT`（或已存在的 `lab-roots.json`）；CI 由 `prepare-lab-roots` 注入。缺根 fail-closed。

改 dispatch 协议额外：`node --test tests/jj-dispatch-contract.test.mjs`；改 ralph 额外：`node --test tests/jj-ralph-contract.test.mjs`。

## Skill SSOT

编辑源为仓库顶层 `skills/`（对话协议）、`agents/`（命名子代理）、`claude-commands/`（Claude 斜杠命令入口，行数门禁 ≤40）。**禁止**把 `.claude/`、`.codex/`、`.cursor/` 当作 SSOT 或推远端。

改后分发到宿主：`node src/cli.mjs install-skill --platform all --force`（五端：codex / claude / qoder / grok / agents）。

派单协议（客服派单）：`jj-ralph` / `jj-same` / `jj-review` 的独占派单固定 spawn `agents/` 命名子代理（`jj-implementer`、`jj-researcher`、`jj-reviewer`），缺失才回退 `general-purpose`；执行人只读派单文件，不读 parent 聊天或 skill `references/`。同一人设 + 同一目录的后续切片用 `resume_from` 续接，不冷启动。

命令行全集见 [CLI 参考](commands/cli.md)（维护/调试用，不写进用户教程）。

## 发布

npm 只走 GitHub Actions `NPM Publish`（`workflow_dispatch`）。`CHANGELOG.md` 由 release-please 维护：已发布段落不再改动，仅 `## Unreleased` 可编辑；边界与条目格式见[写作规范](writing-guide.md)。

## 已移除入口

`$jj-delivery` / `$jj-validate` / `$jj-evolve` — 勿恢复为活入口。  
维护用 `npm run verify`。
