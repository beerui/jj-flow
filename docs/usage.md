# 第一次使用（5 分钟端到端实战）

本页通过一个真实的业务需求，带你完整走完 **`jj-flow` 最核心的单仓闭环（`ralph`） → 代码提交合并（`end`） → 跨仓同源迁移（`same`）** 全流程。

::: tip 本教程使用的示例场景
假设你维护着同一产品的两个前端仓库：
* **项目A**（PC 端仓库）：需要先实现一个新需求——**“登录成功后，如果接口返回密码已过期，弹出改密提醒弹窗”**。
* **项目B**（H5 端仓库）：等项目A 做完验收后，把同一个业务逻辑按 H5 端的组件规范迁移过去。

*(注：下文示例统一写 Codex 的 `$jj-…` 前缀；如果你用 Claude Code、Grok 或 Qoder，把 `$` 换成 `/` 即可，例如 `/jj-ralph`。)*
:::

## 第 0 步：准备工作区（30 秒）

在开始对话前，请确认两件小事：

1. **在正确的仓库根目录打开对话**：先进入 **项目A** 的根目录启动你的 AI 编程工具。
2. **切好功能分支**：Agent 默认在你当前所在的 Git 分支上修改代码，**不会自作主张帮你切换分支**。请先在终端切好本次需求的功能分支：

```bash
cd /path/to/project-a
git checkout -b feat/password-expired-tip
```

如果输入 `$jj-ralph` 或 `/jj-ralph` 时没有看到命令补全，请先按 [1 分钟安装与配置](installation.md) 完成安装。

## 第 1 步：用一句话发起需求（`ralph`）

在对话窗口里直接用日常中文描述你要改什么，不需要记任何任务编号或固定模板：

```text
$jj-ralph 登录成功后，如果接口返回 password_expired 为 true，弹出提示框引导用户去改密；只处理登录成功那条路径
```

如果你手头有明确的边界，也可以分条写得更清楚：

```text
$jj-ralph
目标：登录成功后若 password_expired=true，弹出改密提醒
范围：只改 src/views/login/ 和对应单元测试，不动全局路由守卫
验收：1. password_expired=true 时弹窗显示；2. 点击「去修改」跳转到 /account/password；3. 单测通过
```

## 第 2 步：观察 Agent 如何分五步把事做完

发送后，主对话会扮演 **团队负责人（team-lead）** 的角色：它先和你对齐目标与计划，然后派发专门的子代理去改代码和做审查。整个过程分为清晰的 5 个阶段：

| 阶段 | Agent 在后台做什么 | 你在对话和仓库里会看到什么 |
| :--- | :--- | :--- |
| **1. 对齐（ANALYZE）** | 读取相关代码，确认需求目标与验收标准；若关键范围不明确，会先停下来问你，绝不瞎猜 | 生成 `.workflow/ralph/task-password-expired-tip/task_plan.md`，列出 `## Goal` 与 `## 验收` |
| **2. 计划（PLAN）** | 拆解具体要修改的文件清单与实施步骤 | `task_plan.md` 中补齐清晰的 `## Steps` 勾选列表 |
| **3. 实施与审查（DELIVER）** | 生成精确到文件的派单，调用实现子代理修改代码并跑测试；若是较大改动，还会调用只读审查子代理检查代码质量 | 对话里提示正在派发实施或审查；代码改动出现在工作区；进展写入 `progress.md`；审查结论输出 `[OK]`、`[WARN]` 或 `[BLOCK]` |
| **4. 你的验收（ACCEPT）** | 代码与审查通过后，**主动停下来等你本地试用或确认** | Agent 向你汇报改动摘要与验证结果，询问你是否验收通过 |
| **5. 归档（ARCHIVE）** | 经你确认通过后，锁定最终记录，提炼可复用经验存入本机记忆热层 | 任务文件夹自动移入 `.workflow/ralph/completed/`，并向你输出简短的收尾报告 |

### 真实多轮对话实录

下面是你在对话窗口里实际会经历的交互过程：

**第 1 回合（你提需求 → Agent 完成实施并请你验收）：**

```text
你：
$jj-ralph 登录成功后，如果接口返回 password_expired 为 true，弹出提示框引导用户去改密；只处理登录成功那条路径

Agent：
已对齐需求并写入任务计划 `.workflow/ralph/task-password-expired-tip/task_plan.md`：
- 目标：登录成功响应含 `password_expired: true` 时弹出改密提醒
- 验收标准：
  1. `password_expired === true` 时展示提醒弹窗并支持跳转 `/account/password`
  2. `password_expired === false` 时保持原跳转逻辑不变
  3. 新增对应单元测试并通过

正在派发实现子代理修改 `src/views/login/LoginForm.vue` 与 `tests/login.spec.js`……
[implementer] 已完成代码修改并通过 4 项单元测试。
正在派发审查子代理检查本次改动……
[OK] 审查通过：仅在登录成功回调分支新增 `password_expired` 判空与弹窗逻辑，未污染全局鉴权状态。

请在本地验证效果。如果还需要微调请直接告诉我；如果符合预期，请回复「验收通过」。
```

**第 2 回合（你想顺手改个细节 → Agent 接着同一任务修改）：**

```text
你：
弹窗里的「稍后再说」按钮间距太挤了，把右边距从 8px 改成 12px

Agent：
已在当前任务 `task-password-expired-tip` 上追加一步，正在派发实现子代理更新 `src/views/login/LoginForm.vue` 样式……
[implementer] 已将「稍后再说」按钮右边距调整为 12px（纯样式微调，跳过重复审查）。请确认是否可以验收归档？
```

**第 3 回合（你确认验收 → Agent 自动归档）：**

```text
你：
验收通过

Agent：
任务 `task-password-expired-tip` 已完成归档：
- 归档路径：`.workflow/ralph/completed/task-password-expired-tip/`
- 验收结果：3 项验收标准全部通过
- 沉淀经验：已将登录态扩展字段处理约定写入本机项目记忆 `~/.jj-flow/memory/`
```

## 第 3 步：核对仓库里的真实凭据

在 `jj-flow` 中，**不要只相信聊天框里的文字总结**，你可以随时用 10 秒钟核对仓库里的三样东西：

1. **看代码改动（`git status` / `git diff`）**：确认只改了预期内的业务文件。
2. **看任务合同（`.workflow/ralph/completed/task-…/task_plan.md`）**：确认 `## 验收` 和 `## Steps` 下的复选框 `[x]` 均已完成。
3. **看过程流水（`progress.md` 与 `findings.md`）**：确认测试命令真正执行过，且没有遗留未解决的 `[BLOCK]` 审查问题。

## 第 4 步：提交代码或迁往兄弟仓库

当项目A 的需求归档后，你通常有三条后续路径，直接用一句话就能衔接：

### 路径 A：觉得还有遗漏，想继续改

哪怕任务已经归档进了 `completed/`，只要还是同一件事，你**不需要记任务编号**，直接在对话里说：

```text
$jj-ralph 刚才那个密码过期弹窗，点击遮罩层的时候不要关闭弹窗
```

Agent 会自动从索引中找回刚才那条任务，重新拉回活跃状态接着改。

### 路径 B：单仓做完了，提交并合并到 `dev` 分支（`end`）

`ralph` 为了安全，绝不会自动帮你 `git commit` 或 `git push`。当你想把代码正式提交并合入集成分支时，输入：

```text
$jj-end
```

Agent 会先打印一行收工计划（例如 `feat/password-expired-tip → dev`），只提交本次任务涉及的文件，推送工作分支，切到 `dev` 同步合并并推送，最后安全切回你的工作分支。详见 [end · Git 提交与合并](commands/jj-end.md)。

### 路径 C：把这个能力同步迁移到项目B（`same` 或 `dispatch`）

**注意：跨仓迁移前，请务必先在源仓库（项目A）完成 `git commit`！** 提交后，根据仓库数量二选一：

* **直接迁往一两个兄弟仓（用 `same`）**：
  ```text
  $jj-same 交接到 项目B
  ```
  Agent 会读取项目A 刚归档的交接信息，先去项目B 调研它的登录组件写法，再按项目B 自己的代码风格完成适配与测试。详见 [same · 跨仓同源迁移](commands/jj-same.md)。
* **一次涉及三四个以上项目，想先看预览表再统一批准（用 `dispatch`）**：
  ```text
  $jj-dispatch 把密码过期提醒预览分发到 项目B、项目C
  ```
  Agent 会先列出一张只读的分支与状态预览表，等你说“批准”后再正式派发。详见 [dispatch · 多仓统筹调度](commands/jj-dispatch.md)。

## 新手最容易踩的 3 个坑

::: warning 动手前看一眼，省去 90% 的返工
1. **源仓库还没 `git commit` 就去跨仓迁移**：`same` 和 `dispatch` 都需要锁定源仓库的 commit 哈希作为基线证据；未提交时会被门禁直接拦下。
2. **没看目标仓库在什么分支就开始迁移**：如果项目B 当前停在 `master` 或错误的旧分支上，直接迁移会污染分支（`same` 发现分支不对时也会停下来问你）。
3. **看到 `dispatch` 提示“验收通过（VERIFIED）”就以为代码已经上线**：调度验收通过只代表本地代码、测试与审查证据齐备，**不代表已经 `git push` 或合入 `dev`**；远端收尾请调用 `$jj-end`。
:::

::: details 内部机制备查（供维护者与高级用户参考）
* 在对话路径下，主会话固定扮演 `team-lead`，负责对齐 `task_plan.md`、编写 `assignments/ASSIGNMENT-*` 派单并调用命名子代理（`jj-implementer`、`jj-reviewer`、`jj-researcher`），不在主会话直接修改业务代码，也不调用机械 CLI `ralph_ops`。
* 子代理派遣宣告、同目录占位与 `resume_from` 续接协议统一由 `skills/jj/references/assignment-spawn.md` 规定。
* 若在分析或实施途中遇到 MUST / 范围 / 验收事后仍确认不了（先问，不要凭猜测推进），Agent 会停在当前阶段向你提问。
:::

## 相关阅读

* [命令总览与选型指南](commands.md)
* [ralph · 单仓任务闭环详解](commands/jj-ralph.md)
* [常见避坑与自检清单](pitfalls.md)
* [核心术语对照表](glossary.md)
