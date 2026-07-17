# ADR 0001：与 Maestro 的边界（历史：薄适配）

## 状态

Accepted（实现边界仍有效）  
**产品定位已演进**：jj-flow 现定位为 **项目族编排工作流**，不再以「Maestro 适配层」为对外简介。见 [架构](../architecture.md)。

## 背景

早期需要长期沉淀项目级 AI 交付方法，同时复用 Maestro 的分析/计划/执行 skill，避免 fork core。

## 决策（边界，仍成立）

1. **不 fork Maestro core**，不把 `/jj-*`、`$jj-*` 做成重型通用编排引擎。  
2. 需要时生成 prompt / 调用链，把证据与门禁注入执行；**可不用 Maestro 完成协议层本身**（控制面、same 契约、dispatch tick 是 jj-flow 自有能力）。  
3. 正式用户入口以 `$jj-same` / `$jj-dispatch` 为主（历史文档中的 delivery 入口已移除）。  
4. 全部流程禁止调用 `maestro explore`。

## 产品定位（现行）

- **jj-flow**：项目族迁移与多项目调度的编排协议与工作流。  
- **Maestro**：可选执行基建之一，不是产品定义中心。  
- **事实来源**：control-plane、Git commit、验证/审查证据。

## 后果

优点：编排方法可独立演进；工具可替换。  
代价：宿主仍是 Codex/Claude Code；完整执行依赖 agent 与工具可用性。
