# `jj-same` 同源项目迁移与持续同步

`jj-same` 用于在同源但已经分叉的项目之间迁移同一项业务能力。它迁移的是已经确认的需求语义，不是把源项目文件、整条分支或 legacy 结构原样复制到目标项目。

首次迁移会建立可验证的交接与同步基线；后续同步只分析源项目从上次成功检查点到当前 `HEAD` 的有效增量，并按目标项目现有架构做最窄适配。

## 适用场景

- A 项目已实现一项功能，需要迁到同一项目族中的 B 或 C 项目。
- 源项目修复了 bug，需要判断其它同源项目是否存在相同根因，并只修真正受影响的项目。
- 源需求发生新增、删除、纠正或回退，需要按上次成功基线继续同步。
- 已有 Codex 会话、需求文档、功能分支、commit、diff 或 `handoff_ref`，希望还原最终需求后再实施。
- 多个目标要共享同一份源需求语义，但每个目标仍需独立分析、实现和验证。

## 何时不用

- 只需要跨项目拆任务、创建 Codex task 和汇总状态时，使用 [`jj-dispatch`](command-jj-dispatch.html)；它不替代具体迁移。
- 不要用它做整分支 `cherry-pick`、整文件覆盖、跨前台/后管的默认广播或后台常驻监听。
- 源 commit、最终需求或目标调用链无法验证，且缺口会影响 `MUST` 验收时，应保持 `BLOCKED`，不要猜测后继续改代码。
- 已移除的 `$jj-delivery` / `$jj-validate` / `$jj-evolve` 不再作为替代入口。

## 输入模板

首次迁移或按会话还原需求：

```text
$jj-same
操作：<首次迁移 / 分析 / 修复同根因问题 / 建立持续同步>
源证据：<Codex 会话 ID、需求文档、分支、commit 或 diff>
当前需求：<本次最终有效要求，包含对历史要求的纠正>
源项目：<业务角色或仓库绝对路径>
目标项目：<一个或多个明确授权的业务角色或路径>
范围：<要分析或修改什么；是否提交、推送>
验收：<目标行为、旧功能保护和验证标准>
```

消费交接快照：

```text
$jj-same
操作：交接
交接：@<handoff-snapshot.yaml 绝对路径>
当前项目：<目标业务角色或仓库路径>
目标动作：<只分析 / 开始迁移>
验收：<当前目标的完成标准>
```

Claude Code 使用 `/jj-same`。当前明确要求某个目标“开始迁移”时，该消息可视为实施授权；未明确要求实施时，不会擅自修改业务代码。

## 完整示例

### 示例 1：从源会话准备交接，再迁移到目标项目

先在源项目生成一次共享交接快照：

```text
$jj-same
操作：准备交接
会话：019f49dd-1ec9-7eb0-a0e5-53cf5f4da99c
源提交：c0c360f9d
功能：密码更新提醒
当前需求：保留密码入口；点击“修改密码”时在当前页面打开已有弹框，不跳转新页面。
范围：整理正式需求引用、源验证证据和目标待验证差异，不修改其它项目。
验收：输出唯一 handoff_ref，并明确 handoff_status、execution_readiness 和未解决项。
```

随后在兑接前台消费同一份快照并开始迁移：

```text
$jj-same
操作：交接
交接：@D:\codeup\chengjie\cj-frontend-web\.workflow\.csv-wave\20260717-analyze-password-reminder\requirement-baseline\HOF-password-reminder-001\handoff-snapshot.yaml
当前项目：兑接前台
目标动作：开始迁移
范围：只覆盖登录和切换账号两个真实入口；不新增路由页，不改旧密码登录逻辑。
验收：复用目标已有 API wrapper 和修改密码弹框；目标测试与质量审查通过；必要运行时验收单独列出。
```

目标会先判断 snapshot freshness。只有 `REUSE + execution_readiness=READY`，或刷新后重新达到同等条件，才进入当前目标自己的 `ANL-TARGET -> PLN -> EXC/VRF -> REV`。

### 示例 2：按成功基线同步后续 bug 修复

```text
$jj-same
操作：持续同步
sync_key：SYNC-silence-login
源项目：D:\codeup\chengjie\cj-frontend-web
源分支：feat/cj-0717-3
目标项目：D:\codeup\duijie\dj-frontend-web
当前变更：源项目修复静默账号错误码 1027 的重复提示，并保留验证码快捷登录入口。
范围：分析 last_source_head..current_source_head；只同步需求变化和同根因修复，排除格式化、文档和无关重构。
验收：证明目标是否存在同一根因；存在则按目标原生消息提示方式最小修复，不存在则形成 NO_CHANGE_REQUIRED 证据。
```

如果源变更尚未形成稳定 commit，本轮只会输出 `PREVIEW_ONLY` 候选清单，不会修改目标或推进同步基线。

### 示例 3：源修改完成后逐项目决定同步动作

```text
$jj-same
操作：源修改完成后的同步发现
源项目：承接前台
源分支：feat/cj-0717-4
范围：列出同一前台项目族的同步候选，不自动切换仓库或分支。
验收：逐项目展示 sync_key、最近检查点、源增量范围和 READY / ALREADY_SYNCED / ELIGIBLE / DEFERRED / BLOCKED / N/A 状态，再等待我选择 SYNC_NOW、DEFER、NOT_APPLICABLE 或 PAUSE_RELATION。
```

## 执行过程

1. 确认本轮是首次迁移、准备交接、消费交接、更新交接还是按 `sync_key` 继续同步。
2. 核对源/目标仓库、业务角色、分支、`HEAD`、工作区和当前授权范围；业务角色不能只根据仓库名或技术栈猜测。
3. 从当前需求、会话、需求文档、Git 和源码交叉还原最终需求，区分 `MUST`、`TARGET-ONLY`、`DO-NOT-PORT` 和 `UNRESOLVED`。
4. 有 `handoff_ref` 时先做 freshness gate；有效快照只复用共享源需求引用，目标仍重新验证自己的入口、API、状态、权限和 legacy。
5. 为当前目标建立能力矩阵，对每项能力标记 `DIRECT / ADAPT / EXTEND / BLOCKED / N/A`，并给出最小文件范围和剃刀排除项。
6. 达到 `EXECUTION_READY` 后生成最窄计划；当前请求已明确要求实施时，在同一轮进入业务代码和聚焦测试修改。
7. 运行 `git diff --check`、目标文件 lint、聚焦单元测试或契约测试。默认不运行 build、浏览器或 E2E；确有运行时风险且静态证据不足时，输出最小人工测试清单。
8. 目标实现、验证和 review 满足完成门禁后，记录目标 commit、artifact refs 和同步检查点；失败时保留旧基线。

## 输出/完成标准

- 明确使用了哪些会话、文档、分支、commit、diff 或 handoff snapshot。
- 给出最终需求账本、源变更地图、目标能力矩阵和明确排除项。
- 每个目标分别说明是否分析、是否修改、采用 `DIRECT / ADAPT / EXTEND / BLOCKED / N/A` 中哪一种决策。
- 输出 `稳健 / 剃刀 / 精准 / 最小化 / 复用` 五项门禁结论。
- 当前目标的修改能追溯到 `REQ-*`、`MUST` 或目标专有的 `TARGET-ONLY`，没有顺手覆盖未授权项目。
- 列出实际运行、默认跳过、标记 `N/A` 和等待用户执行的验证，不能把静态检查写成运行时验收。
- 持续同步只有在目标已实施并验证成功，或有充分证据形成 `NO_CHANGE_REQUIRED` 时，才推进 `last_source_head`。

## 关键门禁与状态

### 实施与交接双门禁

- `EXECUTION_READY`：已有实施授权、稳定源 commit/diff、可收敛的最终需求、已验证的目标调用链，且没有影响 `MUST` 的冲突。满足后可以开始编码。
- `HANDOFF_READY`：目标实现完成，聚焦检查通过，review 不阻塞，必要运行时验收已确认或有 `N/A` 证据。满足后才可宣称完成并推进检查点。

源 review、UAT 或交接记录仍为 `PENDING`，通常只是 caveat，不应单独阻塞当前目标编码；明确失败、源不稳定或需求冲突才是实施阻塞。

### Handoff freshness

| 状态 | 用户会看到的动作 |
| --- | --- |
| `FRESH` | `REUSE`，复用正式需求引用并继续目标分析 |
| `PARTIAL` | 结合 `execution_readiness` 决定带 caveat 实施或保持阻塞 |
| `STALE` | `REFRESH_SOURCES`，只刷新变化来源并生成 successor snapshot |
| `BROKEN` | `REBASELINE`；无法恢复时为 `BLOCKED` |

旧 snapshot 不会被原地覆盖；更新交接会生成带 `parent_snapshot` 的 successor。Snapshot 更新本身不推进任何目标同步基线。

### 同步候选状态与动作

- 候选状态：`READY / ALREADY_SYNCED / ELIGIBLE / DEFERRED / PREVIEW_ONLY / BLOCKED / N/A`。
- 用户动作：`SYNC_NOW / DEFER / NOT_APPLICABLE / PAUSE_RELATION`。
- `DEFER` 会在目标项目保留 open issue，不修改目标、不推进基线；恢复时仍从最近成功检查点重新计算完整范围。

## 常见误区

- 把“源分支已更新”当成“目标已同步”。目标只有形成成功检查点后才推进基线。
- 每个目标重新读取完整源会话、重新生成源分析和 blueprint。有效 `handoff_ref` 应被多个目标复用。
- 复制前一个目标的文件或计划。每个目标必须按自己的源码和调用链生成 `ANL-TARGET` 与最小补丁。
- 用默认 `cj -> dj -> cz` 顺序否决用户当前明确指定的目标。默认顺序只用于 Agent 自动推荐下一目标。
- 为了“保持一致”顺手重构目标 legacy、跨前台/后管广播或修改未授权仓库。
- 没有稳定 commit 时仍同步，或在验证失败后推进 `last_source_head`。
- 把 `PARTIAL_HANDOFF` 一律视为不能编码。应单独检查 `execution_readiness`。
- 把 `$jj-same` 当作后台 daemon。自动化最多发送同步事件或创建待审查 PR，不应静默修改和合并目标。

## 相关命令

- [`jj-dispatch`](command-jj-dispatch.html)：在独立控制项目中预览、派发和恢复跨项目任务。
- [`jj` CLI](command-cli.html)：安装资产与本地调试输出。
- [维护说明](maintenance.html)：维护 `jj-flow` 项目本身时运行 `npm run verify`。
