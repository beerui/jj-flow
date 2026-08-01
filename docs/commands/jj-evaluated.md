# evaluated — 真实工作流评估

只读、离线、可回放：用真实项目对话与交付工件评估 same / ralph / dispatch，在批准后改进 skill 与 recipe。

入口：`/jj-evaluated`（skill）。**不**自动改生产业务代码，**不**自动训练模型。

## 何时用

- 复盘项目A / 项目B / 项目C 波次成本与返工
- 对比策略、找可泛化改进
- 写 episode 到 `docs/evaluations/`（仓库内评估笔记）

## 状态

设计整体仍为 **Proposed**（完整 holdout/regression 闭环未关）。skill MVP 可用。  
见 [设计](design-docs/jj-evaluated.html)。

## 相关

[命令总览](commands.html) · [Harness 设计](design-docs/harness-engineering.html)
