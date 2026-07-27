param(
  [string]$ContainerName = "vaija-postgres",
  [string]$Database = "vaija",
  [string]$User = "postgres",
  [string]$OutputDir = ".\backups"
)

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = "backup-$($Database)-$($timestamp).sql"
$hostOutputDir = Resolve-Path -LiteralPath "." | ForEach-Object { Join-Path $_ $OutputDir.TrimStart('.\') }

if (-not (Test-Path -LiteralPath $hostOutputDir)) {
  New-Item -ItemType Directory -Path $hostOutputDir | Out-Null
}

$containerPath = "/tmp/$backupFile"

docker exec $ContainerName sh -lc "pg_dump -U '$User' -d '$Database' -f '$containerPath'"
if (-not $?) {
  throw "Backup failed inside container."
}

docker cp "${ContainerName}:$containerPath" (Join-Path $hostOutputDir $backupFile)
if (-not $?) {
  throw "Failed to copy backup from container."
}

docker exec $ContainerName sh -lc "rm -f '$containerPath'"

"Backup created at $(Join-Path $hostOutputDir $backupFile)"
