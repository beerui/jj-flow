# `jj` / `jj-flow` CLI

`jj` 与 `jj-flow` 是同一个 Node.js CLI 的两个可执行名，面向 jj-flow 维护者和自动化脚本。它可以读取 intent 与 evidence，生成 recipe、guard、execution decision、knowledge loop 和 Maestro prompt；它不会在终端里代替 Codex/Claude Code 完成真实业务交付。

## 适用场景

- 维护者需要检查某个 intent 会被路由到哪个内置 mode。
- CI 或脚本需要结构化 JSON，用于检查 evidence、guard 和 Maestro 调用链。
- 调试 `delivery`、`validate`、`evolve` recipe。
- 使用 `install-skill` 安装或更新 Codex/Claude Code 原生命令资产。

## 何时不用

- 真实需求交付应在 Codex 中使用 `$jj-delivery`，或在 Claude Code 中使用 `/jj-delivery`。
- 不要在终端执行 `jj delivery ...` 后期待 CLI 修改业务代码；它只生成调度结果。
- CLI mode 不包含 `same` 或 `dispatch`。`jj same ...`、`jj dispatch ...` 不会进入 `$jj-same` / `$jj-dispatch`，应在 Codex 对话中使用对应 skill。
- 安装命令资产时直接使用 `install-skill`，完整说明见[安装](installation.html)。

## 命令格式

两个可执行名等价：

```text
jj [mode] <intent> [--cwd <dir>] [--evidence <file>] [--json]
jj-flow [mode] <intent> [--cwd <dir>] [--evidence <file>] [--json]
```

`mode` 可省略。省略时使用内部 `auto` 路由；没有命中明显关键词时，回退到 `delivery`。

支持的 mode：

- `auto`（仅 CLI 内部路由，不是对话入口）
- `delivery`
- `validate`
- `evolve`

## 参数

- `[mode]`：可选，显式指定 recipe。自动化场景建议指定，避免关键词路由产生歧义。
- `<intent>`：自然语言目标。多个非选项参数会按空格拼成完整 intent。
- `--cwd <dir>`：把指定目录作为项目上下文写入调度结果。默认是当前工作目录。
- `--evidence <file>`：读取一个 UTF-8 JSON evidence 文件。文件内容可以是 evidence 数组，也可以是包含 `evidence` 数组的对象。
- `--json`：输出完整 JSON；不传时输出适合人读的 Markdown。
- `--help` / `-h`：显示 CLI 安装与定位说明。

最小 evidence 项通常包含：

```json
{
  "id": "api-contract",
  "source": "$yapi",
  "artifact_type": "yapi_contract",
  "summary": "列表接口字段已确认。"
}
```

缺失的可选字段会被标准化，但 evidence 不会因为标签看起来正确就自动变成 `PASS`。

## 输入模板

人读调试：

```powershell
jj <mode> "<intent>" --cwd "<project-dir>" --evidence "<evidence.json>"
```

自动化：

```powershell
jj-flow <mode> "<intent>" --cwd "<project-dir>" --evidence "<evidence.json>" --json
```

安装原生命令资产：

```powershell
npx @shendu-sdt/jj-flow@beta install-skill
```

## 完整示例

### 示例 1：生成 delivery 的结构化结果

假设 `D:\evidence\delivery.json` 包含项目上下文与测试 evidence：

```powershell
jj delivery "审查 AI 获客页面，重点检查接口字段、权限和测试缺口" --cwd "D:\codeup\ai-leads-web" --evidence "D:\evidence\delivery.json" --json
```

期望输出 JSON，其中 `requested_mode` 和 `mode` 为 `delivery`，并包含 `guard_report`、`execution_decision`、`maestro_calls` 与 `maestro_prompt`。guard 是否为 `PASS` 取决于 evidence 是否真正覆盖要求。
### 示例 2：让内部 auto 根据线上异常路由到 delivery

```powershell
jj-flow "线上 goods-detail 在 09:30 到 10:00 出现 500，按 ARMS 指纹定位根因" --cwd "D:\codeup\mall-web" --evidence "D:\evidence\arms-sls.evidence.json"
```

命令省略 mode，因此先按关键词路由；该 intent 通常进入 `delivery`，输出 Markdown 形式的 Maestro 调用、证据门禁、执行决策、知识闭环和提示词。它仍不会直接修改 `mall-web`。

### 示例 3：项目自检自动化

```powershell
jj validate "检查当前项目状态、文档与 recipe 是否漂移" --cwd "D:\daji-docs\jj-flow" --json
```

当 mode 为 `validate` 且没有显式 evidence 时，CLI 会从 `--cwd` 指向的项目构建自检 evidence，再输出结构化结果。

## 执行过程

1. 解析可选 mode、intent、`--cwd`、`--evidence` 和 `--json`。
2. mode 省略时按关键词自动路由；显式 mode 则直接选择对应 recipe。
3. 读取并标准化 evidence；`validate` / `evolve` 会按规则补充项目管理 evidence。
4. 根据 recipe 计算 evidence checklist 和 guard 状态。
5. 生成 `execution_decision`、knowledge loop、Maestro 调用链和最终 prompt。
6. 以 Markdown 或 JSON 输出，不执行 Maestro 调用链，也不修改业务项目。

## 输出/完成标准

- 命令退出码为 `0`，输出能够被人或脚本完整解析。
- 显式 mode 与 `requested_mode`、最终 `mode` 一致；auto 路由理由可见。
- `cwd`、标准化 evidence、checklist、guard 和 Maestro prompt 均包含在结果中。
- 证据不足时 guard 保持 `PENDING`，guard 失败或兼容性不足时执行决策不会伪装成 `ready`。
- 自动化使用 `--json` 时，应校验字段而不是只搜索输出文本中的 `PASS`。

## 常见误区

- 把 CLI 当成业务执行器。它生成调度产物，不会自动调用 `maestro-execute`。
- 使用 `jj same ...` 或 `jj dispatch ...`。这两个不是 CLI mode，必须使用 Codex 原生 skill。
- 自动化省略 mode，又假设路由永远稳定。明确知道目的时应显式传 `delivery`、`validate` 等 mode。
- `--evidence` 指向非 JSON、缺少 `evidence` 数组的对象，或漏传文件路径。
- 把 `--cwd` 当成自动切换 shell 工作目录；它只设置调度使用的项目上下文。
- 看到 evidence 的 `artifact_type` 就认为 guard 一定通过；状态仍取决于真实 evidence 和 guard 规则。

## 相关命令

- [安装与 `install-skill`](installation.html)：安装、升级和预览 Codex/Claude Code 原生资产。
- [`jj`](command-jj.html)：对话中的兼容路由入口。
- [`jj-delivery`](command-jj-delivery.html)：Codex/Claude Code 中的真实端到端交付（含功能、修复与审查）。
