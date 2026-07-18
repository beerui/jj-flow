# `jj` / `jj-flow` CLI

`jj` 与 `jj-flow` 是同一个 Node.js CLI 的两个可执行名，面向 jj-flow 维护者和自动化脚本。它可以读取 intent 与 evidence，生成 recipe、guard、execution decision、knowledge loop 和 Maestro prompt；它不会在终端里代替 Codex/Claude Code 完成真实业务交付。

## 适用场景

- 维护者需要检查某个 intent 会被路由到哪个内置 mode。
- CI 或脚本需要结构化 JSON，用于检查 evidence、guard 和 Maestro 调用链。
- 调试 `same` recipe。
- 使用 `install-skill` 安装或更新 Codex/Claude Code 原生命令资产，使用 `uninstall-skill` 安全卸载。
- 使用 `doctor` 只读判断当前仓库的 Harness、Git、host capabilities 和自治等级。
- 使用 `scenario` 运行固定、隔离、无副作用的任务级回归。
- 使用 `trace explain` / `trace replay` 解释或纯重放 scenario trace，不重复 host action。
- 使用 `host-trial` 在临时 Git repo/worktree 中验证 A2/A3 半真实 Host 闭环。
- 使用 `harness-gc` 只读检查 Harness 漂移、规则健康和维护重复。
- 使用 `dispatch-tick` 对控制面做一次可恢复调度预览或写回。

## 何时不用

- 真实迁移应在 Codex 中使用 `$jj-same`，或在 Claude Code 中使用 `/jj-same`。
- 真实多项目调度应在 Codex 中使用 `$jj-dispatch`。
- 不要在终端执行 `jj same ...` 后期待 CLI 修改业务代码；它只生成调度结果。
- 管理命令资产时使用 `install-skill` 或 `uninstall-skill`，完整说明见[安装](installation.html)。

## 命令格式

两个可执行名等价：

```text
jj [mode] <intent> [--cwd <dir>] [--evidence <file>] [--json]
jj-flow [mode] <intent> [--cwd <dir>] [--evidence <file>] [--json]
```

`mode` 可省略。省略时使用内部 `auto` 路由；没有命中明显关键词时，回退到 `same`。

支持的 mode：

- `auto`（仅 CLI 内部路由，不是对话入口）
- `same`

安装、卸载与调度：

```text
jj install-skill [--platform codex|claude|all] [--project | --target dir] [--force] [--dry-run] [--json]
jj uninstall-skill [--platform codex|claude|all] [--project | --target dir] [--force] [--dry-run] [--json]
jj doctor [--json]
jj scenario list [--json]
jj scenario check [--json]
jj scenario run <scenario|all> [--json]
jj trace explain <trace.json> [--json]
jj trace replay <trace.json> [--json]
jj host-trial run [--json]
jj harness-gc [--json]
jj dispatch-tick --manifest control-plane.json --delivery DELIVERY_ID \
  [--expected-revision N] [--receipt receipt.json] [--capabilities a,b,c] [--write] [--json]
```

注意：

- `install-skill` 会在每个目标根目录写入 `.jj-flow-install.json`，记录包版本、明确资产名和内容摘要。
- `uninstall-skill` 默认只删除摘要匹配的自有资产；任一资产被修改时整组拒绝删除。`--dry-run --json` 会返回 `would_remove`、`conflicts` 和 `conflict_details`。
- 已移除的旧版入口没有 ownership manifest，只会作为明确 retired 候选报告；必须审查后显式使用 `--force`。命令不会按 `jj-*` 前缀扫描未知文件。
- `doctor` 只读取 Git、`harness-manifest.json` 和仓库文件，不修复、不安装、不派发；失败输出包含 `rule_id`、原因和下一动作。
- `scenario list` 输出 Manifest 机械校验的 runtime registry；`scenario check` 执行全部场景但省略完整 trace；`scenario run` 输出统一 report 和可审计 trace。
- 当前场景为 `dispatch-happy-path`、`dispatch-interrupted-resume`、`dispatch-partial-target-failure` 和 `same-handoff-contract`。
- 场景只使用固定 fixture 与内存状态。report 始终声明隔离策略；`trace replay` 会校验 before/after/output/final hash，并在最早不匹配步骤失败。
- `trace.json` 相对当前工作目录解析；replay 重新调用纯状态转换，但不执行 trace 中记录的 `CREATE_THREAD` 或 `RECONCILE_THREAD`。
- `host-trial` 会创建临时控制仓、真实 Git repo 和 worktree，执行 CAS、中断对账及两轮 Review，然后删除临时目录。它不联网、不触碰业务仓，也不创建 Codex App task。
- 半真实报告中的批准和 sandbox attestation 是固定 Host fixture，用于验证协议消费；真实宿主能力仍需在 Codex App 环境单独验证。
- `harness-gc` 输出 100 分质量评分；P0/P1 使命令失败，P2/P3 仅形成维护建议。它不会自动删除、重写或创建 `.workflow`。
- `--delivery` 是控制面 `delivery_id`，不是已移除的 `$jj-delivery` 入口。
- `dispatch-tick` 是单次 tick/resume：消费结构化 receipt、按 `expected_revision` 做 revision CAS，输出 `actions` / `decision_required` / `next_wait`。
- `--write` 使用文件级 CAS 写回；若磁盘 revision 已变化，返回 `REVISION_CONFLICT` 且不覆盖。
- 目标 `ANL-TARGET` 差异决策不可绕过（已移除 `--no-target-analysis`）。
- 未批准差异的目标会进入 `decision_required`，但**不会**阻塞其它已就绪目标的派发。
- 恢复时会对仍为 `PENDING_THREAD` 的 intent 重新输出 `CREATE_THREAD` actions，避免中断后丢动作。

## 参数

- `[mode]`：可选，显式指定 recipe。自动化场景建议指定，避免关键词路由产生歧义。
- `<intent>`：自然语言目标。多个非选项参数会按空格拼成完整 intent。
- `--cwd <dir>`：把指定目录作为项目上下文写入调度结果。默认是当前工作目录。
- `--evidence <file>`：读取一个 UTF-8 JSON evidence 文件。文件内容可以是 evidence 数组，也可以是包含 `evidence` 数组的对象。
- `--json`：输出完整 JSON；不传时输出适合人读的 Markdown。
- `--help` / `-h`：显示 CLI 安装与定位说明。

## 相关命令

- [`jj-same`](command-jj-same.html)：Codex/Claude Code 中的同源迁移入口。
- [`jj-dispatch`](command-jj-dispatch.html)：Codex 多项目调度入口。
- [安装](installation.html)：`install-skill` 与 `uninstall-skill` 完整参数。
