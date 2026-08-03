# Apply report — SEZ-20260803-path-migrate

- mode: **apply** (path migration) + **dry-run** (full Chinese→English body rewrite deferred)
- mapGate: N/A for path move; language inventory complete
- skills scanned: 8 (7 product jj-* + skill-en-zh-rewrite)

## Path migration (applied)

| Change | Result |
| --- | --- |
| Repo SSOT `.codex/skills` → `skills/` | done |
| `package.json` files | `skills/` |
| `skill-inventory.json` + schema const | `canonical_skills_root: "skills"` |
| `installSkill` / `skillInventory` source dir | `skills/` |
| Host install targets | unchanged (`~/.codex/skills`, `~/.grok/skills`, …) |
| `.codex/agents` | kept under `.codex/agents` |
| `.codex/skills/README.md` | pointer only (no product skills) |
| `ralph_ops` monorepo resolve | `../../../src/ralph.mjs` (+ legacy depth) |
| Claude thin commands | point at `skills/<id>/` |
| Tests / harness / check-project | paths updated |

## Bridge packs (written)

| path | skill_id |
| --- | --- |
| `docs/skill-zh-bridge/README.md` | index |
| `docs/skill-zh-bridge/<id>/README.zh.md` | each skill |

## Language rewrite (not fully applied)

- ~32 mixed/zh markdown files remain under `skills/`
- Entry-level Chinese对照 packs only; full EN SSOT body rewrite is next batch
- See `language-report.md` for P0 file list

## Preserve-token failures

None (path migration only).

## Install

- `node src/cli.mjs` / `installSkill({ platform: 'all', force: true })` from local `skills/` source — ok
