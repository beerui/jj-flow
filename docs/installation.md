# 安装

## 安装目标

安装完成后：

- Codex 识别 `$jj-delivery`、`$jj-fix`、`$jj-review` 等 skills。
- Codex 识别 `$jj-same`，用于同源项目间迁移功能、修复和需求变更。
- Claude Code 识别 `/jj-delivery`、`/jj-fix`、`/jj-review` 等 slash commands。
- Claude Code 识别 `/jj-same`。

`jj-flow` 参考 Maestro 的包结构：npm 包携带 `.codex/skills` 和 `.claude/commands` 原生命令资产；`npx` 只负责复制这些资产，不承担真实交付执行。

## 前置条件

- 使用 Codex 时，需要 Codex 能读取本机 `~/.codex/skills/` 或项目内 `./.codex/skills/`。
- 使用 Claude Code 时，需要 Claude Code 能读取本机 `~/.claude/commands/` 或项目内 `./.claude/commands/`。
- 已能通过 `npx` 运行 npm 包。

## 推荐安装

默认安装 Codex skills：

```bash
npx @shendu-sdt/jj-flow@beta install-skill
```

安装到：

```text
~/.codex/skills
```

安装 Claude Code slash commands：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --platform claude
```

安装到：

```text
~/.claude/commands
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
./.claude/commands
```

## 安装选项

- `--platform codex`：安装 Codex skills，默认值。
- `--platform claude`：安装 Claude Code slash commands。
- `--platform all`：同时安装 Codex 和 Claude Code 资产。
- `--project`：安装到当前项目目录。
- `--target <dir>`：安装到自定义目录；不能和 `--platform all` 一起使用。
- `--force`：目标资产已存在时覆盖文件。
- `--dry-run`：只预览写入位置，不复制文件。
- `--json`：输出结构化结果，便于脚本检查。

升级已有安装：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --force
```

首次安装或更新成功后，命令会紧接着输出当前版本及其最新版本日志。使用 `--json` 时读取 `version` 和 `release_notes` 字段。`--dry-run` 只预览写入位置，不输出版本日志。

预览安装位置：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --platform all --dry-run
```

## 手动安装

如果安装命令不可用，可以手动复制 npm 包或仓库中的原生资产：

```text
Codex 源目录：.codex/skills/jj-delivery
Codex 目标目录：~/.codex/skills/jj-delivery
Codex 迁移源目录：.codex/skills/jj-same
Codex 迁移目标目录：~/.codex/skills/jj-same

Claude 源文件：.claude/commands/jj-delivery.md
Claude 目标文件：~/.claude/commands/jj-delivery.md
Claude 迁移源文件：.claude/commands/jj-same.md
Claude 迁移目标文件：~/.claude/commands/jj-same.md
```

手动安装只作为排障备选；正常路径优先使用 `npx @shendu-sdt/jj-flow@beta install-skill`。

## 确认生效

在 Codex 新对话里输入：

```text
$jj-delivery 测试安装是否生效
```

在 Claude Code 里输入：

```text
/jj-delivery 测试安装是否生效
```

测试跨项目迁移入口：

```text
$jj-same 会话=019f... 只分析迁移矩阵
/jj-same 会话=019f... 只分析迁移矩阵
```

期望行为：

1. Agent 识别对应的原生命令资产。
2. 输出围绕这次交付怎么开始，而不是解释 shell 命令。
3. 当资料不足时，明确告诉你哪些信息还需要确认。
4. 不要求用户先传 `--prd`、`--api`、`--design` 等固定参数。

## 常见问题

### Codex 没有识别 `$jj-delivery`

检查 `~/.codex/skills/jj-delivery/SKILL.md` 是否存在，且文件开头包含 `name: jj-delivery` 的 frontmatter。若文件存在但仍无法识别，重新打开 Codex 对话，或确认当前 Codex 配置允许加载本地 skills。

### Claude Code 没有识别 `/jj-delivery`

检查 `~/.claude/commands/jj-delivery.md` 是否存在，且文件开头包含 `name: jj-delivery` 的 frontmatter。若文件存在但仍无法识别，重新打开 Claude Code。

### 为什么还保留 `jj` CLI

`jj` CLI 只做安装和维护调试，例如生成结构化调度结果、跑项目自检测试。普通交付不要在终端运行 `jj-delivery`；应该在 Codex 中使用 `$jj-delivery`，或在 Claude Code 中使用 `/jj-delivery`。
