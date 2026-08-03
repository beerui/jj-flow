[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$SourceRepo,

  [Parameter(Mandatory = $true)]
  [string]$SourceBase,

  [Parameter(Mandatory = $true)]
  [string]$SourceRef,

  [Parameter(Mandatory = $true)]
  [string]$TargetRepo,

  [string]$TargetRef = 'HEAD'
)

# Thin Windows launcher. Canonical logic lives in collect-port-evidence.mjs
# so macOS / Linux / Windows share one implementation.

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeScript = Join-Path $scriptDir 'collect-port-evidence.mjs'
$nodeBin = if ($env:NODE_BIN) { $env:NODE_BIN } else { 'node' }

if (-not (Test-Path -LiteralPath $nodeScript)) {
  throw "Missing Node implementation: $nodeScript"
}

$nodeCmd = Get-Command $nodeBin -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  throw "Node.js is required to run collect-port-evidence (NODE_BIN=$nodeBin)."
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'git is required on PATH.'
}

& $nodeBin $nodeScript `
  --source-repo $SourceRepo `
  --source-base $SourceBase `
  --source-ref $SourceRef `
  --target-repo $TargetRepo `
  --target-ref $TargetRef

exit $LASTEXITCODE
