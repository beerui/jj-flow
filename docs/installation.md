# 1 分钟安装与配置

`jj-flow` 安装的是**对话入口与角色资产**（包含对话协议 `skills/`、斜杠命令 `commands/` 以及命名子代理 `agents/`），而不是后台常驻服务。安装完成后，你只需要在自己的业务项目对话窗口里输入 `$jj-…` 或 `/jj-…`，无需学习复杂的底层命令行。

## 前置要求

* **Node.js**：建议使用 `v20.19.0` 及以上版本（供 `npx` 安装脚本与内置轻量脚本运行）。
* **Git**：业务仓库需已初始化 Git，且配置好常规的远端（如 `origin`）。
* **AI 编程工具**：已安装 Codex、Claude Code、Grok 或 Qoder 中的任意一款。

## 第 1 步：选择安装方式

你可以根据团队习惯，选择**安装到当前业务项目**（推荐团队共享）或**安装到本机用户目录**（个人跨项目通用）。

### 方式 A：在当前业务项目安装全平台入口（推荐）

打开终端，进入你的**业务仓库根目录**，执行以下一行命令：

```bash
npx @brewer/jj-flow@latest install-skill --platform all --project
```

执行后，安装器会在当前项目下按平台写入对应的入口文件，同时在你的用户主目录初始化空的 `~/.jj-flow` 全局配置结构：

| 宿主平台 | 项目级安装位置（含 `--project`） | 用户级全局安装位置（不含 `--project`） | 安装内容说明 |
| :--- | :--- | :--- | :--- |
| **Codex** | `.codex/skills` + `.codex/agents` | `~/.codex/skills` + `~/.codex/agents` | 对话技能协议 + TOML 命名子代理 |
| **Claude Code** | `.claude/skills` + `.claude/commands` + `.claude/agents` | `~/.claude/skills` + `~/.claude/commands` + `~/.claude/agents` | 完整技能 + `/jj-*` 斜杠命令 + Markdown 命名子代理 |
| **Grok** | `.grok/skills` + `.grok/agents` | `~/.grok/skills` + `~/.grok/agents` | 对话技能协议 + Markdown 命名子代理（自动兼容 Claude 资产） |
| **Qoder** | `.qoder/skills` | `~/.qoder/skills` | 对话技能协议 |
| **AGENTS 兼容** | `.agents/skills` + `.agents/commands` | `~/.agents/skills` + `~/.agents/commands` | 通用 AGENTS 兼容入口 |

### 方式 B：只安装你正在使用的单一平台

如果你只使用某一款工具，且希望全局生效（所有项目无需重复安装），可以去掉 `--project` 并指定 `--platform`：

```bash
# 只装 Claude Code（全局 ~/.claude）
npx @brewer/jj-flow@latest install-skill --platform claude

# 只装 Codex（全局 ~/.codex）
npx @brewer/jj-flow@latest install-skill --platform codex

# 只装 Grok（全局 ~/.grok）
npx @brewer/jj-flow@latest install-skill --platform grok

# 只装 Qoder（全局 ~/.qoder）
npx @brewer/jj-flow@latest install-skill --platform qoder
```

::: tip 自动防重机制：同一份资产不会在两处重复出现
如果你的用户级目录（如 `~/.claude`）和项目级目录（如 `./.claude`）同时存在同名命令，编辑器菜单里会显示两个重复的 `/jj-ralph`。
因此，当你执行 `--project` 安装时，若检测到用户级已装过相同资产，安装器会**自动跳过**并在输出字段 `shadowed` 中提示你，确保菜单干净。如果你确实需要两层各留一份，可显式加上 `--force`。
:::

## 第 2 步：验证安装是否成功

安装完成后，**新开一轮对话会话**（让宿主重新加载命令列表），在输入框中试输入前缀：

| 你使用的工具 | 调用前缀 | 完整的试跑输入示例 | 预期表现 |
| :--- | :--- | :--- | :--- |
| **Codex** | `$jj-…` | `$jj-init` | 输入 `$jj-` 时出现技能提示，发送后生成当前项目的接入提案 |
| **Claude Code** | `/jj-…` | `/jj-init` | 输入 `/jj-` 时出现斜杠命令补全菜单 |
| **Grok / Qoder** | `/jj-…` | `/jj-init` | 输入 `/jj-` 时出现命令补全，并能正常响应 |

你也可以在终端运行只读诊断命令，一眼看清本机目录与当前仓库的状态：

```bash
npx @brewer/jj-flow@latest doctor
```

它会用简明中文列出：`~/.jj-flow` 主目录是否就绪、项目地图 `map.md` 中已登记几个项目、当前仓库是否已在地图中。

## 第 3 步：了解自动生成的本机目录（`~/.jj-flow`）

首次运行 `install-skill` 时，系统会在你的用户主目录下创建 `~/.jj-flow`（若已有同名文件则绝不覆盖），用于存放跨项目的全局信息：

```text
~/.jj-flow/
├── naming.json          # 全局路径与分支命名约定配置（一般保持默认即可）
├── map.md               # 全局项目地图（记录各项目的中文名、路径与所属项目族）
├── knowledge/           # 跨项目共享知识库（仅在经你确认后写入）
└── memory/              # 按项目隔离的记忆热层（归档任务时自动沉淀可复用经验）
```

::: info 隐私与安全边界
新项目安装后**不会**自动把自己写进全局地图或知识库。只有当你在对话里主动调用 `$jj-init` / `/jj-init` 并点击确认后，才会写入 `~/.jj-flow/map.md` 或 `~/.jj-flow/knowledge/`。
:::

## 日常升级与清理卸载

### 升级到最新版本

当 `@brewer/jj-flow` 发布新版本后：

* **仅补齐新增命令（保留本地微调）**：直接重新执行安装命令（不带 `--force`），安装器会补齐新版本增加的技能，同时跳过已存在的文件。
* **完整覆盖升级（推荐）**：加上 `--force` 参数，将所有官方技能、斜杠命令与子代理刷新到最新版本，并自动清理已废弃的旧文件：

```bash
npx @brewer/jj-flow@latest install-skill --platform all --force
```

升级完成后，请**新开一轮对话**再使用。

### 清理重复安装或完整卸载

如果你以前同时在用户级和项目级装了两份，或者想卸载 `jj-flow`，可以先用 `--dry-run` 预览将要删除的文件，确认无误后再正式移除：

```bash
# 1. 先预览将要移除的文件（只读，不删文件）
npx @brewer/jj-flow@latest uninstall-skill --platform all --dry-run

# 2. 确认无误后正式卸载（如果只想删掉项目级重复副本，加上 --project）
npx @brewer/jj-flow@latest uninstall-skill --platform all
```

卸载器严格按照安装清单（ownership manifest）删除官方资产：你自己在目录里新建的其他自定义 skill 或本地修改过的文件，默认会被安全保护（除非你显式加上 `--force`）。

## 下一步去哪？

* 已经装好入口？立刻前往 [第一次使用（完整实战）](usage.md)，用 5 分钟跑通第一个完整需求。
* 想直接看所有对话命令？查看 [命令总览与选型指南](commands.md)。
