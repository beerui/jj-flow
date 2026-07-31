# Changelog

版本标题附带发布时间（`YYYY-MM-DD HH:mm`，与发版 commit 本地时区一致）。进行中的变更写在 `Unreleased`。

## Unreleased

- **docs**：ralph 用户文档「续作」重写为说人话（还没归档 / 已经归档）；修复对照表因分隔行 `-` 不足 3 位导致整表渲染成乱码管道符。
- **jj-ralph 强度档 + 双层 ACCEPT + 停滞早停**（速度×质量，不引入多 agent/ACO）：
  - `init --intensity tiny|standard|strict`：默认 budget / stagnation / accept_layers
  - `deliver-attempt`：连续无改进 → `BLOCKED` + `STAGNATION`；触顶 max_iterations/budget
  - `accept-layer`：mechanical/judgment；strict 验收前 judgment 必 PASS；`gate_issues` error 挡 accept
  - schema/skill/CLI/`phases.md`/设计文档同步；合约测试覆盖三档、停滞、strict accept、CLI 接线
  - 用户文档：`docs/commands/jj-ralph.md` 用承接/兑接/承载、控制项目、`RALPH-*`/`DEL-*`/`CAP-*` 真实话术解释强度档与闭环；`tiny-example.md` 对齐
  - 收口：`docs/commands/cli.md` 补 `intensity`/`deliver-attempt`/`accept-layer`；SKILL 立即动作选档 + 完成报告；`integrations.md` 身份对照；`examples/ralph/sample-run.json` 字段样例；合约锁定文档/skill 标记
  - `recordReview` 自动同步 `accept_layers.judgment`；`map-merge` 派生 STAGNATION/strict lessons 进 business-map（弱信息素）
  - `deliver-attempt` 可省略 `--improved`：用 diff 路径 + signal 指纹自动判定是否进展（`stagnation.last_fingerprint`）
- **docs**：调度演示改通俗版（人话总结、少术语、预览=看菜单/批准=下单）；SVG 动画 + 自动播放；仍对齐业务仓发起与账本进度。
- **docs**：调度演示页输出改为 `milestones/dispatch-demo.html`（修复 `.../milestones/dispatch-demo.html` 404）；根路径 `dispatch-demo.html` 保留重定向。
- **jj-ralph 续作协议 nits**：恢复表/设计文档裸词 `supersedes` → 规范键 `supersedes_run_id` / `parent_run_id`；`suggestReopenAsNew` note 改为只链 `progress.md`（非 `family`/run.json）；`post-complete-continue` / `rollback` 审计行措辞对齐。
- **对抗复查 follow-up**：合约测试锁定 note 含 `progress.md` / `not family`；用户文档 `docs/commands/jj-ralph.md` 首行→审计行；COMPLETED/ARCHIVE throw 文案补 progress.md placement；禁止表白话键名对齐。

## 0.1.1-beta.41 — 2026-07-31 18:23

- **jj-ralph 续作协议（改错 / 加子需求）**：归档前同 `run_id` 扩 scope 或按相邻边回退；归档后新 run + `progress.md` 链（纠正用 `supersedes_run_id`，纯子需求用 `parent_run_id`）；禁止 reopen COMPLETED / invent 未 schema 的 run.json 字段。
- Skill：`.codex/skills/jj-ralph/references/post-complete-continue.md`；`rollback.md` / `SKILL.md` 交叉引用。
- 文档：`docs/commands/jj-ralph.md` §1；`docs/design-docs/jj-ralph.md` 站点链接 `command-jj-ralph.html`。

## 0.1.1-beta.40 — 2026-07-31 14:45

- **技能面 90+ 三波优化（Wave0–2）**
  - Wave0：可移植命名/map 解析（去掉 ralph 立即动作 `D:/a` 硬编码）；`jj` 路由补全 `/jj-end`、dispatch 多端、evaluated experimental、不确定不默认 same；Claude `jj-same` 瘦身；`jj-review` 去幽灵 `/jj-dispatch` + host 矩阵；`jj-end` monorepo/dry_run 加固；ARCHITECTURE / inventory 平台文案对齐。
  - Wave1：`jj-same` / `jj-dispatch` progressive disclosure（主 SKILL 压缩 + `happy-path` / `workflow-core` / `agent-write-plane` references）；Claude 薄入口行数门禁 `SKI-CLAUDE-005`（≤40 行）。
  - Wave2：`jj-evaluated` experimental MVP runner（`episode-validate.mjs` / `evaluated_ops.mjs`：validate、init-report、check-split）+ 合约测试；design 状态 Implemented（验收证据链）。
- 测试：`tests/jj-evaluated-contract.test.mjs`；skill-inventory thinness；install/harness 断言适配 progressive disclosure。
- 文档：`docs/commands/jj-same.md` 补准备交接 / freshness 入口说明。

## 0.1.1-beta.39 — 2026-07-31 10:58

- **T-lead-outside-schema + T-task-result-sync**：lead∉targets 时可用完整 `reference_implementation` 代替空 `lead_responsibilities`；checkpoint/last_result 不再强制 `recorded_at` 相等；`recordTargetResult` 同步该 lead 逻辑。skill 要求 VERIFIED 同批刷新 task `result.md`/`progress.md`。telemetry Codex 实战 plane 现通过 `validateControlPlane`。
- 评估：Codex 实战 dispatch `docs/evaluations/2026-07-31-telemetry-image-codex-dispatch.md`（候选已 promote）。
- **C4–C6 加深**：`dispatchAttestation.mjs`（含 review 的 attestation 路径/写文件）；schema 可选 `integrity_grade` / `remote_closeout` / `closeout`；skill 硬门禁 C 段改为文件 ref；用户文档与 sample；合约测试。
- **收尾 R4 + C4–C6 + closeDelivery**：`dispatchRollbackPrep.mjs`；`closeDelivery` / `setRemoteCloseout` / `setIntegrityGrade`；plane-self-check；readme-pnpm `ROLLED_BACK` 关闭。
- **R-soft-reopen + G-menu**：Mode S session 共享；`prepareModeSReopen`；`reopenTarget` 默认 prepareSoft；未 push 干净 tip Recommended=**reset**。
- **任务回退（R1–R4）**：Dispatch reopen/block + Ralph phase/status + rollback-prep；plane-self-check `VERIFIED_REOPEN_SUGGESTED`。默认不自动 unmerge/force-push。
- 评估：`DEL-readme-pnpm-install-20260731` Mode S **控制面闭环**（plane-self-check OK）；`docs/evaluations/2026-07-31-readme-pnpm-dispatch.md`；Mode S exec plan live checkbox 勾选；acceptor-tag 保留 integrity FAIL 负例。
- 升级 backlog：`docs/exec-plans/active/2026-07-31-dispatch-upgrade-backlog.md` — **C4–C6 已完成**；Mode W/P / Host Wave 2 仍后置。

## 0.1.1-beta.38 — 2026-07-30 19:30

- **Grok dispatch Mode S（skill MVP）**：默认单会话串行 + project-branch；缺多 session API 时降级 Mode S，禁止合成 session id；用户不跑 CLI。
- 新增 `.codex/skills/jj-dispatch/references/grok-dispatch-execution.md`（PREFLIGHT / attestation / receipt / Mode S·W·P / 与 Workflow 边界）。
- Agent 写 plane 硬门禁（C3）：无 `produced_commit` 最多 `EVIDENCE_READY`；`scripts/plane-self-check.mjs` + 合约测试。
- 文档：`docs/commands/jj-dispatch.md`、`usage`、`grok-host-adapter` 脚注；exec plan `docs/exec-plans/active/2026-07-30-grok-dispatch-execution.md`；评估 `docs/evaluations/2026-07-30-acceptor-tag-color-dispatch.md`。

## 0.1.1-beta.37 — 2026-07-30 18:29

- **目录配置一等公民**：`naming.json` 支持 `dispatch.control_root` / `portfolio_root` / `knowledge_root` 与 `project_map`；产品默认 control_root=`~/.jj-flow`。解析顺序：CLI `--control-root`/`--manifest` → env → naming.json → 默认。`jj doctor` 打印 paths；`jj dispatch-tick --delivery` / `jj task scaffold --delivery` 可省略 `--manifest`。
- 修复 skill/docs 真源漂移：去掉「默认 D:/a/dispatch-control / 独占 worktree 才能 DISPATCH」矛盾；dispatch-demo 改为业务仓发起。
- CREATE_THREAD 动作尊重 intent.environment（隔离时可升级 exclusive-worktree）；host-trial 写绑定与 exclusive worktree 语义一致。
- 文档：明确 `jj-dispatch` 支持 Grok（`/jj-dispatch`，`host_id=grok-build` / session）；命令总览补全多端平台列，删除「已移除（非活入口）」段落。
- **dispatch write workspace 默认改为 `project-branch`**（与 same 一致：命名 feature 分支 + 项目主路径）；`exclusive-worktree` 仅在并发写 / 主仓脏 / 用户显式隔离时启用。host-action-contract + control-plane 校验与 skill 同步（EP-20260730 worktree transfer 负例）。
- **dispatch 分支/workspace 不确定时先问再派**：PREVIEW 输出判断表；`NEEDS_CONFIRM` 时禁止 DISPATCH / create_thread / 写 intent，用户确认后以用户改判为准。
- **dispatch 状态默认 `~/.jj-flow`**：产品默认用户主目录；`D:/a` 仅为可选本机 portfolio（map/业务仓布局），须用 `naming.json` 才能把 control_root 指到 `D:/a/dispatch-control`。

## 0.1.1-beta.36 — 2026-07-30 17:26

- 文档站全局顶栏：快捷入口改为「安装 / 使用 / Changelog / GitHub」；移除 same / dispatch 快捷标签。
- 新增站内 `changelog.html`（由根目录 `CHANGELOG.md` 生成）；GitHub 外链 `https://github.com/beerui/jj-flow`。

## 0.1.1-beta.35 — 2026-07-30 17:11

- `$jj-same`：开干前强制 **branch purpose preflight**（任务用途 vs 当前分支用途）；新增 `references/branch-purpose-preflight.md` 与 EP-20260730-S1 五题 golden（错误 train 分支、恢复、staging tip 树判定）。
- `$jj-end`：记录 `branch_purpose`；明显落错 feature/发布线时停并报告，避免错线 merge 进 integration。
- jj-evaluated：记录 `docs/evaluations/2026-07-30-grok-episodes.md`（今日 Grok episode 标签、split、candidate v5 晋升状态）。
- `docs/commands/jj-same.md`：执行过程补充分支用途 preflight。
- chore：清理本地 scratch；保留 `docs/other/dispatch-demo/make_frames.py`；gitignore 生成媒体与一次性脚本。

## 0.1.1-beta.34 — 2026-07-30 16:34

- Fix npm package homepage: publish workflow now aligns `latest` dist-tag (npmjs.com defaults to `latest`, which was stuck on Maestro-era 0.1.1-beta.0).
- `$jj-review` / `/jj-review` 改为宿主内置 review 优先的适配器：发现并调用当前宿主 review/code-review，将结论映射为 `reviews/REV-*.json`（`source`/`host_review` 溯源）；仅在宿主不可用时最小内联回退。
- `jj ralph review-record` / `ralph_ops review-record` 支持 `--source` 与 `--host-review-json`，progress 写入 `source=`；校验可选 provenance 枚举。
- `$jj-end`：强制 `fetch → 同步 work → push → 同步 integration → merge → push → 回切`；提交前/推送前必须拉远端；禁止中途只 commit 不 merge；integration 回退链 `dev→develop→main`；冲突 abort 后回 work 并明确失败。
- Skill 多端统一：新增 `skill-inventory.json` + `src/skillInventory.mjs`；harness 对账磁盘 skill ↔ 清单 ↔ Claude commands；补 `.claude/commands/jj-end.md`；安装文档写明 SSOT（`.codex/skills`）与 reinstall 纪律。

## 0.1.1-beta.33 — 2026-07-29 17:52

- Remove residual Maestro product framing: rename ADR 0001 to external-tool-boundary; scrub reviewer agent wording; docs site paths no longer reference Maestro.
- Ralph v2: review_scope (working_tree|commit) + fix_commit; ARCHIVE requires commit-scoped PASS review when a review exists.
- Ralph v4: accept/archive require gates.deliver=PASS/N/A; block deliver-outside-ledger when progress/diff shows deliver while deliver gate pending.
- Ralph host metadata: optional run.host (host_id/thread_id/model_id/export_path); `jj ralph host-record` + init flags for session binding/evaluation (not a checkpoint).
- Contract tests covering v2/v4/host; phases.md and ralph-run schema updated.

## 0.1.1-beta.32 — 2026-07-29 17:13

- Ralph accept/archive product-consistency gate: block PASS when latest review is NEEDS_CHANGES/BLOCKED or plan/acceptance path set drifts from actual diff (EP-04 false-complete class).
- Contract tests for ledger path extraction and accept/archive gate refusal.
- jj-same multi-env collect-port-evidence (Node primary + sh/ps1 wrappers) and tests.
- jj-evaluated: record 2026-07-29 Grok episodes baseline under docs/evaluations; exclude that tree from docs-site orphan GC.
- Refresh source-evidence-map paths to D:/a role mapping.

## 0.1.1-beta.31 — 2026-07-27 21:41

- Ralph 硬接线 Portfolio KB: init auto-writes knowledge_refs / knowledge_summary (--no-knowledge-refs / --project / --knowledge-query).
- Add src/portfolioKnowledge.mjs to read D:/a/knowledge indexes into run/analyze/status.
- Skill portable lib syncs portfolioKnowledge.mjs; ralph:sync/check covers 3 files.
- knowledge loop package emits knowledge_refs + portfolio_knowledge.
- schema/sample/skill skeleton + contract tests cover knowledge fields.
- design-docs index links external portfolio KB at D:/a/knowledge.
## 0.1.1-beta.30 — 2026-07-27 18:00

- 精简 Ralph handoff：交接状态并入 run.handoff（ready/must/targets/source_head），accept/finalize 自动维护。
- handoff 包改为 run 内薄镜像 `.workflow/ralph/RALPH-*/handoff/handoff.json`；停写外部 handoffs/csv-wave 大包为默认。
- `$jj-same` 优先消费当前会话 Ralph handoff；用户只说「交接到 …」，不填路径参数。
- 更新 schema/skill/布局与合约测试（ralph-handoff/1.1）。

## 0.1.1-beta.29 — 2026-07-27 16:24

- 统一全局命名配置：新增 src/namingConfig.mjs，支持读取 D:/a/config/naming.json（schema_version: jj-flow/naming/1.0）。
- jj-same 分支派生规则升级：以领头分支为模板，只替换项目 role；req_suffix / 开发者缩写不得擅自增减；role 从 D:/a/map.md 解析。
- jj-ralph 新建 run 强制 RALPH-{kebab}-{YYYYMMDD}，archive 目录强制 YYYY-MM-DD-{kebab}；portable lib 同步 namingConfig.mjs。
- Grok Host Adapter Phase 1 契约扩展：host_ids / handle_kinds / host_profiles 进入 host-action-contract；control-plane intent 支持 handle_kind；validateHostBindAttestation fail-closed；新增 tests/grok-host-contract.test.mjs 与 harness attestation 反例。
- 完成并归档 Phase 1 exec plan：docs/exec-plans/completed/2026-07-27-grok-host-adapter.md（契约扩展；不升 A2；Phase 2/3 另开）。
- 新增 Grok Host Adapter 设计（Proposed）：Wave 2 可选第二宿主路径，与 Codex 并列；skill 安装不推进 A2。
- 真实 Host 验收里程碑改为支持 Codex / Grok 双路径；补充 install-skill --platform grok 使用说明边界。

## 0.1.1-beta.28 — 2026-07-27 11:19

- 新增 Grok 平台安装支持：`install-skill --platform grok` 将 skills 安装到 `~/.grok/skills/`（`GROK_HOME` 可覆盖）。
- `--platform all` 现在同时安装 Codex、Claude Code、Qoder 和 Grok 四端资产；`--project` 支持 `./.grok/skills/`。
- 安装文档补充 Grok skill 发现优先级、AGENTS.md 自动加载与真实 Host 边界说明。
- 新增 `/jj-evaluated` 设计文档与 skill：用真实 episode/trace 做离线评估与泛化学习（Proposed）。
- Harness Wave 0/2 收口：fresh clone 验证通过；真实 Codex App Host 单列为 PENDING 里程碑；`max_unattended_level` 保持 A1。

## 0.1.1-beta.27 — 2026-07-24 13:36

- 新增 Qoder 平台安装支持：`install-skill --platform qoder` 将 skills 安装到 `~/.qoder/skills/`。
- `--platform all` 现在同时安装 Codex、Claude Code 和 Qoder 三端资产。
- 项目级安装 `--project` 同步支持 `./.qoder/skills/` 目标。

## 0.1.1-beta.26 — 2026-07-23 18:51

- 新增 `$jj-end` 任务收尾 skill：提交、推送、合并到 `dev`/`develop` 并切回工作分支；`$jj` 路由接入收尾入口。
- `$jj-ralph` 可移植机械步骤：skill 内同步实现与 finalize/gate/map-find，业务仓无需安装 jj-flow 包。
- `$jj-dispatch` 对齐 runtime 门禁优先级与状态语义：capability 失败不改 plane，UNKNOWN 禁止同 key 重建。
- `$jj-review` 收敛为直接写 `reviews/REV-*.json` 的只读审查；无 run 时 BLOCKED，PASS/NEEDS_CHANGES 强制 `reviewed_commit`。
- 统一 skill `agents/openai.yaml` 展示名为 `jj-*`，补齐 `$jj` 路由 agent 元数据，并收紧 `$jj-end` 边界说明。

## 0.1.1-beta.25 — 2026-07-23 16:47

- 精简 `$jj-ralph` skill：Codex 直写产物、短路径约束、失败预算与 skeleton 模板。
- Ralph 产物路径压扁为 `.workflow/ralph/RALPH-*/`，去掉 `ralphs/` 中间层。
- 新增 skill 内确定性脚本 `scripts/ralph_ops.mjs`（init/status/archive/map-merge/handoff/dispatch-snapshot）。
- 同步 Claude 命令、文档、样例、合同测试与 `agents/openai.yaml。

## 0.1.1-beta.24 — 2026-07-23 13:56

- 新增 `$jj-ralph` / `/jj-ralph` 单仓全流程闭环：需求分析 → 计划实施 → 验收完成 → 归档，产物在 `.workflow/ralph/ralphs/`，能力地图 `business-map.json`。
- 新增 `jj ralph` 机械 CLI：`init`、`status`、`archive`、`map-merge`、`map-find`、`handoff`、`dispatch-snapshot`、`commit-prep`、`review-record`。
- 新增 `$jj-review` / `/jj-review` 单仓轻量审查：把审查结论与 task/review 会话关联到 ralph run 的 `reviews/REV-*.json`，不走 dispatch 控制面。
- ralph 完成后可导出 `.workflow/handoffs/` 供 `jj-same` 迁移，或导出 dispatch 推荐快照供 `jj-dispatch` 分发；迁移实现不在 ralph 目录内完成。
- 增加 schema、样例、设计文档与合同测试：map-merge 后 map-find 可恢复历史能力与 run 路径；review-record 可关联任务/审查会话。

## 0.1.1-beta.23 — 2026-07-20 21:00

- 新增可复制的 `TASK-ID`：标准任务的 `task.json` 记录任务文档、控制面 manifest 和 delivery 绑定；新会话可只提供任务 ID 恢复任务内容与实时状态。
- 新增 `jj task assign`、`jj task status` 和 `jj task context`，普通输出保持简洁，JSON 输出保留完整审计面。

## 0.1.1-beta.22 — 2026-07-20 11:12

- control plane 在 `intake.status=REQUIRED` 时 fail-closed，必须确认项目归属和目标集合后才能 PREVIEW / APPROVE。

## 0.1.1-beta.21 — 2026-07-20 11:07

- 在 `jj --help` 中公开标准任务 `task scaffold` 入口。

## 0.1.1-beta.20 — 2026-07-20 10:58

- 新增标准任务资产 scaffold：非 quick 任务生成 `.workflow/tasks/<TASK-ID>/` 下的任务、计划、进度和结果 Markdown。
- dispatch task plan、approval、intent 和 Codex App host action 自动携带结构化 `distribution_prompt` 与 `initial_prompt`。
- 增加 control intake、handoff/dispatch/report/receipt 按任务 ID 分目录和源任务完成后的推荐分发规则。

## 0.1.1-beta.19 — 2026-07-18 16:54

- 修复 Windows `core.autocrlf=true` 的 fresh clone 中 Harness runner fingerprint 因 `LF/CRLF` 差异误判过期的问题；fingerprint 现在按规范化文本计算，并增加跨行尾回归测试。

## 0.1.1-beta.18 — 2026-07-18 16:42

- 新增 `jj uninstall-skill`，支持 Codex/Claude、project/target、dry-run 和 JSON 输出；通过安装 ownership manifest 与 SHA-256 摘要保护本地修改，并可安全清理 `jj-validate` 等 8 个历史入口。
- 加固 Harness manifest、schema、机械检查与成熟度评分，补齐版本化 exec plan 和 98/A 基线，持续检测文档、资产、验收证据与仓库事实漂移。
- 新增只读 Harness Gardener workflow，仅允许创建维护 issue，不授予代码写入或自动修复权限。

## 0.1.1-beta.17 — 2026-07-18 15:50

- 引入 repository-native Harness：`ARCHITECTURE.md`、`harness-manifest.json`、`jj doctor` 和机械边界检查，仓库事实不再依赖 `.workflow` 或本机 memory。
- 新增确定性 scenario、trace/replay、`jj-same` handoff 契约，以及使用真实临时 Git/worktree、CAS、中断恢复和 Review 返工的半真实 Host trial。
- 新增只读 `harness:gc`、100 分质量评分和版本化 H5 基线；P0/P1 阻断，P2/P3 仅形成维护候选，禁用自动修复。
- 补齐 Harness Engineering 设计、ADR、H4/M7 与 H5 验收文档，并将全部门禁接入 `npm run verify`。

## 0.1.1-beta.16 — 2026-07-18 10:24

- 文档站：嵌套页相对路径修复、表格/粗体渲染、导航与样式可读性增强、首页 3 步路径；维护说明写清文档所有权；`tests/docs-site.test.mjs` 覆盖主路径与 docs:check。
- dispatch 运行时：分析 receipt 先消费、目标独立 ADAPT/NO_CHANGE/BLOCKED 门禁、resume 调和 pending intent、CAS 写锁不误删他人 lock。

## 0.1.1-beta.15 — 2026-07-17 23:53

- 产品定位调整：`jj-flow` 定位为 **项目族编排工作流**（same / dispatch），同步 README、架构、规划、AGENTS、package 描述与文档站标语。
- 一并发布尚未上架的 beta.14 能力：dispatch 可恢复 tick/CAS、目标独立差异门禁、M6 验收文档。

## 0.1.1-beta.14 — 2026-07-17 23:49

- 加固 `$jj-dispatch` 运行时：resume 重放 `PENDING_THREAD` 的 `CREATE_THREAD` actions；目标差异决策按项目独立门禁；receipt `attempt` 与 `task_key`/intent 绑定；`persistPlaneCas` 真 CAS 写回。
- 移除 `dispatch-tick --no-target-analysis`；目标 ANL-TARGET 不可绕过。
- 关闭 M6（P11/P12）：验收报告 `docs/milestones/m6-acceptance.md`；下一里程碑 M7 为真实控制项目试跑。


## 0.1.1-beta.13 — 2026-07-17 22:58

- **Breaking**：移除 `jj-delivery` / `jj-validate` / `jj-evolve` 原生命令、recipe 与文档入口。
- 用户可见原生命令收敛为 `jj-same`（同源迁移/持续同步）与 `jj-dispatch`（多项目调度，Codex-only）；兼容入口 `jj` 默认路由到 `same`。
- 控制平面 `delivery_id` 保留为调度任务身份，不再对应 `$jj-delivery` 对话入口。
- 维护 jj-flow 自身改为直接改仓 + `npm run verify`；删除 `projectEvolution` 与相关测试。
- 同步更新 Codex skills、Claude commands、CLI help、文档站导航与回归测试。

## 0.1.1-beta.12 — 2026-07-17 22:15

- 移除 `jj-feat` / `jj-fix` / `jj-knowhow` / `jj-auto` / `jj-review` 原生命令与 recipe；明确功能、线上修复、交付前审查与不确定意图统一走 `jj-delivery`。
- 知识沉淀与独立 review 入口不再提供；审查走 delivery 内 `$quality-review`，沉淀可按需调用 `$manage-knowhow-capture`。
- 全部流程代码定位改用定点读取与搜索工具。
- 同步更新 Codex skills、Claude commands、文档、安装校验与回归测试。

## 0.1.1-beta.11 — 2026-07-17 14:20

- 新增独立项目族控制平面，支持动态 `origin_project`、`requirement_owner`、`lead_project` 和多个目标项目的可恢复派发。
- 新增只读 Reviewer 与可写 Developer 双角色闭环，支持结构化 findings、`NEEDS_CHANGES` 重工、递增 attempt 和 Review PASS 门禁。
- 收紧 sandbox attestation、terminal writer、NO_CHANGE、checkpoint、结果防重放和 skipped dependency 等运行时与公开 Schema 约束。
- 接入 `openaiDeveloperDocs` MCP，固定双角色使用 `gpt-5.6-sol`，并补充 AGENTS、安装、架构、命令与示例文档。

## 0.1.1-beta.10 — 2026-07-14 18:46

- 为 `jj-same` 增加可版本化 handoff snapshot，多个目标复用共享 `ANL-SOURCE / BLP/REQ`，避免重复读取完整源需求。
- 增加 `准备交接 / 交接 / 更新交接` 标准调用流程、freshness 动作、`execution_readiness` 与 successor delta 契约。
- 新增 handoff JSON Schema、Codex/Claude 安装资产、用户文档和回归测试。

## 0.1.1-beta.9 — 2026-07-14 09:09

- 首次安装或 `--force` 更新成功后，输出当前包版本对应的最新版本日志。
- `--json` 安装结果增加 `version` 和 `release_notes` 字段。
- 安装失败或 `--dry-run` 预览时不输出版本日志，并兼容 Release Please 的版本标题格式。

## 0.1.1-beta.8 — 2026-07-13 14:40

- 默认跳过代理侧编译、build、浏览器、E2E 和页面交互自测。
- 仅当改动存在静态证据无法覆盖的运行时风险时，提示用户下一步执行最小手动测试清单。
- 不需要运行时验收时记录 `N/A` 并继续；需要时使用 `READY_FOR_USER_TEST` 等待用户确认。

## 0.1.1-beta.7 — 2026-07-13 14:13

- 从 `jj-same` 的 Codex、Claude 和项目族规则中彻底移除 grill 问答流程。
- 信息不足时仅使用本地证据和可回退的最窄假设；无法安全推断时直接标记 `BLOCKED`。
- 增加安装资产回归测试，防止 grill 命令重新进入发布包。

## 0.1.1-beta.6 — 2026-07-13 13:37

- 将 `grill-me` 收紧为阻塞交付时的最后兜底，不再作为常规分析步骤。
- 信息不足时优先检查需求、会话、Git、文档和源码，再采用不扩大范围且可回退的最窄默认值。
- 只有缺失信息会改变 `MUST`、验收、目标项目集合或不可逆实现时才询问，并且一次只确认当前阻塞决策。

## 0.1.1-beta.5 — 2026-07-13 11:32

- 让 `jj-same` 从领头项目分析阶段进入，并持续维护跨项目家族交付计划。
- 承接领头时默认按 `cj -> dj -> cz` 串行推进，前置项目验证和评审通过且用户主动触发后才进入下一项目。
- 规范后续项目从本地 `master` 创建派生分支，只替换项目角色前缀并保留日期和任务序号。
- 增加跨会话交接、目标项目独立差异分析、Codex/Claude 入口和安装资产回归测试。

## 0.1.1-beta.4 — 2026-07-11 12:37

- 将 `jj-same` 扩展为可持续同步协议，按最近成功检查点分析 A 项目的需求更新、bug 修复、回退和有效增量。
- 增加修改完成后的项目、分支和候选目标确认门禁，由用户逐项目决定立即同步、延期、不适用或暂停关系。
- 使用目标项目 目标项目 open issue 跟踪延期同步，恢复时从最近成功检查点重新计算累计范围。
- 为 `jj-delivery`、`jj-feat` 和 `jj-fix` 增加 post-change discovery，并补充 Codex、Claude、文档与安装回归测试。

## 0.1.1-beta.3 — 2026-07-10 14:45

- 将 `jj-same` 固化为源证据总结、正式需求、目标项目评审、实施计划和实现复审的顺序门禁。
- 按 canonical artifact 规范保存并注册 `ANL-*`、`BLP-*`、`PLN-*`、`EXC-*`、`VRF-*` 和 `REV-*`，禁止创建私有迁移文档目录。
- 增加 产物路由参考、安装资产检查和回归测试。

## 0.1.1-beta.2 — 2026-07-10 10:52

- 增加 `jj-same` Codex skill 与 Claude slash command，用于基于会话、需求、分支、commit 或 diff 在同源分叉项目之间迁移功能、修复和需求变更。
- 增加跨项目迁移的项目族参考、沉默账户真实案例和只读证据采集脚本。

## 0.1.1-beta.1 — 2026-07-06 14:17

- 调整安装资产结构，发布包内同时提供 Codex skills 与 Claude slash commands。
- 增加 `jj install-skill --platform codex|claude|all`，支持用户级和项目级安装。
- 更新文档站内容，突出真实入口、安装方式和维护边界。

## 0.1.1-beta.0 — 2026-07-04 17:47

- 增加 npm beta 发布准备：版本号、`npx` 安装入口和 GitHub Actions 发布流程。
- 修正 npm `bin` 路径，确保发布后 `npx @shendu-sdt/jj-flow@beta` 能调用 `jj`。
- 增加 `jj install-skill --project`，支持安装到当前项目的 `./.codex/skills/jj`。
- 更新安装文档：默认用户级安装，可选项目级安装。

## 0.1.0

- 初始化独立 `jj-flow` 项目。
- 增加 `/jj` 薄入口的 CLI、recipe、guard、evidence schema。
- 增加 Codex skill 草案、GitHub CI、Release Please、Dependabot。

