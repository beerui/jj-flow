# 安装

把 **项目族编排工作流** 的对话入口装到本机或当前项目：主能力是 **same（迁移）** 与 **dispatch（调度）**。`npx` 只复制资产，不在终端里替你改业务代码。

## 安装目标

完成后应能：

- Codex：`$jj-same`、`$jj-dispatch`、兼容入口 `$jj`
- Claude Code：`/jj-same`、兼容入口 `/jj`
- Qoder：`/jj-same`、`/jj-ralph`、`/jj-review`、`/jj-dispatch`、`/jj-end`、兼容入口 `/jj`

`$jj-dispatch` 目前仅 Codex；需要 project / thread / worktree 等 host 能力，缺失时停在预览或阻塞。

`.codex/agents/` 提供 Reviewer / Developer 角色期望。首次使用后请将项目标为 trusted，重启或新建任务，并确认角色与 sandbox attestation 可用后再 `BIND_THREAD`。

## 安装后下一步

1. [使用说明](usage.html)  
2. 第一件事优先 [$jj-same](command-jj-same.html) 或 [$jj-dispatch](command-jj-dispatch.html)

## 前置条件

- 使用 Codex 时，需要 Codex 能读取本机 `~/.codex/skills/`、`~/.codex/agents/`，或项目内对应的 `./.codex/` 目录。
- 使用 Claude Code 时，需要 Claude Code 能读取本机 `~/.claude/commands/` 或项目内 `./.claude/commands/`。
- 使用 Qoder 时，需要 Qoder 能读取本机 `~/.qoder/skills/` 或项目内 `./.qoder/skills/`。
- 已能通过 `npx` 运行 npm 包。

## 推荐安装

默认安装 Codex skills 和配套 agents：

```bash
npx @shendu-sdt/jj-flow@beta install-skill
```

安装到：

```text
~/.codex/skills
~/.codex/agents
```

安装 Claude Code slash commands：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --platform claude
```

安装到：

```text
~/.claude/commands
```

安装 Qoder skills：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --platform qoder
```

安装到：

```text
~/.qoder/skills
```

同时安装两端资产：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --platform all
```

只给当前项目安装：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --platform all --project
```

项目级安装目标是：

```text
./.codex/skills
./.codex/agents
./.claude/commands
./.qoder/skills
```

## 安装选项

- `--platform codex`：同时安装 Codex skills 和配套 agents，默认值。
- `--platform claude`：安装 Claude Code slash commands。
- `--platform qoder`：安装 Qoder skills。
- `--platform all`：同时安装 Codex、Claude Code 和 Qoder 资产。
- `--project`：安装到当前项目的 `./.codex/skills`、`./.codex/agents`、`./.claude/commands` 或 `./.qoder/skills`。
- `--target <dir>`：自定义 skills/commands 目标；Codex agents 安装到该目录的兄弟 `agents` 目录。不能和 `--platform all` 一起使用。
- `--force`：skills 或 agents 任一目标已存在时，覆盖整组安装文件。
- `--dry-run`：预览 skills、agents、commands 的位置与冲突，不复制文件。
- `--json`：输出结构化结果，便于脚本检查。

升级已有安装：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --force
```

首次安装或更新成功后，命令会紧接着输出当前版本及其最新版本日志。使用 `--json` 时读取 `version` 和 `release_notes` 字段。`--dry-run` 只预览写入位置，不输出版本日志。

安装还会在对应的 skills、agents 或 commands 目标根目录写入 `.jj-flow-install.json`。它只登记 jj-flow 实际复制的顶层资产及其 SHA-256 内容摘要，供后续卸载判断所有权和本地修改。

预览安装位置：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --platform all --dry-run
```

## 卸载

先预览全平台卸载：

```bash
npx @shendu-sdt/jj-flow@beta uninstall-skill --platform all --dry-run --json
```

确认没有冲突后执行：

```bash
npx @shendu-sdt/jj-flow@beta uninstall-skill --platform all
```

卸载沿用安装的 `--platform`、`--project`、`--target`、`--dry-run` 和 `--json` 目标规则，并遵守以下保护：

- ownership manifest 中摘要匹配的资产可以直接删除。
- 当前包资产没有 manifest 时，只有内容与当前包完全一致才可直接删除。
- 本地修改过的资产会返回 `modified-assets`，且整组不执行删除。
- `jj-auto`、`jj-delivery`、`jj-evolve`、`jj-feat`、`jj-fix`、`jj-knowhow`、`jj-validate` 等历史入口因缺少旧版所有权证据，默认只报告为 `ownership-unverified`。
- `--force` 只会强制删除当前包和上述明确 retired 清单中的精确路径；不会扫描或删除其它 `jj-*` 文件。使用前必须先查看 dry-run 结果。

例如，清理旧 Codex 安装残留：

```bash
npx @shendu-sdt/jj-flow@beta uninstall-skill --dry-run --json
npx @shendu-sdt/jj-flow@beta uninstall-skill --force
```

## 手动安装

如果安装命令不可用，可以手动复制 npm 包或仓库中的原生资产：

```text
Codex 技能源目录：.codex/skills/（jj、jj-same、jj-dispatch）
Codex 技能目标目录：~/.codex/skills/
Codex agent 源目录：.codex/agents
Codex agent 目标目录：~/.codex/agents

Claude 命令源目录：.claude/commands/（jj.md、jj-same.md）
Claude 命令目标目录：~/.claude/commands/

Qoder 技能源目录：.codex/skills/（与 Codex 共用同一套 SKILL.md 资产）
Qoder 技能目标目录：~/.qoder/skills/
```

手动安装只作为排障备选；正常路径优先使用 `npx @shendu-sdt/jj-flow@beta install-skill`。

## 确认生效

在 Codex 新对话里输入：

```text
$jj-same 测试安装是否生效
```

在 Claude Code 里输入：

```text
/jj-same 测试安装是否生效
```

在 Qoder 里输入：

```text
/jj-same 测试安装是否生效
```

测试跨项目迁移入口：

```text
$jj-same 会话=019f... 只分析迁移矩阵
/jj-same 会话=019f... 只分析迁移矩阵
```

测试 Codex 控制项目调度入口：

```text
$jj-dispatch PREVIEW origin=B lead=C targets=A,B
```

期望行为：

1. Agent 识别对应的原生命令资产。
2. 输出围绕这次交付怎么开始，而不是解释 shell 命令。
3. 当资料不足时，明确告诉你哪些信息还需要确认。
4. 不要求用户先传 `--prd`、`--api`、`--design` 等固定参数。

## 常见问题

### Codex 没有识别 `$jj-same`

检查 `~/.codex/skills/jj-same/SKILL.md` 是否存在，且文件开头包含 `name: jj-same` 的 frontmatter。若文件存在但仍无法识别，重新打开 Codex 对话，或确认当前 Codex 配置允许加载本地 skills。

### Codex 调度任务没有使用配套角色

检查 `~/.codex/agents/jj-workflow-reviewer.toml` 和 `jj-workflow-developer.toml` 是否存在。Reviewer 配置必须保留 `sandbox_mode = "read-only"`；使用 `--force` 可以把本地旧版本更新为包内版本。

### Claude Code 没有识别 `/jj-same`

检查 `~/.claude/commands/jj-same.md` 是否存在，且文件开头包含 `name: jj-same` 的 frontmatter。若文件存在但仍无法识别，重新打开 Claude Code。

### Qoder 没有识别 `/jj-same`

检查 `~/.qoder/skills/jj-same/SKILL.md` 是否存在，且文件开头包含 `name: jj-same` 的 frontmatter。若文件存在但仍无法识别，重新打开 Qoder 对话，或确认当前 Qoder 配置允许加载本地 skills。

### 为什么还保留 `jj` CLI

`jj` CLI 只做安装和维护调试，例如生成结构化调度结果、跑项目自检测试。普通交付不要在终端运行 `jj-same`；应该在 Codex 中使用 `$jj-same`，或在 Claude Code 中使用 `/jj-same`。
