# 使用说明

这页只讲用户第一次怎么用：选择入口、提供资料、理解执行过程，以及判断一项工作是否真的完成。`jj-flow` 是 **项目族编排工作流**（迁移 + 调度），不是 Maestro 适配层。安装步骤见 [安装](installation.html)，全部入口见 [命令总览](commands.html)。全部流程禁止调用 `maestro explore`。

## 第一次使用

同源功能迁移、修复同步或 handoff 时，直接用 `$jj-same`：

```text
$jj-same
会话=019f...
当前需求=保留密码入口
源=承接前台
目标=兑接前台,承载前台
```

Claude Code 中把 `$` 换成 `/`：

```text
/jj-same 会话=019f... 源=承接前台 目标=兑接前台 开始迁移
```

多项目波次、批准与恢复时，在控制项目使用 `$jj-dispatch`（仅 Codex）：

```text
$jj-dispatch PREVIEW delivery=DEL-password 目标=承接前台,兑接前台,承载前台
```

## 一份好输入包含什么

不需要准备固定参数，但最好说明下面 4 件事：

- `目标`：你最终要得到什么。
- `资料`：会话、PRD、接口、设计、日志、diff、handoff、截图或文件路径在哪里。
- `范围`：本次明确做什么、不做什么；源与目标是谁。
- `验收`：什么证据能证明完成。

资料不完整也可以先给线索：

```text
$jj-same 参考会话 019f... 与源分支 feat/cj-0717-1，准备交接
```

Agent 应该先寻找已有上下文。只有缺失信息会改变范围、方案、权限或上线风险时，才需要你补充决策。

## 怎么选择命令

- 同源迁移 / handoff / 持续同步：[$jj-same](command-jj-same.html)
- 多项目任务调度：[$jj-dispatch](command-jj-dispatch.html)
- 不确定：[$jj](command-jj.html) 兼容入口（默认路由到 same）

已移除 `$jj-delivery`、`$jj-validate`、`$jj-evolve`。控制面 `delivery_id` 仍用于 `$jj-dispatch` 任务身份。

更完整的选择说明见 [命令总览](commands.html)。

## 你会看到的执行过程

不同命令细节不同，但一次可靠的迁移通常按这个顺序推进：

1. 确认真实目标、源/目标、已有资料和不做范围。
2. 从会话、Git、文档或 handoff snapshot 核对证据（**不使用 `maestro explore`**）。
3. 说明缺口、风险和需要用户拍板的决策。
4. 给出最小可执行迁移矩阵与计划。
5. 在批准边界内实施或同步。
6. 运行与改动风险匹配的验证。
7. 区分已验证、待确认和阻塞项。

如果 Agent 还没核对资料就直接写代码，或者把无法验证的内容写成已经完成，说明流程没有正确执行。

## 3 个完整场景

### 场景一：会话驱动迁移

```text
$jj-same
会话=019f...
当前需求=账号安全页保留密码入口
源=承接前台
目标=兑接前台,承载前台
验收：目标调用链验证通过，聚焦测试通过
```

### 场景二：准备交接再迁目标

```text
$jj-same 准备交接 会话=019f... 源提交=c0c360f9d 功能=密码更新提醒
$jj-same 交接=@path/to/handoff-snapshot.yaml 当前项目=兑接 开始迁移
```

### 场景三：多项目调度

```text
$jj-dispatch PREVIEW delivery=DEL-password
$jj-dispatch DISPATCH 批准 delivery=DEL-password 的当前 task_keys
$jj-dispatch RECONCILE task_key=DEL-password/dj/development/1
```

## 完成标准

- 关键证据可追溯（会话、commit、handoff、验证结果）。
- 目标改动可对应需求账本与迁移决策。
- 未验证项明确标为 `PENDING` / `BLOCKED` / `N/A`，不伪装成已完成。
- 多项目任务以 control-plane、Git commit、VRF/REV 为准推进 checkpoint。
