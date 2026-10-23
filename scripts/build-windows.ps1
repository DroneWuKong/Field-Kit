$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:OS -ne 'Windows_NT') { throw 'Build the Windows executable on Windows.' }
$WorkspaceRoot = Split-Path -Parent $PSScriptRoot
Set-Location $WorkspaceRoot
function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed with exit code $LASTEXITCODE" }
}
$BuildRoot = Join-Path $WorkspaceRoot 'build-private/windows'
$DistRoot = Join-Path $BuildRoot 'dist'
$GridRoot = Join-Path $BuildRoot 'grids'
$FrontendRoot = Join-Path $WorkspaceRoot 'apps/horizon/frontend/dist'
$AssetsRoot = Join-Path $WorkspaceRoot 'source/assets'
New-Item -ItemType Directory -Force $BuildRoot | Out-Null
Invoke-Checked python @('-m', 'pip', 'install', '--require-hashes', '-r', 'apps/horizon/requirements.lock')
Invoke-Checked python @('-m', 'pip', 'install', '--no-deps', './apps/horizon')
Invoke-Checked python @('-m', 'pip', 'install', 'pyinstaller==6.22.3')
Invoke-Checked npm.cmd @('--prefix', 'apps/horizon/frontend', 'ci')
Invoke-Checked npm.cmd @('--prefix', 'apps/horizon/frontend', 'run', 'build')
Invoke-Checked python @('apps/horizon/scripts/fetch_grids.py', $GridRoot)
Invoke-Checked python @('-m', 'PyInstaller', '--noconfirm', '--clean', '--onedir', '--console',
    '--name', 'PrismoFieldKit', '--distpath', $DistRoot, '--workpath', (Join-Path $BuildRoot 'work'),
    '--specpath', $BuildRoot, '--collect-all', 'rasterio', '--collect-all', 'pyproj',
    '--collect-all', 'uvicorn', '--collect-all', 'horizon',
    '--add-data', "${FrontendRoot}:frontend", '--add-data', "${AssetsRoot}:fieldkit",
    '--add-data', "${GridRoot}:grids", 'apps/horizon/windows/launcher.py')
$AppRoot = Join-Path $DistRoot 'PrismoFieldKit'
Copy-Item apps/horizon/windows/README.txt (Join-Path $AppRoot 'README.txt')
$Commit = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Could not identify source commit' }
[IO.File]::WriteAllText((Join-Path $AppRoot 'SOURCE_COMMIT'), "$Commit`n")
Invoke-Checked python @('scripts/test-windows-package.py', '--exe', (Join-Path $AppRoot 'PrismoFieldKit.exe'), '--output', (Join-Path $AppRoot 'WINDOWS_VALIDATION.json'))
$Checksums = Get-ChildItem $AppRoot -File -Recurse | Sort-Object FullName | ForEach-Object {
    $Relative = $_.FullName.Substring($AppRoot.Length + 1).Replace('\', '/')
    "$((Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower())  $Relative"
}
[IO.File]::WriteAllLines((Join-Path $AppRoot 'SHA256SUMS'), $Checksums)
$Archive = Join-Path $BuildRoot 'Prismo-Field-Kit-Horizon-0.2.0-windows-x64.zip'
Compress-Archive -Path $AppRoot -DestinationPath $Archive -Force
$Hash = (Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash.ToLower()
[IO.File]::WriteAllText("$Archive.sha256", "$Hash  $([IO.Path]::GetFileName($Archive))`n")
Write-Host "Windows package ready: $Archive"
