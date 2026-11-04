# Starts only the Express service and reuses the existing SQL Server container/volume.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $workspace
try {
    $infoJson = docker inspect sqlserver 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Existing sqlserver container not found.' }
    $info = @($infoJson | ConvertFrom-Json)[0]
    if (-not $info.State.Running) { throw 'Existing sqlserver container is not running.' }
    if (-not @($info.Mounts | Where-Object { $_.Name -eq 'sqlserver_data' -and $_.Destination -eq '/var/opt/mssql' }).Count) {
        throw 'Expected SQL volume not found. Nothing has been changed.'
    }

    $envPath = Join-Path $workspace '.env'
    if (-not (Test-Path -LiteralPath $envPath)) {
        $bytes = New-Object byte[] 32
        $random = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $random.GetBytes($bytes) } finally { $random.Dispose() }
        $runtimePassword = 'El!9' + [Convert]::ToBase64String($bytes)
        $content = @(
            'DB_SERVER=sqlserver', 'DB_PORT=1433', 'DB_DATABASE=web_thoi_trang',
            'DB_USER=endless_runtime', "DB_PASSWORD=$runtimePassword",
            'DB_ENCRYPT=true', 'DB_TRUST_SERVER_CERTIFICATE=true'
        ) -join "`n"
        [IO.File]::WriteAllText($envPath, $content + "`n", [Text.UTF8Encoding]::new($false))
    }
    $settings = @{}
    foreach ($line in [IO.File]::ReadAllLines($envPath)) {
        if ($line -match '^([A-Z_]+)=(.*)$') { $settings[$matches[1]] = $matches[2] }
    }
    if ($settings['DB_USER'] -ne 'endless_runtime' -or $settings['DB_DATABASE'] -ne 'web_thoi_trang' -or
        $settings['DB_SERVER'] -ne 'sqlserver' -or $settings['DB_PASSWORD'].Length -lt 24) {
        throw 'Existing .env is not compatible with this setup; it was not overwritten.'
    }

    # Upgrade existing .env additively. Persist the same signing secret across restarts.
    if (-not $settings.ContainsKey('SESSION_SECRET')) {
        $secretBytes = New-Object byte[] 48
        $secretRandom = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $secretRandom.GetBytes($secretBytes) } finally { $secretRandom.Dispose() }
        $settings['SESSION_SECRET'] = [Convert]::ToBase64String($secretBytes)
        [IO.File]::AppendAllText($envPath, "`nSESSION_SECRET=$($settings['SESSION_SECRET'])`n", [Text.UTF8Encoding]::new($false))
    }
    if ($settings['SESSION_SECRET'].Length -lt 32) { throw 'SESSION_SECRET must contain at least 32 random characters.' }
    $authDefaults = @{
        SESSION_COOKIE_SECURE = 'false'
        APP_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3000'
        TRUST_PROXY = '0'
    }
    foreach ($key in $authDefaults.Keys) {
        if (-not $settings.ContainsKey($key)) {
            [IO.File]::AppendAllText($envPath, "$key=$($authDefaults[$key])`n", [Text.UTF8Encoding]::new($false))
        }
    }

    $networkNames = @(docker network ls --format '{{.Name}}')
    if ($LASTEXITCODE -ne 0) { throw 'Cannot list Docker networks.' }
    if ($networkNames -notcontains 'endlessshop_network') {
        docker network create endlessshop_network | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Cannot create application network.' }
    }
    if (-not $info.NetworkSettings.Networks.PSObject.Properties['endlessshop_network']) {
        docker network connect endlessshop_network sqlserver
        if ($LASTEXITCODE -ne 0) { throw 'Cannot attach existing SQL container to application network.' }
    }
    docker compose build backend
    if ($LASTEXITCODE -ne 0) { throw 'Backend image build failed.' }

    # Read the existing admin password only into memory. Never pass it in command-line arguments.
    $passwordEntry = @($info.Config.Env | Where-Object { $_ -match '^MSSQL_SA_PASSWORD=.' }) | Select-Object -First 1
    if (-not $passwordEntry) { $passwordEntry = @($info.Config.Env | Where-Object { $_ -match '^SA_PASSWORD=.' }) | Select-Object -First 1 }
    if (-not $passwordEntry) { throw 'SQL admin credential is not available in the existing container environment.' }
    $temporary = @{
        DB_PASSWORD = $passwordEntry.Substring($passwordEntry.IndexOf('=') + 1)
        RUNTIME_DB_USER = $settings['DB_USER']
        RUNTIME_DB_PASSWORD = $settings['DB_PASSWORD']
    }
    $previous = @{}
    try {
        foreach ($key in $temporary.Keys) {
            $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
            [Environment]::SetEnvironmentVariable($key, $temporary[$key], 'Process')
        }
        # Docker inherits values by variable name; secrets do not appear in argv.
        docker run --rm --network endlessshop_network --env DB_SERVER=sqlserver --env DB_PORT=1433 `
            --env DB_DATABASE=web_thoi_trang --env DB_USER=sa --env DB_PASSWORD `
            --env DB_ENCRYPT=true --env DB_TRUST_SERVER_CERTIFICATE=true `
            --env RUNTIME_DB_USER --env RUNTIME_DB_PASSWORD endlessshop-backend:local node scripts/init-db.js
        if ($LASTEXITCODE -ne 0) { throw 'Database initialization failed. Backend was not started.' }
    } finally {
        foreach ($key in $previous.Keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
        $temporary.Clear()
        $passwordEntry = $null
    }
    docker compose up -d --wait backend
    if ($LASTEXITCODE -ne 0) { throw 'Backend did not become healthy.' }
    Write-Output 'Backend ready: http://localhost:3000 ; SQL container and volume reused.'
} finally {
    Pop-Location
}
