# jj — 说不清时用它分流

只说「用 jj-flow」时，用这个入口帮你选路。

| 工具 | 怎么喊 |
|------|--------|
| Codex | `$jj` |
| 其他 | `/jj` |

## 大概怎么选

1. 像「多个项目一起派」→ [dispatch](command-jj-dispatch.html)  
2. 像「交接 / 迁移到别的仓」→ [same](command-jj-same.html)  
3. 像「就在这个仓做完」→ [ralph](command-jj-ralph.html)  
4. 像「动态多角色并行」→ [team-coordinate](command-jj-team-coordinate.html)（**不**算验收通过）  
5. 像「固定规格文档 / SDLC 流水线」→ [team-lifecycle](command-jj-team-lifecycle.html)  
6. 像「多假设 / 蚁群搜索」→ [team-swarm](command-jj-team-swarm.html)  
7. 仍不清 → 先问你目标  

交付主路径始终是 same / ralph / dispatch；team-* 只是会话内执行/搜索引擎。

## 相关

[命令总览](commands.html)
