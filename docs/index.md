# jj-flow

<div class="jj-hero">
  <span class="jj-hero-badge">AI-Native 项目族研发编排工作流</span>
  <p class="jj-hero-lead">
    通过自然语言对话，在多个关联仓库之间完成<strong>单仓需求闭环、同源跨仓迁移、多仓统筹派发与 Git 自动收工</strong>。所有进度以仓库内的计划文件、审查报告与 Git 提交为唯一凭据，随时可核对、随时可续接。
  </p>
  <div class="jj-hero-actions">
    <a class="jj-btn jj-btn-primary" href="./installation.html">1 分钟安装 →</a>
    <a class="jj-btn jj-btn-secondary" href="./usage.html">第一次实战教程</a>
    <a class="jj-btn jj-btn-secondary" href="./commands.html">命令选型速查</a>
  </div>
</div>

<div class="jj-feature-grid">
  <div class="jj-feature-card">
    <p class="jj-feature-title">单仓闭环 · ralph</p>
    <p class="jj-feature-desc">一句话提出需求，按“分析 → 计划 → 实施 → 验收 → 归档”五步落地，计划与过程记录完整保存在仓库中。</p>
  </div>
  <div class="jj-feature-card">
    <p class="jj-feature-title">同源迁移 · same</p>
    <p class="jj-feature-desc">把项目A 已经验证通过的能力，按项目B、项目C 各自的代码规范与目录结构适配过去，拒绝生搬硬套。</p>
  </div>
  <div class="jj-feature-card">
    <p class="jj-feature-title">多仓调度 · dispatch</p>
    <p class="jj-feature-desc">一次改动涉及多个项目时，先生成只读分支预览表，经你批准后再统一派发、独立跟踪验收状态。</p>
  </div>
  <div class="jj-feature-card">
    <p class="jj-feature-title">证据门禁 · Evidence First</p>
    <p class="jj-feature-desc">聊天口头声称“改完了”不算数；只有落盘的任务合同、只读审查记录与真实的 Git 提交才算通过。</p>
  </div>
</div>

::: tip 支持的主流 AI 编程宿主
开箱支持 **Codex**（使用 `$jj-…` 前缀）、**Claude Code**、**Grok**、**Qoder**（使用 `/jj-…` 前缀），并同时提供 `~/.agents` 兼容入口。无需记忆复杂命令行，在日常对话窗口里直接输入前缀即可调用。
:::

## 三步快速上手

1. **安装对话入口**：按 [1 分钟安装与配置](installation.md) 在项目或全局执行一行 `npx` 命令，装好对话技能与子代理。
2. **跑通第一个需求**：跟随 [第一次使用（完整实战）](usage.md)，在当前业务仓库体验从提需求、自动实现到验收归档的全流程。
3. **跨仓迁移与收工**：对照下方选型表，用 `same` 将改好的功能同步到兄弟仓库，最后用 `end` 一键提交并合并到 `dev` 分支。

遇到分支拦截或收工报错时，可随时查阅 [常见避坑与自检清单](pitfalls.md)。拿不准该用哪个命令时，直接在对话里输入 `$jj` 或 `/jj`，由 [jj 智能分流入口](commands/jj.md) 帮你判断。

## 我该用哪个命令？（选型速查表）

日常研发只需要关注以下 **6 个核心工作流入口**：

| 你的目标场景 | 推荐入口 | 调用示例（Claude / Grok 将 `$` 换为 `/`） | 核心行为与边界 |
| :--- | :--- | :--- | :--- |
| **登记新项目、补充跨仓知识库** | [init](commands/jj-init.md) | `$jj-init 当前仓加入全局地图，中文名「项目A」` | 先生成预览提案，经你确认后写入 `~/.jj-flow/map.md` |
| **只在当前仓库开发或修复一个需求** | [ralph](commands/jj-ralph.md) | `$jj-ralph 登录后若密码过期，弹窗提醒用户改密` | 执行五步任务闭环，归档后仍可随时接着改，不自动动 Git |
| **对当前代码改动做一次独立审查** | [review](commands/jj-review.md) | `$jj-review 审一下刚才的密码过期弹窗改动` | 派只读审查员检查代码并输出 `[OK]`、`[WARN]` 或 `[BLOCK]` |
| **把项目A 做好的功能迁到项目B / 项目C** | [same](commands/jj-same.md) | `$jj-same 交接到 项目B 项目C` | 读取源仓提交与交接说明，按各目标仓原生写法适配并验证 |
| **多个项目需要统一预览、批准后再一起改** | [dispatch](commands/jj-dispatch.md) | `$jj-dispatch 预览把依赖升级分发到项目A、项目B` | 先给分支与模式预览表 → 你说“批准” → 分别派发与验收 |
| **把改好的代码提交、推送并合入集成分支** | [end](commands/jj-end.md) | `$jj-end` 或 `$jj-end integration=staging` | 只操作 Git：提交本任务文件 → 推工作分支 → 合入 `dev` 并推送 |

::: info 一句话选型口诀
* **改一个仓**用 **`ralph`**；
* **代码做完要检查**用 **`review`**；
* **搬到兄弟仓**用 **`same`**；
* **多仓先审批再统派**用 **`dispatch`**；
* **最后提交合分支**用 **`end`**。
:::

除了上述核心交付流，还提供 4 个**可选辅助引擎**（仅辅助本轮分析或方案探索，不直接替代 `ralph` 或 `dispatch` 的验收门禁）：
* [team-coordinate](commands/jj-team-coordinate.md)：按当前问题动态拆分多个协作角色（如安全、性能、实现并行分析）。
* [team-lifecycle](commands/jj-team-lifecycle.md)：按固定角色走“规格 → 计划 → 实现 → 测试 → 审查”标准化流水线。
* [team-swarm](commands/jj-team-swarm.md)：针对复杂架构问题发起多假设探索与对抗评分，收敛出最优方案。
* [evaluated](commands/jj-evaluated.md)：基于真实交付记录做离线耗时与返工复盘。

## 核心工作流是如何串联的？

在实际的多端项目族（例如：**项目A** 为 PC 端、**项目B** 为 H5 端、**项目C** 为管理后台）中，各入口按照以下生命周期自然衔接：

```text
[准备阶段]  $jj-init        将项目A / 项目B / 项目C 登记到本机项目地图 (~/.jj-flow/map.md)
               │
               ▼
[单仓交付]  $jj-ralph       在项目A 完成「分析 → 计划 → 编码 → 审查 → 验收 → 归档」
               │            （期间可随时调用 $jj-review 做只读审查，完成后用 $jj-end 提交）
               ▼
       ┌───────┴───────┐
       ▼               ▼
[同源迁移]          [多仓统筹调度]
$jj-same            $jj-dispatch
直接把项目A 的改动   先出多仓预览表 → 你批准后统一派发
适配到项目B / 项目C  并在调度账本中逐仓跟踪 VERIFIED 状态
       │               │
       └───────┬───────┘
               ▼
[收工合入]  $jj-end         在各仓库自动提交本任务文件、推送功能分支，并安全合入 dev 分支
```

## 全站文档导航

| 章节分组 | 适合读者 | 包含内容与重点入口 |
| :--- | :--- | :--- |
| **开始** | 首次接触 `jj-flow` 的开发者 | [1 分钟安装](installation.md)、[第一次使用（完整实战）](usage.md)、[常见避坑与自检清单](pitfalls.md) |
| **工作流** | 日常使用对话命令写代码的开发者 | [命令总览与选型指南](commands.md) 及 11 个命令的详细步骤、对话实录与产物说明 |
| **概念** | 想理解底层规则与目录结构的开发者 | [核心术语表](glossary.md)、[证据门禁](concepts-evidence.md)、[目录布局](concepts-paths.md)、[宿主与工作模式](concepts-hosts.md)、[知识库与记忆](concepts-knowledge.md) |
| **维护者** | 参与维护或调试 `jj-flow` 本身的人员 | [系统架构](architecture.md)、[CLI 参考](commands/cli.md)、[维护指南](maintenance.md)、[写作规范](writing-guide.md)、[站点部署](deployment.md)、[实验场规范](jj-lab-siblings.md) |
| **参考** | 查阅架构演进与历史验收证据的深究者 | [设计文档总览](design-docs/index.md)（含 [Agent Harness 设计](design-docs/harness-engineering.md)）、[执行计划索引](exec-plans/index.md)、[ADR 索引](adr/index.md)，以及历史验收记录（[真实 Host](milestones/real-host-acceptance.md)、[M7 半真实 Host](milestones/m7-acceptance.md)、[H5 熵清理](milestones/h5-acceptance.md)） |
