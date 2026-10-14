# 仓库与文档维护指南

本页供**参与开发、调试或修改 `jj-flow` 仓库本身**的维护者查阅。

## 一、文档站架构与单一真源（SSOT）

`jj-flow` 文档站基于 **VitePress** 构建，所有站点规则与仓库 `harness-manifest.json` 机械绑定：

| 层级 | 仓库路径 | 维护规则 |
| :--- | :--- | :--- |
| **文档正文** | `docs/**/*.md` | 直接编辑 Markdown；页面间内链统一使用**源文件相对路径**（如 `../commands/jj-ralph.md`） |
| **站点配置与主题** | `docs/.vitepress/config.mjs`<br>`docs/.vitepress/sidebar.mjs`<br>`docs/.vitepress/redirects.mjs`<br>`docs/.vitepress/theme/` | 分别管理站点导航/搜索配置、五组侧栏结构、旧 URL 静态重定向映射表以及自定义主题样式 |
| **构建产物** | `site/` | 由 `npm run docs:build` 生成，由 GitHub Actions 自动部署至 GitHub Pages，**禁止手动编辑或提交入库** |
| **自动化门禁** | `scripts/check-docs.mjs`<br>`scripts/lint-doc-tables.mjs`<br>`scripts/lint-doc-pointers.mjs` | 包含侧栏双向覆盖校验、GFM 表格结构检查、更新日志双页切分校验与 VitePress 死链构建检查 |

### 新增或修改文档页面的流程

1. **新增顶层或命令页面**：在 `docs/` 下创建 `.md` 文件，并在 `docs/.vitepress/sidebar.mjs` 对应分组中添加一行链接（若漏加侧栏，`npm run docs:check` 与 `npm run harness:gc` 会立即报错阻断）。
2. **新增深层参考文档**：在 `docs/design-docs/`、`docs/exec-plans/active/`、`docs/exec-plans/completed/` 或 `docs/adr/` 下新增 `.md` 文件时，侧栏会自动按目录扫描生成（取文件首个 `# ` 一级标题），但**必须同步登记到对应目录的 `index.md`**（受 `harness:check` 门禁检查）。
3. **两条核心排版禁令**：
   * **禁止在正文或行内代码中直接写双花括号**：VitePress 会将非代码块内的双花括号当作 Vue 模板插值解析导致构建失败（仅围栏代码块内部安全）。
   * **更新日志双页同步**：根目录 `CHANGELOG.md` 是 release-please 的唯一真源，站点通过 `docs/changelog.md`（近期）与 `docs/changelog-archive.md`（归档）两页发布（避免单页超大导致 VitePress 打包内存溢出）。每次修改 `CHANGELOG.md` 后，必须运行 `node scripts/sync-changelog-pages.mjs` 重新投影这两页，且 `CHANGELOG.md` 内部链接一律使用完整绝对 URL。

### 修改不同模块时的同步清单

| 你要修改的内容 | 需要同步更新的文件 |
| :--- | :--- |
| **新手引导与安装方式** | `docs/index.md`、`docs/installation.md`、`docs/usage.md` |
| **工作流协议与命令行为** | 先改 `skills/jj-*/SKILL.md`（英文协议真源），再同步更新 `docs/commands/jj-*.md`（中文用户说明） |
| **系统架构与模块划分** | 同步更新根 `ARCHITECTURE.md` 与 `docs/architecture.md` |
| **设计方案与执行计划** | 在 `docs/design-docs/` 或 `docs/exec-plans/` 下更新，并同步维护对应的 `index.md` 状态 |

## 二、全站文档受众与章节分工

| 侧栏分组 | 目标受众 | 内容定位与边界 |
| :--- | :--- | :--- |
| **开始** | 首次接触的新用户 | 从 1 分钟安装到 5 分钟跑通第一个完整需求，聚焦操作步骤与避坑清单，不堆砌底层状态机名词 |
| **工作流** | 日常使用对话命令的开发者 | 涵盖命令总览与 11 个工作流入口详解；以对话交互为主线，底层协议细节收入折叠块，CLI 子命令统一归入维护者参考 |
| **概念** | 想理解底层原理的开发者 | 解释核心术语、证据门禁、目录结构、宿主模式（Mode S / W / P）与双层知识记忆机制 |
| **维护者** | 修改 `jj-flow` 仓库的维护者 | 系统架构、CLI 完整参数参考（与 `src/cli.mjs` 对齐）、文档写作规范、部署与实验场规范 |
| **参考** | 查阅设计历史与验收证据的人员 | 折叠收纳所有设计文档（Design Docs）、执行计划（Exec Plans）、架构决策（ADR）与历史里程碑验收报告 |

## 三、开发与验证命令速查

```bash
npm run docs:dev
npm run docs:check
npm run docs:build
npm run docs:preview
npm run verify
npm run lab:check
npm run harness:gc
```

* **本地实时预览文档**：运行 `npm run docs:dev`（支持热更新；WSL 环境下自动切换为轮询监听）。构建后预览请运行 `npm run docs:preview`（站点带有 `/jj-flow/` 路径前缀，不能直接双击打开 `site/index.html`）。
* **全量门禁链（`npm run verify`）**：依次执行 `ralph:check` + `end:check` + 全量单元测试 + `check` + `harness:check` + `harness:gc` + `scenario:check` + `host:trial` + `docs:check` + `evaluated:check` + `lab:check`。
  * 注意：本地运行全量 `verify` 或 `lab:check` 时，必须先配置存在的绝对路径环境变量 `JJ_LAB_LOOP_ROOT` 与 `JJ_LAB_FAMILY_ROOT`（或配置本地 `lab-roots.json`），详见 [实验场 Sibling 仓库规范](jj-lab-siblings.md)。
* **专项合约测试**：
  * 修改 `dispatch` 协议后可单独运行：`node --test tests/jj-dispatch-contract.test.mjs`
  * 修改 `ralph` 协议后可单独运行：`node --test tests/jj-ralph-contract.test.mjs`

## 四、技能资产单一真源（Skill SSOT）与子代理派单

* **唯一编辑源**：仓库顶层的 `skills/`（对话协议）、`agents/`（命名子代理）、`claude-commands/`（Claude 斜杠命令薄包装，行数 ≤40 行）。**严禁**把本地 `.claude/`、`.codex/`、`.grok/` 安装目录当作真源或提交入库。
* **本地分发测试**：修改 `skills/` 或 `agents/` 后，可执行 `node src/cli.mjs install-skill --platform all --force` 刷新本机宿主入口。
* **便携脚本同步**：
  * 修改 `src/ralph.mjs` 或 `src/ralph/*` 后，必须运行 `npm run ralph:sync` 同步至 `skills/jj-ralph/scripts/lib/`。
  * 修改 `src/end.mjs` 或 `src/endCli.mjs` 后，必须运行 `npm run end:sync` 同步至 `skills/jj-end/scripts/lib/`。
* **子代理派单契约**：`jj-ralph`、`jj-same`、`jj-review` 在对话路径下固定派发 `agents/` 中的命名子代理（`jj-implementer`、`jj-researcher`、`jj-reviewer`），子代理仅读取独占派单文件，不读取父会话聊天记录。完整派遣宣告、占位与续接规则定义在 `skills/jj/references/assignment-spawn.md`，本页不再重复。

## 五、版本发布与历史废弃入口

* **NPM 发布**：仅通过 GitHub Actions 的 `NPM Publish` 工作流（`workflow_dispatch`）发布，不依赖个人本机 `npm publish` token。
* **发版日志管理**：根目录 `CHANGELOG.md` 由 release-please 自动维护。已发布的带时间戳版本段落严禁回溯改动，日常仅可编辑 `## Unreleased` 段落（格式规范见 [文档写作规范](writing-guide.md)）。
* **历史已移除入口**：早期的 `$jj-delivery`、`$jj-validate`、`$jj-evolve` 均已移除，请勿在代码或文档中恢复为活跃入口；仓库自检统一使用 `npm run verify`。
