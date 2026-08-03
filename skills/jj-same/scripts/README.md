# jj-same helper scripts

These scripts collect structural evidence for branch-driven / session-driven
migration. They are optional helpers; the conversation protocol still decides
what to port.

## Multi-environment support

| Script | Role | Environments |
| --- | --- | --- |
| `collect-port-evidence.mjs` | **Canonical implementation** | Windows / macOS / Linux (Node.js >= 20 + git) |
| `collect-port-evidence.sh` | Thin launcher | macOS / Linux / Git Bash / WSL |
| `collect-port-evidence.ps1` | Thin launcher | Windows PowerShell / pwsh |
| `extract_session_evidence.py` | Session JSONL extractor | Any OS with Python 3 |

Always prefer the Node entry. Shell / PowerShell wrappers only forward args.

## collect-port-evidence

Compare a source feature range against a target worktree and print Markdown
evidence (commits, path presence, blob equality, worktree status).

### Preferred (all OS)

```bash
node scripts/collect-port-evidence.mjs \
  --source-repo /path/to/source \
  --source-base master \
  --source-ref feat/example \
  --target-repo /path/to/target \
  --target-ref HEAD
```

### macOS / Linux

```bash
chmod +x scripts/collect-port-evidence.sh   # once
./scripts/collect-port-evidence.sh \
  --source-repo /path/to/source \
  --source-base master \
  --source-ref feat/example \
  --target-repo /path/to/target
```

### Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File scripts/collect-port-evidence.ps1 `
  -SourceRepo 'D:\path\source' `
  -SourceBase 'master' `
  -SourceRef 'feat/example' `
  -TargetRepo 'D:\path\target' `
  -TargetRef 'HEAD'
```

### Requirements

- Node.js >= 20 (`NODE_BIN` can override the binary name/path)
- `git` on `PATH`

## extract_session_evidence

```bash
python -X utf8 scripts/extract_session_evidence.py \
  --thread-id '019f3a6a-07f2-7c80-a75e-3d40be996901'
```

Works with system Python 3 on Windows, macOS, and Linux. Codex session paths
still follow the host layout (`$CODEX_HOME/sessions`).
