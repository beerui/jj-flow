# 单点改动最短样例

适用：用户已给 `@file:line` 或明确单字段/单交互修改。

## 范围

- 只改 1 个业务文件（可加 1 个参考实现文件只读）
- 不写长背景；不全仓检索

## analyze.md（示例）

```markdown
# ANALYZE
run_id: RALPH-zero-interest-url-20260723

## MUST
- 协议链接使用后端字段 zeroInterestBizAgreementUrl

## OUT
- 不改其它协议下载逻辑

## Acceptance
- 页面渲染的协议地址来自 traderCorpOrderInfo.zeroInterestBizAgreementUrl
```

## plan.md（示例）

```markdown
# PLAN
## Tasks
- TASK-1 → REQ-001：更新 order-operation-link.vue 协议 URL 绑定

## Out of scope
- 后端字段定义
```

## progress.md（追加）

```markdown
- 2026-07-23T00:00:00Z DELIVER: 改 URL 绑定
- 2026-07-23T00:01:00Z VERIFY: rg 确认旧静态地址已移除
```

## acceptance.md（示例）

```markdown
| item | result | evidence |
| --- | --- | --- |
| 使用 zeroInterestBizAgreementUrl | PASS | order-operation-link.vue + rg |
```

## 收口

1. gates.accept=PASS 后写 archive 冻结副本
2. 合并 capability：modules 含改动文件；keywords 含业务词
3. 未要求则不 commit/push
