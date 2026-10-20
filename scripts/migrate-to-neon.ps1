# Copia o schema public de um Postgres de origem (ex.: Supabase) para o Neon.
# Usa a imagem oficial do Postgres via Docker (não precisa de pg_dump/psql instalados).
#
# As URLs vêm de variáveis de ambiente para não ficarem no histórico do shell:
#   $env:SOURCE_DATABASE_URL = "postgresql://postgres.<ref>:<senha>@...pooler.supabase.com:5432/postgres"
#   $env:NEON_DATABASE_URL   = "postgresql://<user>:<senha>@ep-xxx.<regiao>.aws.neon.tech/<db>?sslmode=require"
#   .\scripts\migrate-to-neon.ps1
#
# Use a conexão DIRETA do Neon (host sem "-pooler") para o restore.
param(
  [string]$Image = "postgres:18-alpine",
  [string]$OutputDir = ".\backups"
)

if (-not $env:SOURCE_DATABASE_URL -or -not $env:NEON_DATABASE_URL) {
  throw "Defina SOURCE_DATABASE_URL e NEON_DATABASE_URL antes de rodar."
}
if ($env:NEON_DATABASE_URL -match "-pooler") {
  throw "Use a conexão direta do Neon (sem '-pooler') para o restore."
}

$hostOutputDir = Join-Path (Resolve-Path -LiteralPath ".") $OutputDir.TrimStart('.\')
if (-not (Test-Path -LiteralPath $hostOutputDir)) {
  New-Item -ItemType Directory -Path $hostOutputDir | Out-Null
}
$dumpFile = "supabase-to-neon-$(Get-Date -Format 'yyyyMMdd-HHmmss').sql"

Write-Host "1/3 Dump do schema public da origem..."
docker run --rm -e SRC=$env:SOURCE_DATABASE_URL -v "${hostOutputDir}:/out" $Image `
  sh -c "pg_dump `$SRC --schema=public --no-owner --no-privileges --no-publications --no-subscriptions -f /out/$dumpFile"
if ($LASTEXITCODE -ne 0) { throw "pg_dump falhou." }

Write-Host "2/3 Restore no Neon (parando no primeiro erro)..."
docker run --rm -e DST=$env:NEON_DATABASE_URL -v "${hostOutputDir}:/out" $Image `
  sh -c "sed '/^CREATE SCHEMA public;/d' /out/$dumpFile | psql `$DST -v ON_ERROR_STOP=1 -1"
if ($LASTEXITCODE -ne 0) { throw "Restore falhou; nada foi aplicado (transação única)." }

Write-Host "3/3 Contagem de linhas por tabela no Neon:"
$countSql = "SELECT table_name AS tabela, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I', table_name), false, true, '')))[1]::text::int AS linhas FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1"
docker run --rm $Image psql $env:NEON_DATABASE_URL -c $countSql

Write-Host "Dump guardado em $(Join-Path $hostOutputDir $dumpFile) (contém dados reais; está no .gitignore)."
