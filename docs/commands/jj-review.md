# review — 把审查结论记下来

把当前工具里的 code review 结果，写进当前 ralph 任务的记录里。

| 工具 | 怎么喊 |
|------|--------|
| Codex | `$jj-review` |
| 其他 | `/jj-review` |

## 什么时候用

- 已经在做 ralph 任务，需要正式审查记录  
- 只记审查结论，**不改业务代码**  

**不是：** 多项目调度的验收门（那是 dispatch）。  
也 **不替代** 工具自带的审查功能，只是把结论落到仓库文件。

## 怎么说

```text
$jj-review 审一下刚才的改动
```

```text
/jj-review 帮我 code review 这波，结论写到 run 里
```

## 写在哪

```text
.workflow/ralph/<这次任务>/reviews/REV-….json
```

## 相关

[ralph](command-jj-ralph.html)
