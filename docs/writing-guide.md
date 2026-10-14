# 文档写作与优化规范

本文件是 **面向维护者与模型（Agent）的中文文档写作与审查规范**。当任务涉及“优化文档”、“修改文档文案”、“新增命令说明”或“整理发版日志”时，**必须先阅读本规范**，再修改 `CHANGELOG.md`、`docs/**/*.md` 等中文文档。

## 1. 适用范围与分层原则

| 文档类型 | 仓库路径 | 维护与语言规范 |
| :--- | :--- | :--- |
| **用户与维护者文档** | `docs/**/*.md` | VitePress 站点中文源文件；正文必须以**人类读者视角**编写，清晰区分“用户操作”与“底层机制” |
| **发版日志** | `CHANGELOG.md`（经 `docs/changelog.md` 与 `docs/changelog-archive.md` 投影发布） | 受 release-please 约束（见 §4），仅编辑 `## Unreleased` |
| **Skill 运行时协议** | `skills/**/SKILL.md`、`skills/**/references/*.md` | 英文单一真源（SSOT）；面向模型执行，不直接照搬粘贴到中文用户教程正文 |
| **Claude 斜杠命令入口** | `claude-commands/*.md` | 轻量引导入口，受行数门禁（≤40 行）约束 |
| **仓库级导航地图** | `AGENTS.md`、`ARCHITECTURE.md` | 受 `harness-manifest.json` 行数上限约束，修改后需同步事实层 |

::: info 历史归档文件豁免原则
已完成的历史执行计划（`docs/exec-plans/completed/**`）、已完结设计文档（`docs/design-docs/**`）与 `CHANGELOG.md` 中已发布的带时间戳版本段落**不回溯改写**；所有新撰写或重构的活跃文档均须遵循本规范。
:::

## 2. 用户文档结构与叙事准则

为了让首次接触 `jj-flow` 的开发者能在 5 分钟内看懂并用起来，所有工作流命令页（`docs/commands/jj-*.md`）应遵循以下结构准则：

1. **先讲人话定位，后讲细节**：开篇第一段必须用一句话说明“这个命令帮你解决什么问题、边界在哪”，并给出 Codex（`$jj-…`）与 Claude / Grok（`/jj-…`）的调用写法。
2. **分离“用户动作”与“Agent 内部机制”**：
   * 正文主线严格围绕**“前置准备 → 你输入什么 → Agent 做什么 → 你会看到什么结果 → 下一步怎么接”**展开。
   * 涉及子代理命名、派单文件格式、内部脚本名等底层协议细节，统一放入页面底部的 `::: details 内部机制与协议参考` 折叠块或归入维护者章节，避免干扰新手阅读。
3. **必须提供端到端多轮对话示例**：不要只放孤立的一句命令，应展示“第 1 轮用户输入 → Agent 响应与落盘产物 → 第 2 轮确认或续接”的完整闭环。
4. **善用 VitePress 视觉容器**：合理使用表格、`::: tip`、`::: info`、`::: warning`、`::: danger` 与 `::: details` 提升扫读体验。

## 3. 中文用词与排版总则

### 3.1 书面化用词对照（禁用生僻黑话与口语动词）

面向外部读者的文档统一使用自然、规范的书面技术中文。避免使用内部口语黑话：

| 禁用（口语 / 内部黑话） | 改用（清晰书面语） |
| :--- | :--- |
| 跑（跑 ralph_ops / 跑测试） | 执行 / 运行 |
| 搬（搬进 completed/） | 移动到 / 迁入 |
| 吃（只吃该文件 / 不吃聊天） | 读取 / 消费 |
| 清掉（清掉残留） | 清理 |
| 长出（长出“已落地”） | 生成 / 写入 |
| 钉（钉 high / 钉死） | 固定为 / 锁定 |
| 干等 | 静默等待 |
| 挡（仍挡连败） | 拦截 / 阻断 |
| 喊（怎么喊 / 装好后怎么喊） | 调用 / 调用写法 |
| 工人（实施工人 / 审查工人） | 执行人 / 子代理（实施子代理 / 审查子代理） |
| 入职（入职 prefix / 调研入职） | 人设提示词 / 派单前缀 |
| 单仓 / 单仓闭环 | 当前仓库任务 / 单仓任务闭环 |
| 一刀 / 上一刀 / 每片 | 一轮 / 上一轮 / 每个切片 |
| 活着的工人 / 活着的 reviewer | 运行中的执行人 / 运行中的审查子代理 |
| 你点头才写 / 须你同意才投喂 | 经你确认后写入 |

### 3.2 中英文混排与标点规范

1. **保留精准英文术语**：如 `run`、`gate`、`spawn`、`commit`、`diff`、`PASS` / `FAIL` / `BLOCKED`、`run_id`、`task_key`、`worktree`；首次出现时可括注中文解释（如 `sandbox attestation（沙箱证明）`）。
2. **中英文之间加空格**：中文字符与英文单词、数字、行内代码反引号之间统一保留一个半角空格（例如：`派发 jj-reviewer 子代理`、`超过 5 条任务`）。
3. **并列分隔符**：中文并列项统一使用顿号 `、`（如 `COMPLETED、ABANDONED、PAUSED`），不在正文中用中点 `·` 连接并列词。
4. **严禁裸露双花括号**：VitePress 会把非围栏代码块中的双花括号解析为 Vue 模板插值，正文与行内代码中均严禁出现双花括号。
5. **消除悬空指代与同名文件歧义**：引用仓库内文件时，若存在同名文件（如多个目录下都有 `SKILL.md`、`index.md`、`state.mjs`），在行内代码中应写出带目录的相对路径（如 `` `skills/jj-ralph/SKILL.md` ``、`` `src/ralph/state.mjs` ``），避免产生 `pointer-basename-ambiguous` 警告。

## 4. CHANGELOG 专项规范

### 4.1 release-please 维护边界

* `CHANGELOG.md` 由 release-please 负责发版归档。**所有已发布的带时间戳版本段落（形如 `## <版本> — <YYYY-MM-DD HH:mm>`）严禁改动**。
* 日常仅允许编辑顶部的 `## Unreleased` 段落：
  * 当没有待发布条目时，`## Unreleased` 下方只写一行纯文本 `暂无。`（严禁写成 `- 暂无` 列表项，否则发版时会被当成更新条目发布）。
  * 新增待发布条目时，删掉 `暂无。`，按 `- **主题**：完整陈述。合约：...` 格式编写。
* 每次修改 `CHANGELOG.md` 后，必须运行 `node scripts/sync-changelog-pages.mjs` 将内容投影同步至 `docs/changelog.md` 与 `docs/changelog-archive.md`。

## 5. 提交前自检与验证清单

完成文档修改后，请依次执行以下命令确认全部通过：

```bash
# 1. 校验侧栏覆盖、GFM 表格语法、CHANGELOG 切分与 VitePress 完整构建
npm run docs:check

# 2. 检查仓库 Harness 契约与必需链接
npm run harness:check

# 3. 检查是否存在同名文件裸引用歧义
npm run docs:pointers

# 4. 运行文档与资产合约测试
node --test tests/docs-site.test.mjs tests/ralph/assets.contract.mjs tests/jj-same-contract.test.mjs tests/jj-review-contract.test.mjs
```
