Param(
    [string]$HostName = "127.0.0.1",
    [int]$Port = 5000
)

$root = Split-Path -Path $MyInvocation.MyCommand.Definition -Parent
Set-Location $root

if (-not (Test-Path .venv)) {
    Write-Host "Creating virtual environment..."
    python -m venv .venv
}

$py = Join-Path .venv 'Scripts\python.exe'
Start-Process -FilePath $py -ArgumentList '-m','pip','install','--upgrade','pip' -NoNewWindow -Wait
Start-Process -FilePath $py -ArgumentList '-m','pip','install','-r','requirements.txt' -NoNewWindow -Wait

Write-Host "Launching app on ${HostName}:${Port}..."
Start-Process -FilePath $py -ArgumentList 'app.py' -NoNewWindow -Wait
