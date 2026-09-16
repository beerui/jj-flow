# 你在哪个工具里用

## 支持哪些

| 工具 | 对话前缀 | 多项目调度 |
|------|----------|------------|
| Codex | `$jj-…` | 有 |
| Claude | `/jj-…` | **没有** 调度命令 |
| Grok | `/jj-…` | 有（默认一个会话做完） |
| Qoder | `/jj-…` | 有 |

不想记前缀时，直接说 `$jj`（Codex）或 `/jj`，由它帮你选择入口。安装时也会写一份入口到 `~/.agents`（AGENTS 兼容工具读取），见[安装](installation.md)。

## Grok 的「一个会话做完」（Mode S）

- 默认：**不用** 为每个任务再开一个会话  
- 状态仍写在调度记录里，不靠聊天当作账本
- **不用** 你手动敲命令行

主仓有无关脏文件、或你明确要求隔离时，改用 **Mode W**：单独 worktree + **命名的功能分支**，不要 detached HEAD。Mode W 只是工作区拓扑，**不能**当作真宿主验收。

用户明确要求并行、且不需要 isolation 时，可用 **Mode P**：每个写任务绑定一个真实子会话（1:1），工作区仍是 project-branch。不能用 placeholder session 冒充多会话；临时 subagent 不能当作持久 session。Mode P + 隔离需求 → 停下来改用 Mode W。

Mode W / Mode P 只是工作区与会话的拓扑，**不能**因此上调无人值守等级（A3 / A4 仍要真宿主验收）。日常用法见 [dispatch](commands/jj-dispatch.md)。

## Grok 与 Claude Code 互通

Grok 无需额外配置，即可自动读取 Claude Code 侧的插件、skills、子代理、MCP 与 hooks，以及 `CLAUDE.md` 等指令文件；Claude 侧的共享资产在 Grok 会话中同样可用。同一套 skills、命令与子代理，两个工具共用一份。

## 「真环境」和「本机试跑」

| | 本机试跑 | 真宿主验收 |
|--|----------|------------|
| 用途 | 测流程、测恢复 | 证明真会话 / 真沙箱 |
| 能不能当作「高级无人值守」依据 | **不能**（半真实） | Grok 真试跑已关闭 Wave 2 并升 A2；见 [真实 Host 验收](milestones/real-host-acceptance.md) |

## 代码写在哪

默认：在 **功能分支** 上改当前仓库。  
只有要隔离时，才用单独的工作目录。

## 相关

[dispatch](commands/jj-dispatch.md)
