param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [string]$ContainerName = "vaija-postgres",
  [string]$Database = "vaija",
  [string]$User = "postgres"
)

if (-not (Test-Path -LiteralPath $BackupFile)) {
  throw "Backup file not found: $BackupFile"
}

$resolvedBackupFile = Resolve-Path -LiteralPath $BackupFile
$fileName = Split-Path -Path $resolvedBackupFile -Leaf
$containerPath = "/tmp/$fileName"

docker cp $resolvedBackupFile "${ContainerName}:$containerPath"
if (-not $?) {
  throw "Failed to copy backup into container."
}

docker exec $ContainerName sh -lc "psql -U '$User' -d '$Database' -f '$containerPath'"
if (-not $?) {
  throw "Restore failed inside container."
}

docker exec $ContainerName sh -lc "rm -f '$containerPath'"

"Restore finished for database $Database from $resolvedBackupFile"
