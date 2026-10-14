# 系统架构与模块边界

`jj-flow` 的核心定位是**面向多仓库项目族的研发编排协议与证据门禁系统**。它不重复造轮子去替代外部 AI Coding Agent（如 Codex、Claude Code、Grok），而是通过一套统一的对话协议（`skills/`）与确定性状态机（`src/`），把单仓闭环、跨仓迁移、多仓调度与 Git 收工组织成可核对、可恢复的工程流水线。

## 一、四条核心交付流与三套可选引擎

### 1. 核心交付主路径（推进正式验收与 Git 状态）

```text
[项目接入]  init     : 扫描仓库 → 生成接入提案 → 用户确认 → 写入 ~/.jj-flow/map.md 与知识库
[单仓闭环]  ralph    : 对齐需求(ANALYZE) → 计划(PLAN) → 派单实施与审查(DELIVER) → 用户验收(ACCEPT) → 归档(ARCHIVE)
[跨仓迁移]  same     : 锁定源仓增量与 handoff → 核对目标仓分支 → 派发目标仓只读调研 → 按目标仓原生写法实施 → 逐仓验证
[多仓调度]  dispatch : 控制面只读预览(PREVIEW) → 用户批准(APPROVE) → 绑定会话与派发 → 收集回执与沙箱证明 → 逐仓 VERIFIED
[Git 收尾]  end      : 只读预览收工计划 → 拉取远端 → 仅提交本任务文件 → 推送工作分支 → 合入 dev 并推送 → 切回工作分支
```

### 2. 可选会话协作与评估引擎（不直接推进交付门禁）

```text
[动态多角色]  team-coordinate : 按问题动态生成角色拓扑 → 输出 .workflow/.team/TC-*/ 产物（可作为证据引用）
[标准流水线]  team-lifecycle  : 固定角色走 spec / plan / impl / test / review → 输出 .workflow/.team/TLV4-*/ 产物
[多方案搜索]  team-swarm      : 多假设候选探索 + ACO 对抗评分收敛 → 输出 .workflow/.team/TAS-*/artifacts/best-solution.md
[离线复盘]    evaluated       : 校验真实交付 episode → 统计耗时/返工基线 → 回归测试 → 生成报告待人工采纳
```

## 二、代码仓库模块地图（`src/` 与 `skills/`）

更详细的物理文件索引请参阅仓库根目录的 `ARCHITECTURE.md`。核心模块职责划分如下：

| 目录或模块路径 | 核心职责说明 |
| :--- | :--- |
| `skills/jj-*` | **对话协议单一真源（SSOT）**：定义所有工作流的行为规范、派单模板与红线检查点，通过 `install-skill` 分发至五大宿主平台 |
| `claude-commands/*.md` | **Claude 斜杠命令入口**：轻量引导包装（严格受 ≤40 行门禁约束），指向 `skills/` 权威协议 |
| `agents/*` | **命名子代理定义**：包含 `jj-implementer`、`jj-reviewer`、`jj-researcher`（Markdown 与 TOML 双格式）及工作流持久角色 |
| `src/ralph.mjs` + `src/ralph/*` | **单仓闭环机械状态机**：门面导出及 `src/ralph/state.mjs`、`src/ralph/gates.mjs`、`src/ralph/map.mjs`、`src/ralph/context.mjs`、`src/ralph/knowledge.mjs`、`src/ralph/archive.mjs`、`src/ralph/migrate.mjs`（通过 `npm run ralph:sync` 同步至技能便携脚本） |
| `src/dispatch*.mjs` | **多仓调度控制面**：状态机流转（`src/dispatchControlPlane.mjs`）、单步 tick 与 CAS 写入（`src/dispatchRuntime.mjs`）、宿主契约与沙箱证明校验（`src/dispatchHostContract.mjs`、`src/dispatchAttestation.mjs`） |
| `src/end.mjs` + `src/endCli.mjs` | **Git 批量收尾执行器**：实现 `$jj-end` 的只读预览、范围校验、冲突分类与安全合并推送（通过 `npm run end:sync` 同步至技能便携脚本） |
| `src/installSkill.mjs` + `src/skillInventory.mjs` | **跨平台分发与资产清点**：管理 `codex`、`claude`、`grok`、`qoder`、`agents` 五端安装、卸载、跨层级防重（shadowing）与 ownership 清单校验 |
| `src/jjInit.mjs` + `src/projectMap.mjs` | **全局主目录与地图接入**：管理 `~/.jj-flow/map.md` 解析、项目族推断与知识贡献导入 |
| `src/memoryHotLayer.mjs` + `src/memoryRetrieve.mjs` + `src/memoryExtract.mjs` + `src/portfolioKnowledge.mjs` | **双层记忆与知识检索**：项目级记忆热层提炼/置顶/注入，以及跨项目全局知识库索引检索 |
| `src/claudeHostAdapter.mjs` + `src/grokHostAdapter.mjs` + `src/grokHostTrialRunner.mjs` | **宿主会话适配器**：支持 Claude Code 与 Grok 的 Mode S 会话绑定及真实宿主试跑验收 |
| `src/scenarioRunner.mjs` + `src/dispatchTrace.mjs` + `src/hostTrialRunner.mjs` | **确定性场景与半真实演练**：固定夹具状态机回放、轨迹漂移检测与临时 Git worktree 半真实试跑 |
| `src/harnessGc.mjs` + `scripts/check-harness.mjs` | **仓库 Harness 门禁与熵扫描**：校验权威文档索引、协议枚举一致性、孤儿文档与仓库健康度评分 |
| `docs/` + `scripts/check-docs.mjs` | **VitePress 文档站源码与构建门禁**：负责双向侧栏覆盖检查、GFM 表格语法检查、更新日志双页切分校验与静态站点构建 |

## 三、六条核心架构不变量（Invariants）

1. **唯持久证据推进状态**：只有落盘的文档合同、Git 提交、审查报告与结构化回执可以推进门禁状态；多轮聊天记录本身不推进控制面。
2. **控制面单写者（Single-Writer）**：多项目控制面由单写者通过 CAS（Compare-And-Swap）推进，执行子代理（Worker）只返回结构化回执（Receipt）。
3. **稳定任务标识可恢复**：任务身份由稳定的 `task_key` / `run_id` 标识，临时子代理（Subagent）不是持久任务身份。
4. **读写职责严格分离**：只读审查员（Reviewer）与调研员（Researcher）严禁修改业务代码；实现执行人（Implementer）仅在获批范围内写工作区。
5. **无后台守护进程、不替用户强推代码**：运行时均为按需单次调用，无常驻 daemon，不做未经授权的自动分支合并或强推。
6. **自治等级受真实宿主证据约束**：Grok 真实宿主已通过验收达到 `max_unattended_level = A2`（默认仍为 `A1`；`A3` / `A4` 保持关闭，半真实演练不得用于解锁高等级自治）。

## 四、当前演进成熟度与边界

| 已完成闭环并纳入 `npm run verify` 门禁 | 仍处于演进或待开启状态（Open） |
| :--- | :--- |
| M6 控制面、M7 半真实试跑、H5 持续熵清理、Mode S 日常单会话并发、Mode W 隔离工作tree、Mode P 显式子会话、Grok Wave 2 / A2 真宿主验收、[AI-Native SDLC 映射](design-docs/ai-native-sdlc.md)、[机械实验场（Loop / Family Gym）](design-docs/jj-flow-labs.md) | `A3` / `A4` 高阶无人值守等级、Codex App 多线程并列真宿主试跑、`evaluated` 全自动 LLM 回放闭环、实验场 Live Agent 模式 |

## 五、架构决策记录（ADR）与设计文档

* [ADR 决策索引](adr/index.md)
  * [ADR 0001：外部工具边界](adr/0001-external-tool-boundary.md)
  * [ADR 0002：项目族控制平面](adr/0002-project-family-control-plane.md)
* [设计文档总览](design-docs/index.md)
* [执行计划索引](exec-plans/index.md)
