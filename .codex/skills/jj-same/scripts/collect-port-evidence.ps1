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

$ErrorActionPreference = 'Stop'

function Resolve-RepoPath {
  param([string]$Path)

  $resolved = (Resolve-Path -LiteralPath $Path).Path
  & git -C $resolved rev-parse --is-inside-work-tree *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Not a Git worktree: $resolved"
  }
  return $resolved
}

function Invoke-Git {
  param(
    [string]$Repo,
    [string[]]$Arguments,
    [switch]$AllowFailure
  )

  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = @(& git -C $Repo @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($exitCode -ne 0 -and -not $AllowFailure) {
    throw "git -C '$Repo' $($Arguments -join ' ') failed:`n$($output -join [Environment]::NewLine)"
  }
  return $output
}

function Test-GitPath {
  param(
    [string]$Repo,
    [string]$Ref,
    [string]$Path
  )

  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'SilentlyContinue'
  try {
    & git -C $Repo cat-file -e "${Ref}:$Path" *> $null
    return $LASTEXITCODE -eq 0
  } finally {
    $ErrorActionPreference = $previousPreference
  }
}

function Get-GitPathHash {
  param(
    [string]$Repo,
    [string]$Ref,
    [string]$Path
  )

  if (-not (Test-GitPath -Repo $Repo -Ref $Ref -Path $Path)) {
    return $null
  }
  return @(Invoke-Git -Repo $Repo -Arguments @('rev-parse', "${Ref}:$Path"))[0]
}

function Get-PackageSummary {
  param(
    [string]$Repo,
    [string]$Ref
  )

  if (-not (Test-GitPath -Repo $Repo -Ref $Ref -Path 'package.json')) {
    return 'package.json unavailable at ref'
  }
  $raw = @(Invoke-Git -Repo $Repo -Arguments @('show', "${Ref}:package.json"))

  try {
    $package = ($raw -join [Environment]::NewLine) | ConvertFrom-Json
    $vue = $package.dependencies.vue
    $router = $package.dependencies.'vue-router'
    $store = if ($package.dependencies.pinia) { "pinia $($package.dependencies.pinia)" } elseif ($package.dependencies.vuex) { "vuex $($package.dependencies.vuex)" } else { 'no declared store' }
    $builder = if ($package.devDependencies.vite) { "vite $($package.devDependencies.vite)" } elseif ($package.devDependencies.'@vue/cli-service') { "vue-cli $($package.devDependencies.'@vue/cli-service')" } else { 'unknown builder' }
    return "$($package.name); vue $vue; router $router; $store; $builder"
  } catch {
    return 'package.json could not be parsed'
  }
}

$source = Resolve-RepoPath -Path $SourceRepo
$target = Resolve-RepoPath -Path $TargetRepo

Invoke-Git -Repo $source -Arguments @('rev-parse', '--verify', $SourceBase) *> $null
Invoke-Git -Repo $source -Arguments @('rev-parse', '--verify', $SourceRef) *> $null
Invoke-Git -Repo $target -Arguments @('rev-parse', '--verify', $TargetRef) *> $null

$mergeBase = @(Invoke-Git -Repo $source -Arguments @('merge-base', $SourceBase, $SourceRef))[0]
$range = "$mergeBase..$SourceRef"
$commits = @(Invoke-Git -Repo $source -Arguments @('log', '--reverse', "--format=%h`t%s", $range))
$changed = @(Invoke-Git -Repo $source -Arguments @('diff', '--name-status', $range))
$sourceStatus = @(Invoke-Git -Repo $source -Arguments @('status', '--short', '--branch'))
$targetStatus = @(Invoke-Git -Repo $target -Arguments @('status', '--short', '--branch'))

Write-Output '# Port evidence'
Write-Output ''
Write-Output "- Source: ``$source``"
Write-Output "- Source range: ``$range``"
Write-Output "- Source stack: $(Get-PackageSummary -Repo $source -Ref $SourceRef)"
Write-Output "- Target: ``$target``"
Write-Output "- Target ref: ``$TargetRef``"
Write-Output "- Target stack: $(Get-PackageSummary -Repo $target -Ref $TargetRef)"
Write-Output ''

Write-Output '## Source commits'
Write-Output ''
if ($commits.Count -eq 0) {
  Write-Output '- No commits in range.'
} else {
  foreach ($commit in $commits) {
    Write-Output "- $commit"
  }
}
Write-Output ''

Write-Output '## Changed-path comparison'
Write-Output ''
Write-Output '| Source status | Path | Target ref state | Content relation |'
Write-Output '|---|---|---|---|'

foreach ($line in $changed) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $parts = $line -split "`t"
  $status = $parts[0]
  $path = $parts[-1]
  $targetExists = Test-GitPath -Repo $target -Ref $TargetRef -Path $path
  $targetState = if ($targetExists) { 'present' } else { 'missing' }
  $relation = 'not comparable'

  if ($status -notmatch '^D' -and $targetExists) {
    $sourceHash = Get-GitPathHash -Repo $source -Ref $SourceRef -Path $path
    $targetHash = Get-GitPathHash -Repo $target -Ref $TargetRef -Path $path
    $relation = if ($sourceHash -and $sourceHash -eq $targetHash) { 'identical blob' } else { 'different blob' }
  }

  $safePath = $path -replace '\|', '\|'
  Write-Output "| $status | ``$safePath`` | $targetState | $relation |"
}
Write-Output ''

Write-Output '## Worktree status'
Write-Output ''
Write-Output '### Source'
Write-Output '```text'
$sourceStatus | ForEach-Object { Write-Output $_ }
Write-Output '```'
Write-Output ''
Write-Output '### Target'
Write-Output '```text'
$targetStatus | ForEach-Object { Write-Output $_ }
Write-Output '```'
Write-Output ''
Write-Output '> This report is structural evidence only. Classify behavior with source requirements and target call chains before editing.'
