# 架构决策记录

这里索引已经接受、需要长期追溯的 Architecture Decision Record（ADR）。ADR 记录为什么选择某个稳定边界；当前代码位置仍以根 `ARCHITECTURE.md` 为准。

## 当前决策

- [ADR 0001：外部工具边界（历史）](0001-thin-maestro-adapter.html)：不重写外部执行引擎；工具可替换；协议层自有。
- [ADR 0002：用独立控制项目承载动态项目族调度](0002-project-family-control-plane.html)：定义控制项目、稳定任务身份和 host/runtime 边界。

新增 ADR 时必须加入本索引；被替代的 ADR 保留原文，并明确指向替代决策。
