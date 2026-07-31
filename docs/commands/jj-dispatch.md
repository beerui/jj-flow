# dispatch — 多个项目一起派

在 **业务仓库的对话里** 发起：预览 → 你批准 → 派到多个项目 → 可恢复、可继续。  
调度状态默认记在 **`~/.jj-flow`**（可配置）。

| 工具 | 怎么喊 |
|------|--------|
| Codex | `$jj-dispatch` |
| Grok / Qoder | `/jj-dispatch` |
| Claude | **没有** 这个入口 |

## 什么时候用

- 一次要改 **好几个** 项目  
- 需要：先预览、你点同意、中断后能接着做  
- 需要：审查只读、开发可写 的边界  

**别用 dispatch：** 只改一个仓 → [ralph](command-jj-ralph.html)；只做迁移实现 → [same](command-jj-same.html)

## 怎么说

**口语（推荐）：**

```text
/jj-dispatch 分发当前任务到 承接和承载识票
```

```text
$jj-dispatch 把 README 装依赖从 npm 改成 pnpm，预览分发到承接、兑接、承载
```

```text
$jj-dispatch 开始回退 DEL-readme-pnpm-install-20260731
```

**写整齐一点（可选）：**

```text
$jj-dispatch PREVIEW delivery=DEL-password 目标=承接前台,兑接前台,承载前台
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
| 已经推远端 / 合进 dev | **还要** 用 [end](command-jj-end.html) 或你自己 push |

回退某个交付时：Agent 应列出选项，**你点选** 怎么改代码（不要默认 revert）。见 [踩坑](pitfalls.html)。

## 在哪个工具上跑

| 工具 | 日常习惯 |
|------|----------|
| Grok | 默认 **一个会话做完多个任务**（Mode S） |
| Codex | 可用多个会话 / 线程（按宿主能力） |

写代码默认在 **功能分支 + 主仓库路径** 上改；只有要隔离时才用独占 worktree。

## 相关

[宿主说明](concepts-hosts.html) · [踩坑](pitfalls.html) · [上手](usage.html)
