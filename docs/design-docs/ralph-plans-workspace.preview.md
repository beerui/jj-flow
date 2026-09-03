# Ralph 多轮任务内容预览（目标布局示例）

> 状态：Proposed
>
> **性质**：按 [Ralph 任务工作区 .plans 化改造](ralph-plans-workspace.md) §3.2/§3.4 目标布局生成的**示例产物**，非实际运行输出。
>
> **数据来源**：seo-daji-web 真实样本 `RALPH-enter-form-dynamic-route-20260826`（轮次 1）+ `RALPH-enter-form-dynamic-apply-20260901`（轮次 2），按 §3.12 经 `ralph migrate` + `jj ralph adopt --task task-enter-form-dynamic --absorb task-enter-form-dynamic-apply` 合并为一个任务目录。
>
> **编号重排**（§3.4 多轮语义，合并时顺延）：轮次 1 的 REQ-001~007 / TASK-1~23 / REV-1~3 保留；轮次 2 原 REQ-001~013 → **REQ-008~020**、原 TASK-001~015 → **TASK-024~038**、原 REV-1~5 → **REV-4~8**。
>
> **快照时点**：REV-8（原 REV-5）修复已交付（test 20/20）、accept=PASS 但 latest review 仍 NEEDS_CHANGES、待 REV-9 复审——多轮任务进行中的典型中间态。

## 目录布局

```text
.workflow/ralph/tasks/task-enter-form-dynamic/
  task_plan.md          ← 目标 / 分析 / 计划 / 验收 四段合一（人维护）
  progress.md           ← 日期分节追加式日志（人维护）
  findings.md           ← 踩坑因果 / 改动摘要 / 验证证据（人维护，知识抽取源）
  .state/               ← 机器面，人不看（ls 默认不显示）
    run.json            ← 唯一机器 SSOT（schema 1.1）
    reviews/            ← REV-1..8.json（jj-review 写回）
    handoff.json        ← jj-same 交接锚点
```

## task_plan.md

```md
# task-enter-form-dynamic

> 运行: task-enter-form-dynamic　状态: ACCEPT / IN_PROGRESS（待 REV-9 复审）　分支: feat/dynamic-enter　轮次: 2
> 身份链: RALPH-enter-form-dynamic-route-20260826（migrate，轮次 1）→ RALPH-enter-form-dynamic-apply-20260901（absorb，轮次 2）→ task-enter-form-dynamic

## 目标
「商家入驻表单改成后台 schema 驱动的动态表单：先做独立预览路由验证渲染与复合控件，再把申请单 / 审核回显 / 编辑接进来；验证通过前不改现商家入驻入口。」（发起人原话摘录）

### 待答问题
- 后台 schema 字段类型全集？管理端占位与 PC 真实交互的差异边界？——轮次 1 已回答并落地 REQ-006
- 模板接口真实 path 与 query 契约？——轮次 2 按 YApi 104353 原文关闭（F-002）

## 分析
### 必须项
- REQ-001 独立路由 `/merchants-enter/dynamic` 承载预览与动态表单　［evidence_class: behavior-local］
- REQ-002 按 schema.groups/rows/fields 渲染；values 按 field.id　［evidence_class: behavior-local］
- REQ-003 复合控件交互与样式对齐 commonIndex/englishIndex（100×100 虚线框、tips 在下方、地区一行均分）　［evidence_class: diff-only］
- REQ-005 debug 入口：粘贴后台 schema JSON 后应用　［evidence_class: behavior-local］
- REQ-006 schema 驱动 emptyText / showCountry / showLabel / labelOccupy　［evidence_class: behavior-local］
- REQ-007 extInfo 写入带 label　［evidence_class: behavior-local］
- REQ-008 独立页用 userTemplate 渲染　［evidence_class: write-then-read］
- REQ-009 模板 query 只传已选 countryCode，不得从 audit/query 兜底　［evidence_class: behavior-local］
- REQ-012 from=audit 用 getUserAuditInfo 回填；审核中跳转　［evidence_class: write-then-read］
- REQ-016 入驻页网关按申请单分流（info/get 或 audit/get）　［evidence_class: behavior-local］
- REQ-019 halfEdit 锁身份字段并从 initialValues 还原提交值　［evidence_class: write-then-read］
- REQ-020 只读 / disabled 上传跳过 OSS　［evidence_class: behavior-local］

（REQ-010 / 011 / 013~015 / 017 / 018 同轮新增，此处节选）

### 范围外
- commonIndex / englishIndex / globalEnter 三表单实现（REQ-018 保证零改）
- H5 动态入驻页、AccountOpenWYG、登录信息加字段、utils/business 跳转规则

### 存疑事项
- 模板 path 在 YApi 未登录时不可确认 → 已按 YApi 原文关闭（F-002）
- 「同一业务含义跨入口一致」按 cross-path 取证（REQ-015），入口语义由 resolveEnterPath 单点承载

### 未解决
- (none)

## 计划
- knowledge_refs: CAP-enter-form-dynamic-route-20260826；热层注入 2 条（F-001 / 同项目 1 条，见 .state/run.json knowledge.memory_refs）
### 当前
1. [ ] TASK-037 → REQ-019: halfEdit=half 且 from=audit 时锁定身份 mapping（companyName / companyLicenseId / companyType / companyLicenseUrl）；提交从 initialValues 还原锁定值
2. [ ] TASK-038 → REQ-020: mode=readonly 或字段 disabled 时，动态字段与共享上传控件隐藏增删、跳过 OSS onChange/onRemove

### 已落地
#### 轮次 2 · 接申请与回填（archive_history[1]，head=2b2b312a）
- TASK-036 → REQ-009/014/017/018: 测试覆盖 0 不进动态 / 1 进动态 / 三入口 helper / 旧三表单零改（18/18）
- TASK-034 → REQ-017: 企业信息开关 1 时 userTemplate 只读渲染（hydrate 含 extInfo）
- TASK-033 → REQ-016: index 网关 shouldReadPassedSellerInfo → info/get 否则 audit/get，保留 query
- TASK-031 → REQ-012: loadAuditRecord 必须带 loadSeq；过期审核响应不写共享状态（15/15）
- TASK-030 → REQ-009/011: REV-4 F-1~F-4 修复——selectedCountryCode-only GET / init(status,userType) / loadSeq / enterTemplateId 必填（14/14）
- TASK-028/029 → REQ-008/011: path 改 GET /client/user/enter/template/get（YApi 原文）；extInfo JSON 字符串提交与回填

（TASK-024..027、032、035 略）

#### 轮次 1 · 独立路由（archive_history[0]，head=bf4111b1）
- TASK-23 → REQ-007: extInfo 补 label（9/9）
- TASK-17..22 → REQ-003/006: emptyText 换行 / region 均分 + showCountry / tips 下方 / compact-row / 管理端属性面板
- TASK-12..16 → REQ-003: commonIndex 同源规则补齐（.upload-container column / :deep(.el-upload) / FileUpload 外观 / region flex-1）
- TASK-8..11 → REQ-002/003/005: REV-1 修复（scoped CSS / 长期不校验 / 地区必填 / 协议 href / slots）（7/7）
- TASK-1..7 → REQ-001..005: 独立页 + form-runtime + sample schema + debug 粘贴（6/6）

### 已取代
- 「不接回 `/merchants-enter` 网关、index 零改动」（原 REQ-004，轮次 1）——2026-09-02 改为申请单 useEnterTemplate 分流，index 仅作网关（REQ-016）
- 「旧入驻四文件未改」（原 REQ-013，轮次 2 早期）——2026-09-02 index 改为分流网关；收缩为旧三表单零改（REQ-018）

## 验收
### 当前
| 项 | must_id | evidence_class | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| halfEdit 锁身份字段并还原提交值 | REQ-019 | write-then-read | 待复审 | write_then_read:mock_ok 篡改 companyName/证照后 restoreHalfEditLockedValues 读回原值；test 19/20；REV-8 修复已落地，待 REV-9 复审 |
| 只读 / disabled 上传跳过 OSS | REQ-020 | behavior-local | 待复审 | upload-el / file-upload `if (disabled.value) return` 跳过 OSS、隐藏增删；test 20/20；待 REV-9 复审 |

### 已落地
#### 轮次 2（节选）
| 项 | must_id | evidence_class | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| 独立页用 userTemplate 渲染 | REQ-008 | write-then-read | PASS | mock userTemplate → pickUserTemplateSchema；submit→hydrate 读回 |
| 模板 query 只传已选 countryCode | REQ-009 | behavior-local | PASS | resolveTemplateQueryCountry；page 不拼 audit/query；test 14/14 |
| 过期审核响应不写共享状态 | REQ-012 | behavior-local | PASS | loadAuditRecord(seq) + isCurrentEnterLoad；test 15/15 |
| 入口共用 resolveEnterPath | REQ-015 | cross-path | PASS | 三入口读同一 helper；身份/登录跳转源码无该字段；test 17 |
| 旧入驻四文件未改 | REQ-013 | diff-only | 已取代 | 2026-09-02 index 改为分流网关；收缩为 REQ-018 旧三表单零改 |

#### 轮次 1（节选）
| 项 | must_id | evidence_class | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| 独立路由承载预览 | REQ-001 | behavior-local | PASS | 既有（archive_history[0]） |
| 复合控件对齐现入驻样式 | REQ-003 | diff-only | PASS | 既有（archive_history[0]） |
| extInfo 带 label | REQ-007 | behavior-local | PASS | pushExtInfo 写 label；test 9/9 |
```

## progress.md

```md
# task-enter-form-dynamic - 进度

> 用于上下文恢复。压缩/重启后先读此文件（最后 30 行）。
> **追加式，时间正序**；轮次导航见下方索引表，不倒序、不重写历史。

## 轮次索引
| 轮次 | 日期 | 主题 | 结果 | 认知 |
| --- | --- | --- | --- | --- |
| 2 | 2026-09-01 | 接申请与回填 | 7 迭代 / 5 评审 / 5 回滚 | F-002..006 |
| 1 | 2026-08-26 | 独立路由 | 6 迭代 / 3 评审 / 5 回滚 | F-001 |

## 轮次 1 · 2026-08-26 · 独立路由（RALPH-enter-form-dynamic-route-20260826 → migrate）

### 迭代 1
- 实现：独立路由 /merchants-enter/dynamic；动态表单复用 ImgUploadEl / FileUpload / cascader / getRegionList；未改旧入口
- 验证：node --test test/merchants/dynamic-enter-form.test.mjs → 4/4 pass；vue/compiler-sfc 9 个 SFC OK
- 2026-08-26T05:54:05.936Z deliver-attempt improved=true iteration=1 signal=behavior-local:dynamic_route_tests_4_pass
- 2026-08-26T05:54:11.310Z gate deliver=PASS

### 迭代 2-3（debug 粘贴 schema；REV-1 修复）——节选
- 验证：6/6 → 7/7 pass
- 2026-08-26T06:20:00.000Z review REV-1 NEEDS_CHANGES scope=working_tree
- 2026-08-26T06:43:36.981Z gate deliver=PASS

### ⟲ 回滚 1 — 触发源：用户纠正
- failed_must: REQ-003
- failed_evidence_class: diff-only
- over_claimed: 仅断言 ImgUploadEl / class 名 / scoped import，未对齐 commonIndex 的 .upload-container 叠放、:deep(.el-upload)、FileUpload 默认红框、region 布局
- → findings.md **F-001**
- 2026-08-26T07:43:22.946Z rollbackPhase ACCEPT→DELIVER

### 迭代 4-5（样式对齐 + 对照图 6 项）——节选
- 验证：test 7/7；SFC 7 个 OK；admin fixtures 28/28 PASS

### 迭代 6（extInfo label）
- 实现：pushExtInfo 写入 { key, value, label }
- 验证：9/9 pass
- 2026-08-29T03:40:58.567Z review REV-2 PASS scope=commit
- 2026-08-29T03:43:13.371Z archive status=COMPLETED → archive_history[0]（head=bf4111b1）
- 2026-08-29T03:52:31.319Z review REV-3 PASS scope=commit

## 轮次 2 · 2026-09-01 · 接申请与回填（RALPH-enter-form-dynamic-apply-20260901 → adopt absorb）

### 迭代 1
- 实现：dynamic 拉 userTemplate；query 默认不传 countryCode；校验后 userInsert；from=audit 用 getUserAuditInfo 回填
- 验证：13/13 pass
- 2026-09-01T03:52:26.867Z archive status=COMPLETED → archive_history[1]（head=2b2b312a）

### ⟲ 回滚 1 — 触发源：自查（YApi 原文核对）
- failed_must: REQ-008 模板 path 曾猜测 getUserAndScene
- failed_evidence_class: write-then-read
- over_claimed: 未登录 YApi 时把 path 写成 /client/user/enter/template/getUserAndScene
- → findings.md **F-002**
- 2026-09-01T04:04:22.831Z rollbackPhase ARCHIVE→DELIVER

### ⟲ 回滚 2 — 触发源：评审 REV-4
- failed_must: REQ-009 countryCode 从 audit/query 泄漏进模板 GET
- failed_evidence_class: behavior-local
- over_claimed: 仅测 helper 省略 countryCode，未测 page 把 audit/query 拼进 query
- → findings.md **F-003**
- 2026-09-01T06:33:12.127Z deliver-attempt improved=true iteration=3 signal=behavior-local:rev1_F1-F4_tests_14_pass
- 2026-09-01T06:49:15.000Z review REV-5 PASS scope=working_tree

### ⟲ 回滚 3 — 触发源：评审 REV-6
- failed_must: REV-6 F-1 loadAuditRecord 在 loadSeq 前写 audit 共享状态
- failed_evidence_class: behavior-local
- over_claimed: loadSeq 只挡住模板 GET/schema，未挡住审核回填写入
- → findings.md **F-004**
- 2026-09-01T07:42:25.000Z review REV-7 PASS

### ⟲ 回滚 4 — 触发源：用户纠正（方案变更）
- failed_must: 独立路由不接回网关 / 不从申请单分流
- failed_evidence_class: cross-path
- over_claimed: 仅独立 /dynamic 可测通，审核失败与企业信息回显仍走旧 path
- → findings.md **F-005**
- 2026-09-02 05:51 ANALYZE/PLAN Current: REQ-014..018 + TASK-029..033；原 REQ-004（index 零改动）已取代

### ⟲ 回滚 5 — 触发源：评审 REV-8
- failed_must: REV-8 F-1 halfEdit 未锁动态身份字段；F-2 只读上传仍走 OSS
- failed_evidence_class: write-then-read / behavior-local
- over_claimed: resolveEnterPath 只转发 halfEdit query，动态页未消费；el-form disabled 未传到自定义上传
- → findings.md **F-006**

### 迭代 6-7（REV-8 修复）
- 实现：TASK-037 halfEdit 锁身份 mapping + initialValues 还原；TASK-038 只读上传禁 OSS
- 验证：node --test test/merchants/dynamic-enter-form.test.mjs → 20/20 pass
- user_correction: 09-02 用户确认锁定字段以旧表单 mapping 为准（companyName / companyLicenseId / companyType / companyLicenseUrl）
- 2026-09-02T07:21:54.423Z gate deliver=PASS
- 2026-09-02 gate accept=PASS blocked：latest review REV-8 NEEDS_CHANGES；待 REV-9 复审后 archive
```

## findings.md

```md
# task-enter-form-dynamic - findings

> 状态: REV-8 修复待复审（20/20）　分支: feat/dynamic-enter　ADR/决策: docs/code-reviews/feat-dynamic-form.md

## 改动摘要
| 文件 | 轮次 | 变更 |
| --- | --- | --- |
| utils/merchant-enter/form-runtime.js | 1 | schema 渲染 / 值按 field.id / extInfo 带 label |
| utils/merchant-enter/apply-runtime.js | 2 | buildEnterTemplateQuery / shouldUseDynamicEnter / resolveEnterPath / loadAuditRecord(seq) / halfEdit 还原 |
| constants/merchant-enter.js | 2 | 场景与模板 path 常量 / USE_ENTER_TEMPLATE |
| apis/merchants.js | 2 | 用户 + 场景模板 API |
| pages/merchants-enter/dynamic.vue | 1→2 | 预览页 → 拉模板 / 校验提交 / 审核回填 / halfEdit 锁定 |
| pages/merchants-enter/index.vue | 2 | 申请单分流网关（原「零改动」约束已取代） |
| pages/merchants-enter/components/dynamic-enter-form.vue + dynamic-fields/* | 1→2 | 动态表单与 10 类字段控件；readonly 禁增删 |
| components/img/upload-el.vue / components/file/upload.vue | 2 | disabled 跳过 OSS、隐藏增删 |
| test/merchants/dynamic-enter-form.test.mjs | 1→2 | 4 → 20 用例 |

## 行为/契约
- 模板 GET：`GET /client/user/enter/template/get`，query 仅已选 countryCode（YApi 104353）——已同步 docs/code-reviews/feat-dynamic-form.md
- 提交：userInsert 必带 enterTemplateId；extInfo 以 JSON 字符串提交并按字符串回填
- 分流：useEnterTemplate 只从 audit/get 与 info/get 读，登录信息不加该字段

## 踩坑与因果
### F-001 同源样式要对齐规则清单，不是对齐 class 名
- 现象: PC 预览与现入驻组件视觉不一致（上传框叠放、el-upload 穿透、FileUpload 红框、地区布局）
- 原因: 只断言组件引用 / class 名 / scoped import，未对齐 commonIndex 的具体 scoped 规则
- 对策: 「复用现有组件」类需求先 diff 目标组件的 scoped 规则清单再写样式；测试断言具体选择器与效果，不只认 class 名
- 适用范围: 同源 UI 复用、视觉对齐需求（diff-only 类）
- 代价: 1 次用户纠正回滚 + 2 轮重交付
- 证据: REV-1；progress 轮次 1 回滚 1 三行组

### F-002 外部接口 path 未确认前不落码
- 现象: 模板 path 被写成 /client/user/enter/template/getUserAndScene
- 原因: YApi 未登录，凭命名猜测接口
- 对策: 契约拿不到原文时 path 进「存疑 / 未解决」并先 mock；拿到原文再落码，不猜
- 适用范围: 一切外部 API 首次接入
- 代价: 1 次 ARCHIVE→DELIVER 全程回滚
- 证据: progress 轮次 2 回滚 1

### F-003 helper 纯函数测过了 ≠ 调用方没绕过它
- 现象: countryCode 从 audit/query 泄漏进模板 GET
- 原因: 只测 helper 省略 countryCode，未测 page 把 audit/query 拼进 query
- 对策: 收敛类需求的验证必须覆盖最终出口（page 拼参处），不只测 helper 纯函数
- 适用范围: query / 参数收敛、helper 封装类改动
- 代价: REV-4 F-1 返工
- 证据: REV-4 F-1；progress 轮次 2 回滚 2

### F-004 竞态守卫要枚举全部共享状态写入点
- 现象: loadAuditRecord 在 loadSeq 前写 audit 共享状态
- 原因: loadSeq 只挡住模板 GET / schema，未挡审核回填写入
- 对策: 加请求代数守卫时枚举页面所有「await 后写共享状态」的位置逐一过 guard，不只护新增请求
- 适用范围: 页面多请求并发回填
- 代价: REV-6 F-1 返工
- 证据: REV-6 F-1；progress 轮次 2 回滚 3

### F-005 「不接回」是范围决策，入口语义变化按 cross-path 重估
- 现象: 仅独立 /dynamic 可测通，审核失败与企业信息回显仍走旧 path
- 原因: 轮次 1 把「不接回网关」当范围外；业务要求同一含义跨入口一致时该约束失效
- 对策: 同一业务含义跨 ≥2 入口的需求按 cross-path 取证；入口接回时显式取代旧 REQ 并重编号，不静默扩 scope
- 适用范围: 分流 / 网关 / 多入口一致性需求
- 代价: 原 REQ-004 已取代；1 次方案级回滚（ANALYZE 重开）
- 证据: progress 轮次 2 回滚 4；task_plan 已取代段

### F-006 只读 / 锁定语义要穿透到自定义控件
- 现象: halfEdit 只转发 query 未被动态页消费；readonly 表单的上传控件仍走 OSS
- 原因: el-form disabled 未传到自定义上传组件；锁定 mapping 只存在于旧表单
- 对策: 只读 / 锁定需求逐控件检查（含上传、增删、onChange/onRemove），不只依赖表单层 disabled 传递
- 适用范围: 表单 readonly / halfEdit / 权限态
- 代价: REV-8 F-1/F-2 返工
- 证据: REV-8；progress 轮次 2 回滚 5

## 可复用结论
- 外部接口 path 未确认前不落码，先进存疑（→ F-002）
- helper 测过不代表调用方没绕过，验证覆盖最终出口（→ F-003）
- 竞态守卫枚举全部共享状态写入点，不只护新请求（→ F-004）
- 同一业务含义跨入口一致按 cross-path 取证，接回时显式取代旧 REQ（→ F-005）
- 只读 / 锁定语义逐控件穿透，不依赖表单层 disabled（→ F-006）
- 同源样式对齐规则清单与选择器，不只认 class 名（→ F-001）

## 验证
- node --test test/merchants/dynamic-enter-form.test.mjs：4/4（轮次 1 首交付）→ 20/20（REV-8 修复后）
- vue compiler-sfc 9 个 SFC OK；admin fixtures 28/28 PASS
- runtime-env 项（真实账号联调、浏览器 UAT）本轮未覆盖，属 READY_FOR_USER_TEST
```

## .state/run.json（节选）

```json
{
  "schema_version": "jj-flow/ralph-run/1.1",
  "run_id": "task-enter-form-dynamic",
  "task_key": "task-enter-form-dynamic",
  "title": "动态入驻表单：预览路由 + 申请/回显/编辑接入",
  "phase": "ACCEPT",
  "status": "IN_PROGRESS",
  "gate_set": "full",
  "gates": { "analyze": "PASS", "plan": "PASS", "deliver": "PASS", "accept": "PASS", "archive": "PENDING" },
  "artifact_refs": {
    "analyze": "task_plan.md",
    "plan": "task_plan.md",
    "acceptance": "task_plan.md",
    "progress": "progress.md",
    "findings": "findings.md",
    "latest_review_ref": "reviews/REV-8.json"
  },
  "review": {
    "latest_review_id": "REV-8",
    "reviews": [
      { "review_id": "REV-8", "outcome": "NEEDS_CHANGES", "path": "reviews/REV-8.json" },
      "…": "REV-1..7 共 8 条，含轮次 1 的 REV-1~3 与轮次 2 重编号的 REV-4~7，略"
    ]
  },
  "knowledge": {
    "memory_refs": [
      "2026-08-29#task-enter-form-dynamic-route#同源样式对齐规则清单与选择器，不只认 class 名 → F-001",
      "2026-08-27#task-inbox-cs-unread#同人换票 401 属会话态冲突 → tasks/task-inbox-cs-unread F-002"
    ]
  },
  "archive_history": [
    { "archived_at": "2026-08-29T03:43:13.371Z", "head": "bf4111b1c955cc58", "manifest_sha256": "e3b0c4429…" },
    { "archived_at": "2026-09-01T04:07:16.159Z", "head": "2b2b312a33e18db6", "manifest_sha256": "9f86d0818…" }
  ],
  "budget": { "max_iterations": 20, "iterations_used": 13 },
  "stagnation": { "patience": 2, "unchanged_count": 0, "fingerprint": "3eae7ced7b366f2f" }
}
```

## 预览演示的设计规则对照

- **任务目录即身份**（§3.2）：两个历史 run 合一目录，日期只出现在 archive_history 与轮次小节；run_id ≡ task_key ≡ 目录名。
- **8→3 + .state**（§3.3）：analyze / plan / acceptance / intent 四文件并入 task_plan.md 四段；机器面（run.json / reviews / handoff）全部收进 `.state/`；三个 artifact_ref 同指裸文件名 `task_plan.md`，无锚点。
- **三段分层跨轮累积**（§3.4）：`### 当前` 只有 REV-8 修复两项；两轮已落地按轮分节并回链 `archive_history[i]`；「不接回网关」显式进 `### 已取代`（原文 + 原因 + 时间）。
- **编号跨轮顺延**（§3.4）：轮次 2 的 countryCode 需求从原 REQ-002 重编为 REQ-009，Landed 引用不断链；REV / TASK 同理（合并目录下 `.state/reviews/` 单目录，REV-1 撞名必须重编）。
- **progress 追加式 + 轮次索引**（§3.4）：时间正序、恢复只读最后 30 行；每个 ⟲ 回滚带触发源与三行组（`looksLikeFixRun` 的 gate 输入），并指向一条 F 编号；`user_correction` 槽位在用（09-02 锁定 mapping 确认）；`fp=` / `unchanged=` 机器字段不出现（SSOT 在 run.json）。
- **findings 当场追写 + 五要素**（§3.4/§3.6）：六条 F 全部来自真实回滚 / 评审事件；「对策 + 适用范围」齐备；`## 可复用结论` 一句话回指 F 编号，archive 时晋升热层——对照旧管道同一批 run 的 `durable_lessons: []`。
- **零拷贝归档 + 注入可追溯**（§3.5/§3.6）：归档证据内联 `archive_history[]`（时间 + HEAD + 清单哈希）；`knowledge.memory_refs` 记录本轮注入了哪些热层条目（含跨任务命中）。
