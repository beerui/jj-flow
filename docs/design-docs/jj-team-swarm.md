# `jj-team-swarm`：对抗蚁群搜索引擎融入 jj-flow

> 状态：Proposed
>
> P0：从 Claude `team-adversarial-swarm` vendor 为 `jj-team-swarm`；用户透明协议 + 多宿主 skill 根解析 + Codex/Grok Workflow 降级说明。  
> 未关闭：真机多宿主 ACO 联调、ralph bridge CLI、Workflow→宿主原生编排的自动转译。
>
> 关联：`jj-team-coordinate.md`（多角色流水线）、`ARCHITECTURE.md`、`jj-ralph.md`  
> 产品 id：`jj-team-swarm`（session 前缀 **`TAS`** 保持稳定）  
> 别名：`team-adversarial-swarm` / TAS  
> 人类中文对照（非 Agent SSOT）：`docs/skill-zh-bridge/jj-team-swarm/README.zh.md`

## 1. 摘要

`jj-team-swarm` 是 **搜索 / 方案优选 / 对抗收敛** 执行引擎，不是交付控制面。

| 引擎 | 解决什么 |
| --- | --- |
| `jj-team-coordinate` | 动态多角色 **实施流水线**（TC-*） |
| `jj-team-lifecycle` | 固定 SDLC **规格→实现→测审**（TLV4-*） |
| **`jj-team-swarm`** | ACO + 对抗评分的 **搜索空间迭代**（TAS-*） |
| `jj-ralph` / `jj-dispatch` | 交付事实源 |

产物：`.workflow/.team/TAS-*/`（config、pheromone、trails、scores、`best-solution.md`）。  
**不得**推进 ralph gates 或 control-plane checkpoint。

## 2. 架构（继承 TAS）

```text
Coordinator (SKILL.md)
  Phase 0 resume
  Phase 1 swarm-config.json  + 用户透明 pre-flight
  Phase 2 python aco.py init
  Phase 3 loop ×K:
    aco select → explore module → score module → aco update → converge module
  Phase 4 aco report → synthesize → best-solution.md
```

Python：`scripts/aco.py` + `pheromone.py` + `scoring.py`（skill 内自包含）。  
模块：`workflows/wf-swarm-{explore,score,converge,synthesize}.js`（Claude Workflow 形态）。

## 3. 非目标

| 非目标 | 原因 |
| --- | --- |
| 替代 coordinate | 角色流水线 vs 搜索迭代 |
| 替代 dispatch | 无 delivery 身份 |
| P0 保证 Claude Workflow 在 Codex/Grok 原样执行 | 宿主编排不同；P0 提供 **agent-parallel 降级** |
| 自动写 ralph ACCEPT | 仅可引用 best-solution 路径 |

## 4. 用户提示（仅嵌套 jj-flow 工作流）

| 调用方式 | 提示 |
| --- | --- |
| 用户直接 `/jj-team-swarm` | **不**打多行 banner |
| 嵌套在 **ralph / review / dispatch** | **一句话**：`开启 swarm 模式，开始任务XXX 约 15-40分钟` |

内部仍要 why-swarm catalog；无理由则不开。契约：`skills/jj-team-swarm/references/user-transparency.md`。

## 5. 宿主兼容

| 能力 | Claude | Codex / Grok 典型 |
| --- | --- | --- |
| Python 3.10+ `aco.py` | ✅ | ✅（需本机 Python） |
| Claude `Workflow(scriptPath)` | ✅ | ❌ → **agent-module fallback** |
| 并行 ants | Workflow parallel | 宿主 parallel 或 **串行蚁** |
| skill 根 | install 目录 | 多路径解析 |

**agent-module fallback**：读各 `wf-swarm-*.js` 中的 args/return 契约与 prompt 模板意图，用 host Agent/子代理实现同等 I/O，写同一 session 文件布局；**不**要求执行 JS Workflow 运行时。

细则：`skills/jj-team-swarm/references/host-compatibility.md`。

### skill_root / aco.py 解析

禁止只 Glob `.claude/skills/team-adversarial-swarm`。顺序：

1. 本 skill 包 `scripts/aco.py`
2. `skills/jj-team-swarm/scripts/aco.py`
3. `~/.claude|/.codex|/.grok|/.qoder/skills/jj-team-swarm/scripts/aco.py`
4. 旧名 `…/team-adversarial-swarm/scripts/aco.py`（只读回落）

## 6. 与 jj-flow 接缝

| 场景 | 用法 |
| --- | --- |
| ralph PLAN 不确定 | swarm 搜方案 → `best-solution.md` 回写 plan 引用 |
| 架构/路径多选 | 用户显式 `$jj-team-swarm` |
| 多角色实施 | **coordinate**，不是 swarm |
| 固定规格文档链 | **lifecycle**，不是 swarm |
| 跨仓调度 | **dispatch** |

## 7. 仓库落地（P0）

| 资产 | 动作 |
| --- | --- |
| `skills/jj-team-swarm/` | vendor + 边界 + transparency + host 文档 |
| inventory + claude-commands | `jj-team-swarm` |
| `jj` 路由 | 显式 swarm / 蚁群 / 对抗搜索 |
| ralph integrations | optional swarm 指针 |
| design + ARCHITECTURE | 本文件 |

## 8. 验收（P0）

- [x] skill 目录 + Python 脚本 + workflows + specs
- [x] 用户透明 + host 兼容 references
- [x] inventory / slash / docs index
- [ ] 非 Claude 真机跑通一轮 ACO（P1）
- [ ] bridge 到 ralph（P2）
