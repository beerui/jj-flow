# loop gym overlay — lean L1-S7a

Pinned gym `ed72b08` still requires live `task_plan.md` to grow `已落地` / `Landed` after rewrite. Product `initRun` now writes lean Goal / 验收 / Steps; history belongs in `progress.md`.

`lab-check.mjs` copies these three files over a loop-gym checkout **only when** the pin oracle still has the leftover Landed finding **and** does not yet contain:

`lean task_plan.md grew Landed/已落地 after rewrite`

Leftover `## 计划` / `## Current` checks stay in the overlay (they still mention Landed). Detection keys off the lean marker, not the leftover string. Once gym lands the lean oracle, the overlay no-ops. Do not raise `loop_ref` to an unpublished SHA.
