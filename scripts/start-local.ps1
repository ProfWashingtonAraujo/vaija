docker compose up -d

$npmPath = (Get-Command npm.cmd).Source
$workspace = Split-Path -Parent $PSScriptRoot

Start-Process -FilePath $npmPath -ArgumentList 'run', 'dev' -WorkingDirectory $workspace

"Local stack started:"
"- Postgres: http://localhost:5434"
"- Backend: http://localhost:3001/api/health"
"- Frontend: http://localhost:5173"
