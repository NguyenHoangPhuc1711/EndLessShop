# Real HTTP/SQL integration tests. Only newly tagged fixtures may be cleaned up.
[CmdletBinding()]
param([switch]$WithBrowser)
$ErrorActionPreference='Stop'
$workspace=Split-Path -Parent $PSScriptRoot
$runId=[Guid]::NewGuid().ToString('N').Substring(0,12)
$controlPath=Join-Path $workspace ('.reference/cod-test-'+$runId)
[IO.Directory]::CreateDirectory($controlPath) | Out-Null
$info=@(docker inspect sqlserver | ConvertFrom-Json)[0]
$entry=@($info.Config.Env | Where-Object {$_ -match '^MSSQL_SA_PASSWORD=.'}) | Select-Object -First 1
if(-not $entry){$entry=@($info.Config.Env | Where-Object {$_ -match '^SA_PASSWORD=.'}) | Select-Object -First 1}
if(-not $entry){throw 'Existing SQL admin credential unavailable.'}
$previous=[Environment]::GetEnvironmentVariable('DB_PASSWORD','Process')
try {
  [Environment]::SetEnvironmentVariable('DB_PASSWORD',$entry.Substring($entry.IndexOf('=')+1),'Process')
  $browserFlag=if($WithBrowser){'true'}else{'false'}
  Write-Output ('TEST_CONTROL='+$controlPath)
  docker run --rm --network endlessshop_network --mount "type=bind,source=$controlPath,target=/test-control" `
    --mount "type=bind,source=$workspace/server,target=/app/server" --workdir /app/server `
    --env DB_SERVER=sqlserver --env DB_PORT=1433 --env DB_DATABASE=web_thoi_trang --env DB_USER=sa --env DB_PASSWORD `
    --env DB_ENCRYPT=true --env DB_TRUST_SERVER_CERTIFICATE=true --env TEST_API_BASE_URL=http://backend:3000 `
    --env "TEST_RUN_ID=$runId" --env "TEST_WAIT_FOR_BROWSER=$browserFlag" `
    node:22-bookworm-slim node scripts/verify-orders.js
  if($LASTEXITCODE -ne 0){throw 'COD tests failed; inspect the test report. No credentials are printed.'}
} finally {
  [Environment]::SetEnvironmentVariable('DB_PASSWORD',$previous,'Process')
  $entry=$null
}
