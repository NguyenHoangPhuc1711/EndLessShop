# Controlled name/price proof only. Run Restore even if browser verification fails.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidateSet('Set','Restore')][string]$Phase)
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$backupPath = Join-Path $workspace '.reference/catalog-proof-backup.json'
$oldEncoding = $OutputEncoding
$OutputEncoding = [Text.UTF8Encoding]::new($false)
function Invoke-ProofSql([string]$Query) {
    $runner = 'export SQLCMDPASSWORD=${MSSQL_SA_PASSWORD:-$SA_PASSWORD}; exec /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -l 5 -h -1 -y 2000 -w 65535'
    $output = ($Query + "`nGO") | docker exec -i sqlserver sh -c $runner
    if ($LASTEXITCODE -ne 0) { throw 'Controlled SQL proof failed. Original-value backup was retained.' }
    return ($output -join "`n").Trim()
}
try {
    if ($Phase -eq 'Set') {
        if ((Test-Path -LiteralPath $backupPath) -and (Get-Item -LiteralPath $backupPath).Length -gt 0) { throw 'An earlier proof backup exists. Run Restore first.' }
        $json = Invoke-ProofSql "SET NOCOUNT ON; SELECT san_pham_id AS id,ten_sp AS name,gia AS price FROM web_thoi_trang.dbo.SAN_PHAM WHERE san_pham_id=1 FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;"
        $original = $json | ConvertFrom-Json
        if ($original.id -ne 1) { throw 'Product 1 not found.' }
        $apiProducts = Invoke-RestMethod 'http://localhost:3000/api/products'
        $apiOriginal = $apiProducts | Where-Object id -eq 1
        if ($original.name -cne $apiOriginal.name -or $original.price -ne $apiOriginal.price) {
            throw 'SQL/API original values differ; stop before modifying the test product.'
        }
        $marker = 'DB-PROOF-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + ' <img src=x onerror=alert(1)>'
        $backup = @{ id=1; name=$original.name; price=[int]$original.price; marker=$marker; testPrice=189123 }
        [IO.Directory]::CreateDirectory((Split-Path -Parent $backupPath)) | Out-Null
        [IO.File]::WriteAllText($backupPath, ($backup | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
        $markerSql = $marker.Replace("'", "''")
        Invoke-ProofSql "SET NOCOUNT ON; UPDATE web_thoi_trang.dbo.SAN_PHAM SET ten_sp=N'$markerSql',gia=189123 WHERE san_pham_id=1; IF @@ROWCOUNT<>1 THROW 51020,'Proof target missing',1;" | Out-Null
        Write-Output 'Controlled DB name/price set; original values backed up locally. Run Restore after verification.'
    } else {
        if (-not (Test-Path -LiteralPath $backupPath)) { throw 'No proof backup exists.' }
        $backup = [IO.File]::ReadAllText($backupPath) | ConvertFrom-Json
        $nameBytes = [Text.Encoding]::Unicode.GetBytes([string]$backup.name)
        $nameHex = [BitConverter]::ToString($nameBytes).Replace('-', '')
        $markerSql = ([string]$backup.marker).Replace("'", "''")
        $price = [int]$backup.price
        Invoke-ProofSql "SET NOCOUNT ON; UPDATE web_thoi_trang.dbo.SAN_PHAM SET ten_sp=CONVERT(NVARCHAR(150),0x$nameHex),gia=$price WHERE san_pham_id=1 AND ten_sp=N'$markerSql' AND gia=189123; IF @@ROWCOUNT<>1 THROW 51021,'Proof row changed externally; review saved original before retrying',1;" | Out-Null
        # Keep evidence without obstructing a later controlled test; never delete application data.
        $backup | Add-Member -NotePropertyName restored -NotePropertyValue $true -Force
        [IO.File]::WriteAllText((Join-Path $workspace '.reference/catalog-proof-restored.json'), ($backup | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
        [IO.File]::WriteAllText($backupPath, '', [Text.UTF8Encoding]::new($false))
        Write-Output 'Original database name and price restored.'
    }
} finally { $OutputEncoding = $oldEncoding }
