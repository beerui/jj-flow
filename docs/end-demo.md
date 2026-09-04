# end 收工机制 · 可交互演示

**end 在干什么？**  
功能已经改完后，把 **Git 收尾一次做完**：提交本任务 → 推工作分支 → 合进集成分支（默认 `dev`）→ 再推集成分支 → 回到工作分支。

| 别和这些搞混 | 说明 |
| --- | --- |
| **ralph 归档** | 业务任务记录收尾（`.workflow/ralph/…`） |
| **dispatch 验收通过** | 调度账本齐了，**不等于** 已 push / 合进 dev |
| **end** | 只做 Git 提交与合并推送 |

## 怎么看

1. 点顶部步骤，或「上一步 / 下一步」
2. **自动播放** 看蓝灯
3. 每步有一句总结 + 你可以怎么说

颜色：蓝=当前 · 绿=完成 · 红=失败点

## 故事线（8 步）

1. 看清工作分支 / 集成分支 / 远端  
2. fetch + 安全检查（含 dry_run）  
3. 只 commit 本任务  
4. 同步 work → push work  
5. 切到集成分支并拉最新  
6. merge work → integration  
7. push 集成分支 → 回到 work  
8. 冲突默认自己合；真正合不了才停

## 相关

- [end 命令说明](../command-jj-end.html)  
- [踩坑](../pitfalls.html)  
- [ralph 机制演示](ralph-demo.html) · [调度演示](dispatch-demo.html)  

<!-- embed:docs/other/end-demo/interactive.fragment.html -->
