Get-CimInstance Win32_Process |
  Where-Object {
    ($_.Name -eq 'cmd.exe' -and $_.CommandLine -like '*npm run dev*')
  } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force
  }

docker compose down

"Local stack stopped."
