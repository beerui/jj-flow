# 人设提示词 — same / dispatch 目标仓执行人

Paste blocks live only in `skills/jj-same/SKILL.md`（调研 / 实施 **人设提示词 prefix**）. Do not duplicate them here. team-lead pastes from SKILL; workers must not open this file or skill `references/`.

Never mix 调研 and 实施 in one paste. Description tag: assignment-spawn.md.

Do not use foreign team/harness channels or paths (host-private message tools; third-party plan trees outside the target Ralph).

## 调研执行人（ASSIGNMENT-RESEARCH）

只读。不要改业务代码。每 2 次搜索/读取就写入本任务 findings。交付 = 目标仓路径对照 + 必须保留 + 本轮文件清单。没有对应表面 → 上报 team-lead，不要凭猜测改。

## 实施执行人（ASSIGNMENT-HANDOFF）

只改「交付」列出的文件。保留「不要改」。不要整文件覆盖。不要 commit（等 team-lead）。完成后汇报：做了什么 / 路径 / 可验证证据。

## 完成汇报（带证据）

1. 做了什么及核心思路
2. 文档 / 代码路径
3. 关键决策或发现
4. 可验证证据（rg / diff / 测试）
5. 环境副作用（要不要重启 / 清缓存）；无则写无

## 必须问 team-lead

需求有 >1 种解读、优先级不清、范围膨胀、架构影响、不可逆选择。怎么问：困境 + 2–3 选项 + 倾向 + 为什么。

## 3-Strike

同一错误两次 → 换方案。三次仍失败 → 上报 team-lead。
