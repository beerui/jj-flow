# 核心术语对照表

本页将 `jj-flow` 文档、日志与状态文件中可能出现的术语，按**“工作流入口 → 任务与跨仓调度 → 工作模式与角色 → 目录与记忆”**四个维度整理成通俗解释，方便随时查阅。

## 一、核心工作流术语

| 术语 / 命令名 | 日常怎么理解 | 详细说明与关联入口 |
| :--- | :--- | :--- |
| **项目族（Project Family）** | 同一个产品拆出来的多个关联仓库 | 例如 PC 前台（**项目A**）、H5 端（**项目B**）、管理后台（**项目C**）。它们共享同一套业务概念，但各自有独立的代码树与组件库。 |
| **`init`（项目地图接入）** | 让 `jj-flow` 认识本地仓库 | 将当前仓库或指定目录下的子仓库登记到 `~/.jj-flow/map.md`，并按需导入历史经验（须经你确认后写入）。详见 [init](commands/jj-init.md)。 |
| **`ralph`（任务闭环）** | 在**当前单个仓库**做需求的五步流程 | 固定经历 **分析 → 计划 → 实施 → 验收 → 归档** 五步，记录保存在仓库 `.workflow/ralph/` 下。详见 [ralph](commands/jj-ralph.md)。 |
| **`same`（跨仓同源迁移）** | 把项目A 做好的功能**适配**到项目B | 不生搬硬套原文件，而是读取源仓库改动后，按目标仓库自己的组件风格与架构实现并验证。详见 [same](commands/jj-same.md)。 |
| **`dispatch`（多仓统筹调度）** | 多个仓库先看预览表、统一批准再分派 | 在本机 `~/.jj-flow` 维护多项目调度账本，支持中断续跑与逐仓验收跟踪。详见 [dispatch](commands/jj-dispatch.md)。 |
| **`review`（只读代码审查）** | 派只读审查员挑毛病并落盘结论 | 输出 `[OK]`、`[WARN]` 或 `[BLOCK]`，绝不直接改业务代码。详见 [review](commands/jj-review.md)。 |
| **`end`（Git 收工）** | 一键提交、推送并合并到 `dev` | 自动拉取最新 → 提交本任务文件 → 推工作分支 → 合入 `dev` 并推送 → 切回工作分支。详见 [end](commands/jj-end.md)。 |
| **会话执行引擎（`team-*`）** | 可选的多角色分析或方案搜索工具 | 包含 [team-coordinate](commands/jj-team-coordinate.md)（动态多角色）、[team-lifecycle](commands/jj-team-lifecycle.md)（固定 SDLC）、[team-swarm](commands/jj-team-swarm.md)（多方案对抗搜索）。**它们只辅助本轮执行，不代替 `ralph` 或 `dispatch` 的正式验收。** |
| **`evaluated`（离线复盘）** | 用真实交付导出记录做耗时与返工诊断 | 实验性离线评估工具，生成复盘报告供人工改进技能协议。详见 [evaluated](commands/jj-evaluated.md)。 |

## 二、任务状态与跨仓调度术语

| 术语 / 状态词 | 日常怎么理解 | 关键边界说明 |
| :--- | :--- | :--- |
| **证据（Evidence）** | 仓库里可核对的真实记录 | 包含 Git 提交、`task_plan.md`、`progress.md`、只读审查文件 `REV-*.json` 与调度回执。**聊天框里口头说“改完了”不算证据。** |
| **交接包（`handoff`）** | 从源仓库提炼出的跨仓迁移说明 | 记录在源任务 `.state/run.json`（及 `.state/handoff.json`）中，写明改了什么、哪些该迁、哪些禁止照搬，供 `same` 读取。 |
| **`VERIFIED`（调度验收通过）** | 目标仓库在调度账本里已集齐全部本地凭据 | 需同时具备：Git 提交 + 审查通过 + 真实会话绑定 + 沙箱证明。**注意：`VERIFIED` 不等于代码已 `git push` 到远端。** |
| **`PENDING` / `BLOCKED`** | 证据还不齐 / 遇到阻塞停下等你确认 | 只要缺少凭据或存在未确认项，系统就会保持 `PENDING` 或 `BLOCKED`，绝不伪装成已通过。 |
| **`DEL-*`（Delivery 编号）** | 一次“多项目统筹交付”的账本编号 | 例如 `DEL-20261013-pnpm`，由 `dispatch` 自动生成维护，不需要你手动输入。 |
| **`task_key` / `run_id`** | 单个任务的稳定标识 | 单仓任务形如 `task-login-reminder`；多仓调度子任务形如 `DEL-001/A/development/1`。用于中断后精准续接，日常对话无需背诵。 |
| **`completed/`** | 已完成归档或已废弃的任务目录 | 位于 `.workflow/ralph/completed/`。即使进了 `completed/`，只要是同一需求想微调，直接说就能接着改。 |

## 三、宿主工作模式与子代理角色

| 术语 / 标识 | 日常怎么理解 | 详细说明 |
| :--- | :--- | :--- |
| **团队负责人（`team-lead`）** | 你当前正在对话的主窗口 Agent | 负责和你对齐需求、维护 `task_plan.md`、编写派单并调度子代理；主对话自己不直接动手改业务代码。 |
| **派单（`ASSIGNMENT-*`）** | 写给子代理的精确任务单文件 | 保存在任务目录 `assignments/` 下（分 `TASK`、`REVIEW`、`FIX`、`RESEARCH`、`HANDOFF` 五类）。子代理只读派单里点名的精确文件，不翻看主对话聊天记录。 |
| **执行人（Subagents）** | 被主对话派出去干活的命名子代理 | 包括 `jj-implementer`（写代码）、`jj-reviewer`（只读审查）、`jj-researcher`（只读调研）。派遣宣告、占位与 `resume_from` 续接规则见 `skills/jj/references/assignment-spawn.md`。 |
| **Mode S（单会话模式）** | Claude / Grok 默认工作方式 | 在同一个对话窗口内完成所有调度；不同仓库可同时派发执行人并行修改，同一仓库内部保持串行。 |
| **Mode W（隔离工作区模式）** | 使用独立 Git worktree + 命名功能分支 | 仅在主工作区存在无法清理的无关脏文件、或你明确要求物理隔离时使用。 |
| **Mode P（独立子会话模式）** | 每个写任务绑定一个独立子会话 | 仅在你显式点名要求 `1:1` 独立子会话时启用（不同仓库并行修改并不需要先开 Mode P）。 |
| **沙箱证明（Sandbox Attestation）** | 宿主运行时留下的真实执行凭据 | 用于在 `dispatch` 中证明代码确实在受控工作区与指定权限下执行，而非模型口头虚构。 |

## 四、目录与知识记忆术语

| 术语 / 路径 | 日常怎么理解 | 详细说明 |
| :--- | :--- | :--- |
| **项目地图（`~/.jj-flow/map.md`）** | 本机所有业务仓库的通讯录 | 记录每个仓库的中文名、别名、绝对路径与所属项目族，供 `same` 和 `dispatch` 按名字精准定位仓库。 |
| **记忆热层（`~/.jj-flow/memory/<project_key>.md`）** | 每个项目专属的“高频踩坑与经验便签” | `ralph` 任务归档时自动从 `findings.md` 提炼可复用结论存入此处；下次在该项目开新任务时自动按需注入。 |
| **全局知识库（`~/.jj-flow/knowledge/`）** | 跨项目共享的沉淀规范库 | 只有当你在 `init` 或 `ralph` 中主动提出并确认后，才会写入全局知识库。 |
| **`events.jsonl`** | 机器可读的事件流水账 | 位于 `.workflow/ralph/<task>/.state/events.jsonl`，供状态机校验门禁使用；日常人类查看进度请读 `progress.md`。 |

## 相关阅读

* [证据门禁：什么算做完](concepts-evidence.md)
* [目录结构与文件布局](concepts-paths.md)
* [宿主平台与工作模式](concepts-hosts.md)
* [系统架构总览](architecture.md)
