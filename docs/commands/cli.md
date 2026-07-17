# `jj` / `jj-flow` CLI

`jj` 与 `jj-flow` 是同一个 Node.js CLI 的两个可执行名，面向 jj-flow 维护者和自动化脚本。它可以读取 intent 与 evidence，生成 recipe、guard、execution decision、knowledge loop 和 Maestro prompt；它不会在终端里代替 Codex/Claude Code 完成真实业务交付。

## 适用场景

- 维护者需要检查某个 intent 会被路由到哪个内置 mode。
- CI 或脚本需要结构化 JSON，用于检查 evidence、guard 和 Maestro 调用链。
- 调试 `same` recipe。
- 使用 `install-skill` 安装或更新 Codex/Claude Code 原生命令资产。
- 使用 `dispatch-tick` 对控制面做一次可恢复调度预览或写回。

## 何时不用

- 真实迁移应在 Codex 中使用 `$jj-same`，或在 Claude Code 中使用 `/jj-same`。
- 真实多项目调度应在 Codex 中使用 `$jj-dispatch`。
- 不要在终端执行 `jj same ...` 后期待 CLI 修改业务代码；它只生成调度结果。
- 安装命令资产时直接使用 `install-skill`，完整说明见[安装](installation.html)。

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

安装与调度：

```text
jj install-skill [--platform codex|claude|all] [--project | --target dir] [--force] [--dry-run] [--json]
jj dispatch-tick --manifest control-plane.json --delivery DELIVERY_ID \
  [--expected-revision N] [--receipt receipt.json] [--capabilities a,b,c] [--write] [--json]
```

注意：

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
- [安装](installation.html)：`install-skill` 完整参数。
