# 安装

## 安装目标

安装完成后，Codex 能识别 `$jj`。你在项目对话里输入 `$jj delivery ...` 时，Codex 会按 `jj-flow` 的方式先整理需求、资料和验收边界，再继续推进交付。

## 前置条件

- 已安装 Codex，并能读取本机 `~/.codex/skills/` 目录。
- 已获取 `jj-flow` 仓库代码。
- 当前版本以 Codex skill 为主入口，CLI 只作为 skill 内部实现和维护调试使用。

## 推荐安装

已发布 beta 包时，推荐用 `npx` 直接安装：

```bash
npx @shendu-sdt/jj-flow@beta install-skill
```

默认会把 `skills/jj` 安装到用户级 Codex skill 目录：

```text
~/.codex/skills/jj
```

如果只希望当前项目可用，使用项目级安装：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --project
```

项目级安装目标是：

```text
./.codex/skills/jj
```

在 `jj-flow` 仓库或 npm 包已全局安装时，也可以运行：

```bash
jj install-skill
```

默认会把 `skills/jj` 安装到：

```text
~/.codex/skills/jj
```

安装后目录应包含：

```text
~/.codex/skills/jj/SKILL.md
```

如果目标目录已经存在，命令会停止，避免无意覆盖本地 skill。确认要更新时使用：

```bash
jj install-skill --force
```

如果只想预览写入位置，不实际复制文件：

```bash
jj install-skill --dry-run
```

需要安装到自定义目录时：

```bash
jj install-skill --target D:/path/to/.codex/skills/jj
```

## 手动安装

如果安装命令不可用，可以手动把仓库里的 `skills/jj` 复制或同步到 Codex skill 目录：

```text
源目录：D:/daji-docs/jj-flow/skills/jj
目标目录：~/.codex/skills/jj
```

手动安装只作为排障备选；正常路径优先使用 `jj install-skill`。

## 确认生效

在 Codex 新对话里输入：

```text
$jj delivery 测试安装是否生效
```

期望行为：

1. Codex 识别 `$jj` skill。
2. 输出内容围绕这次交付怎么开始，而不是泛泛解释命令。
3. 当资料不足时，明确告诉你哪些信息还需要确认。
4. 不要求用户先传 `--prd`、`--api`、`--design` 等固定参数。

## 项目内使用

在真实项目里使用时，不需要先准备 CLI 参数。直接把上下文写进 Codex 对话：

```text
$jj delivery
需求：实现 AI 获客列表和详情。
资料：PRD 在 docs/v17.1，接口文档用 YApi 链接，设计图是 MasterGo 链接。
关键决策：列表先按运营视角验收，导出能力本期不做。
```

`$jj` 会优先整理项目上下文、资料来源和关键决策；只有边界、方案或权限真正阻塞时才追问。

## 升级

升级时使用：

```bash
jj install-skill --force
```

然后重新打开 Codex 对话验证。

## 常见问题

### Codex 没有识别 `$jj`

先检查 `~/.codex/skills/jj/SKILL.md` 是否存在。若文件存在但仍无法识别，重新打开 Codex 对话，或确认当前 Codex 配置允许加载本地 skills。

### `$jj` 识别了，但输出像普通聊天

通常是 skill 没有被加载，或触发文本没有写成 `$jj ...`。重新用 `$jj delivery ...` 触发，并确认 skill 文件内容来自本仓库。

### 为什么还保留 CLI

CLI 主要给维护者安装、测试和排障使用。普通交付用法以 Codex 内 `$jj` 为准。
