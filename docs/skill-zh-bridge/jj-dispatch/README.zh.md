# jj-dispatch — 中文对照（人类审阅）

> **重要**：本文档仅供人类理解与审阅。  
> **不是** Agent 运行时 SSOT。发生冲突时以 skill 正文为准。  
> English SSOT: `skills/jj-dispatch/`  
> Session: TC-skill-en-zh-20260803 · Updated: 2026-08-03

## 技能用途

多项目调度：PREVIEW→批准→DISPATCH→tick/resume；控制面默认 `~/.jj-flow`。  
平台：Codex / Qoder / Grok；**故意无** Claude `/jj-dispatch` slash。

## 仓库规范（2026-08-03）

| 项 | 说明 |
| --- | --- |
| 编辑源 | 顶层 `skills/jj-dispatch/` |
| 发布 | npm `files` 含 `skills/`；install 分发到各宿主 |
| 宿主安装目录 | 如 `~/.codex/skills/jj-dispatch`、`~/.grok/skills/jj-dispatch` — **勿当编辑源** |
| Claude | 仅 `.claude/commands/` 薄入口（若清单声明） |

## 英文化状态

| 状态 | 说明 |
| --- | --- |
| 路径迁移 | **已完成**（`.codex/skills` → `skills/`） |
| 正文 EN SSOT | **已完成**（TC-skill-en-zh-20260803 / en-writer-dispatch） |
| 对照包 | 本文件为人读 section map；协议细节以英文 SSOT 为准 |
| 残余 CJK | `skills/jj-dispatch/**` 扫描 **0** 命中（2026-08-03） |

## Section map（EN 文件 → 中文摘要）

| English SSOT | 中文要点 |
| --- | --- |
| [SKILL.md](../../../skills/jj-dispatch/SKILL.md) | 跨项目调度入口；Gates 1–8；目录默认 `~/.jj-flow`；四动作 PREVIEW/DISPATCH/RECONCILE/BIND_THREAD；Agent 写 plane；Grok Mode S；CLI 可选矩阵；回退入口；host tokens；与 jj-same 关系；明确不做 |
| [references/happy-path.md](../../../skills/jj-dispatch/references/happy-path.md) | 用户主线；Gates 1–8 全文；real-host PENDING；分支/workspace 判断表与 CREATE 基线新鲜度（EP-20260803）；delivery 状态链 |
| [references/agent-write-plane.md](../../../skills/jj-dispatch/references/agent-write-plane.md) | 用户不跑 CLI 时 Agent 落盘硬门禁：状态天花板 A；`produced_commit` B；session/C4 C；自检清单 D/C5/C6；T-task-result-sync |
| [references/control-project.md](../../../skills/jj-dispatch/references/control-project.md) | 目录/naming；control_root；注册项目；intake/delivery 字段；恢复规则；成功回执/checkpoint；Reviewer/Developer 闭环；schema 检索键 |
| [references/rollback.md](../../../skills/jj-dispatch/references/rollback.md) | 控制面诚实前进（非 git 时光机）；reopen/block/rework/abandon；Mode S 软字段；**G-menu** 用户点选 git；rollbackPrep；closeDelivery |
| [references/grok-dispatch-execution.md](../../../skills/jj-dispatch/references/grok-dispatch-execution.md) | Grok 默认 Mode S；W/P 后置；Workflow 非 checkpoint；attestation/receipt 路径；PREFLIGHT；实现波次 2a/2b/2c/3 |
| [agents/openai.yaml](../../../skills/jj-dispatch/agents/openai.yaml) | 宿主短描述 + default_prompt（Mode S / 门禁摘要） |
| `references/*.schema.json` / `host-action-contract.json` | 机器契约；本轮未改（本就无中文 prose） |
| `scripts/plane-self-check.mjs` | Agent 可选自检脚本；本轮未改 |

## 术语（与 glossary 对齐）

| 中文 | English（agent 正文） |
| --- | --- |
| 控制平面 | control plane |
| 派发 / 调度 | dispatch |
| 批准 | approve / approval |
| 门禁 | gate |
| 产物 | artifact |
| 验收 / VERIFIED | VERIFIED / acceptance |
| 回退 | rollback |
| 续作 | resume / continue same run |
| 废弃 | abandon |
| 薄入口 | thin entry / thin wrapper |
| 权威源 | SSOT / authoritative source |
| 收工 | closeout (`$jj-end`) |

## 相关产物

- Glossary: `docs/skill-zh-bridge/sessions/TC-skill-en-zh-20260803/artifacts/glossary.json`
- Rewrite report: `docs/skill-zh-bridge/sessions/TC-skill-en-zh-20260803/artifacts/dispatch-rewrite-report.md`
- Inventory (path migrate): `docs/skill-zh-bridge/sessions/SEZ-20260803-path-migrate/language-report.md`
- Workflow: `skills/skill-en-zh-rewrite/`
