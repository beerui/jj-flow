# ADR 0001：外部工具边界（历史）

## 状态

Accepted for Beta

## 日期

2026-07

## 背景

早期需要在长期沉淀项目级 AI 交付方法的同时，避免把 jj-flow 做成重型通用编排引擎或 fork 外部 core。

## 决策

1. **不重写外部执行引擎**，不把 `/jj-*`、`$jj-*` 做成通用 intent/daemon 平台。
2. 需要时生成 prompt / 调用链，把证据与门禁注入执行；协议层（控制面、same 契约、dispatch tick、ralph ledger）是 jj-flow 自有能力。
3. YApi / ARMS / 禅道等是可插拔证据源，可换、可缺。
4. 代码定位使用 Read、Glob、Grep、Bash、`rg` 或已批准 skill。

## 后果

- **jj-flow**：定义编排协议、证据门禁与可恢复身份。
- **宿主**（Codex / Claude Code / Git）：执行对话、改代码、隔离 worktree。
- **外部证据工具**：按需接入，不定义产品中心。

当前产品定位见 [架构](../architecture.md) 与 [ADR 0002](0002-project-family-control-plane.html)。
