# dispatch — 多个项目一起派

在业务仓对话里走完：**预览 → 你批准 → 派到多个项目**（可中断再续）。  
调度状态默认在 **`~/.jj-flow`**（可配置）。Claude **没有** 这个入口。

| 工具 | 怎么喊 |
|------|--------|
| Codex | `$jj-dispatch` |
| Grok / Qoder | `/jj-dispatch` |
| Claude | **没有** 这个入口 |

## 什么时候用

- 一次要改 **好几个** 项目  
- 需要：先预览、你点同意、中断后能接着做  
- 需要：审查只读、开发可写 的边界  

**别用 dispatch：** 只改一个仓 → [ralph](jj-ralph.md)；只做迁移实现 → [same](jj-same.md)

## 怎么说

**口语（推荐）：**

```text
/jj-dispatch 分发当前任务到 项目A和项目D
```

```text
$jj-dispatch 把 README 装依赖从 npm 改成 pnpm，预览分发到项目A、项目B、项目C
```

```text
$jj-dispatch 开始回退 DEL-readme-pnpm-install-20260731
```

**写整齐一点（可选）：**

```text
$jj-dispatch PREVIEW delivery=DEL-password 目标=项目A,项目B,项目C
```

流程：先 **预览** → 你批准 → 再真正派发。  
分支拿不准时，Agent 应先问你（例如确认 `feat/日期-人名` 这类分支）。

## 派之前请确认

1. **源仓库已经 commit**（没提交会被拦住）  
2. 每个目标 **分支对得上任务**  
3. **你本人** 批准了预览（聊天里随口「行」不够当正式批准）  

## 两个容易误会的点

| 说法 | 实际意思 |
|------|----------|
| 调度「验收通过」 | 记录和证据齐了 |
| 已经推远端 / 合进 dev | **还要** 用 [end](jj-end.md) 或你自己 push |

回退某个交付时：Agent 应列出选项，**你点选** 怎么改代码（不要默认 revert）。见 [踩坑](../pitfalls.md)。

## 在哪个工具上跑

| 工具 | 日常习惯 |
|------|----------|
| Grok | 默认 **一个会话做完多个任务**（Mode S） |
| Codex | 可用多个会话 / 线程（按宿主能力） |

写代码默认在 **功能分支 + 主仓库路径** 上改（Grok **Mode S**）；只有要隔离时才用独占 worktree（**Mode W**，必须挂命名分支，禁止 silent detached）。用户明确要求并行时可用 **Mode P**（每个写任务一个真实子会话，不能共享、不能伪造 placeholder）。Mode W / Mode P **不能**升 A3/A4。

## 相关

[宿主说明](../concepts-hosts.md) · [踩坑](../pitfalls.md) · [上手](../usage.md)
