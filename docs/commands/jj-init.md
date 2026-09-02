# init — 接入全局地图和知识库

把当前仓库（或你点名的一目录项目）写进 `~/.jj-flow/map.md`，需要时再补知识库。

| 工具 | 怎么喊 |
|------|--------|
| Codex | `$jj-init` |
| 其他 | `/jj-init` |

ralph / same / dispatch **不会**自动把仓库写进地图。要接入、梳理项目、建知识库，用这个入口。

## 什么时候用

- 新仓库要出现在全局地图里  
- 给仓库起中文名、aliases、家族  
- 把本仓已有 ralph 贡献补进 `~/.jj-flow/knowledge`  

**别用 init：** 开一轮需求 → [ralph](command-jj-ralph.html)；迁仓 → [same](command-jj-same.html)。`jj ralph init` 是开任务，不是接入。

## 怎么说

```text
$jj-init
$jj-init 当前仓加入全局地图，中文名称姐姐
$jj-init 梳理 D:\2025，家族中国大集
$jj-init 把本仓已有贡献补进知识库
```

Agent 会先给你看提案（名称 / 家族 / 要不要投喂），**你点头才写入**。单轮归档后只投喂这一条，仍可在 ralph 里说「投喂知识库」。

## 相关

[命令总览](commands.html) · [目录](concepts-paths.html) · [知识库](concepts-knowledge.html)
