param([switch]$Demo)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
Push-Location $projectRoot
try {
    if (-not (Test-Path -LiteralPath '.venv\Scripts\python.exe')) {
        python -m venv .venv
        if ($LASTEXITCODE -ne 0) { throw 'Python sanal ortami olusturulamadi.' }
    }
    & '.\.venv\Scripts\python.exe' -m pip install -r backend\requirements.lock.txt
    if ($LASTEXITCODE -ne 0) { throw 'Backend bagimliliklari kurulamadi.' }
    Push-Location frontend
    try {
        npm ci --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'Frontend bagimliliklari kurulamadi.' }
        npm run build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build basarisiz.' }
    } finally { Pop-Location }
    Push-Location backend
    try {
        $setupArguments = @('-m', 'scripts.initialize')
        if ($Demo) { $setupArguments += '--demo' }
        & '..\.venv\Scripts\python.exe' @setupArguments
        if ($LASTEXITCODE -ne 0) { throw 'Veritabani veya yonetici kurulumu tamamlanamadi.' }
    } finally { Pop-Location }
    Write-Host 'Kurulum tamamlandi. Baslatmak icin: .\start.ps1'
} finally { Pop-Location }
