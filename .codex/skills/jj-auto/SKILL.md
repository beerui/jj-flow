---
name: jj-auto
description: 自动判断用户意图并选择最合适的 jj-flow 原生命令入口。
---

# jj-auto

## 适用场景

用户不确定应该走交付、修复、审查、沉淀、自检还是迭代时使用。长期主入口仍然是 `$jj-delivery`。

## 执行步骤

1. 从原始需求判断任务类型、风险、资料成熟度和是否需要改代码。
2. 输出推荐入口：`$jj-delivery`、`$jj-feat`、`$jj-fix`、`$jj-review`、`$jj-knowhow`、`$jj-validate` 或 `$jj-evolve`。
3. 说明选择理由和缺失证据。
4. 用户未反对时，直接按推荐入口继续执行。

## 边界

不要要求用户改成 shell 命令；这是 Codex skill 内的路由能力。
