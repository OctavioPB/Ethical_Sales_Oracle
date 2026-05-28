#Requires -Version 5.1
<#
.SYNOPSIS
    Ethical Sales Oracle -- dev stack launcher.
.DESCRIPTION
    Cleans conflicting ports, loads .env, verifies Docker, starts the full
    Compose stack, waits for every service to be healthy, then opens log
    windows for the API and dashboard containers and launches the browser.
.NOTES
    Run from the repo root:  .\demo.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---- Colour helpers ---------------------------------------------------------

function Write-Step { param([string]$msg) Write-Host "  >> $msg" -ForegroundColor Cyan   }
function Write-Ok   { param([string]$msg) Write-Host "  OK $msg" -ForegroundColor Green  }
function Write-Warn { param([string]$msg) Write-Host "  ** $msg" -ForegroundColor Yellow }
function Write-Fail { param([string]$msg) Write-Host "  !! $msg" -ForegroundColor Red    }

function Exit-Fail {
    param([string]$msg)
    Write-Fail $msg
    Read-Host "`nPress Enter to exit"
    exit 1
}

# ---- Constants --------------------------------------------------------------

$ROOT = $PSScriptRoot

# Ports used by this project (all served via Docker port mappings).
$ALL_PORTS = @(3001, 5173, 5432, 9092)

# Process name fragments that belong to Docker Desktop's own networking stack.
# Any PID whose executable name matches one of these strings is skipped.
$DOCKER_PROC_FRAGMENTS = @(
    'com.docker.backend',
    'docker desktop',
    'dockerd',
    'docker-proxy',
    'vpnkit',
    'wslhost'
)

# Containers that expose a Docker health-check, in start-up dependency order.
# Values are per-container timeouts in seconds.
$HEALTH_CONTAINERS = [ordered]@{
    'ethical_sales_oracle-postgres'  = 90
    'ethical_sales_oracle-zookeeper' = 90
    'ethical_sales_oracle-kafka'     = 180
    'ethical_sales_oracle-api'       = 120
}

# ---- Banner -----------------------------------------------------------------

Write-Host ''
Write-Host '  Ethical Sales Oracle -- dev launcher' -ForegroundColor White
Write-Host '  =====================================' -ForegroundColor DarkGray
Write-Host ''

# ---- 1. Load .env -----------------------------------------------------------

Write-Step 'Loading environment variables from .env'

$envFile = Join-Path $ROOT '.env'
if (Test-Path $envFile) {
    $loaded = 0
    foreach ($line in Get-Content $envFile) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
        $eqIdx = $trimmed.IndexOf('=')
        if ($eqIdx -le 0) { continue }

        $key = $trimmed.Substring(0, $eqIdx).Trim()
        $val = $trimmed.Substring($eqIdx + 1).Trim()

        # Strip a matching pair of surrounding single or double quotes
        if ($val.Length -ge 2) {
            $first = $val[0]
            $last  = $val[$val.Length - 1]
            if (($first -eq '"'  -and $last -eq '"') -or
                ($first -eq "'" -and $last -eq "'")) {
                $val = $val.Substring(1, $val.Length - 2)
            }
        }

        [System.Environment]::SetEnvironmentVariable($key, $val, 'Process')
        $loaded++
    }
    Write-Ok "$loaded variable(s) loaded from .env"
} else {
    Write-Warn '.env not found -- using existing environment (copy .env.example to .env to configure)'
}

# ---- 2. Check Docker --------------------------------------------------------

Write-Step 'Verifying Docker daemon'

docker version 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Exit-Fail 'Docker daemon is not responding. Start Docker Desktop and retry.'
}
Write-Ok 'Docker daemon is running'

# ---- 3. Find Python ---------------------------------------------------------

Write-Step 'Locating Python interpreter'

$pythonExe = $null
$candidates = @(
    (Join-Path $ROOT '.venv\Scripts\python.exe'),
    (Join-Path $ROOT 'venv\Scripts\python.exe')
)
foreach ($c in $candidates) {
    if (Test-Path $c) { $pythonExe = $c; break }
}
if (-not $pythonExe) {
    $sysPy = Get-Command python -ErrorAction SilentlyContinue
    if ($sysPy) { $pythonExe = $sysPy.Source }
}

if ($pythonExe) {
    Write-Ok "Python: $pythonExe"
} else {
    Write-Warn 'Python not found -- dev tooling (pytest, alembic) unavailable'
}

# ---- 4. Free conflicting ports ----------------------------------------------

$portList = $ALL_PORTS -join ', '
Write-Step "Checking ports $portList for conflicting processes"

foreach ($port in $ALL_PORTS) {
    # netstat -ano columns: Proto  Local Address  Foreign Address  State  PID
    $lines = netstat -ano 2>$null | Select-String "TCP\s+\S+:$port\s+\S+\s+LISTENING"
    foreach ($match in $lines) {
        $parts  = ($match.Line.Trim() -split '\s+')
        $rawPid = $parts[-1]
        if ($rawPid -notmatch '^\d+$') { continue }
        $procId = [int]$rawPid
        if ($procId -le 0) { continue }

        try {
            $proc = Get-Process -Id $procId -ErrorAction Stop
            $name = $proc.ProcessName.ToLower()

            $isDocker = $false
            foreach ($frag in $DOCKER_PROC_FRAGMENTS) {
                if ($name -like "*$($frag.ToLower())*") { $isDocker = $true; break }
            }

            if ($isDocker) {
                Write-Warn "Port $port held by Docker process '$($proc.ProcessName)' -- leaving it"
            } else {
                Write-Warn "Stopping '$($proc.ProcessName)' (PID $procId) on port $port"
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 300
            }
        } catch {
            # Process already gone -- nothing to do
        }
    }
}

Write-Ok 'Port cleanup done'

# ---- 5. docker compose up ---------------------------------------------------

Write-Step 'Starting Compose stack  (docker compose up -d --remove-orphans)'

Push-Location $ROOT
try {
    docker compose up -d --remove-orphans
    if ($LASTEXITCODE -ne 0) {
        Exit-Fail "docker compose up failed (exit $LASTEXITCODE). Run 'docker compose logs' for details."
    }
} finally {
    Pop-Location
}

Write-Ok 'Compose stack started'

# ---- 6. Wait for healthy containers -----------------------------------------

function Wait-ContainerHealthy {
    param(
        [string]$ContainerName,
        [int]$TimeoutSec
    )

    Write-Step "Waiting for $ContainerName  (timeout ${TimeoutSec}s)"
    $elapsed  = 0
    $interval = 5

    while ($elapsed -lt $TimeoutSec) {
        $status = docker inspect --format '{{.State.Health.Status}}' $ContainerName 2>$null |
                    Select-Object -First 1

        switch ($status) {
            'healthy'   { Write-Ok "$ContainerName is healthy";   return $true  }
            'unhealthy' { Write-Fail "$ContainerName is unhealthy"; return $false }
        }

        Start-Sleep -Seconds $interval
        $elapsed += $interval
        Write-Host "    $ContainerName -- $status  ($elapsed / ${TimeoutSec}s)" -ForegroundColor DarkGray
    }

    Write-Fail "$ContainerName did not become healthy within ${TimeoutSec}s"
    return $false
}

foreach ($entry in $HEALTH_CONTAINERS.GetEnumerator()) {
    if (-not (Wait-ContainerHealthy -ContainerName $entry.Key -TimeoutSec $entry.Value)) {
        Write-Warn "Tip: run 'docker compose logs $($entry.Key)' to see what went wrong"
        Exit-Fail "Aborting -- $($entry.Key) failed health check"
    }
}

# ---- 7. Database migrations -------------------------------------------------

# Schema is applied via SQL init scripts in infra/docker/postgres/init/ on
# first container creation (Docker runs them automatically).
# If alembic is added to the project this block will execute it.

if ($pythonExe) {
    $alembicExe = Join-Path (Split-Path $pythonExe -Parent) 'alembic.exe'
    if (Test-Path $alembicExe) {
        Write-Step 'Running database migrations  (alembic upgrade head)'
        Push-Location $ROOT
        try {
            & $alembicExe upgrade head
            if ($LASTEXITCODE -ne 0) {
                Write-Warn "alembic exited $LASTEXITCODE -- inspect output above before continuing"
            } else {
                Write-Ok 'Migrations applied'
            }
        } finally {
            Pop-Location
        }
    } else {
        Write-Ok 'No alembic found -- schema is managed by Postgres init scripts in Docker'
    }
} else {
    Write-Ok 'Skipping migration check (Python not available)'
}

# ---- Helper: open a command in a titled PowerShell window -------------------

function Open-Window {
    param(
        [string]$Title,
        [string]$Command
    )

    $fullCmd = "`$Host.UI.RawUI.WindowTitle = '$Title'; $Command; Read-Host 'Stream ended -- press Enter to close'"
    $bytes   = [System.Text.Encoding]::Unicode.GetBytes($fullCmd)
    $encoded = [Convert]::ToBase64String($bytes)

    Start-Process powershell.exe `
        -ArgumentList @('-NoExit', '-EncodedCommand', $encoded) `
        -WorkingDirectory $ROOT
}

# ---- 8. API log window ------------------------------------------------------

Write-Step 'Opening API log window'
Open-Window `
    -Title 'ESO -- API logs (ethical_sales_oracle-api)' `
    -Command "docker compose --project-directory `"$ROOT`" logs -f api"
Write-Ok 'API log window opened'

# ---- 9. Dashboard log window ------------------------------------------------

Write-Step 'Opening Dashboard log window'
Open-Window `
    -Title 'ESO -- Dashboard logs (ethical_sales_oracle-dashboard)' `
    -Command "docker compose --project-directory `"$ROOT`" logs -f dashboard"
Write-Ok 'Dashboard log window opened'

# ---- 10. Open browser -------------------------------------------------------

Write-Step 'Waiting 5 s for the dashboard container to initialise'
Start-Sleep -Seconds 5

Write-Step 'Opening browser -> http://localhost:5173'
Start-Process 'http://localhost:5173'

# ---- 11. Summary ------------------------------------------------------------

Write-Host ''
Write-Host '  +--------------------------------------------------+' -ForegroundColor DarkCyan
Write-Host '  |  Ethical Sales Oracle -- stack is up             |' -ForegroundColor DarkCyan
Write-Host '  +--------------------------------------------------+' -ForegroundColor DarkCyan
Write-Host '  |                                                  |' -ForegroundColor DarkCyan
Write-Host '  |  Dashboard     http://localhost:5173             |' -ForegroundColor Cyan
Write-Host '  |  API / health  http://localhost:3001/health      |' -ForegroundColor Cyan
Write-Host '  |  API / metrics http://localhost:3001/metrics     |' -ForegroundColor Cyan
Write-Host '  |  PostgreSQL    localhost:5432  (db: eso)         |' -ForegroundColor Cyan
Write-Host '  |  Kafka         localhost:9092                    |' -ForegroundColor Cyan
Write-Host '  |                                                  |' -ForegroundColor DarkCyan
Write-Host '  +--------------------------------------------------+' -ForegroundColor DarkCyan
Write-Host '  |  Useful commands:                                |' -ForegroundColor DarkGray
Write-Host '  |    docker compose logs -f                        |' -ForegroundColor DarkGray
Write-Host '  |    docker compose logs -f api                    |' -ForegroundColor DarkGray
Write-Host '  |    docker compose down                           |' -ForegroundColor DarkGray
Write-Host '  |    docker compose down -v   (wipe volumes)       |' -ForegroundColor DarkGray
Write-Host '  +--------------------------------------------------+' -ForegroundColor DarkCyan
Write-Host ''
