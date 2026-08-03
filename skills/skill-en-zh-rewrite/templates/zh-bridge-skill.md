# {skill_id} — 中文对照（人类审阅）

> **重要**：本文档仅供人类理解与审阅。  
> **不是** Agent 运行时 SSOT。发生冲突时以英文 skill 正文为准。  
> English SSOT: `{ssot_path}`  
> Session: `{sessionId}` · Updated: `{date}`

## 技能用途

{zh_purpose_paragraph}

## 触发与入口

| 项 | 说明 |
| --- | --- |
| Skill id | `{skill_id}` |
| 触发语（英文 skill 内） | {triggers} |
| 安装后路径示例 | `~/.grok/skills/{skill_id}/`（由 install 生成，勿当编辑源） |

## 章节对照

| English heading (SSOT) | 中文含义 | 备注 |
| --- | --- | --- |
| {en_h1} | {zh_gloss} | |
| {en_h2} | {zh_gloss} | |

## 关键规则摘要

1. {zh_rule_1} → 详见 SSOT `{anchor_or_section}`
2. {zh_rule_2}
3. {zh_rule_3}

## 阶段 / 产物（若适用）

| 英文名 | 中文理解 | 产物 |
| --- | --- | --- |
| ANALYZE | 需求分析 | analyze.md |
| … | … | … |

## 刻意不对照的内容

- 脚本源码、JSON Schema 字段名
- CLI 子命令与 flag 字面量
- 业务仓 knowledge / 具体 API 名（应留在业务仓）

## 修订记录

| 日期 | sessionId | 说明 |
| --- | --- | --- |
| {date} | {sessionId} | 初版对照 |
