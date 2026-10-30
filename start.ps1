param([switch]$Rebuild)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if (-not (Test-Path -LiteralPath '.venv\Scripts\python.exe')) { throw 'Once .\setup.ps1 komutunu calistirin.' }
    if ($Rebuild -or -not (Test-Path -LiteralPath 'frontend\dist\index.html')) {
        Push-Location frontend
        try {
            npm run build
            if ($LASTEXITCODE -ne 0) { throw 'Frontend build basarisiz.' }
        } finally { Pop-Location }
    }
    Push-Location backend
    try {
        & '..\.venv\Scripts\python.exe' -m alembic upgrade head
        if ($LASTEXITCODE -ne 0) { throw 'Migration basarisiz.' }
        Write-Host 'StockPilot: http://127.0.0.1:8000 | Durdurmak icin Ctrl+C'
        & '..\.venv\Scripts\python.exe' -m uvicorn app.main:app --host 127.0.0.1 --port 8000
    } finally { Pop-Location }
} finally { Pop-Location }
