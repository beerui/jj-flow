# Ralph 任务工作区 `.plans` 化改造

> 状态：Proposed
>
> 参考模型：`daji-customer-service` 仓库 `.plans/<project>/<role>/task-*` 工作区（任务 / 进度 / 文档三套规范）
>
> 关联设计：[jj-ralph](jj-ralph.html)（Implemented）、[Ralph 归档提升](ralph-archive-elevation.html)（Accepted）、[Ralph → 知识库贡献](ralph-knowledge-contribute.html)（Proposed，本方案 P0 即其落地路径）

## 1. 背景与问题

### 1.1 现状

一个 ralph run 从创建到归档，会在 `.workflow/ralph/RALPH-{slug}-{YYYYMMDD}/` 与 `archive/{YYYY-MM-DD}-{slug}/` 各留一份完整副本，每份 8 个文件：

```
acceptance.md  analyze.md  plan.md  progress.md  run.json
knowledge-attach.json  knowledge-contribution.json  archive-manifest.json  (+ reviews/ 与条件性 handoff.json——后两者在 §3.3 单列)
```

实测样本（seo-daji-web，2026-08-26 `enter-form-dynamic-route`）暴露三个结构性问题：

| # | 问题 | 根因 | 代码位置 |
| --- | --- | --- | --- |
| 1 | 同一需求产生多条 Ralph（`enter-form-dynamic-route` vs `enter-form-dynamic-apply`） | run_id 把**临时起的 slug** 和**日期**都编进目录名，任务没有稳定身份 | `buildRalphRunId`（`src/namingConfig.mjs:369`），pattern `RALPH-{slug}-{YYYYMMDD}` |
| 2 | 文件多且归档后双份 | `archiveRun` 是**复制**而非终结（soft closeout 可恢复），活跃目录原样保留 | `archiveRun`（`src/ralph.mjs:541`） |
| 3 | 知识零散、无闭环 | 见 §1.2——**提取源头错了**，管道无人触发只是次因 | `buildKnowledgeContribution`（`src/ralph.mjs:805` 起）、`attachKnowledgeRefs`（`src/portfolioKnowledge.mjs:83`） |

### 1.2 知识零散的真因：原料已在产生，提取管道看错了地方

问题不是「没有知识可提取」，而是**知识已经写下来了，提取器却去读了另一个文件**。

样本 `enter-form-dynamic-apply-20260901` 的 `progress.md` 里，有四组这样的三行结构：

```text
- failed_must: REQ-002 countryCode 从 audit/query 泄漏进模板 GET
- failed_evidence_class: behavior-local
- over_claimed: 仅测 helper 省略 countryCode，未测 page 把 audit/query 拼进 query

- failed_must: REQ-001 模板 path 曾猜测 getUserAndScene
- failed_evidence_class: write-then-read
- over_claimed: 未登录 YApi 时把 path 写成 /client/user/enter/template/getUserAndScene

- failed_must: REV-3 F-1 loadAuditRecord 在 loadSeq 前写 audit 共享状态
- failed_evidence_class: behavior-local
- over_claimed: loadSeq 只挡住模板 GET/schema，未挡住审核回填写入

- failed_must: 独立路由不接回网关 / 不从申请单分流
- failed_evidence_class: cross-path
- over_claimed: 仅独立 /dynamic 可测通，审核失败与企业信息回显仍走旧 path
```

`over_claimed` 一行尤其珍贵——它记录的是「我以为测到了，其实没测到」，是最难得的元认知，且**只有做完才知道**。

同一目录下 `knowledge-contribution.json` 的实际产出：

```text
candidates: 1，durable: 0
keywords: ["seo", "daji", "web", "不改现商家入驻入口", "测通后再接回", ...]
```

三条真知识就躺在同一个目录里，一条都没被拿走。原因在 `buildKnowledgeContribution` 读的是 `run.json` 的 `title` / `goal` / `scope` 再机械分词——那是**任务开始时的意图**，不是**结束时的认知**。从意图里提取，天花板就是分词噪音。

推论有两条，都决定后续设计：

1. **findings.md 不是凭空新增的负担**，而是把已在产生、却被埋在六十行时间戳流水里的信号提出来单独成文。
2. **换目录结构解决不了知识问题**，必须同时换提取源头（§3.6）。只做 8→3 而不动管道，等于换了个更整洁的地方继续丢知识。

### 1.3 参考模型的吸引力

`daji-customer-service` 的 `.plans` 工作区，一个任务一辈子一个目录、只有 3 个文件：

```
.plans/daji-cs/frontend-dev/task-outbound-token-takeover/
  task_plan.md   -- Goal + 验收 checklist + Steps checklist
  progress.md    -- 日期分节的追加式工作日志
  findings.md    -- 改动摘要 / 行为表 / 修复记录 / 验证证据（核心交付物）
```

目录清晰、身份稳定、知识（findings）与过程（progress）天然分离。

### 1.4 必须先认清的一点：参考模型是纯 prompt 约定

三套规范的权威定义**不是程序**，而是三份提示词/手册（见 §2）。没有任何 schema、校验或生成器；连它自己的归档规则（progress 长了归档到 `archive/progress-<period>.md`）都从未被执行过（`frontend-dev/` 下无 archive 目录）。它能维持整洁靠的是团队规模小 + 提示词强。

因此本方案的立场是：**吸收 `.plans` 的文件语义与恢复语义，但每条规范都必须落到 jj-flow 的模板、schema 或 gate 里**——软约定进 ralph 就会漂移。

## 2. 学到的三套规范（参考模型事实）

规范来源三层：

1. **`CLAUDE.md` / `AGENTS.md`**（repo 根，团队运营手册，内容一致）：定义任务下发协议、Doc-Code Sync、状态检查方式。
2. **`.plans/daji-cs/team-snapshot.md`**（每次建团队/恢复上下文时加载，内嵌各角色 system prompt，「文档维护（最重要！）」章节）：三文件职责、索引规则、恢复规则、更新触发时机的权威定义。
3. **`.plans/daji-cs/docs/team-bootstrap.md`**（runbook）：恢复时 progress 只读最后 30 行。

### 2.1 任务规范

- **三层级**：
  - 主计划 `.plans/<project>/task_plan.md`：项目概述 + 阶段概览 + **任务汇总表**（# / 任务 / 负责人 / 状态 / 计划文件路径）+ 当前阶段指针（含 HEAD、分支、审查报告链接）。
  - 角色级 `<role>/task_plan.md`：个人任务清单（做什么、做到哪）。
  - 任务级 `task-<name>/task_plan.md`：`> Status` 头 + `## Goal` + `## 验收`（checkbox）+ `## Steps`（checkbox）。
- **命名前缀区分性质**：`task-<功能名>` / `research-<topic>` / `review-<target>`。
- **大任务/小任务分界**：bug 修复、配置变更直接发消息，不建文件夹、不审查；大任务下发消息必含四要素——范围目标+验收标准、文档提醒（创建任务文件夹）、依赖说明、审查预期。
- **恢复读取顺序**（压缩后必读）：`docs/index.md` → docs 相关文件 → 自己的 task_plan → 进行中任务的三文件；一般性恢复只读根 findings（索引）+ 根 progress（最后 30 行）。
- **更新触发**：完成一个任务/步骤 → 更新 task_plan + progress；发现坑 → findings；决策偏离 → findings + 通知。
- **协议性软规则**：3-Strike 错误处理、每 ~10 次工具调用五问自检、收到任务先一句话确认、完成汇报必须带证据（grep/diff/测试输出）、上下文溢出先写 progress 再上报。

### 2.2 进度管理规范

- **定位是「恢复态」文件**：角色级文件头明写「用于上下文恢复。压缩/重启后先读此文件」。首要用户是 context compaction 后的自己。
- **两层结构**：角色级 `<role>/progress.md`（跨任务总日志）+ 任务级 `task-<name>/progress.md`（单任务日志）。
- **格式**（规范条文 + 实际文件归纳）：
  - 标题 `# <task-name> - progress`；
  - 按日期 `## YYYY-MM-DD` 分节，追加式（`echo ... >>`），不重写历史；
  - 每节简短 bullet：实现要点、**验证证据**（`单测 15 PASS` / `pnpm build PASS`）、状态（DONE / 未 commit / 待复审）、文档同步、下一步。
- **长度治理**：难浏览 → 旧内容归档 `archive/progress-<period>.md`；恢复只读最后 30 行；读取用 Grep 按标签搜，不全量 Read。
- **溢出协议**：感觉上下文过长 → 先把当前状态写进 progress，再通知。

### 2.3 文档规范

- **docs/ 四件套**（项目知识库，路径 `.plans/<project>/docs/`）：
  - `index.md`：导航地图（文档 × 关键 Sections × 最后更新）+ **新鲜度日志**（上次审计 + 状态），明确「智能体先读此文件再进 docs/」。
  - `architecture.md`：系统组件、数据流、ADR 注记。
  - `api-contracts.md`：字段名和类型的**真理源头**，devs 添加/变更端点时**必须**更新。
  - `invariants.md`：INV-N 编号的系统边界，**违反任何一条 = CRITICAL Bug**，每条标注状态（已有实现 / commit 起强制 / 人工检查）。
- **decisions.md（ADR）**：`ADR-NNN · 标题`，字段固定——日期 / 状态（accepted）/ 关联 commit / 背景 / 决策 / 备选方案（已否决）/ 后果。
- **Doc-Code Sync（强制）**：API 变更 → 同一任务内更新 api-contracts；架构变更 → architecture；「未文档化的 API 对其他智能体来说不存在」；reviewer 把 Doc-Code 一致性列为 HIGH 级检查项。
- **findings 索引体系**：根 findings = **纯索引**（每条仅 Status + Report 链接 + Summary，膨胀即拆分到任务文件夹）；任务 findings = 核心交付物（改动摘要表、行为表、M-1/M-1r 修复记录、验证、审查预期）；reviewer 完成审查后在 dev 的 findings 追加**交叉引用**；调研类 findings 带 `[RESEARCH] [BUG] [ARCHITECTURE]` 标签；2-Action Rule（调研场景每 2 次搜索必须落一次 findings）。
- **Known Pitfalls**：护栏捕获（3-Strike 上报解决）后追问「会复现吗」，会则追加到 CLAUDE.md 的 Known Pitfalls + findings 留详录——这是坑类知识的沉淀点。

## 3. 目标设计

### 3.1 总原则

1. **任务目录即身份**：稳定 task_key 目录，日期只存在于 run.json 与归档快照名。
2. **机器事实与人的文档分离**：run.json 是唯一机器 SSOT（gates/budget/stagnation/attestation），人只维护 3 个 md。
3. **知识有唯一落地动作**：archive 时晋升 KB candidate，run 目录不再堆积候选包裹。
4. **每条 `.plans` 规范机制化**：模板由 skill 生成、归档由 CLI 执行、完整性由 gate 校验。

### 3.2 目标目录布局（P2 完成态）

```
.workflow/ralph/
  tasks/<task_key>/            -- 稳定任务目录（task_key 无日期；一任务一目录）
    task_plan.md               -- 分析 / 计划 / 验收 三 section（中文标题，§3.11）
    progress.md                -- 日期分节追加式日志（.plans 进度规范）
    findings.md                -- 发现/改动摘要/验证证据（知识抽取源）
    .state/                    -- 机器面，人不看；ls 默认不显示
      run.json                 -- 唯一机器 SSOT（schema 1.1；归档 sha256 内联）
      reviews/                 -- REV-*.json（jj-review 适配，reviewer 只读）
      handoff.json             -- jj-same handoff-first 锚点（run.handoff 仍是 SSOT）
  business-map.json            -- L1（不变）
  archive/                     -- 旧布局只读保留（不迁不删，§3.5；活跃旧目录迁移后成 .migrated-*，确认后可删）
```

**`.state/` 已定（本方案采纳）**：机器面统一收进点前缀子目录，人 `ls` 任务目录只见 3 个 md——这是「8→3」诉求的直接实现，否则人打开仍见 4~5 项。代价有二，均可接受：查机器状态需 `ls -a` 或显式路径（本就是机器读的）；下游路径常量深一层，与 §3.10 的 jj-same / jj-review 改动**同批落地**（P2），不额外增加变更批次。

task_key 即 `.plans` 的 `task-<name>` 语义，**自带 `task-` 前缀**（如 `task-enter-form-dynamic-route`），与 run_id 是**同一字符串**——下段「合一」即指此；早期「run_id 恒为 `task-` + task_key」的派生写法与 §3.12 目录示例（`tasks/task-<slug>/`）冲突，已废弃。统一正则 `^task-[a-z0-9][a-z0-9-]{1,80}$`，消除现存 slug 正则与 run_id 硬编码正则的边界缝隙（单字符/尾连字符/大小写/下划线）。`namingConfig` 新增 `task_dir_pattern: tasks/{task_key}`。init 时先查 business-map / 热层相似历史并**建议复用**，用户可改；`jj ralph adopt --task <task_key>` 可把已存在的 run 绑定到规范目录。

**run_id 与 task_key 合一（已定）**：run_id 改为 `task-<短语>`，即 task_key（正则 `^task-[a-z0-9][a-z0-9-]{1,80}$`），与任务目录同名——目录即身份即标识，不留第二套命名。多轮归档事件由 run.json `archive_history[]`（时间 + git HEAD + 清单哈希）承载；dispatch 绑定不受影响（`delivery_id` + `attempt` 是调度自有身份）。连带改动：`namingConfig` 的 `run_id_pattern / run_id_regex / active_run / completed_run / archive` 模板组、`schemas/ralph-run.schema.json` 的 run_id 正则、`buildRalphRunId` / `assertStrictRalphRunId` 改为 taskId 语义；存量旧 `RALPH-*` id 在 `ralph migrate` 中映射（规则见 §3.12）。

### 3.3 文件映射（8 → 3+1）

| 现有文件 | 去向 | 说明 |
| --- | --- | --- |
| `analyze.md` | `task_plan.md` 的 `## 分析`（子段降三级，§3.11） | 分析是计划的输入，合并为计划文件的一节 |
| `plan.md` | `task_plan.md` 的 `## 计划` | Goal + 范围 + Steps checklist（对齐 `.plans` 任务级模板） |
| `acceptance.md` | `task_plan.md` 的 `## 验收` | 验收项必须带**证据引用**（测试命令+结果），不只是打勾 |
| `intent.md` | `task_plan.md` 的 `## 目标`（发起人原话） | **原表遗漏**。standard 档默认写此文件（`src/ralph.mjs:483`），故现状对 standard 是 9 文件不是 8。其 5 个子段（Problem / Proposed outcome / Affected users / Constraints / Open questions）降为 `### ` 并入目标段；`artifact_refs.intent` 改指 `task_plan.md`，保住 `computeRunMetrics:2572` 的 `intent_to_analyze_hours` 与 `phases.md:7` 的 ANALYZE gate 判据（Flagged concerns 须回答 intent open questions） |
| `progress.md` | `progress.md` | 语义不变，格式对齐 §2.2 规范（日期分节、追加、证据 bullet） |
| （无） | `findings.md` | 新增，承接 knowledge-contribution 的人读核心：改动摘要、可复用结论、验证证据。**必须同批新增 `artifact_refs.findings` 键**——`commitPrep`（`:2462`）只 stage `run.json` + `artifact_refs` 列出的文件，不加键则知识原料写完永不入库；`schemas/ralph-run.schema.json:288` 是 `additionalProperties:false`，加键须同批改 schema |
| `knowledge-contribution.json` | **停写** | 拆为 findings.md（人读）+ KB candidate upsert（机器，§3.6） |
| `knowledge-attach.json` | **并入 run.json** | `knowledge_refs` / `knowledge_summary` 字段本就存在，删重复缓存文件 |
| `archive-manifest.json` | **并入 run.json `archive` 字段** | sha256 清单内联，零文件副本；交付冻结证据归 dispatch snapshot 机制 |
| `run.json` | 保留，schema 升 1.1，移入 `.state/` | gates / budget / stagnation / artifact_refs（**裸文件名，见下方硬约束**）/ knowledge 内联字段 |
| `reviews/` | 移入 `.state/reviews/`，内容不变 | reviewer 只读适配 jj-review，输出可追溯 findings |
| `handoff.json` | 移入 `.state/handoff.json` | jj-same handoff-first 协议的锚点（§3.10），migrate 映射必须保持可解析 |

**`artifact_refs` 硬约束：三个键必须都填裸文件名 `task_plan.md`，禁止 `task_plan.md#analyze` 式锚点。** 这不是风格偏好，锚点会同时打断三处已实现逻辑（核查见 §3.10 表 B）：

- `readRunArtifactText`（`src/ralph.mjs:1690`）对 ref 做 `path.join` + `existsSync`，带 `#` 必然落空并**静默返回空串**——`collectClaimedImplementationPaths`（`:1706`）随之收到空清单，product-consistency 合规 gate 从「比对声明路径」退化为「无路径可比」，**不报错、直接放行**。这是本方案风险最高的一处，静默降级比崩溃更难发现。
- `commitPrep`（`:2466`）把四个 ref 展开成四条待提交路径，靠 `unique()`（`:161`）去重；裸文件名时三条折叠为一条，带锚点则去重失效，`git add` 收到 3 条不存在的路径。
- `validateRun`（`:314`）只校验四键非空，锚点能通过校验——**没有守门人会拦住这个错误**，只能靠本约束 + 合约测试。

三个 ref 指向同一文件后，section 切分由**读取侧**负责：`extractPlanCurrentSection` / `extractAcceptanceActiveText`（`:1612` / `:1624`）必须先按 `## 分析` / `## 计划` / `## 验收` 裁出对应段再解析，否则 Plan 段的路径会被 Acceptance 解析器重复计入 ledger（同一文件被读三遍）。这是 P1b 的必做项，不是可选优化。


### 3.4 文件模板（规范固化进 skill）

由 `jj ralph init`（ANALYZE 前）生成骨架，skill 文案与模板同步修改。

**章节名一律中文（已定）**。边界要分清：这三个 md 是**业务仓工作区产物**，首要读者是中文使用者，标题用中文；`skills/**` 的指令正文仍是英文 SSOT（`skill-en-zh-rewrite` 既有约定不变，中文只出 `docs/skill-zh-bridge/` 对照）。二者不冲突——前者是产物内容，后者是 agent 运行时协议。机器可解析的标识符（`run_id` / `task_key` / `evidence_class` 取值 / 阶段名 / gate 名）保持英文，不参与本次中文化。

**task_plan.md**

```md
# <task_key>

> 运行: <run_id>　状态: <phase/status>　分支: <branch>　轮次: <round>

## 目标
<发起人原话（原 intent.md）>
### 待答问题
<原 intent.md 的 Open questions；ANALYZE 须在「存疑事项」回答>

## 分析
### 必须项
- REQ-n <MUST 描述>  ［evidence_class: diff-only | behavior-local | write-then-read | cross-path | runtime-env］
### 范围外
### 存疑事项
### 未解决

## 计划
- knowledge_refs: <从 run.json 注入，可空>
### 当前
1. [ ] TASK-n → REQ-n: <步骤>
### 已落地
<按轮次分小节；仍成立的完成项 + 回链（任务目录 + archive_history[i].head，靠 git 取历史全文）>
### 已取代
<原文 + 一行原因 + 时间戳>

## 验收
### 当前
| 项 | must_id | evidence_class | 结果 | 证据 |
| --- | --- | --- | --- | --- |
### 已落地
<按轮次分小节的历史验收表>
```

**层级规则（解析器依赖，不可随意调整）**：`## 目标 / ## 分析 / ## 计划 / ## 验收` 是一级骨架，其余全部降为 `###`。原 analyze.md 的 `## MUST` / `## OUT` / `## Flagged concerns` / `## UNRESOLVED` 五个二级子段随之降级——**其中原有的 `## Acceptance` 子段废止**（合并进顶层 `## 验收`），否则合并后出现两个 `## 验收`，`extractMarkdownSection` 取首个匹配会拿到 MUST 后的验收草稿而非正式验收表。

**验收段分层是语义变更，不是改名（已定，需推翻现行禁令）**。`skills/jj-ralph/references/artifact-layout.md:72` 现行契约明写 acceptance「markdown table, no Current sections … **Do not** convert the table into Current/Landed/Superseded headings」。采纳分层后必须同批：

1. 改 `extractAcceptanceActiveText`（`src/ralph.mjs:1620`）——它现在**只做行级 `SUPERSEDED` 过滤、无 section 概念**，三 ref 指向同一文件后会吃进整个 task_plan.md（含计划段路径）。须改为「先裁 `## 验收` → 再裁 `### 当前`」两跳。
2. 推翻 `artifact-layout.md:72` 的禁令并改写该行。
3. 否则 `### 已落地` 的历史验收表会被当作本轮在效证据参与 ACCEPT 判据，且其反引号路径重复进 ledger。

因此 §3.11 的「语义与解析结构完全不变，只换名」定性**仅适用于计划段与分析段**，验收段是例外，已单列。

gate 判据调整：PLAN gate 要求 `## 计划` 的 `### 当前` 存在且非空；ACCEPT gate 要求 `## 验收` 的 `### 当前` 每项有证据引用；ANALYZE gate 沿用「`### 存疑事项` 须回答 `### 待答问题`」（原 phases.md:7 判据，随 intent 并入调整段名）；ARCHIVE gate 复用现有 product-consistency 检查。

**progress.md**

```md
# <task_key> - 进度

> 用于上下文恢复。压缩/重启后先读此文件（最后 30 行）。
> **追加式，时间正序**；轮次导航见下方索引表，不倒序、不重写历史。

## 轮次索引
| 轮次 | 日期 | 主题 | 结果 | 认知 |
| --- | --- | --- | --- | --- |
| 2 | 2026-09-01 | 接申请与回填 | 4 迭代 / 4 评审 / 3 回滚 | F-003..005 |
| 1 | 2026-08-26 | 独立路由 | 1 迭代通过 | F-001 |

## 轮次 1 · YYYY-MM-DD · <主题>

### 迭代 n
- 实现：<要点>
- 验证：<命令 + PASS/FAIL>
- user_correction: <可选；用户当场纠正时追加，记原话或要点>
- <ISO 时间戳> deliver-attempt / gate 行（机器追写，勿手改）

### ⟲ 回滚 n — 触发源：自查 | 评审 REV-n
- failed_must: <REQ-n 描述>
- failed_evidence_class: <diff-only | behavior-local | write-then-read | cross-path | runtime-env>
- over_claimed: <以为测到了、实际没测到的是什么>
- → findings.md **F-00N**
```

**`failed_must` / `failed_evidence_class` / `over_claimed` 三行是 gate 输入，必须保留槽位；`user_correction` 是同级的第四个信号。** 它们不是噪音——`looksLikeFixRun`（`src/ralph.mjs:1753`，正则在 `:1755`）grep progress 全文的 `failed_must` / `user_correction` / `over_claimed` 判定是否 fix run，进而驱动 `detectTestIntegrityViolation`（`:1777`）；`analyzeRework`（`:2560`）同样消费。删掉即**测试完整性检查静默失效**。`user_correction` 当前全仓只有读取端、没有机器写入方（`must-evidence.md:99` 仅在分类规则中提及），本就靠 skill 文案维系——模板不留槽位，这条信号路径会随模板化静默断掉。§1.2 全节的立论证据正是这些行，模板必须给它们固定位置。

**只排除三类机器字段**：`fp=` 指纹、`unchanged=` 停滞计数、毫秒级重复时间戳——这些在 `.state/run.json` 的 `stagnation` 里已是 SSOT。**gate / deliver-attempt 行的 ISO 时间戳必须保留**：`parseProgressEvents`（`:2529`）以行首 ISO 时间戳为锚点匹配三类事件，`computeRunMetrics`（`:2550`）用 `events.find()` 取**首个**匹配算时长。

**因此文件必须时间正序、追加式**（`appendProgressLine`，`:2455`）。早期草案曾写「轮次倒序，最新在最上」——已废弃：倒序会让 `events.find()` 取到最新一轮，所有时长指标出错甚至为负；且倒序无法用追加实现，与 §2.2 的 append-only 规范和「恢复只读最后 30 行」同时冲突。轮次导航改由文件头的索引表承担。

**回滚必须显式标记 `⟲` 并写触发源**：自查回滚说明上一轮验收标准不够严，评审回滚说明验收标准覆盖不到该维度——两者要改的东西不同。**每个回滚都指向一条 F 编号**：回滚要重跑整个 DELIVER→ACCEPT 循环，是最贵的动作，不留认知等于白付代价。

**findings.md**

```md
# <task_key> - findings

> 状态: <摘要>　分支: <branch>　ADR/决策: <引用或"无">

## 改动摘要
| 文件 | 轮次 | 变更 |

## 行为/契约
<表或条目；API/架构变更必须注明已同步项目 docs>

## 踩坑与因果
### F-00N <一句话结论>
- 现象: <观察到什么>
- 原因: <为什么会这样>
- 对策: <下次该怎么做——写做法，不写"我改了哪行">
- 适用范围: <什么场景下这条成立>
- 代价: <可选；本条坑造成的返工/回滚>
- 证据: <REV 编号 / 测试 / progress 回链>

## 可复用结论
<每条一句话规则 + 回指对应 F 编号；archive 时逐条晋升热层与 KB candidate>

## 验证
<测试命令与结果汇总>
```

**写入时机：DELIVER 阶段增量追写，不是 ARCHIVE 时回顾生成。** 这是 findings 能否成为合格知识原料的分水岭：

- 实测样本的两条真知识（同人换票 401、断连未 await）分别产生于 08-27 与 08-28，跨天跨会话。归档时一次性回顾，当时的上下文已随会话结束消失，产出必然退化为「计划的复述」。
- §1.2 已证明「只有做完才知道」的认知（尤其 `over_claimed`）无法从任务开始时的意图反推。错过当场，就只能靠猜。

**五要素中「对策」与「适用范围」是硬性要求**，缺一条则该条目不具备复用价值：只写「我改了哪行」的条目投进知识库后，检索命中也无法判断该不该套用；缺「适用范围」则无法判断何时该挂载。这正是 §1.2 里旧管道产出「1 条被截断的 lesson、durable=0」的直接原因。

**机械支持**（软约定进 ralph 必漂移，见 §1.4）：

- `skills/jj-ralph/scripts/ralph_ops.mjs` 新增 `finding` 子命令，按五要素追加条目并在 progress 留一行索引，使追写是一次命令而非一次自觉（注意实际路径：该脚本在 skill 目录，仓库根 `scripts/` 下无此文件，勿新建错位）。
- DELIVER gate 增**软检查**：本轮存在 `recordDeliverAttempt(improved=false)` 或发生 `rollbackPhase`，但 findings 无新增条目时提示「这次失败的原因记下来了吗」。**只提示不阻断**——回滚是最贵的动作（要重跑整个 DELIVER→ACCEPT 循环），不留认知等于白付代价；但强制会诱发凑数条目，反而污染知识库。
- 编号 `F-00N` 跨轮连续，与必须项编号同理（§3.4 多轮语义）。

**多轮任务语义**（同一 task_key 归档后 resume、或后续 run 绑定同目录）：

单目录累积是本方案的核心收益，也是它最容易被写坏的地方——多轮语义必须与**已实现的 `## Current` / `## Landed` / `## Superseded` 三段合约**（本方案中文化为 `### 当前 / ### 已落地 / ### 已取代`，语义不变，见 §3.11）对齐，不能另起一套。

> **冲突记录（本次评审推翻的早期方案）**：本节初稿写的是「`## Analyze / ## Plan / ## Acceptance` 每轮重写，上一轮计划不保留副本」。该写法与现网机制直接冲突，已废弃。理由：
> - `extractPlanCurrentSection`（`src/ralph.mjs:1612`）已实现 `## Current` → legacy `## Tasks` → 全文的三级回退，且**显式排除 Landed / Superseded**；
> - `jj-review` 的合规判据是「diff 比对 `plan.md` ## Current」（`skills/jj-review/SKILL.md:68`、`references/review-policy.md:13`）；
> - 实测样本 `enter-form-dynamic-apply` 的 `plan.md` 正在使用该结构（`## Current` 1 条 + `## Landed` 7 条）。
>
> 「每轮重写」会让第二轮的 agent 丢失第一轮的在效约束（如「复合控件必须复用现有上传组件」），从而重做或推翻已落地的工作——这正是 §1.1 问题 1 想消除的浪费。

落定语义：

- **`task_plan.md` 跨轮累积，靠三段分层而非重写**。`### 当前` 只放本轮在效项；上一轮完成且仍成立的降入 `### 已落地`（按轮次分小节，附归档快照回链）；被取代的原文进 `### 已取代`（保留原文 + 一行原因 + 时间戳）。头部 `运行:` 仍累积 run_id 事件链。
- **必须项编号跨轮连续**（轮次 1 用 REQ-001~004，轮次 2 从 REQ-005 起）。同名编号在两轮含义不同会让 Landed 的引用失效——实测两条 run 各自都有 `REQ-001` 且语义完全不同，合并时必须重编。`TASK-n` / `REV-n` 同理跨轮顺延：合并目录下 `.state/reviews/` 是单目录，两条 run 各自的 `REV-1` 会撞名互覆；adopt 重编号须同步 `run.json` 的 `review.reviews[].review_id` / `latest_review_id` 与 reviews/ 文件名及 progress / findings 中的引用（`REV-<n>` 均为纯数字串，机械可改）。
- **`progress.md` 与 `findings.md` 跨轮累积**：progress **时间正序追加**、按轮次分节并注明所属 run（倒序会打断 `computeRunMetrics`，见 §3.4 progress 模板说明），轮次导航靠文件头索引表；findings 增量更新改动摘要行与「可复用结论」，头部状态恒为最新轮。
- **衰减治理**（单目录长期累积的必然问题，先定规则再落地）：

  | 风险 | 触发点 | 对策 |
  | --- | --- | --- |
  | progress 无限增长 | 超过 5 轮 | **不压缩、不重写**（append-only 是 `parseProgressEvents` 的前提）；头部索引表标注冷区，恢复只读最后 30 行；完整历史靠 git 与 `archive_history[i]` 的 HEAD 回取 |
  | Landed 积压成史书 | 超过 10 条必须项 | 按轮次分小节；对应模块已重写的整节移入归档 |
  | findings 条目重复 | 同类坑再踩 | 追加前先扫已有条目的「适用范围」，命中则在原条目下加一行「再次出现」，不新开编号 |

- lite 档共用同一语义（BRIEF 即 `### 当前` 段的精简形态，已落地 / 已取代 规则不变）。


进度/恢复语义完全采纳 §2.2：追加式、Grep 检索、恢复只读最后 30 行；「上下文溢出先写 progress」写入 jj-ralph SKILL.md 的 DELIVER 循环规则。

### 3.5 归档语义反转（零拷贝）

归档 = 原地翻转 + 证据内联，**不再复制任何文件**：

- `archiveRun` 将任务目录 status 置 COMPLETED（软关闭可恢复语义不变——resume 把 status 翻回来继续写同一目录），并在 run.json 内联 `archive` 字段：`{ archived_at, files: [{ path, sha256 }] }`；resume 后再次归档以 `archive_history[]` 追加事件（时间 + git HEAD + 清单哈希）——历史可追，磁盘零拷贝。
- 旧 archive-manifest.json 的 sha256 存证价值由内联字段等价承接；**交付冻结证据**（dispatch 交付证明 / sandbox attestation）由 dispatch 既有的 snapshot 机制承担，ralph 不自建副本。
- 旧布局处置与 §5 硬切口径一致：活跃 `RALPH-*` 目录在 P2 加载即报错并提示跑 `jj ralph migrate`（迁移后原名改 `.migrated-` 前缀保留一轮，§3.12 步 7）；`archive/` 历史快照**只读保留、不迁不删**——jj-review P2 验收的「新旧布局各定位一个 run」依赖旧布局目录存在，可删除的仅限确认无误后的 `.migrated-` 目录。

### 3.6 知识管道（P0，最优先；轻量默认 + KB 可选）

两条硬约束（与推广策略对齐）：

- **绝不写业务仓库的指令文件**（AGENTS.md / CLAUDE.md / `.cursorrules` 等）。热层知识只在「使用 jj 时」注入：init 生成 task_plan.md、dispatch 派单简报、resume 恢复读取。
- **主循环零基建**：不要求用户配置或理解 portfolio KB（外置 git 仓 / extractors / candidate→active 审核 / web 管理端）即可完成闭环。KB 降级为 opt-in 的跨项目/团队层。

三层知识模型：

| 层 | 位置 | 写入 | 读取 |
| --- | --- | --- | --- |
| 冷层 | 归档任务目录的 findings.md `## 踩坑与因果`（F-00N 五要素全文） | DELIVER 阶段当场追写（§3.4 写入时机） | 人工 / Grep 回查；**永不整读**，按回链拉单条 |
| 热层（默认） | `~/.jj-flow/memory/<project_key>.md`（用户级、append-only） | archive 时从 findings `## 可复用结论` 追加；每块 = 日期 + task_key + 规则一句话 + 回链归档路径 | init / resume / dispatch 时按 CJK bigram 词法排序注入（复用 `memoryRetrieve`，纯本地 md 解析，无索引服务；沿用注入软上限） |
| 组合层（opt-in） | `~/.jj-flow/knowledge`（既有 portfolio KB） | KB root 已存在时 archive 顺带 upsert candidate，走既有审核；不存在时静默跳过 | attach 可用时叠加注入；不可用时不阻塞主循环 |

**`## 踩坑与因果` 与 `## 可复用结论` 的分工**（同一文件两节，职责不同，勿混）：前者是**冷层全文**——五要素完整、含现象与证据，供回查时理解来龙去脉；后者是**热层投喂口**——每条一句话规则，是前者「对策 + 适用范围」两行的蒸馏。archive 时只有 `## 可复用结论` 进热层（注入有界，全文进 context 必然膨胀），`## 踩坑与因果` 留在归档目录供回链拉取。写 `## 可复用结论` 时**必须回指对应 F 编号**，保证热层每条一句话都能追回冷层全文。

另需与 §2.3「findings 索引体系」的分层对齐：本方案不设参考模型的「根 findings 纯索引」层——jj-flow 单仓闭环只有一条执行线（§5），热层 `~/.jj-flow/memory/<project_key>.md` 已承担跨任务索引职责，无需在仓内再建一层。

要点：

- **热层放用户级而非仓内**：实测 seo-daji-web 的 `.workflow/ralph` 被 gitignore，仓内知识文件天然单机、re-clone 即失；`~/.jj-flow` 由 jj-flow 独占写入，跨 clone 存活，且完全不触碰业务仓库。参考模型 `.plans` 的知识闭环一半建立在它被 git 跟踪、随仓团队共享之上——这个前提在 ralph 侧必须显式设计而不是继承。团队 git 共享作为可选项：建议 un-ignore `.workflow/ralph/knowledge.md` 单文件作团队热层镜像（一条 .gitignore 改动，opt-in，非指令文件）。
- **去重与蒸馏**：热层 append 前 grep 级查重（同 task_key / 高相似文本跳过）；组合层启用时走 KB 既有 conflict hold / merge。热层条目带 `confirmed` 人工标记位（`jj ralph knowledge confirm`，轻量人审），confirmed 条目置顶并提高注入权重——机制化替代参考模型「细节→规则」的蒸馏，终点仍是 jj-flow 自己的文件。
- **注入有界（防上下文膨胀）**：进 context 的每一路都有上限——热层注入软上限 5 条（复用 `INJECT_SOFT_CAP`，`MIN_RELATED_SCORE` 强相关门槛之下宁可 0 条、禁止凑数），每条为「一句话规则 + 回链」，注入总量另设 token 预算；冷层文件**永不整读**（细节靠回链按需拉取单份归档）；progress 恢复只读最后 30 行（文件在磁盘上增长不进 context）；热层文件本身单项目条目设硬上限，超限由 `jj ralph knowledge prune` 归并过期条目。总原则：**存储可以无界增长，注入每路有界**；注入只发生在 init / dispatch / resume 三个时机，不是每轮对话常载。
- **热层与 business-map（L1）分工，不双写全文**：business-map 记**能力与模块坐标**（什么功能落在哪些文件，供跨任务定位与调度），热层记**行为规则**（怎么做不踩坑，供任务注入）；archive 产物按此分流——capability/elevation 走 §3.7 的 L1 提升，`## 可复用结论` 走热层。
- **home 索引去向（评审补充，已定）**：P1 停写 knowledge-contribution.json 后，`jj ralph knowledge-contribute` 与 `jj init` 的 `builtin-home-knowledge` ingest 链（`src/ralph.mjs:1008`、`src/jjInit.mjs:262-275`、`src/homeKnowledge.mjs:41-51`；home 索引由 `ensureJjFlowHome` 默认创建，**不属于**「KB root 未配置静默跳过」场景）随之断供——home 索引由热层取代，`knowledge/index/search.json` 旧条目只读保留并标注 deprecated；P1 验收含 ingest 链的显式降级测试。
- **P0 实现边界（评审补充）**：`memoryRetrieve` 只提供 bigram 打分原语（输入为结构化 rows），热层 md → rows 的解析、grep 级去重、confirmed 置顶是 **P0 新增模块**（可与 findings Lessons 提取同模块），工作量按此评估；热层写入须容忍旧 run 尚无 findings.md（静默跳过）；project_key 作文件名前先 slug 化并兜底空值（`src/projectMap.mjs:63` 的 alias 归一不过滤 Windows 非法字符，空 key 落 `unknown-project`）。
- **提取源与 §1.2 的论证对齐（闭环补缺）**：§1.2 证明原料已在 progress 的 `failed_must` / `over_claimed` 三行里，但热层取的是 findings 的 `## 可复用结论`——一个需 agent 另外手写的文件。若不衔接，等于「旧管道读错地方，新管道读对地方但那里可能是空的」。故 `ralph_ops finding` 与 DELIVER 软提示**以本轮 progress 的 `failed_must` / `over_claimed` 三行为预填草稿**：现象与原因两栏自动带入，人只补「对策」与「适用范围」。这样已保证存在的机器信号成为知识的起点，而不是被绕过。
- **可追溯（分阶段，评审修正）**：run.json 留 `knowledge.memory_refs`（本轮注入了哪些热层条目），保证「哪条知识影响了哪个任务」可回查。**该键随 P1b schema 1.1 落地，不进 P0**——P0 红线是「不动布局与 schema」，而 schema 顶层 `additionalProperties:false` 且现状无 `knowledge` 对象（`knowledge_refs` / `knowledge_summary` 是顶层标量数组，语义不同不可复用）；P0 期间注入记录以 progress.md 追写行承载（沿用 init 现有 `knowledge_refs:` 行格式，`src/ralph.mjs:493`）。

该节取代 [Ralph → 知识库贡献](ralph-knowledge-contribute.html)（Proposed）中「写包裹文件、等外部流水线」的默认路径（其管线保留为组合层实现）；`ralph-archive-elevation` 的 L1 business-map 提升不变。

### 3.7 保持不变的 ralph 机制

- **循环控制**：max_iterations / budget / stagnation（patience、unchanged_count、fingerprint）——这是 ralph 相对纯 3 文件计划目录的核心价值，`.plans` 模型没有对应物，全部保留在 run.json。
- **事实来源红线**（AGENTS.md）：checkpoint 只认控制面 manifest、run.json、Git commit、verification/review artifact 与 sandbox attestation；3 个 md 不推进任何 gate，只作为证据载体被 gate 校验。
- **Reviewer 只读**、Developer 仅在批准目标项目写工作区、delivery_id ≠ 对话入口等多项目调度边界不变。

### 3.8 任务分档（lite path）

五阶段全档对 10 分钟级 bugfix / 配置变更是纯流程税——用户感知的「Ralph 太重」多来源于此。参考模型以「大任务建文件夹、小任务直接消息」分档，ralph 侧对应：

| | full（现状） | lite（新增） |
| --- | --- | --- |
| 入口判档 | `$jj-ralph` 默认 full | init 时按规模判档（改动面小、无架构影响、单一验收项）；`--lite` / `--full` 可显式覆写 |
| 阶段与 gate | ANALYZE→PLAN→DELIVER→ACCEPT→ARCHIVE | 合并为 BRIEF→DELIVER→CLOSE（ANALYZE 并入 BRIEF，ACCEPT+ARCHIVE 合并 CLOSE） |
| 文件 | task_plan / progress / findings / run.json | **同一布局不另起一套**；仅 Analyze 节允许缩为一句话 |
| 循环控制 | budget + stagnation 全量 | budget 收紧（max_deliver_loops ≤ 3）；stagnation 的 fingerprint 保留 |
| 升档 | — | 任一 gate 失败或范围膨胀 → 自动升 full |

分档判错是可恢复的：lite 升 full **不换目录、不丢证据**，已有文件直接续写——这是「任务目录即身份」（§3.2）的直接收益。

schema 层面：1.1 在 P1 即预留 `gate_set: full | lite` 字段（full = 现五 gate；lite = brief / deliver / close），lite 落地时不再二次动 schema；`gate_issues`、`budget`、`stagnation` 两种档位共用结构，仅取值范围不同。

### 3.9 `ralph.mjs` 模块拆分（与 P1 同批）

`src/ralph.mjs` 现 2607 行单文件（状态机 + 五 gate + 归档 + 知识贡献 + business-map 集于一身），且在 `skills/jj-ralph/scripts/lib/` 有逐字节副本（sync 脚本维持）。P0 要加热层读写、P1 要加 task_plan 三 section 解析，必须**先拆再长**：

- 按职责拆为模块组：`state.mjs`（run.json 读写与 1.0→1.1 迁移）、`gates.mjs`（含 evaluateAcceptArchiveGate）、`archive.mjs`、`knowledge.mjs`（P0 热层并入此模块）、`map.mjs`（business-map / elevation）；`ralph.mjs` 保留为门面 re-export，CLI 与既有 import 路径不破坏。
- src ↔ skill lib 的逐字节 sync 机制不变，但两处硬编码清单必须同批扩展：`scripts/sync-ralph-skill-lib.mjs:8-15` 的 files 数组、`tests/jj-ralph-contract.test.mjs:179-204` 的逐字节断言清单；lib 内相对 import 同步调整。拆分是**移动不是重写**，diff 可审。
- 单模块目标 300–600 行；后续新功能一律进对应模块，禁止回填门面。

### 3.10 下游依赖核查：jj-same 与 jj-dispatch（核查于 2026-09-02，二次复核含代码级断点）

对全仓 `RALPH-` / `run_id` / `.workflow/ralph` 引用面逐一核查（并经子代理评审复核）后的结论：**jj-same 与 jj-review 必须同批更新（路径级依赖），jj-dispatch 协议层零破坏（仅测试 fixture 同步）**。

#### 表 A · 技能与协议层依赖

| 依赖方 | 引用点 | 性质 | 动作 |
| --- | --- | --- | --- |
| jj-same | `SKILL.md:14,72,82`（handoff-first 协议读 `RALPH-*/run.json` → `artifact_refs.handoff_ref` / `run.handoff`；失败分支以「无 `RALPH-*/run.json`」为条件）、`references/happy-path.md:7`、`references/handoff-snapshot.md:5`（`.workflow/ralph/<run_id>/handoff/handoff.json`）、`test-prompts.json:4` | **路径级依赖**：目录改名即失效 | 协议语义不变（handoff-first、`ready=true` 不重做分析），路径常量同批改为 `tasks/<task_key>/.state/run.json` 与 `.state/handoff.json`；旧布局交接走既有 legacy 分支 |
| jj-dispatch | `references/control-plane.schema.json` 的 `runtime_delivery.run_id` 仅约束 `minLength:1`、无格式 pattern；`task_key` / `delivery_id` 为调度自有身份（SKILL.md:18-55），从不解析 ralph id 格式；`src/dispatchRuntime.mjs:572` 的 `RUN-...` 为 dispatch 自生成 id | **非破坏**：新 run_id `task-xxx` 依然合法 | 无协议改动；`tests/jj-dispatch-contract.test.mjs:796-802` 三处 fixture 字符串（`ralph:RALPH-...`）随示例同步 |
| jj-review | `SKILL.md:41,79,120`——run 定位 = `RALPH-*/run.json` glob（**含 archive 目录**），并消费 `artifact_refs`；`SKILL.md:52` 读 `analyze.md` / `plan.md` / `progress.md` / `acceptance.md` 四文件；`SKILL.md:68` 合规判据比对 `plan.md` `## Current`；`references/report-layout.md:6,15`、`review-report.skeleton.json:4` | **路径级硬依赖** | 定位改为 `tasks/<task_key>/.state/run.json`；四文件读取改为 task_plan.md 三 section；合规判据逻辑**不变**（§3.4 保证结构存续），仅章节名常量改中文（§3.11）；P2 验收含「新旧布局各定位一个 run」用例 |
| ralph → dispatch 桥 | `writeDispatchSnapshot` 写 `dispatch_recommendation.snapshot_path`（由 ralph 布局常量派生），dispatch 侧无硬编码路径 | 自动跟随 | 无 |

**dispatch 零破坏的证据**：对 `src/dispatch*.mjs`（9 个文件）grep `analyze.md|plan.md|acceptance.md|progress.md|run.json|.workflow/ralph|RALPH-` **零命中**；`dispatchControlPlane.mjs` 仅两处注释提及 ralph。dispatch 与 ralph 之间只有**单向数据流**（ralph 写 snapshot → dispatch 读 `snapshot_path` 字段值），无路径耦合。这是本次改造能分批推进的结构前提。

#### 表 B · 代码级断点（二次复核新增，表 A 未覆盖）

路径常量之外，另有四处**从 run_id 字面量派生**或**依赖旧文件名**的逻辑，改名后不报错但行为改变：

| # | 位置 | 现状 | 改后 | 处置 |
| --- | --- | --- | --- | --- |
| B1 | `src/ralph.mjs:1690` `readRunArtifactText` | `path.join(runDir, ref)` + `existsSync`，失败**返回空串** | ref 带锚点则恒空 → `collectClaimedImplementationPaths`（`:1706`）拿到空清单 → product-consistency gate **静默放行** | §3.3 硬约束禁锚点；P1b 补「ref 解析失败必须抛错而非返回空串」的合约测试 |
| B2 | `src/ralph.mjs:722` `CAP-` id 派生 | `'CAP-' + run_id.replace(/^RALPH-/,'').toLowerCase()` | run_id=`task-xxx` 时 replace 空转 → `CAP-task-xxx`，与存量 business-map 的 `CAP-<slug>-<日期>` 断代 | 剥离正则改为 `/^(?:RALPH|task)-/`；migrate 时保持存量 CAP id 不变（仅新 run 用新形态） |
| B3 | `src/ralph.mjs:1216` `HOF-` id 派生 | `'HOF-' + run_id.replace(/^RALPH-/,'')` | → `HOF-task-xxx`。仍满足 `handoffContract.mjs` 的 `^HOF-[A-Za-z0-9._-]+$`，**不破坏 jj-same**，但 id 出现 `task-` 赘余 | 同 B2 剥离正则；非阻塞，与 B2 同批改 |
| B4 | `src/ralph.mjs:1260` `SNAP-` id 派生 | `'SNAP-' + run_id.replace(/^RALPH-/,'')` | → `SNAP-task-xxx`。dispatch 侧对 `snapshot_id` **无格式校验**（已 grep 确认），非破坏 | 同 B2；仅整洁性 |

**表 B 补充 · run_id 改名的硬阻断（初稿遗漏，二次复核补入）**

上表 B2-B4 是 id 派生的**整洁性**问题。真正会中断运行的是下面四处 run_id 字面量校验与目录扫描，初稿全部缺席：

| # | 位置 | 现状 | 改 `task-` 后果 |
| --- | --- | --- | --- |
| B5 | `src/ralph.mjs:178` `createRunSkeleton` | `/^RALPH-[A-Za-z0-9][A-Za-z0-9_-]{1,80}$/` 不匹配即 `throw` | **创建即抛错**，硬失败 |
| B6 | `src/ralph.mjs:233` `validateRun` | 同一正则 | 每次 save / load 校验 reject |
| B7 | `src/ralph.mjs:348` `validateReviewReport` | 同一正则，作用于 `report.run_id` | **jj-review 写回直接失效**——这推翻了表 A 把 jj-review 仅列为「路径级依赖」的定性 |
| B8 | `src/ralph.mjs:431` `listRuns` | `entry.name.startsWith('RALPH-')` | **返回空数组，不报错**。`jj ralph status`（不带 run-id）、latest-run 解析、jj-review 定位最新 run 全部表现为「没有 run」，与「确实没有 run」不可区分——本方案反复警惕的静默降级类型 |

另有两处 `^RALPH-` 剥离不在 `ralph.mjs` 而在 `src/namingConfig.mjs`：`normalizeRalphSlug`（`:347`）与 `buildArchiveDirNameFromRunId`（`:393`）。**全仓 `^RALPH-` 相关点共 5 处剥离 + 4 处校验/扫描**，§3.2 的连带清单（namingConfig 模板组 + schema 正则 + `buildRalphRunId` / `assertStrictRalphRunId`）需按此扩充。

**表 B 补充 · progress 消费者（随 §3.4 模板变更）**

| # | 位置 | 依赖 | 处置 |
| --- | --- | --- | --- |
| B9 | `src/ralph.mjs:1753` `looksLikeFixRun` | grep progress 全文的 `failed_must` / `user_correction` / `over_claimed` | 模板保留三行槽位（§3.4）；驱动 `detectTestIntegrityViolation`，删则静默失效 |
| B10 | `src/ralph.mjs:2529` `parseProgressEvents` / `:2550` `computeRunMetrics` | 行首 ISO 时间戳锚点 + `events.find()` 取首个 | progress 保持**时间正序追加**；gate / deliver-attempt 行的 ISO 时间戳不得删 |

另需同批调整（P1b）：`LEDGER_PATH_EXCLUDE`（`src/ralph.mjs:1577`）加入 `task_plan.md` / `findings.md`，否则合规 gate 会把工作区文件名当业务路径误报；`extractPlanCurrentSection` / `extractAcceptanceActiveText` 须先按一级 section 裁段（§3.3 末段），否则同一文件被解析三遍导致 ledger 路径重复计入。

#### 其余引用面

同批必须跟随的其余引用面（非 same/dispatch/review）：`tests/jj-ralph-contract.test.mjs`（54 处 `RALPH-`）、`tests/home-layout` / `jj-init` / `memory-extract` / `portfolio-knowledge`（若干）、`src/homeKnowledge.mjs` 与 `src/jjInit.mjs`（读 run_id 值但不校验格式，无需逻辑改动；home 索引断供处理见 §3.6）、文档层（`docs/concepts-paths.md`、`claude-commands/jj-ralph.md`、`docs/commands/jj-ralph.md` 及多份 design-docs，随硬切文档批更新）。另：`skills/jj-ralph/` 自身约 66 处 `RALPH-` 引用（SKILL.md 17 处、references/ 合计 31 处、`scripts/ralph_ops.mjs` 18 处——后者 P0 即需改动，勿漏；`scripts/lib/` 为 src 逐字节副本自动跟随）随 P1/P2 文案批更新；`skills/jj-evaluated/references/source-evidence-map.md` 内嵌的旧 `RALPH-` 证据路径声明为**只读合法**，不参与 migrate 改名。核查过且干净（无依赖，无需列入）：`src/scenarioRunner.mjs`、`src/harnessDoctor.mjs`、`src/installSkill.mjs`、`harness-manifest.json`、`tests/harness-doctor.test.mjs`、`tests/install-skill.test.mjs`、`AGENTS.md`。

### 3.11 章节名中文化迁移面（已定，随 P1b 落地）

三个 md 的章节标题一律中文（§3.4）。**语义与解析结构完全不变，只换名**——因此风险是「改漏一处导致解析静默失配」，不是语义风险。

#### 名称映射

| 现英文 | 改中文 | 出处 |
| --- | --- | --- |
| `## Analyze` / `# Analyze` | `## 分析` | analyze.md → task_plan.md 一级段 |
| `## Plan` / `# Plan` | `## 计划` | plan.md → task_plan.md 一级段 |
| `## Acceptance` | `## 验收` | acceptance.md → task_plan.md 一级段 |
| `## Current` | `### 当前` | 计划段/验收段内部分层（降为三级） |
| `## Landed` | `### 已落地` | 同上 |
| `## Superseded` | `### 已取代` | 同上 |
| `## Tasks`（legacy） | —— | 不再新写；只在读端保留识别 |
| `## MUST` | `### 必须项` | analyze 段 |
| `## OUT` / `## Out of scope` | `### 范围外` | analyze / plan 段 |
| `## Flagged concerns` | `### 存疑事项` | analyze 段 |
| `## UNRESOLVED` | `### 未解决` | analyze 段 |
| `## Lessons（durable）` | `## 可复用结论` | findings 段 |
| 行内标记 `SUPERSEDED` | `已取代` | acceptance 行过滤器 |

**层级规则（映射表补充）**：「现英文」列是当前独立文件里的层级；「改中文」列是合并进 task_plan.md 后的目标层级——analyze 子段（必须项 / 范围外 / 存疑事项 / 未解决）与计划、验收段的内部分层（当前 / 已落地 / 已取代）一律降为 `###`（§3.3、§3.4），与 `## Current` → `### 当前` 同理；`## 可复用结论` 保持 `##`（findings.md 是独立文件，一级骨架即 `##`）。

**不参与中文化**：`run_id` / `task_key` / `must_id` / `evidence_class` 及其取值（`diff-only` / `behavior-local` / `write-then-read` / `cross-path` / `runtime-env`，SSOT 为 must-evidence.md）、阶段名（ANALYZE…ARCHIVE）、gate 名、状态值（PASS / FAIL / COMPLETED）、`F-00N` / `REQ-n` / `TASK-n` / `REV-n` 编号前缀。这些是机器标识符，中文化会破坏 schema 与跨技能协议。

#### 代码改动点（已核查）

| 位置 | 现状 | 动作 |
| --- | --- | --- |
| `src/ralph.mjs:487-488` | init 骨架硬编码 `'# Analyze'` / `'## MUST'` / `'## Current'` 等 | 换中文模板（§3.4） |
| `src/ralph.mjs:1615-1616` `extractPlanCurrentSection` | `/^##\s+Current\s*$/im` → `Tasks` → 全文 三级回退 | 扩为**四级**：`当前`（三级标题 `###`）→ `Current` → `Tasks` → 全文。**读端必须容忍 `##` 与 `###` 两种层级**，否则存量文件失配 |
| `src/ralph.mjs:1597` `extractMarkdownSection` | 起始 `^##\s+<名>$`（`:1600`）与**终止** `^##\s+`（`:1605`）都写死二级 | 改签名为 `extractMarkdownSection(text, heading, level)`：起始匹配 `^#{level}\s+<名>$`，终止匹配 `^#{1,level}\s+`（**层级感知**） |
| `src/ralph.mjs:1622` `extractAcceptanceActiveText` | 按行过滤 `/\bSUPERSEDED\b/i` | 改为 `/(?:\bSUPERSEDED\b|已取代)/i`，新旧并存 |
| `src/ralph.mjs:2560` `analyzeRework` | `/SUPERSEDED|failed_must|over_claimed/i` | 同上加 `已取代`；`failed_must` / `over_claimed` 是机器标记，**保持英文** |
| `src/ralph.mjs:1819` | 建议文案 `'Align diff with plan.md ## Current …'` | 换中文段名 |

**`### 当前` 降为三级标题是本次唯一的结构性变化**（原为 `## Current` 二级）。原因：中文化后 `## 计划` / `## 验收` 各自需要内部分层，二级标题无法表达嵌套。

**处方必须是层级感知，不能扁平放宽（初稿此处有误，已实测推翻）**。初稿写「放宽为 `^#{2,3}\s+`」，实测按 §3.4 模板运行的结果：

```text
extract(计划) => "- knowledge_refs: ..."   ← ### 当前 清单被截断丢弃
extract(验收) => ""                        ← 直接返回空串
```

原因是终止符也被放宽，`## 验收` 撞上紧跟的 `### 当前` 立即终止。扁平放宽会同时打断 §3.3 与 §4 P1b **强制要求**的「先裁一级段」——而裁段正是防止同一文件被解析三遍的唯一手段。

正确实现：记住起始标题层级 `level`，终止于 `^#{1,level}\s+`。`extractPlanCurrentSection` 相应改为**两跳**：`section('计划', 2)` → `section('当前', 3)`。

**`### 当前` 在 task_plan.md 出现两次**（计划段、验收段各一），`extractMarkdownSection` 用单次 `exec` 取首个匹配——两跳寻址正好消除这个歧义，扁平单跳则无法寻址验收段的那个。

#### 技能与测试改动点

| 文件 | 处数 | 说明 |
| --- | --- | --- |
| `skills/jj-ralph/SKILL.md` | 4（:35, :43, :89, :165） | Current→Landed/Superseded 流转规则、`## Tasks` 重命名兜底 |
| `skills/jj-ralph/references/artifact-layout.md` | **15**（含 :72 / :80 / :82 行内 `SUPERSEDED`） | 布局契约与 File shape 模板；**:72 的 acceptance 禁令需按 §3.4 推翻改写** |
| `skills/jj-ralph/references/tiny-example.md` | **9**（初稿少算一半：另有 :23 `## OUT`、:38 `## Out of scope`、:70 `## Landed`、:73 `## Superseded`、:77 正文） | 示例文件 |
| `skills/jj-review/SKILL.md:52,:68`、`references/review-policy.md:13,:35`、`references/host-review.md:5` | **5** | 段名常量 + 四文件读取改三 section。**判据逻辑不变，但 `:348` 的 run_id 校验会使写回失效（表 B7），故 jj-review 不只是路径级依赖** |
| `agents/jj-workflow-reviewer.toml:9` | 1 | **初稿整份遗漏**。reviewer agent 定义正文写「对照 plan.md ## Current」，是运行时协议载体，漏改直接让 agent 找错段名 |
| `skills/jj-ralph/references/phases.md:7,:129` | 2 | `## Flagged concerns` 是 ANALYZE gate 判据；:129 是 product-consistency 判据表述 |
| `skills/jj-ralph/references/post-complete-continue.md:41,:42` | 2 | resume 时写 `## Current` / `## Superseded` 与 `## Tasks` 重命名兜底 |
| `docs/skill-zh-bridge/jj-ralph/README.zh.md` | — | 按 `skill-en-zh-rewrite` 约定与 SKILL.md 同步的对照件 |
| `tests/jj-ralph-contract.test.mjs` | **8**（另有 **:237**） | 骨架断言与 Current/Landed/Superseded 用例。**:237 的 `assert.equal((plan.match(/^## Tasks$/m)||[]).length, 0)` 中文化后恒真，变成假绿断言，须改为断言中文段名存在** |

**skill 指令正文仍是英文 SSOT**（`skill-en-zh-rewrite` 约定不变）——上表改的是这些文档中**引用的产物章节名**，不是指令语言本身。二者边界：产物内容中文，运行时协议英文。

#### 迁移策略

读端四级回退保证存量 `## Current` / `## Tasks` 文件继续可解析；写端只写中文。`ralph migrate`（§4 P2）顺带把存量 md 的英文标题转中文，转换失败**不阻断迁移**，留旧标题由读端回退兜住。P1b 验收须含「存量英文标题文件仍能正确提取 Current 段」的用例——这条比中文写入用例更重要。


### 3.12 `ralph migrate` 迁移规则（已定）

初稿把迁移规则挂在 §3.10 而该节只做依赖核查，是全文最实质的悬空引用。规则落定如下。

**默认 1:1 改名，不自动合并**。同需求双 run（如 `enter-form-dynamic-route` / `-apply`）各自成目录，仅提示人工合并：

```text
RALPH-enter-form-dynamic-route-20260826  →  tasks/task-enter-form-dynamic-route/
RALPH-enter-form-dynamic-apply-20260901  →  tasks/task-enter-form-dynamic-apply/

提示：检测到 2 个相似任务，要合并为一个吗？
      jj ralph adopt --task task-enter-form-dynamic --absorb <另一个>
```

不自动合并的理由：合并要做 REQ 跨轮重编号（两条 run 各自都有 `REQ-001` 且语义不同）、progress 时序交错、findings 去重——三件都需要语义判断，机器做不可靠且错了难回退。`adopt` 是人工兜底而非保证（§5 已承认漏匹配风险）。

**逐目录转换步骤**：

| 步 | 动作 | 失败处理 |
| --- | --- | --- |
| 1 | 目录改名去日期后缀；`run_id` 同步改 `task-<slug>`（即 task_key，与目录同名，§3.2） | slug 冲突则追加 `-2` 并提示 |
| 2 | intent / analyze / plan / acceptance 四文件合并为 `task_plan.md`，按 §3.4 层级；英文段名转中文 | 转换失败**不阻断**，留旧英文标题由读端回退兜住（§3.11） |
| 3 | `progress.md` 原样保留（时间正序不变），头部补轮次索引表 | — |
| 4 | 新建 `findings.md`：从 progress 的 `failed_must` / `over_claimed` 三行组提取 F 条目骨架，标注「迁移生成，对策与适用范围待补」 | 无三行组则只建空骨架 |
| 5 | `run.json` / `reviews/` / `handoff.json` 移入 `.state/`；`archive-manifest.json` 内联为 `run.json` 的 `archive` 字段 | — |
| 6 | 删 `knowledge-attach.json` / `knowledge-contribution.json` | — |
| 7 | 原目录改名 `.migrated-RALPH-<原名>/` 保留 | 确认无误后由人手动删；**不自动清理** |

**作用域**：默认单仓（当前 cwd 的 `.workflow/ralph/`）。`--all-projects` 才遍历 home 地图里的项目。`archive/` 下历史快照**只读不迁**。`skills/jj-evaluated` 引用的旧 `RALPH-` 证据路径声明为只读合法，不参与改名（§5）。

**第 7 步保留一轮**是必要的：迁移脚本首次运行难免有边界情况，`.migrated-` 前缀让读端不再识别该目录，同时保留回退余地。判定口径：确认新目录能被 `jj ralph status` 正常列出且 gate 可跑通后即可删。


## 4. 分阶段落地

| 阶段 | 内容 | 主要改动 | 合约/测试 | 风险 |
| --- | --- | --- | --- | --- |
| P0 知识闭环（轻量默认） | archive 时 findings `## 可复用结论` 追加热层 `~/.jj-flow/memory/<project_key>.md`；init / resume / dispatch 注入热层命中（复用 `memoryRetrieve` 词法排序；dispatch 侧落在 `skills/jj-dispatch/SKILL.md` 派单简报模板）；KB 存在时叠加、缺省静默跳过；findings.md 以**附加文件**先行出现在现有布局；`ralph_ops.mjs finding` 子命令 + DELIVER 软提示（§3.4 写入时机）；注入记录暂以 progress.md 追写行承载，`knowledge.memory_refs` 随 P1b schema 1.1 落地（§3.6） | `src/ralph.mjs`（archive / init 流程）、`src/portfolioKnowledge.mjs` 或新增轻量热层模块、`skills/jj-ralph/scripts/ralph_ops.mjs`、`skills/jj-dispatch/SKILL.md`（派单简报加热层命中段）、skill 模板 | `tests/jj-ralph-contract.test.mjs`、`tests/memory-retrieve.test.mjs`、新增热层读写测试、五要素条目格式校验、`tests/jj-dispatch-contract.test.mjs`（派单简报属调度协议面，AGENTS.md 要求） | 低；不动布局与 schema，零用户配置 |
| P1a 模块拆分 | 仅执行 §3.9 拆分，**行为零变化** | `src/ralph.mjs` → 五模块、`scripts/sync-ralph-skill-lib.mjs` files 清单、`tests/jj-ralph-contract` 逐字节断言清单 | 全量 `npm run verify` + sync 往返断言 | 低 |
| P1b 布局 8→4 | task_plan.md 三 section 合并；删 knowledge-attach / knowledge-contribution（含 §3.6 home 索引断供处理）；schema 1.1（含 `gate_set` 预留）；`LEDGER_PATH_EXCLUDE` 同步新文件名（`src/ralph.mjs:1577`，防合规 gate 误报）；**artifact_refs 禁锚点 + ref 解析失败改抛错**（§3.10 表 B1，防合规 gate 静默放行）；`extractPlanCurrentSection` / `extractAcceptanceActiveText` 先按一级 section 裁段；**章节名中文化 + 读端四级回退**（§3.11，含 `extractMarkdownSection` 层级感知改造）；**jj-review 四文件读取改三 section + 段名常量同批修**（否则本阶段起无法评审）；新增 `artifact_refs.findings` 键 + schema | `schemas/ralph-run.schema.json` 及其 skill 副本 `skills/jj-ralph/references/ralph-run.schema.json`（合约测试校验两份同步）、新增 `knowledge.memory_refs` 键（§3.6 可追溯，P0 期间以 progress.md 行过渡）、`src/ralph.mjs`（init/gate/ledger 读写路径）、skill SKILL.md + 模板 | `jj-ralph-contract`、`npm run verify`、`git diff --check`；读端保留 1.0 回退（**过渡措施，P2 migrate 收尾时移除**） | 中 |
| P1c 归档反转 | 原地翻转 + `archive` / `archive_history` 内联，停写 archive-manifest.json（专项核查：该文件无任何 gate/attestation/评估消费者，`src/ralph.mjs:588-589` 为唯一定位点） | `src/ralph.mjs`（archiveRun）、`skills/jj-ralph/references/phases.md:11` 文案 | `jj-ralph-contract` 归档用例 | 中；证据语义变化独立成批，可单独回滚 |
| P2 身份稳定化 | 稳定 task_key 目录 + **run_id 合一为 `task-<短语>`**（§3.2）+ init 建议复用 + `jj ralph adopt` + `ralph migrate` 存量迁移 + **移除 P1b 的 1.0 读端回退** | `src/namingConfig.mjs`（pattern 模板组）、`schemas/ralph-run.schema.json`（run_id 正则）、`src/ralph.mjs`（路径解析）、`skills/jj-same` 路径常量 5 处（含 `.state/` 深一层）、`skills/jj-review` **仅剩 run 定位路径**（四文件读取已在 P1b 修）、`ralph.mjs:178/233/348/431` 四处 run_id 硬阻断（§3.10 表 B5-B8）、`CAP-`/`HOF-`/`SNAP-` 前缀剥离正则 3 处（§3.10 表 B2-B4）、`tests/jj-dispatch-contract` fixture 3 处 | 上列全部 + dispatch 合约 + jj-same 交接用例 + **jj-review 新旧布局各定位一个 run 的用例** | 高；独立变更，最后做（§3.10 核查结论：same/review 必改、dispatch 零破坏） |
| P2+ lite 档 | §3.8 任务分档：BRIEF→DELIVER→CLOSE 三 gate、budget 收紧、自动升 full 兜底；可与 P2 并行或紧随其后 | `src/ralph/` gates 模块（判档 + gate 合并）、skill SKILL.md 与 references 文案 | `jj-ralph-contract` 增 lite 档合约（判档 / 升档 / 收紧 budget） | 中；判档错误的兜底（升 full）必须先落地 |

每阶段独立可交付、独立回滚；P1/P2 各自先出 exec plan 再实现。

## 5. 取舍与开放问题

- **不写业务仓库指令文件**：AGENTS.md / CLAUDE.md 等宿主装载文件不是 jj-flow 的可写面；知识热层全部在「使用 jj 时」注入（task_plan.md / 派单简报 / 恢复读取）。团队共享走 opt-in 的 `.gitignore` 单文件建议，非默认依赖。
- **KB 对推广偏重，降为 opt-in 组合层**：外置 git 仓（jj-portfolio）、extractors、candidate→active 人工审核、web 管理端对新用户是纯成本；实测样本 KB root 未配置时 attach 即 `unavailable`，主循环不能建立在它之上。零基建热层（§3.6）承担默认闭环，KB 服务组合级 / 团队级用户。
- **gate 证据从「文件存在」变「section 完整性」**：三阶段合一个 task_plan.md 后，PLAN/ACCEPT gate 需解析 section 与 checkbox/证据引用，校验逻辑比单文件略复杂。接受。
- **去重责任部分转移到起名纪律**：稳定 task_key 依赖 init 时命中历史建议；漏匹配仍可能双目录，`adopt` 是兜底而非保证。开放问题：是否对「新 task_key 与既有 task 的 KB 相似度超阈值」加一条 warning gate。
- **`.plans` 的角色/团队层不引入**：参考模型的 `<role>/` 层服务于常驻多角色团队；jj-flow 单仓闭环只有一条执行线，任务目录不按角色分层。多角色（team-coordinate/lifecycle/swarm）嵌套时仍写 `.workflow/.team/`，本方案不改。
- **docs 四件套归属**：api-contracts / invariants / ADR 是业务仓库自身知识，不是 ralph 控制面；jj-flow 只在 ACCEPT gate 提示 Doc-Code Sync（API/架构变更时 findings 必须注明已同步项目 docs），不接管这些文件。
- **旧数据迁移与兼容策略**：推荐**硬切**——P2 起加载只认新布局，遇旧布局报错并提示跑 `jj ralph migrate`；迁移时原目录改名 `.migrated-` 保留一轮回退，确认无误后删除。P1b 的 1.0 读端回退是迁移完成前的**过渡措施**，P2 migrate 收尾时移除，不构成常驻双路径。历史归档只读不迁；`skills/jj-evaluated` 冻结证据引用的旧 `RALPH-` 路径声明为只读合法，不参与改名。
- **`.state/` 隐藏目录（已定，采纳）**：run.json / reviews / handoff 移入点前缀 `.state/`，人 `ls` 任务目录只见 3 个 md（§3.2）。取舍已评估：下游路径深一层，但与 §3.10 表 A 的 jj-same / jj-review 路径常量改动**同批落地**，不新增变更批次；人查机器状态需 `ls -a`，而机器状态本就不面向人。
- **多轮 task_plan 的分层写法（已定，推翻初稿）**：保留三段分层（中文化为 `### 当前 / ### 已落地 / ### 已取代`），不采用「每轮重写」——冲突记录与证据见 §3.4。语义不变意味着 jj-review 的合规判据**逻辑不改，只改章节名常量**（§3.11）。

## 6. 参考

- 规范源（外部参考模型）：`D:\2026\daji-customer-service\CLAUDE.md`、`.plans/daji-cs/team-snapshot.md`、`.plans/daji-cs/docs/team-bootstrap.md`；三层级样例 `task-outbound-token-takeover/{task_plan,progress,findings}.md`。
- 样本问题现场：`D:\2025\seo-daji-web\.workflow\ralph\archive\2026-08-26-enter-form-dynamic-route`（8 文件）、活跃区双 run（`enter-form-dynamic-route` / `enter-form-dynamic-apply`）。
- 代码：`src/namingConfig.mjs:34-45`（pattern）、`src/namingConfig.mjs:369`（run_id）、`src/ralph.mjs:541`（archiveRun）、`src/ralph.mjs:805`（contribution 包裹）、`src/portfolioKnowledge.mjs:83`（attach）、`src/memoryRetrieve.mjs`（词法检索）。
