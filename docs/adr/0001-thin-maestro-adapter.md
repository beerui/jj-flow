# ADR 0001：把 jj-* 做成 Maestro 薄适配层

## 状态

Accepted

## 背景

我们需要长期维护自己的项目级 AI 交付方法，同时又希望跟随 Maestro 更新。

## 决策

`$jj-*` / `/jj-*` 不 fork Maestro core。它只负责识别意图、整理证据、选择 `jj-flow` recipe，并生成 Maestro prompt 和调用链。正式命令以 `$jj-same` / `/jj-same` 为主入口，`$jj` / `/jj` 只作为兼容入口。全部流程禁止调用 `maestro explore`。

## 后果

优点：升级成本低，方法沉淀在自己项目里，测试边界清晰。

代价：第一版不会自动完成所有执行，需要依赖 Codex、Claude Code 和 Maestro 接着跑。
