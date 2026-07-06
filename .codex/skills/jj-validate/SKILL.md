---
name: jj-validate
description: 维护 jj-flow 项目本身时使用；检查文档、命令资产、测试、路线图和 Maestro 边界是否漂移。
---

# jj-validate

## 适用场景

仅用于 `jj-flow` 项目自检和维护，不是普通业务交付入口。

## 执行步骤

1. 读取 `.workflow/project.md`、`.workflow/roadmap.md`、`.workflow/state.json`、文档和测试。
2. 检查 Codex skills、Claude commands、npm 包文件、安装文档和测试是否一致。
3. 验证 `jj-flow` 仍是 Maestro 上层协议，而不是替代 Maestro 的执行引擎。
4. 输出 `PASS`、`PENDING`、`FAIL`、证据路径和下一步建议。

## 边界

不要把缺失证据写成通过；自检结果应直接服务于 `$jj-evolve`。
