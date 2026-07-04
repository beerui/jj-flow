# jj

## 作用

`$jj` 是项目级 AI 交付入口。`jj` 只是一个简单标识，不代表组织或业务品牌。它不替代 Maestro，而是先把用户需求转换成：模式、recipe、证据清单、guard 状态、Maestro prompt。

## 触发

当用户使用 `/jj`、`$jj`，或明确要求按 `jj-flow` 交付协议推进时使用。

## 执行步骤

1. 读取用户原始需求，不先改代码。
2. 在 Codex 内生成 `jj-flow` 调度结果。当前实现可通过项目 CLI 得到结构化输出，这是 skill 内部实现细节，不作为用户用法展示：

```bash
node D:/daji-docs/jj-flow/bin/jj.mjs delivery "<用户需求>" --json
```

3. 查看输出的 `mode`、`maestro_calls`、`guard_report`、`maestro_prompt`。
4. 如果 guard 有 `PENDING`，优先从当前项目、`.workflow`、用户消息、PRD、接口文档、设计图和 Codex 线程链接中自动补证据。
5. 只有交付边界、方案取舍、上线风险或外部权限真正阻塞时，才向用户提问。
6. 再按 `maestro_calls` 调用对应 skill，例如 `$maestro-analyze`、`$maestro-plan`、`$yapi`、`$maestro-execute`、`$quality-review`。

## 模式

- `auto`：根据提示词自动判断。
- `delivery`：少参数端到端交付，推荐入口。
- `validate`：项目管理者自检，检查文档、recipe、guard、测试、workflow 和下一步升级建议。
- `evolve`：项目自身迭代，把自检结果转换成 correction backlog、升级计划和 Maestro 调用链。
- `feat`：真实功能交付。
- `fix`：线上问题修复。
- `knowhow`：经验沉淀。
- `review`：交付前质量审查。

## 原则

- 证据优先于结论。
- 不 fork Maestro core。
- 不把第三方工具的输出改写成模型猜测。
- 没有证据的状态保持 `PENDING`。
- `delivery` 不要求用户先传 `--prd`、`--api`、`--design` 等固定参数；资料路径可作为加速信息自然写入需求。
