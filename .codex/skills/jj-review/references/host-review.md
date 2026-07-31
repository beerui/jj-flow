# 宿主内置 review 优先

`jj-review` 是**适配器**：审查引擎优先用当前宿主已有能力；本 skill 把结果写入 ralph `REV-*.json`。

不要在 skill 正文里写死某个产品（Codex / Claude / Grok / Qoder 等）。用**能力发现**选择入口。

## 发现顺序（从前到后，命中即用）

1. **用户已指定**
   用户给出 review 产物路径、粘贴 findings、或点名已完成的 review 会话 → 直接解析映射，`source=user_provided`。

2. **本宿主可调用的 review skill / 命令**
   在当前会话已加载或可调用的 skills / slash / commands 中，**只匹配明确的审查入口**：
   - 名称或描述含 `review`、`code-review`、`code review`（优先）
   - 只读 reviewer 子代理 / 审查 persona（见下条）

   **不要**把下列入口默认当成 code review：
   - `verify`、`npm test`、`npm run verify`、CI/lint/typecheck 绿灯
   - 纯「修到通过」的 `check-work` / self-verify 循环（那是验证/返工，不是审查引擎）

   仅当用户**明确要求**用某入口做审查，且该入口输出的是**结构化 findings**（文件/行/严重度/说明），才可选用；若是“修到通过”循环，只取**第一轮只读审查结论**，不要在 jj-review 里自动开修。测试通过 ≠ `outcome=PASS`。

3. **只读 reviewer 子代理 / 角色**
   宿主提供只读 reviewer / 审查 persona / read-only subagent 时，用于对既定 diff/commit 出 findings。
   约束：子代理只读；禁止其改业务代码。

4. **不可用 → 回退**
   以上皆无，或调用失败且用户要求继续 → `source=fallback_inline` 做最小内联审查（见 SKILL.md）。
   注意：`user_provided` 属于第 1 步，**不是**回退。

同一次 `$jj-review` **只跑一条**宿主审查路径，不要串多个完整 review 引擎。

## 宿主发现矩阵（Codex / Grok / Claude）

用**能力名**发现入口，不写死营销产品页。按当前会话已加载的 tools / skills / slash / agents 搜索：

| 宿主 | 优先查找（能力名 / 入口形态） | 如何确认可用 | 典型产物或输出 |
| --- | --- | --- | --- |
| **Codex** | skill / command 名或描述含 `review`、`code-review`、`code review`；只读 reviewer agent | 会话可调用列表 / skill 目录；用户 `@` 或 `$` 审查入口 | 结构化 findings 文本或 review 产物路径 |
| **Grok** | 已安装 skill 中 review/code-review；Build 内只读 subagent / reviewer 角色 | 当前 session 的 skill 列表；role-spec 若声明 read-only reviewer | findings 列表、会话附件路径 |
| **Claude** | slash 或 skill：`/review`、名称含 review/code-review 的 command；只读 subagent | `.claude/commands` / 已加载 Skill；`/help` 或 tool 列表 | 报告 Markdown / 结构化 findings |

通用规则（各宿主相同）：

1. **只匹配明确审查入口**；`verify` / `npm test` / CI 绿灯 **不是** review 引擎。
2. 优先 **用户已提供** 产物（矩阵之上的发现顺序第 1 步）。
3. 子代理必须 **read-only**，禁止其改业务代码。
4. 无可发现入口 → `source=fallback_inline` 最小内联审查，并在 `host_review.note` 写明原因。
5. 发现失败 hard-stop：若用户要求「必须用宿主 review」且入口不存在 → `BLOCKED`，说明缺失入口与可选回退，不 init ralph。

## 调用时传入的上下文

调用宿主 review 时，至少提供：

| 项 | 内容 |
| --- | --- |
| 范围 | ralph `run_id`、goal、MUST / OUT（来自 analyze/plan） |
| 目标 | `reviewed_commit` 或 working tree / 指定路径 |
| 约束 | 只读；不要修代码；不要 init ralph |
| 期望 | 结构化 findings（文件/行/严重度/说明）+ 总体结论 |

宿主 review 的目标 diff 应覆盖 ralph 相关改动；无关全仓噪音可按 plan `scope.in` 收窄。

## 结论映射 → outcome

| 宿主信号（任一） | 本 schema `outcome` |
| --- | --- |
| 无 OPEN 问题；approve / PASS / LGTM / “no issues” | `PASS` |
| 存在需修改的问题；request changes / FAIL / NEEDS_CHANGES | `NEEDS_CHANGES` |
| 缺 run、缺 diff、无法定位 commit、上下文不足 | `BLOCKED` |

映射后仍必须满足 report-layout 校验：

- `PASS`：无 `status=OPEN` 的 finding，且有 `reviewed_commit`
- `NEEDS_CHANGES`：≥1 个 OPEN finding，且有 `reviewed_commit`
- 仅 style nit 且宿主标明 optional：可标 `status=WAIVED` 或 `severity=info` 且不阻塞 PASS（若全部非 OPEN）

## severity 映射

| 宿主用语（不区分大小写） | 本 schema |
| --- | --- |
| blocker / critical / high / bug（实质缺陷） / security | `high` |
| major / medium / important | `medium` |
| minor / low / suggestion（有修复价值） | `low` |
| nit / style / info / note / optional | `info` |

无法判断时默认 `medium`。`status` 默认 `OPEN`；宿主已关闭/已忽略的标 `RESOLVED` / `WAIVED`。

## finding 字段填充

| 本字段 | 来源 |
| --- | --- |
| `id` | `F-1`… 按序；或保留宿主 id（规范化为安全字符串） |
| `severity` | 上表 |
| `file` | 相对仓库根路径；未知用 `unknown` |
| `line` | 正整数；未知用 `1` |
| `description` | 问题说明（可含宿主原文摘要） |
| `status` | `OPEN` / `RESOLVED` / `WAIVED` |
| `acceptance` | 关闭条件；无则写“按 description 修复并复审” |

## 报告溯源字段（推荐写入 REV JSON）

```json
{
  "source": "host_builtin",
  "host_review": {
    "method": "skill|command|subagent|user_provided|fallback_inline",
    "entry": "发现到的入口短名，勿写厂商营销名",
    "artifact_paths": ["宿主产物相对或绝对路径"],
    "note": "可选：映射说明或回退原因"
  }
}
```

| `source` | 含义 |
| --- | --- |
| `host_builtin` | 宿主内置 review 产出 |
| `user_provided` | 用户粘贴/指定已有审查结果 |
| `fallback_inline` | 本会话最小自审 |

`evidence_refs` 应包含宿主 review 产物路径（若有）以及关键测试/diff 引用。

## 与落盘的关系

```text
宿主内置 review（或用户产物 / 回退自审）
        │
        ▼
  映射 outcome + findings
        │
        ▼
  reviews/REV-n.json  +  run.json.review  +  progress.md
```

- **事实源**仍是 `REV-*.json` 与 `run.json`，不是聊天正文。
- 宿主 review 文件可保留在其默认位置；jj-flow 侧只要求契约路径下有规范化报告。
- accept/archive 的 product-consistency 仍读最新 REV outcome（见 jj-ralph phases）。
