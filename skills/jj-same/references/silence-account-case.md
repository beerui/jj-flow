# Silence-account cross-project port case

This case is an evidence snapshot from `2026-07-10` illustrating port decision method. For real tasks, re-read current requirements, branches, and source.

## Evidence sources

- Baseline: `/path/to/org-a/project-a`
- Project B: `/path/to/org-b/project-b`
- Project C difference example: `/path/to/org-a/project-e`
- Project A feature branch: `feat/pa-silence-0710`
- Project B feature branch: `feat/pb-silence-0710`
- Session: `019f3a6a-07f2-7c80-a75e-3d40be996901`
- Session: `019f3f41-2baf-7e33-a855-a113c20cf197`
- Session: `019f4653-e792-7322-a4d1-3dc7d327d009`

## Final requirement invariants

1. Backend decides silence account; frontend only handles business code `1027`.
2. On password login hit `1027`, switch to captcha/quick login, keep phone number, and clear no-longer-valid form state.
3. On switch-enterprise security check or bind-new-account hit `1027`, switch from password mode to captcha mode.
4. After the security dialog opens, query `queryCheckConfig` by selected enterprise `uid`.
5. When `forceVerifyCodeLoginFlag = 1`, default into captcha mode.
6. During config request, only load the dialog content and disable related buttons to avoid interaction bounce from slow responses.
7. Product finally required keeping the “switch to password” entry. The older “hide entry” requirement is superseded.
8. Closing the dialog, switching accounts, or late old responses MUST NOT pollute the next state.
9. When local messaging owns the business code, handle global error toasts to avoid duplicate toast.

## Branch evolution

### Project A `feat/pa-silence-0710`

Commit order relative to merge base `4b6591aee`:

| Commit | Role |
|---|---|
| `4785949cb` | Password login and switch-account support `1027` |
| `9feb13c5e` | Bind-new-account support `1027` |
| `99dd3cbdd` | Adjust toast copy |
| `ad086e3f1` | Add `queryCheckConfig`, dialog loading, captcha-first |
| `5a1350e30` | Restore “switch to password” entry |

Main code surfaces:

- `src/constants/user.js`
- `src/apis/toolbar.js`
- `src/views/pages/login/login.vue`
- `src/views/pages/switch-account/switch-account-mixins.js`
- `src/views/pages/switch-account/security-verify-dialog.vue`
- `src/views/pages/switch-account/bind-account-dialog.vue`

The branch also contains `.gitignore` and `docs/pre/0710.md`. They are not default parts of other projects’ runtime port.

### Project B `feat/pb-silence-0710`

Commit order relative to merge base `f1b993442`:

| Commit | Role |
|---|---|
| `445ce398e` | Adjust toast copy |
| `520fa1f3a` | Password, switch-account, and bind-account support `1027`; fix duplicate toasts |
| `34638d309` | Add Project B–only QR-code login entry |
| `05e9030d5` | Add `queryCheckConfig` and captcha-first |
| `e7296038e` | Keep password-switch entry; disable buttons while loading |

Project B has one extra `EXTEND` capability vs Project A:

- `src/views/pages/login/components/qrcode-login.vue` stops polling when login hits `1027`.
- Child emits `silent-account`; parent login page switches to captcha login.
- `src/apis/user.js` disables global error toast for QR login to avoid local toast duplication.

This entry MUST NOT be skipped merely because Project A lacks it, and MUST NOT be forced onto projects without QR login.

## Key differences and lessons

### 1. Do not wholesale-align legacy

A Project B session once imported Project A’s old control flow “for maintainability”; the user then required revert: only keep new/changed logic consistent, leave old logic alone.

The port ledger should record:

- `MUST`: new business code, config query, loading, final product behavior.
- `TARGET-ONLY`: Project B QR entry, Project B existing `validUser` conditions.
- `DO-NOT-PORT`: the revoked legacy alignment.

### 2. Target code need not match line-by-line

Project A and Project B both end up with captcha-first and keep-password-entry, but state management still differs. As long as requirement invariants, failure policy, and acceptance match, do not change target legacy logic just to unify code shape.

### 3. Async config needs object-level race protection

Requests MUST bind the current `uid`. After a response returns, at least confirm:

- Dialog is still open.
- Current account `uid` matches the request’s.
- Only the matching request may clear current loading or switch login mode.

### 4. Error toasts have ownership

Main login API already disables global `showError`; switch/bind APIs may still go through global toast first. When handling `1027` locally, dismiss old toasts or explicitly disable global toast in the API wrapper, and provide default copy.

### 5. Later product adjustments port only the delta

“Hide password entry” later became “keep entry”. When propagating to other projects, port only that behavior delta and necessary button disable — do not re-overwrite the entire security dialog.

## Project C judgment

By the user-given project-family roles, `project-e` is Project C in this case. It is not an isomorphic copy of the Vue 2 ERP baseline:

- Stack is Vue 3, Vite, Pinia, Element Plus.
- Login API is `/api/admin/login`.
- Enterprise switch API is `/api/admin/enterprise/switch`.
- Currently no `passwordLogin`, `qrcode/login`, `switchCorpMember`, `bindCorpMember`, `queryCheckConfig`, or captcha-login capability found.

Therefore the silence-account requirement cannot be `DIRECT` for this project. The `/api/admin` path prefix does not change business role, but it does change port approach. Until backend confirms `/api/admin/login` returns `1027` and product requires Project C captcha login, decide:

- Current business scenario: `N/A`; or
- If product confirms Project C must support: `BLOCKED`, first complete API contract and captcha-login product flow, then `ADAPT` on Vue 3 native structure.

Do not copy Vue 2 `login.vue`, mixins, or Element UI dialogs into Project C.

This case covers only three frontend projects. Project A Admin, Project B Admin, and Project C Admin need separate call chains and port matrices under admin requirements; do not infer from this case that they also need silence-account logic.

## Recommended capability matrix

| Capability | Project A | Project B | Project C |
|---|---|---|---|
| Password login `1027` | DIRECT | DIRECT | N/A/BLOCKED |
| Switch account `1027` | DIRECT | DIRECT, keep `validUser` | N/A/BLOCKED |
| Bind account `1027` | DIRECT | DIRECT | N/A |
| QR login `1027` | N/A | EXTEND | N/A |
| `queryCheckConfig` | DIRECT | DIRECT, keep target state structure | BLOCKED/N/A |
| Dialog loading and button disable | DIRECT | DIRECT | N/A |
| Keep password entry | MUST | MUST | N/A |
| Copy old control flow | DO-NOT-PORT | DO-NOT-PORT | DO-NOT-PORT |
