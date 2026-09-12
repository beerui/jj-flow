# jj-flow agent rules

- `jj-flow` 是 **项目族编排工作流**（接入 `jj-init` + 同源迁移 same + 单仓闭环 ralph + 多项目调度 dispatch；可选会话多角色 `jj-team-coordinate` / 固定 SDLC `jj-team-lifecycle` / 对抗蚁群 `jj-team-swarm`，均不推进 checkpoint）。
- 代码定位先读 `ARCHITECTURE.md`；跨模块目标设计从 `docs/design-docs/index.md` 进入。仓库事实以 `harness-manifest.json` 索引的 versioned 资产为准。
- **文档优化先读 `docs/writing-guide.md`**：涉及"优化文档""改文案""审查中文表述""整理发版日志"时，必须先读该规范再动手；改 `CHANGELOG.md` 注意 release-please 边界（已发布段落需维护者批准）。
- **Skill 多端 SSOT**：编辑源为顶层 `skills/<id>/`、`agents/`、`claude-commands/`（**禁止**把 `.claude`/`.codex`/`.cursor` 当仓库 SSOT 或推远端）。`jj install-skill` 分发到宿主 skills（含 `~/.claude/skills` + commands + agents、`~/.agents/skills` + commands、`~/.codex/agents`、`~/.grok/agents`）。清单见 `skill-inventory.json`；改后 `node src/cli.mjs install-skill --platform all --force`。
- **客服派单 = 会话工人身份**：`jj-ralph`/`jj-same`/`jj-review` 的独占派单固定 spawn `agents/` 命名子代理（`jj-implementer`、`jj-researcher`、`jj-reviewer`），缺失时才回退 `general-purpose`；工人只读独占派单文件，不读 parent 聊天或 skill `references/`。同 persona + 同 cwd 的后续切片用 `resume_from` 续接，不冷启动。
- 项目族交付以控制面 manifest、ralph `run.json`、Git commit、verification/review artifact 和 runtime sandbox attestation 为事实来源；聊天正文、thread 状态和 memory 不能推进 checkpoint。
- Reviewer 必须保持 `read-only`，只输出可追溯 findings；Developer 只能在批准的目标项目写工作区（默认 `project-branch` 主路径，isolation 时 `exclusive-worktree`）中处理当前 `task_key`。
- 用户可见的控制任务是可恢复调度身份；临时 subagent 只在任务内部做探索、文档核对或并行只读工作，不得创建控制任务、修改批准快照或成为持久 thread identity。
- 代码与资料定位使用 Read、Glob、Grep、Bash、`rg` 或已批准的 skill。若宿主已挂 **CodeGraph** MCP 且当前仓索引可用（`.codegraph/` / `codegraph status` 健康），结构探索（调用链、影响面、跨文件入口）可优先走图谱；缺省或失败立即回退。图谱输出不推进 checkpoint、不替代验证证据。
- 控制平面中的 `delivery_id` 是多项目调度任务身份，不是对话 skill 入口。
- **npm 发布只走 GitHub Actions `NPM Publish` 工作流**（`workflow_dispatch`，tag 通常为 `beta`）；不要用本地 `npm publish`（本机 token 非事实源，易 401/404）。推送版本 commit 到 `main` 后触发 Actions，确认 `run_verify=true` 通过后再发布。
- 修改调度协议后至少运行 `node --test tests/jj-dispatch-contract.test.mjs`、`npm run verify` 和 `git diff --check`；修改 ralph 后至少运行 `tests/jj-ralph-contract.test.mjs`。

## Host compatibility（Grok ↔ Claude Code / AGENTS）

- **Grok 与 Claude Code 零配置兼容**：无需额外 setup，即可自动读取 Claude Code 的 marketplaces、plugins、skills、MCPs、agents、hooks，以及指令文件 `CLAUDE.md` / `Claude.md` / `CLAUDE.local.md` / `.claude/rules/`（与 `.grok/` 并行）。
- **AGENTS.md 族**：从 cwd 向上走到 repo root 读取 `AGENTS.md` / `Agents.md` / `AGENT.md`。
- **用户级发现路径**：`~/.agents/skills/`、`~/.agents/commands/`（以及 Claude 侧同类资产）。
- **因此 Claude 侧 mem / MEMORY / 共享 skill·command·agent 说明在 Grok 会话中可用**，当作跨宿主上下文与工具发现来源；**仍不得**用 chat/thread/memory 推进 ralph / dispatch / evaluated 的 checkpoint。

## 核心路径

`src/` 是本项目核心源码目录（控制面、调度运行时、CLI、验证逻辑均在此处）。对 `src/` 下文件的变更必须：

1. 运行 `npm run verify`（含 lint + 全量测试）确认管线通过；
2. 运行与变更相关的合约测试（如 `tests/jj-dispatch-contract.test.mjs`、`tests/jj-ralph-contract.test.mjs`）；
3. 在 commit 或 PR 描述中注明受影响的合约测试结果。

## 任务规范
1. Break down sessions into separate clear, actionable tasks. Don't try to "draw the owl" in one mega session.
<!-- 将课程内容分解成一个个清晰、可执行的任务。不要试图在一次大型课程中“画出猫头鹰”。 -->
2. For vague requests, split the work into separate planning vs. execution sessions.
<!-- 对于模糊不清的需求，将工作分成单独的计划阶段和执行阶段。 -->
3. If the task, merge, or requirement is unclear — ask first. Do not invent, do not pick a side, do not land.
<!-- 任务、合并、需求说不清就先问。不要臆造、不要挑一边、不要收工落地。 -->
4. If you give an agent a way to verify its work, it more often than not fixes its own mistakes and prevents regressions.
<!-- 如果你给代理提供验证其工作的方法，它通常会自行纠正错误并防止倒退。 -->

## 核心目标

你是在大模型外面的一整套工程系统：

- 给 Agent 提供工具、代码仓库和上下文
- 拆分任务、规划步骤
- 让多个 Agent 协作
- 运行测试、检查结果、发现错误后重试
- 控制权限、隔离上下文和避免失控
- 保存记忆、压缩上下文、管理长时间任务
