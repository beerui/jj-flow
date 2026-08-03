# Integration with jj-same / jj-dispatch

## Do not mix identities

| Identity | Owner | Example |
| --- | --- | --- |
| `RALPH-*` run_id | **ralph** (business repo `.workflow/ralph/`) | `RALPH-login-reminder-20260722` |
| `CAP-*` | ralph business-map | `CAP-login-reminder` |
| In-run `REQ-*` / `TASK-*` | ralph plan | `TASK-1` detects password_expired |
| `DEL-*` delivery | **dispatch** (control project / control-plane) | `DEL-password` |
| Dispatch `task_key` | dispatch | **Not** the same numbering as ralph `TASK-1` |

Business repos: ProjectA / ProjectB / ProjectC (frontend, ticket-recognition, etc.).  
The **control project** only records schedule state; do not use ralph there as a substitute for business implementation.

## jj-same

1. Ralph maintains a lean handoff in `run.handoff` (accept may write automatically)
2. User only says: 「交接到 项目B」 / 「交接到 项目B 项目C」 / “hand off to ProjectB ProjectC”
3. same reads the current session run/handoff then ports to targets; does not re-do source analysis
4. Target implementation is **not** written under `.workflow/ralph/`
5. If source repo `intensity=strict`, handoff must / do_not_port / targets should be more complete (easier for ProjectB·ProjectC reuse)
6. After archive, same-run edits: should **commit + re-accept/handoff**, refresh `source_head` / must; handoff ready tracks accept + git stability

## jj-dispatch

When a control plane is needed, write a dispatch recommendation. dispatch owns delivery / task_key.  
Example: `$jj-dispatch PREVIEW delivery=DEL-password targets=ProjectA,ProjectB,ProjectC`  
→ Separate line from `RALPH-login-reminder-20260722` in ProjectA; may cross-reference but do not write the wrong directory.

## Boundaries

| Capability | Owner |
| --- | --- |
| Single-repo loop + run.handoff + intensity | jj-ralph |
| Cross-repo migration | jj-same |
| Schedule identity `DEL-*` / task_key | jj-dispatch |
