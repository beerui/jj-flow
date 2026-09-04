# review — 把审查结论记下来

把当前工具里的 code review 结果记下来。有 ralph 任务就写进 `reviews/REV-*.json`；没有任务也审当前改动（工作区 / HEAD），不另建任务。

| 工具 | 怎么喊 |
|------|--------|
| Codex | `$jj-review` |
| 其他 | `/jj-review` |

## 什么时候用

- 已经在做 ralph 任务，需要正式审查记录（先看 `.workflow/ralph/index.md` 里正在做的那条）
- 没有 ralph 任务，也要审当前工作区 / 最新 commit
- 只记审查结论，**不改业务代码**  

**不是：** 多项目调度的验收门（那是 dispatch）。  
也 **不替代** 工具自带的审查功能，只是把结论落到仓库文件。

审查通过时回 `通过。` 加一句总结；有问题则列出每条问题和修改意见。审查本身不改代码，等你说「按审查改」。

## 怎么说

```text
$jj-review 审一下刚才的改动
```

```text
/jj-review 帮我 code review 这波，结论写到 run 里
```

## 写在哪

有 ralph 任务时：

```text
.workflow/ralph/<这次任务>/reviews/REV-….json
```

没有任务：只回审查结论，不另建 run。

## 相关

[ralph](command-jj-ralph.html)
