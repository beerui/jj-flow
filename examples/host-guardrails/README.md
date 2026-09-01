# Host guardrail examples (not protocol)

These samples show how a **host** can enforce what jj-flow only advises. They are **not** part of the npm protocol, not installed by `jj install-skill`, and not a Claude/Codex/Grok requirement.

## Three layers

| Layer | Where | What it does |
| --- | --- | --- |
| Advisory | `AGENTS.md` / skills | Makes mistakes rare |
| Deterministic | Host hook / permission profile | Blocks secrets, frozen paths, unapproved production deploy, test-file edits in fix mode |
| Human | `$jj-end` / user forbid push-merge | Irreversible git/release |

jj-flow still does not execute deploy, merge, or push unless the user explicitly asks (`$jj-end`).

## Parallel streams

One person, **2–3** independent streams (separate worktrees). Shared files stay serial. Stop adding streams when review cannot keep up. Verifier / `$jj-review` **reports only**.

## Samples

- `production-gate.example.sh` — block a production deploy unless `RELEASE_APPROVAL` is set
- `deny-test-edits-on-fix.example.sh` — when `JJ_FIX_MODE=1`, block writes under `tests/` (stricter than protocol: protocol only blocks delete/empty on bugfix)

Copy into the host's hook/settings directory. Do not commit host-private secrets here.
