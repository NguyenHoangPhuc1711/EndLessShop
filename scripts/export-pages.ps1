# Produce a standalone, public-only directory. No backend files or secrets are copied.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'web-ban-quan-ao'
$output = Join-Path $root 'pages'
New-Item -ItemType Directory -Path $output -Force | Out-Null
foreach ($name in @('index.html','checkout.html','account.html','login.html','register.html','admin.html')) {
    $html = [IO.File]::ReadAllText((Join-Path $source $name))
    # Keep this artifact self-contained. CSS already supplies system font fallbacks.
    $html = [regex]::Replace($html, '(?m)^[ \t]*<link\b[^>]*href="https://fonts\.googleapis\.com[^"]*"[^>]*>\r?\n?', '')
    [IO.File]::WriteAllText((Join-Path $output $name), $html, [Text.UTF8Encoding]::new($false))
}
foreach ($name in @('css','js')) {
    $target = Join-Path $output $name
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    Get-ChildItem -LiteralPath (Join-Path $source $name) -File | Copy-Item -Destination $target -Force
}
# The publish artifact always uses the public API; the source keeps local defaults.
$configPath = Join-Path $output 'js/config.js'
$config = [IO.File]::ReadAllText($configPath)
$pattern = '(?s)  // GitHub Pages uses.*?  const base ='
if ([regex]::Matches($config, $pattern).Count -ne 1) {
    throw 'Unexpected config.js layout; public API export was not applied.'
}
$replacement = "  // Public Pages artifact. Local defaults stay in the source config.`n  const API_BASE = 'https://api.puckin.id.vn';`n  const base ="
$config = [regex]::Replace($config, $pattern, $replacement)
[IO.File]::WriteAllText($configPath, $config, [Text.UTF8Encoding]::new($false))
$images = Join-Path $output 'img'
New-Item -ItemType Directory -Path $images -Force | Out-Null
Get-ChildItem -LiteralPath (Join-Path $root 'img') -File | Copy-Item -Destination $images -Force
Write-Output 'Pages export ready: pages/ (HTML, css/, js/, img/ only).'
