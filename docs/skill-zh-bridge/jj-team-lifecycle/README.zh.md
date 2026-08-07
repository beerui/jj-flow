# jj-team-lifecycle（中文对照，非 Agent SSOT）

> Agent 以 `skills/jj-team-lifecycle/SKILL.md` 与 `docs/design-docs/jj-team-lifecycle.md` 为准。

## 是什么

**固定角色**的会话级 SDLC 执行引擎：规格（研究/brief/PRD/架构/epics）→ 计划 → 实现 → 测试 → 审查。  
Session：`.workflow/.team/TLV4-*`。

## 不是什么

- 不是 ralph / dispatch 的替代品  
- 不会推进 checkpoint / 创建 `delivery_id`  
- 不是动态多角色（那是 **jj-team-coordinate**）  
- 不是对抗搜索（那是 **jj-team-swarm**）

## 什么时候用

| 场景 | 选择 |
| --- | --- |
| 要标准 PRD/架构文档链 | lifecycle `spec-only` |
| 规格已有，按剧本实现测审 | lifecycle `impl-only` |
| 全链路 | lifecycle `full-lifecycle`（重，确认后） |
| 角色形状不固定、模块并行 | **coordinate** |
| 方案搜索 | **swarm** |

## 嵌套提示

仅嵌套在 ralph/review/dispatch 时一句：

```text
开启 lifecycle 模式，开始任务… 约 20-45分钟
```

直接调用无需 banner。
