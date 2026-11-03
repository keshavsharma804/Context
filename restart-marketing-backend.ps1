$ErrorActionPreference = 'Stop'
$backendPath = 'D:\.openclaw\PMO\Product_Management_dashboard_db\backend'
$pythonPath = Join-Path $backendPath 'venv\Scripts\python.exe'
$uvicornPath = Join-Path $backendPath 'venv\Scripts\uvicorn.exe'
$listener = Get-NetTCPConnection -LocalPort 8000 -State Listen | Select-Object -First 1
if (-not $listener) { throw 'No existing backend listener found; refusing to change an unknown service.' }
$worker = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
if ($worker.CommandLine -notlike "*$uvicornPath*main:app*--port 8000*") { throw 'The listener is not this dashboard backend.' }
$launcher = Get-CimInstance Win32_Process -Filter "ProcessId=$($worker.ParentProcessId)"
if ($launcher -and $launcher.ExecutablePath -eq $pythonPath -and $launcher.CommandLine -like "*$uvicornPath*main:app*--port 8000*") {
    Stop-Process -Id $launcher.ProcessId -Force
}
Stop-Process -Id $worker.ProcessId -Force -ErrorAction SilentlyContinue
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outLog = Join-Path $backendPath "logs\marketing-$stamp.out.log"
$errLog = Join-Path $backendPath "logs\marketing-$stamp.err.log"
$started = Start-Process -FilePath $pythonPath -ArgumentList "`"$uvicornPath`" main:app --host 0.0.0.0 --port 8000" -WorkingDirectory $backendPath -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru
Write-Output "Backend restart started (process $($started.Id))."
for ($attempt = 0; $attempt -lt 15; $attempt++) {
    Start-Sleep -Seconds 1
    try {
        $schema = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/openapi.json' -TimeoutSec 2
        $endpoint = $schema.paths.'/api/seo-console/performance'.get
        $names = @($endpoint.parameters | ForEach-Object { $_.name })
        if ($names -contains 'start' -and $names -contains 'end') {
            Write-Output 'Backend ready: SEO performance accepts the shared start/end dates.'
            exit 0
        }
    } catch { }
}
throw "Backend readiness not confirmed yet. Inspect $errLog."
