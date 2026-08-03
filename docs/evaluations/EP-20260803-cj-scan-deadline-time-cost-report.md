# jj-evaluated report — EP-20260803-cj-scan-deadline-time-cost

> Status: diagnosis complete (read-only; no skill promotion)
>
> Skill: `$jj-evaluated`
>
> Recorded: 2026-08-03
>
> User question: 最近一次任务在**承接**项目中为什么花费时间这么久

## 1. Episode and role mapping

| Field | Value |
| --- | --- |
| episode_id | `EP-20260803-cj-scan-deadline-time-cost` |
| role | **承接**（`D:/a/cj-web`） |
| run_id | `RALPH-0807-scan-deadline-opt-20260803` |
| title | 【0807】自动扫票的扫票截止时间处理优化 |
| branch / head (run time) | `feat/cj-0807-lyj` @ `9d5214739`（商票色 commit；本任务改动仍 **dirty 未提交**） |
| intensity | `standard` |
| iterations | **2**（首轮假完成 → 深挖重开） |
| evidence | `D:/a/cj-web/.workflow/ralph/RALPH-0807-scan-deadline-opt-20260803/{run,progress,analyze,plan,acceptance}.json|md` + archive 两份 |

### Same-day contrast (承接)

| run | intensity | iter | wall (run created→updated) | notes |
| --- | --- | --- | ---: | --- |
| `RALPH-shang-tag-color-blue-20260803` | tiny | 1 | ~8 min（含 handoff 写盘）；首轮 archive ~0.4 min | 纯 CSS class 替换 |
| **`RALPH-0807-scan-deadline-opt-20260803`** | **standard** | **2** | **~21.5 min** | 多文件 + API 双写根因 + 一轮假 PASS |

## 2. Baseline table and clock-quality caveats

| Metric | Value | clock_quality | timestamp_provenance |
| --- | ---: | --- | --- |
| wall_span (run) | **21.5 min**（`07:28:15Z` → `07:49:44Z`） | derived | artifact (`run.json` created_at/updated_at) |
| iter-1 complete | **11.1 min**（→ `07:39:23Z` first archive） | derived | artifact (archive1 run.json) |
| post-complete gap | **~4.7 min**（`07:39:23` → `07:44:02` setRunStatus IN_PROGRESS） | derived | artifact (progress.md) |
| iter-2 rootcause deliver | **~5.7 min**（`07:44:02` → `07:49:44`） | derived | artifact (progress.md) |
| active_duration (model) | **unknown** | unknown | no host/session export |
| idle / human_attention | 含 gap；是否用户点测未知 | unknown | no thread export |
| tool_wait (eslint/UI) | eslint 有记录；**无**服务大厅登录联调 | derived | progress/acceptance |
| git commit span | **无**（dirty 4 files 未 commit） | exact | git status |
| file mtime (final edit) | list-item `15:37:38`；create/list/api `15:49:13` +0800 | filesystem | mtime only — not active work |

Caveats（skill 规则）:

- 不得把单独 `run.json` 时长当作「纯模型活跃时间」。
- 无 thread export → 无法拆 human wait vs agent think。
- ACCEPT 全是 **静态 PASS**，不能当作真机验收墙钟。

### Trace-backed timeline (UTC)

```text
07:28:15  run create  ANALYZE start (standard)
   …        analyze MUST×3 + 源码根因（前端 normalize / 清空 / minTime）
   …        plan T1–T5
07:39:22  deliver-attempt #1  signal=static preserve/clear/refresh
07:39:23  gates PASS → ARCHIVE soft (iter=1 COMPLETED)
07:44:02  setRunStatus COMPLETED→IN_PROGRESS
          reason=深挖：设置截止时间后开启接单再点修改时间为空
   …        根因升级：整单接口可能不落库 stopTime；需双写专用接口 + canEmpty + 列表兜底
07:49:44  deliver-attempt #2  signal=rootcause dual-write + list fallback
07:49:44  ARCHIVE soft (iter=2 COMPLETED) + knowledge-contribute
after     worktree still dirty (4 files); head still 商票色 commit
```

## 3. Failure / behavior tags and causal hypotheses

| Tag | Evidence | Hypothesis |
| --- | --- | --- |
| `incomplete_rootcause_v1` | analyze 只谈前端 format/拦截/match 空指针；progress 轮2 才写双写 API | 首轮把「回显不稳」当成纯前端问题，未沿 **create 提交 → 启动 → getInfo 回填** 全链路对存储侧取证 |
| `false_accept_static` | acceptance A1–A5 全 PASS（静态）；progress 写明无业务账号/运行态 | 机械门 + 静态验收让 run 在 A1 真失败前就 ARCHIVE |
| `user_correction` / rework | `07:44:02` resume reason 明确业务路径仍空 | 第二轮约 6 min 是补根因，不是新需求膨胀 |
| `api_contract_ambiguity` | knowledge lesson：创建/修改整单后须双写 `updateBillOrderNeedRuleStopTime`；空 stopTime 要 `canEmpty` | 列表改时间已有专用接口；弹窗路径漏接 → 行为分叉 |
| `validation_gap` | A1 本应是「提交→启动→再开修改」；无 UI 联调 | 若首轮能做最小真机或 mock 详情响应，可省一轮假完成 |
| `surface_area` | create.vue ~82KB；diff +105/−22 across 4 files | standard 强度合理；不是「闲逛多仓」类浪费 |
| `not` primary | 非 stale master、非 handoff 重复分析、非 dispatch 多目标 | 对比同日 shang-tag / 昨日 EP-stale-master 是不同类问题 |

### Causal chain (ordered)

1. 需求本身是 **三 MUST 交叉路径**（保留 / 清空同步 / minTime 刷新），不是单点 CSS。
2. ANALYZE 正确抓到前端三症状，但 **漏掉存储侧分叉**：整单 `save/update` vs 专用 `updateBillOrderNeedRuleStopTime`。
3. PLAN/DELIVER1 按「前端 normalize + 清空 + focus 刷新」做完 → 静态验收全绿 → **11 min 假完成**。
4. 业务路径「设截止 → 启动扫票 → 点修改 → 时间为空」暴露存储/详情不回带 → **resume + 根因深挖**。
5. DELIVER2：双写专用接口 + `canEmpty: true` + `detail.stopTime \|\| item.stopTime` 兜底 → 再 ARCHIVE。
6. 合计 wall **~21.5 min**，其中约一半是正确方向的首轮实现，约四分之一是假完成后的间隔/触发，约四分之一是真正补根因。

**所以「久」的主因不是模型空转，而是：首轮根因浅 + 无真机门禁导致一轮 rework。**

## 4. Optimization / holdout / regression split

| Set | Episode | Notes |
| --- | --- | --- |
| search | this episode | incomplete_rootcause + false_accept_static class |
| holdout | reserve next multi-API form field bug | do not overfit dual-write only |
| regression | protect tiny pure-style runs (shang-tag) | speed candidate must not force dual-write ritual on CSS tasks |

## 5. One bounded candidate (not promoted)

| Field | Value |
| --- | --- |
| candidate_id | **C-accept-path-chain-v1**（proposal only） |
| expected mechanism | 对「写后读」类 MUST：ACCEPT 至少要求 trace **submit → reload/getInfo → assert field**（静态模拟响应亦可），禁止仅用 diff 勾 A1 |
| alternate | ANALYZE checklist：同一业务字段若存在 **list 专用 API + 整单 API**，默认怀疑只写一侧 |
| non-goals | 强制起完整 dev server；自动登录服务大厅 |
| promotion | **pending human** — 本报告只诊断 |

## 6. Replay

| Suite | Result | Notes |
| --- | --- | --- |
| git forensics | PASS | dirty 4 files; dual-write symbols in create.vue / auto-orders.js |
| run/progress consistency | PASS | timestamps + iter 1/2 archives align |
| thread export | missing | active vs idle unknown |
| skill edit | n/a | diagnosis-only |

## 7. Human decision

| Field | Value |
| --- | --- |
| human decision | not requested |
| promotion status | none |
| next data-collection | 若有 Grok/Codex thread id 可补 active_duration；提交后补 `produced_commit` |

## 8. Archive notes

- 业务 run 已 ARCHIVE COMPLETED，但 **工作区未 commit** — 交付墙钟若算到「可推送」仍会继续涨。
- 本报告不推进任何 control-plane / ralph checkpoint。
