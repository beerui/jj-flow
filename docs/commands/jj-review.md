# jj-review

Single-repo review linked to ralph run.

## Flow

locate run -> review -> jj ralph review-record -> reviews/

## Command

jj ralph review-record --run-id RALPH-... --outcome PASS --reviewed-commit SHA --task-thread ID --review-thread ID

## Boundary

Does not replace dispatch review gate.
