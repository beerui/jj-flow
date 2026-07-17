---
name: jj-evolve
description: 维护 jj-flow 项目本身时使用；根据自检结果、路线图和用户反馈推进下一轮演进。
---

# jj-evolve

## 适用场景

仅用于维护 `jj-flow` 项目本身。它把 `$jj-validate` 的自检结果、`.workflow` 路线图和用户反馈转成下一轮可执行改进。

## 执行步骤

1. 读取 `.workflow/project.md`、`.workflow/roadmap.md`、`.workflow/state.json` 和最近自检证据。
2. 先修正自检失败和用户反馈指出的方向错误，再推进路线图能力。
3. 保持 `jj-flow` 是 Maestro 上层协议，不重写 Maestro core。
4. 修改代码或文档后运行聚焦测试、文档检查和项目检查。

## 边界

不要把演进入口做成重型 CLI 流水线。真实执行仍由 Codex/Claude Code 和 Maestro skills 承担。**禁止调用 `maestro explore`**。
