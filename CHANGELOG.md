# Changelog

## 0.1.1-beta.22

- control plane 在 `intake.status=REQUIRED` 时 fail-closed，必须确认项目归属和目标集合后才能 PREVIEW / APPROVE。

## 0.1.1-beta.21

- 在 `jj --help` 中公开标准任务 `task scaffold` 入口。

## 0.1.1-beta.20

- 新增标准任务资产 scaffold：非 quick 任务生成 `.workflow/tasks/<TASK-ID>/` 下的任务、计划、进度和结果 Markdown。
- dispatch task plan、approval、intent 和 Codex App host action 自动携带结构化 `distribution_prompt` 与 `initial_prompt`。
- 增加 control intake、handoff/dispatch/report/receipt 按任务 ID 分目录和源任务完成后的推荐分发规则。

## 0.1.1-beta.19

- 修复 Windows `core.autocrlf=true` 的 fresh clone 中 Harness runner fingerprint 因 `LF/CRLF` 差异误判过期的问题；fingerprint 现在按规范化文本计算，并增加跨行尾回归测试。

## 0.1.1-beta.18

- 新增 `jj uninstall-skill`，支持 Codex/Claude、project/target、dry-run 和 JSON 输出；通过安装 ownership manifest 与 SHA-256 摘要保护本地修改，并可安全清理 `jj-validate` 等 8 个历史入口。
- 加固 Harness manifest、schema、机械检查与成熟度评分，补齐版本化 exec plan 和 98/A 基线，持续检测文档、资产、验收证据与仓库事实漂移。
- 新增只读 Harness Gardener workflow，仅允许创建维护 issue，不授予代码写入或自动修复权限。

## 0.1.1-beta.17

- 引入 repository-native Harness：`ARCHITECTURE.md`、`harness-manifest.json`、`jj doctor` 和机械边界检查，仓库事实不再依赖 `.workflow` 或本机 memory。
- 新增确定性 scenario、trace/replay、`jj-same` handoff 契约，以及使用真实临时 Git/worktree、CAS、中断恢复和 Review 返工的半真实 Host trial。
- 新增只读 `harness:gc`、100 分质量评分和版本化 H5 基线；P0/P1 阻断，P2/P3 仅形成维护候选，禁用自动修复。
- 补齐 Harness Engineering 设计、ADR、H4/M7 与 H5 验收文档，并将全部门禁接入 `npm run verify`。

## 0.1.1-beta.16

- 文档站：嵌套页相对路径修复、表格/粗体渲染、导航与样式可读性增强、首页 3 步路径；维护说明写清文档所有权；`tests/docs-site.test.mjs` 覆盖主路径与 docs:check。
- dispatch 运行时：分析 receipt 先消费、目标独立 ADAPT/NO_CHANGE/BLOCKED 门禁、resume 调和 pending intent、CAS 写锁不误删他人 lock。

## 0.1.1-beta.15

- 产品定位调整：`jj-flow` 定位为 **项目族编排工作流**（same / dispatch），不再以「Maestro 适配层」为对外简介；Maestro 为可选执行工具。同步 README、架构、规划、AGENTS、package 描述与文档站标语。
- 一并发布尚未上架的 beta.14 能力：dispatch 可恢复 tick/CAS、目标独立差异门禁、M6 验收文档。

## 0.1.1-beta.14

- 加固 `$jj-dispatch` 运行时：resume 重放 `PENDING_THREAD` 的 `CREATE_THREAD` actions；目标差异决策按项目独立门禁；receipt `attempt` 与 `task_key`/intent 绑定；`persistPlaneCas` 真 CAS 写回。
- 移除 `dispatch-tick --no-target-analysis`；目标 ANL-TARGET 不可绕过。
- 关闭 M6（P11/P12）：验收报告 `docs/milestones/m6-acceptance.md`；下一里程碑 M7 为真实控制项目试跑。


## 0.1.1-beta.13

- **Breaking**：移除 `jj-delivery` / `jj-validate` / `jj-evolve` 原生命令、recipe 与文档入口。
- 用户可见原生命令收敛为 `jj-same`（同源迁移/持续同步）与 `jj-dispatch`（多项目调度，Codex-only）；兼容入口 `jj` 默认路由到 `same`。
- 控制平面 `delivery_id` 保留为调度任务身份，不再对应 `$jj-delivery` 对话入口。
- 维护 jj-flow 自身改为直接改仓 + `npm run verify`；删除 `projectEvolution` 与相关测试。
- 同步更新 Codex skills、Claude commands、CLI help、文档站导航与回归测试。

## 0.1.1-beta.12

- 移除 `jj-feat` / `jj-fix` / `jj-knowhow` / `jj-auto` / `jj-review` 原生命令与 recipe；明确功能、线上修复、交付前审查与不确定意图统一走 `jj-delivery`。
- 知识沉淀与独立 review 入口不再提供；审查走 delivery 内 `$quality-review`，沉淀可按需调用 `$manage-knowhow-capture`。
- 全部流程禁止调用 `maestro explore`；代码定位改用定点读取与搜索工具。
- 同步更新 Codex skills、Claude commands、文档、安装校验与回归测试。

## 0.1.1-beta.11

- 新增独立项目族控制平面，支持动态 `origin_project`、`requirement_owner`、`lead_project` 和多个目标项目的可恢复派发。
- 新增只读 Reviewer 与可写 Developer 双角色闭环，支持结构化 findings、`NEEDS_CHANGES` 重工、递增 attempt 和 Review PASS 门禁。
- 收紧 sandbox attestation、terminal writer、NO_CHANGE、checkpoint、结果防重放和 skipped dependency 等运行时与公开 Schema 约束。
- 接入 `openaiDeveloperDocs` MCP，固定双角色使用 `gpt-5.6-sol`，并补充 AGENTS、安装、架构、命令与示例文档。

## 0.1.1-beta.10

- 为 `jj-same` 增加可版本化 handoff snapshot，多个目标复用共享 `ANL-SOURCE / BLP/REQ`，避免重复读取完整源需求。
- 增加 `准备交接 / 交接 / 更新交接` 标准调用流程、freshness 动作、`execution_readiness` 与 successor delta 契约。
- 新增 handoff JSON Schema、Codex/Claude 安装资产、用户文档和回归测试。

## 0.1.1-beta.9

- 首次安装或 `--force` 更新成功后，输出当前包版本对应的最新版本日志。
- `--json` 安装结果增加 `version` 和 `release_notes` 字段。
- 安装失败或 `--dry-run` 预览时不输出版本日志，并兼容 Release Please 的版本标题格式。

## 0.1.1-beta.8

- 默认跳过代理侧编译、build、浏览器、E2E 和页面交互自测。
- 仅当改动存在静态证据无法覆盖的运行时风险时，提示用户下一步执行最小手动测试清单。
- 不需要运行时验收时记录 `N/A` 并继续；需要时使用 `READY_FOR_USER_TEST` 等待用户确认。

## 0.1.1-beta.7

- 从 `jj-same` 的 Codex、Claude 和项目族规则中彻底移除 grill 问答流程。
- 信息不足时仅使用本地证据和可回退的最窄假设；无法安全推断时直接标记 `BLOCKED`。
- 增加安装资产回归测试，防止 grill 命令重新进入发布包。

## 0.1.1-beta.6

- 将 `grill-me` 收紧为阻塞交付时的最后兜底，不再作为常规分析步骤。
- 信息不足时优先检查需求、会话、Git、文档和源码，再采用不扩大范围且可回退的最窄默认值。
- 只有缺失信息会改变 `MUST`、验收、目标项目集合或不可逆实现时才询问，并且一次只确认当前阻塞决策。

## 0.1.1-beta.5

- 让 `jj-same` 从领头项目分析阶段进入，并持续维护跨项目家族交付计划。
- 承接领头时默认按 `cj -> dj -> cz` 串行推进，前置项目验证和评审通过且用户主动触发后才进入下一项目。
- 规范后续项目从本地 `master` 创建派生分支，只替换项目角色前缀并保留日期和任务序号。
- 增加跨会话交接、目标项目独立差异分析、Codex/Claude 入口和安装资产回归测试。

## 0.1.1-beta.4

- 将 `jj-same` 扩展为可持续同步协议，按最近成功检查点分析 A 项目的需求更新、bug 修复、回退和有效增量。
- 增加修改完成后的项目、分支和候选目标确认门禁，由用户逐项目决定立即同步、延期、不适用或暂停关系。
- 使用目标项目 Maestro open issue 跟踪延期同步，恢复时从最近成功检查点重新计算累计范围。
- 为 `jj-delivery`、`jj-feat` 和 `jj-fix` 增加 post-change discovery，并补充 Codex、Claude、文档与安装回归测试。

## 0.1.1-beta.3

- 将 `jj-same` 固化为源证据总结、正式需求、目标项目评审、实施计划和实现复审的顺序门禁。
- 按 Maestro canonical artifact 规范保存并注册 `ANL-*`、`BLP-*`、`PLN-*`、`EXC-*`、`VRF-*` 和 `REV-*`，禁止创建私有迁移文档目录。
- 增加 Maestro 产物路由参考、安装资产检查和回归测试。

## 0.1.1-beta.2

- 增加 `jj-same` Codex skill 与 Claude slash command，用于基于会话、需求、分支、commit 或 diff 在同源分叉项目之间迁移功能、修复和需求变更。
- 增加跨项目迁移的项目族参考、沉默账户真实案例和只读证据采集脚本。

## 0.1.1-beta.1

- 调整安装资产结构，发布包内同时提供 Codex skills 与 Claude slash commands。
- 增加 `jj install-skill --platform codex|claude|all`，支持用户级和项目级安装。
- 更新文档站内容，突出真实入口、安装方式和维护边界。

## 0.1.1-beta.0

- 增加 npm beta 发布准备：版本号、`npx` 安装入口和 GitHub Actions 发布流程。
- 修正 npm `bin` 路径，确保发布后 `npx @shendu-sdt/jj-flow@beta` 能调用 `jj`。
- 增加 `jj install-skill --project`，支持安装到当前项目的 `./.codex/skills/jj`。
- 更新安装文档：默认用户级安装，可选项目级安装。

## 0.1.0

- 初始化独立 `jj-flow` 项目。
- 增加 `/jj` 薄入口的 CLI、recipe、guard、evidence schema。
- 增加 Codex skill 草案、GitHub CI、Release Please、Dependabot。
