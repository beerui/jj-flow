# 沉默账户跨项目迁移案例

本案例是 `2026-07-10` 的证据快照，用于说明迁移决策方法。执行真实任务时重新读取当前需求、分支和源码。

## 证据来源

- 基本盘：`D:\codeup\chengjie\cj-frontend-web`
- 兑接项目：`D:\codeup\duijie\dj-frontend-web`
- 承载前台差异项目示例：`D:\codeup\chengjie\cj-draft-manager-web`
- 承接功能分支：`feat/cj-silence-0710`
- 兑接功能分支：`feat/dj-silence-0710`
- 会话：`019f3a6a-07f2-7c80-a75e-3d40be996901`
- 会话：`019f3f41-2baf-7e33-a855-a113c20cf197`
- 会话：`019f4653-e792-7322-a4d1-3dc7d327d009`

## 最终需求不变量

1. 后端负责判断沉默账户；前端只处理业务码 `1027`。
2. 密码登录命中 `1027` 时切到验证码/快捷登录，保留手机号并清理不再有效的表单状态。
3. 切换企业安全校验和绑定新账户命中 `1027` 时，从密码态切到验证码态。
4. 安全校验弹框打开后，按所选企业 `uid` 查询 `queryCheckConfig`。
5. `forceVerifyCodeLoginFlag = 1` 时默认进入验证码态。
6. 配置请求期间只给弹框内容 loading，并禁用关键按钮，避免慢返回导致交互反跳。
7. 产品最终要求保留“切换到密码”入口。旧的“隐藏入口”要求已被覆盖。
8. 关闭弹框、切换账号或旧请求晚返回时，不得污染下一次状态。
9. 本地提示接管业务码时要处理全局错误提示，避免重复 toast。

## 分支演进

### 承接 `feat/cj-silence-0710`

相对 merge base `4b6591aee` 的提交顺序：

| Commit | 作用 |
|---|---|
| `4785949cb` | 密码登录与切换账户支持 `1027` |
| `9feb13c5e` | 绑定新账户支持 `1027` |
| `99dd3cbdd` | 调整提示文案 |
| `ad086e3f1` | 增加 `queryCheckConfig`、弹框 loading 和验证码优先 |
| `5a1350e30` | 恢复“切换到密码”入口 |

主要代码面：

- `src/constants/user.js`
- `src/apis/toolbar.js`
- `src/views/pages/login/login.vue`
- `src/views/pages/switch-account/switch-account-mixins.js`
- `src/views/pages/switch-account/security-verify-dialog.vue`
- `src/views/pages/switch-account/bind-account-dialog.vue`

分支还包含 `.gitignore` 和 `docs/pre/0710.md`。它们不是其他项目运行时迁移的默认组成部分。

### 兑接 `feat/dj-silence-0710`

相对 merge base `f1b993442` 的提交顺序：

| Commit | 作用 |
|---|---|
| `445ce398e` | 调整提示文案 |
| `520fa1f3a` | 密码、切换账户和绑定账户支持 `1027`，并修复重复提示 |
| `34638d309` | 补充兑接专有二维码登录入口 |
| `05e9030d5` | 增加 `queryCheckConfig` 和验证码优先 |
| `e7296038e` | 保留密码切换入口并在 loading 期间禁用按钮 |

兑接比承接多一个 `EXTEND` 能力：

- `src/views/pages/login/components/qrcode-login.vue` 轮询登录命中 `1027` 时停止轮询。
- 子组件发出 `silent-account`，父登录页切到验证码登录。
- `src/apis/user.js` 对二维码登录关闭全局错误提示，避免本地提示重复。

这个入口不能仅因为承接项目没有就漏掉，也不能反向强加到没有二维码登录的项目。

## 关键差异与教训

### 1. 不要整块对齐 legacy

兑接会话曾为了“方便维护”把承接旧控制流一并搬入，随后用户明确要求撤销：只让新修改逻辑一致，不动老逻辑。

迁移账本应记录：

- `MUST`：新增业务码、配置查询、loading、最终产品行为。
- `TARGET-ONLY`：兑接二维码入口、兑接既有 `validUser` 条件。
- `DO-NOT-PORT`：被撤销的 legacy 对齐。

### 2. 目标代码不必逐行相同

承接与兑接最终都实现验证码优先和保留密码入口，但状态管理仍有差别。只要需求不变量、失败策略和验收一致，不应为了代码形状统一再改目标旧逻辑。

### 3. 异步配置需要对象级竞态保护

请求必须绑定当前 `uid`。响应回来后至少确认：

- 弹框仍打开。
- 当前账号 `uid` 与发起请求时一致。
- 只有匹配请求才能关闭当前 loading 或切换登录方式。

### 4. 错误提示有所有权

主登录 API 已关闭全局 `showError`；切换与绑定接口可能先经过全局提示。本地处理 `1027` 时需要关闭旧提示或在 API wrapper 中明确关闭全局提示，并提供默认文案。

### 5. 产品后续调整只迁移增量

“隐藏密码入口”后来改为“保留入口”。向其他项目传播时只迁移这个行为增量及必要按钮禁用，不重新覆盖整个安全校验组件。

## 承载前台判断

按用户给出的项目族角色，`cj-draft-manager-web` 是本案例的承载前台。它不是 Vue 2 ERP 基本盘的同构复制：

- 技术栈是 Vue 3、Vite、Pinia、Element Plus。
- 登录接口是 `/api/admin/login`。
- 企业切换接口是 `/api/admin/enterprise/switch`。
- 当前未发现 `passwordLogin`、`qrcode/login`、`switchCorpMember`、`bindCorpMember`、`queryCheckConfig` 或验证码登录能力。

因此沉默账户需求对该项目不能判定为 `DIRECT`。接口中的 `/api/admin` 前缀不能改变其业务角色，但会改变迁移方式。在后端未说明 `/api/admin/login` 会返回 `1027`、且产品未要求承载前台提供验证码登录前，应判定：

- 当前业务场景：`N/A`；或
- 若产品确认承载前台也必须支持：`BLOCKED`，先补齐接口契约和验证码登录产品流程，再按 Vue 3 原生结构 `ADAPT`。

禁止把 Vue 2 的 `login.vue`、mixins 或 Element UI 弹框复制进承载前台。

本案例只覆盖三个前台项目。承接后管、兑接后管和承载后管应在后管需求中单独建立调用链和迁移矩阵，不能从本案例推断它们也需要沉默账户逻辑。

## 推荐能力矩阵

| 能力 | 承接前台 | 兑接前台 | 承载前台 |
|---|---|---|---|
| 密码登录 `1027` | DIRECT | DIRECT | N/A/BLOCKED |
| 切换账户 `1027` | DIRECT | DIRECT，保留 `validUser` | N/A/BLOCKED |
| 绑定账户 `1027` | DIRECT | DIRECT | N/A |
| 二维码登录 `1027` | N/A | EXTEND | N/A |
| `queryCheckConfig` | DIRECT | DIRECT，保留目标状态结构 | BLOCKED/N/A |
| 弹框 loading 与按钮禁用 | DIRECT | DIRECT | N/A |
| 保留密码入口 | MUST | MUST | N/A |
| 复制旧控制流 | DO-NOT-PORT | DO-NOT-PORT | DO-NOT-PORT |
