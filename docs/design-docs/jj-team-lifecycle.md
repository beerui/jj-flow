# `jj-team-lifecycle`：固定 SDLC 会话执行引擎融入 jj-flow

> 状态：Proposed
>
> P0 最小侵入：设计 + skill 入库 + inventory/command/integrations。  
> 来源：Claude 侧 `team-lifecycle-v4`（固定角色 + prefab pipeline + CHECKPOINT supervisor）。  
> 完整 bridge CLI / 真机 Codex 验收仍未关闭。
>
> 关联：`ARCHITECTURE.md`、`jj-team-coordinate.md`、`jj-team-swarm.md`、`jj-ralph.md`  
> 人类中文对照（非 Agent SSOT）：`docs/skill-zh-bridge/jj-team-lifecycle/README.zh.md`  
> 用户命令页：`docs/commands/jj-team-lifecycle.md`
>
> 产品 id：`jj-team-lifecycle`（inventory 约束 `^jj(-[a-z0-9]+)*$`）  
> Session 前缀：**`TLV4`**（稳定）  
> 别名：用户口语 / 历史入口仍可称 `team-lifecycle-v4` / team lifecycle；**仓库 SSOT 与 install 名以 `jj-team-lifecycle` 为准**

## 1. 摘要

`jj-team-lifecycle` 是 **会话内固定角色 SDLC 执行引擎**，不是第四条交付主路径。

jj-flow 主路径保持 same / ralph / dispatch。可选会话引擎：

| 引擎 | 解决什么 | Session |
| --- | --- | --- |
| `jj-team-coordinate` | **动态**多角色并行实施 / 分析 | `TC-*` |
| **`jj-team-lifecycle`** | **固定**规格→计划→实现→测审 剧本 + CHECKPOINT | `TLV4-*` |
| `jj-team-swarm` | 对抗 ACO 搜索 / 方案优选 | `TAS-*` |

本 skill 产出 `.workflow/.team/TLV4-*`；**不得**推进 ralph `run.json` phase、control-plane checkpoint，或创建 `delivery_id` / 持久 `task_key`。

## 2. 问题与动机

| 痛点 | 说明 |
| --- | --- |
| coordinate 偏灵活 | 大功能需要 brief/PRD/架构/epics **标准文档链**时，动态角色不够「剧本化」 |
| 规格一致性 | 需要 CHECKPOINT 检查 brief↔PRD、全规格自洽、plan 对齐 |
| 与交付事实源混用 | 流水线完成被误当 ACCEPT → 不可恢复 |

目标：

1. 把已验证的 `team-lifecycle-v4` **版本化进 jj-flow**（`skills/` SSOT + install）。
2. 与 coordinate / swarm **并列**，路由表写清何时用谁。
3. 第一版 **最小侵入**：文档 + inventory + 薄 slash + integrations；不改 dispatch/ralph schema。

## 3. 非目标

| 非目标 | 原因 |
| --- | --- |
| 替代 `jj-ralph` ANALYZE→ACCEPT | 控制面与会话引擎不同层 |
| 替代 `jj-team-coordinate` | 动态 vs 固定剧本互补 |
| 用 TLV4 session 推进 checkpoint | 违反 harness 不变量 |
| P0 保证 Codex 与 Claude 100% 同构 | 依赖 TeamCreate / team-worker / supervisor；需 degraded |
| 在 jj-flow **本仓** 写 `.workflow/` | harness 禁止提交 `.workflow` |

## 4. 架构裁决

### 4.1 分层

```text
用户意图
   │
   ├─ 交付闭环 ──► jj-ralph / jj-same / jj-dispatch   （事实源）
   │
   └─ 需要协作 ──► 会话执行引擎
                    ├─ 动态多角色 ──► jj-team-coordinate  (TC-*)
                    ├─ 固定 SDLC ──► jj-team-lifecycle   (TLV4-*)
                    └─ 对抗搜索 ──► jj-team-swarm        (TAS-*)
```

### 4.2 身份对照（禁止混写）

| 身份 | Owner | 示例 |
| --- | --- | --- |
| `RALPH-*` | ralph | `RALPH-login-20260805` |
| `DEL-*` / `task_key` | dispatch | 控制面调度 |
| `TC-*` | team-coordinate | 动态多角色 |
| **`TLV4-*`** | **team-lifecycle** | `TLV4-points-spec-20260807` |
| `TAS-*` | team-swarm | 蚁群搜索 |

### 4.3 何时调用

| 场景 | 建议 |
| --- | --- |
| 单点 tiny 改动 | **不要**上 team/lifecycle；直接 ralph |
| 需要 brief/PRD/架构/epics 标准链 | **`jj-team-lifecycle`** `spec-only` |
| 规格已齐，固定 plan→impl→test→review | **lifecycle** `impl-only` |
| 全链路规格+实现 | **lifecycle** `full-lifecycle`（成本高，确认后用） |
| 多模块并行、角色形状不固定 | **`jj-team-coordinate`** |
| 方案多假设搜索 | **`jj-team-swarm`** |
| 跨仓调度 | **只** `jj-dispatch` |

### 4.4 产物与 bridge（P0 仅文档约定）

| Lifecycle 产物 | 可映射到 | 写入方 |
| --- | --- | --- |
| `spec/*.md` | ralph PLAN / ANALYZE 引用 | agent 手写引用；P0 无 CLI |
| `plan/*` | ralph plan 素材 | 人/agent 确认后写 ralph |
| `artifacts/*` | DELIVER evidence 路径 | parent skill 引用 |
| **禁止** | control-plane、`run.json` gates 静默 PASS | — |

## 5. 宿主能力矩阵

| 能力 | Claude Code | Codex / Grok / Qoder |
| --- | --- | --- |
| Skill install | ✅ | ✅ |
| Slash `/jj-team-lifecycle` | ✅ 薄入口 | `$jj-team-lifecycle` |
| team-worker / supervisor | 优先 | 常 **fallback** general-purpose |
| TeamCreate / Task* / SendMessage | ✅ | 部分 → `tasks.json` + `.msg/` |
| 并行 | ✅ | 允许串行；嵌套 notice 可更长用时 |

**P0 保证**：Claude 主路径可用；其他宿主 **degraded**。细则：`skills/jj-team-lifecycle/references/host-codex.md`。

### skill_root 解析

禁止写死 `.claude/skills/team-lifecycle-v4`。顺序：本 skill 包 → `skills/jj-team-lifecycle/` → 宿主 install → 旧名只读回落。

### 用户提示（仅嵌套）

| 调用方式 | 提示 |
| --- | --- |
| 用户直接 `/jj-team-lifecycle` | **不**打多行 banner |
| 嵌套 ralph / review / dispatch | **一句话**：`开启 lifecycle 模式，开始任务XXX 约 20-45分钟` |

契约：`skills/jj-team-lifecycle/references/user-transparency.md`。

## 6. 仓库落地（P0）

| 资产 | 动作 |
| --- | --- |
| `skills/jj-team-lifecycle/` | Vendor lifecycle + jj-flow 边界 + host 解析 |
| `skill-inventory.json` | 登记 id；`claude_command` + platforms |
| `claude-commands/jj-team-lifecycle.md` | 薄 slash（≤40 行） |
| `skills/jj-ralph/references/integrations.md` | optional lifecycle 一节 |
| `skills/jj/SKILL.md` | 显式 lifecycle 路由（非默认交付） |
| design + ARCHITECTURE + AGENTS + CHANGELOG | 本设计 + 索引 |
| **不改** | `src/dispatch*.mjs`、ralph schema、control-plane |

## 7. 协议要点（继承自 team-lifecycle-v4）

1. Coordinator 入口；固定角色 registry。
2. Pipeline：`spec-only` / `impl-only` / `full-lifecycle`（见 `specs/pipelines.md`）。
3. Supervisor 处理 CHECKPOINT；degraded 可串行跑 supervisor 角色。
4. 消息：优先 team_msg；否则 `.msg/`。
5. 完成：Archive / Keep / Export；不写 ralph gate。

## 8. 分阶段

| 阶段 | 内容 |
| --- | --- |
| **P0**（本变更） | skill vendor + 边界 + inventory/command/route/integrations/design |
| **P1** | ralph ANALYZE/PLAN/DELIVER 何时建议 lifecycle 的路由句；真机 degraded 验收 |
| **P2** | 可选 `jj team-bridge` 引用清单；评估与 coordinate 合并 mode 的长期产品决策 |

## 9. 验收（P0）

- [x] `skills/jj-team-lifecycle/SKILL.md` 含 jj-flow 边界与 identity 分离
- [x] `skill-inventory.json` 含 `jj-team-lifecycle`
- [x] `claude-commands/jj-team-lifecycle.md` 薄入口
- [x] design 入索引 / build-docs
- [x] `jj` 路由与 ralph integrations 指针
- [ ] 真机 Claude / Codex 跑通一条 `spec-only`（人工）
