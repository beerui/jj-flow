# same — 迁到别的同源仓库

把功能从 **源项目** 迁到 **目标项目**（同一产品族、代码已分叉）。  
不管「多个仓库一起批准派工」——那是 [dispatch](command-jj-dispatch.html)。

| 工具 | 怎么喊 |
|------|--------|
| Codex | `$jj-same` |
| 其他 | `/jj-same` |

## 什么时候用

- A 仓已经做好，B/C 仓要对齐  
- 已有交接信息、会话或提交可当证据  
- 你说「交接到… / 开始迁移… / 准备交接 / 更新交接」  

**别用 same：** 只在当前仓做完 → [ralph](command-jj-ralph.html)；多仓统一调度 → [dispatch](command-jj-dispatch.html)

## 怎么说

**口语：**

```text
$jj-same 交接到 项目B 项目C
```

```text
$jj-same 开始迁移项目D
```

```text
$jj-same 准备交接 会话=019f... 源提交=<sha> 功能=...
```

```text
$jj-same 更新交接 交接=@…/handoff-snapshot.yaml 会话=… 源提交=<new>
```

```text
$jj-same 把阿里云 tracker 迁到项目D，注意别动错分支
```

**写整齐一点（可选）：**

```text
$jj-same
会话=019f...
当前需求=保留密码入口
源=项目A
目标=项目B,项目C
```

在 ralph 做完后，你往往 **只说**「交接到…」——same 会读当前任务里的交接信息。

## 交接快照（handoff）

- 准备交接：源仓形成可验证状态后生成 snapshot（`parent_snapshot` 链）  
- 消费侧 freshness：`REUSE` / `REFRESH_SOURCES` / `REBASELINE` / `BLOCKED`  
- 权威规程：仓库 skill `.codex/skills/jj-same/`（`references/handoff-snapshot.md`）

## 会怎么做（简版）

1. 确认源、目标、范围  
2. **确认每个目标仓的分支是对的**（最容易翻车）  
3. 看差异，按目标仓自己的写法改（不硬抄）  
4. 验证；缺证据就标「还不行」，不装成已完成  

> 真翻过车：在发布分支上直接迁，后来又 cherry-pick / 回滚。见 [踩坑](pitfalls.html)。

## 相关

[证据](concepts-evidence.html) · [上手](usage.html) · [踩坑](pitfalls.html)
