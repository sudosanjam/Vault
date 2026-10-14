# Vault One-Click Setup Script (PowerShell)
# Automatically checks, installs, and configures all system requirements:
# 1. Python 3.10+ (auto-installs if missing via winget or official installer)
# 2. Node.js 18+ & npm (auto-installs if missing via winget or official MSI)
# 3. Python virtual environment in backend\venv
# 4. Backend dependencies from requirements.txt
# 5. Headless Chromium via Playwright for PDF export
# 6. Frontend dependencies via npm install
# 7. Production frontend bundle build via npm run build

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"

function Write-Step {
    param([string]$Message)
    Write-Host "`n>>> $Message" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Refresh-EnvironmentPath {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::Machine)
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)
    $combined = "$userPath;$machinePath"
    $env:Path = $combined
    return $combined
}

function Test-PythonExe {
    param([string]$ExePath)
    if (-not $ExePath) { return $null }
    try {
        $pinfo = New-Object System.Diagnostics.ProcessStartInfo
        $pinfo.FileName = $ExePath
        $pinfo.Arguments = "--version"
        $pinfo.RedirectStandardOutput = $true
        $pinfo.RedirectStandardError = $true
        $pinfo.UseShellExecute = $false
        $pinfo.CreateNoWindow = $true
        $proc = [System.Diagnostics.Process]::Start($pinfo)
        $output = $proc.StandardOutput.ReadToEnd()
        $errOut = $proc.StandardError.ReadToEnd()
        [void]$proc.WaitForExit(7000)
        $combined = ("$output $errOut").Trim()
        if ($combined -match "Python\s+3\.(\d+)") {
            $minor = [int]$Matches[1]
            if ($minor -ge 10) {
                return $combined
            }
        }
    } catch {}
    return $null
}

function Find-Python {
    # 1. Try python in current PATH
    $cmd = Get-Command "python.exe" -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) {
        if (Test-Path $cmd.Source) {
            $item = Get-Item $cmd.Source -ErrorAction SilentlyContinue
            if ($item -and $item.Length -gt 0) {
                $ver = Test-PythonExe -ExePath $cmd.Source
                if ($ver) {
                    return @{ Path = $cmd.Source; Version = $ver }
                }
            }
        }
    }

    # 2. Try py launcher
    $pyLauncher = Get-Command "py.exe" -ErrorAction SilentlyContinue
    if ($pyLauncher -and $pyLauncher.Source) {
        $ver = Test-PythonExe -ExePath $pyLauncher.Source
        if ($ver) {
            return @{ Path = $pyLauncher.Source; Version = $ver }
        }
    }

    # 3. Check standard Windows Python installation directories
    $localApp = $env:LOCALAPPDATA
    $progFiles = $env:ProgramFiles
    $progFilesX86 = ${env:ProgramFiles(x86)}

    $commonPatterns = @(
        "$localApp\Programs\Python\Python3*\python.exe",
        "$progFiles\Python3*\python.exe",
        "$progFilesX86\Python3*\python.exe",
        "C:\Python3*\python.exe"
    )
    foreach ($pattern in $commonPatterns) {
        $found = Get-Item $pattern -ErrorAction SilentlyContinue | Sort-Object Name -Descending
        foreach ($f in $found) {
            $ver = Test-PythonExe -ExePath $f.FullName
            if ($ver) {
                $pyDir = Split-Path -Parent $f.FullName
                $scriptsDir = Join-Path $pyDir "Scripts"
                $env:Path = "$pyDir;$scriptsDir;$($env:Path)"
                return @{ Path = $f.FullName; Version = $ver }
            }
        }
    }

    return $null
}

function Install-Python {
    Write-Warn "Python 3.10+ was not found on this system."
    Write-Info "Starting automatic one-click installation of Python 3.12..."

    $installed = $false

    # Attempt 1: winget
    $winget = Get-Command "winget.exe" -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Info "Installing Python 3.12 via Windows Package Manager (winget)..."
        try {
            $p = Start-Process -FilePath "winget.exe" -ArgumentList "install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements --silent" -Wait -PassThru -NoNewWindow
            if ($p.ExitCode -eq 0) {
                $installed = $true
            } else {
                Write-Warn "winget returned code $($p.ExitCode), falling back to official installer..."
            }
        } catch {
            Write-Warn "winget invocation failed, falling back to official installer..."
        }
    }

    # Attempt 2: Official python.org standalone installer download
    if (-not $installed) {
        $installerUrl = "https://www.python.org/ftp/python/3.12.9/python-3.12.9-amd64.exe"
        $tempInstaller = Join-Path $env:TEMP "python-3.12.9-amd64.exe"
        Write-Info "Downloading official Python installer from $installerUrl..."
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $installerUrl -OutFile $tempInstaller -UseBasicParsing
            Write-Info "Executing silent Python installation..."
            $p = Start-Process -FilePath $tempInstaller -ArgumentList "/quiet InstallAllUsers=0 PrependPath=1 Include_test=0" -Wait -PassThru
            Remove-Item $tempInstaller -Force -ErrorAction SilentlyContinue
            if ($p.ExitCode -eq 0) {
                $installed = $true
            } else {
                Write-Warn "Python installer returned code $($p.ExitCode)."
            }
        } catch {
            Write-Warn "Failed downloading official Python installer: $_"
        }
    }

    # Refresh environment PATH after installation
    Refresh-EnvironmentPath | Out-Null

    # Re-check for Python
    $py = Find-Python
    if ($py) {
        Write-Success "Python $($py.Version) installed successfully at $($py.Path)!"
        return $py
    }

    throw "Failed to install Python automatically. Please install Python 3.10+ manually from https://python.org."
}

function Test-NodeExe {
    param([string]$ExePath)
    if (-not $ExePath) { return $null }
    try {
        $pinfo = New-Object System.Diagnostics.ProcessStartInfo
        $pinfo.FileName = $ExePath
        $pinfo.Arguments = "-v"
        $pinfo.RedirectStandardOutput = $true
        $pinfo.RedirectStandardError = $true
        $pinfo.UseShellExecute = $false
        $pinfo.CreateNoWindow = $true
        $proc = [System.Diagnostics.Process]::Start($pinfo)
        $output = $proc.StandardOutput.ReadToEnd()
        [void]$proc.WaitForExit(5000)
        if ($proc.ExitCode -eq 0 -and $output -match "^v(\d+)") {
            $major = [int]$Matches[1]
            if ($major -ge 18) {
                return $output.Trim()
            }
        }
    } catch {}
    return $null
}

function Find-Node {
    # 1. Try node in PATH
    $cmd = Get-Command "node.exe" -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) {
        $ver = Test-NodeExe -ExePath $cmd.Source
        if ($ver) {
            return @{ Path = $cmd.Source; Version = $ver }
        }
    }

    # 2. Check standard directories
    $progFiles = $env:ProgramFiles
    $progFilesX86 = ${env:ProgramFiles(x86)}
    $localApp = $env:LOCALAPPDATA

    $commonPaths = @(
        "$progFiles\nodejs\node.exe",
        "$progFilesX86\nodejs\node.exe",
        "$localApp\Programs\nodejs\node.exe"
    )
    foreach ($p in $commonPaths) {
        if (Test-Path $p) {
            $ver = Test-NodeExe -ExePath $p
            if ($ver) {
                $nodeDir = Split-Path -Parent $p
                $appDataNpm = Join-Path $env:APPDATA "npm"
                $env:Path = "$nodeDir;$appDataNpm;$($env:Path)"
                return @{ Path = $p; Version = $ver }
            }
        }
    }

    return $null
}

function Install-Node {
    Write-Warn "Node.js (18+) was not found on this system."
    Write-Info "Starting automatic one-click installation of Node.js LTS..."

    $installed = $false

    # Attempt 1: winget
    $winget = Get-Command "winget.exe" -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Info "Installing Node.js LTS via Windows Package Manager (winget)..."
        try {
            $p = Start-Process -FilePath "winget.exe" -ArgumentList "install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent" -Wait -PassThru -NoNewWindow
            if ($p.ExitCode -eq 0) {
                $installed = $true
            } else {
                Write-Warn "winget returned code $($p.ExitCode), falling back to official MSI..."
            }
        } catch {
            Write-Warn "winget invocation failed, falling back to official MSI..."
        }
    }

    # Attempt 2: Official Node.js LTS MSI download
    if (-not $installed) {
        $nodeMsiUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
        $tempMsi = Join-Path $env:TEMP "node-v20.18.0-x64.msi"
        Write-Info "Downloading official Node.js LTS MSI from $nodeMsiUrl..."
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $nodeMsiUrl -OutFile $tempMsi -UseBasicParsing
            Write-Info "Executing silent Node.js installation (msiexec)..."
            $p = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$tempMsi`" /qn /norestart" -Wait -PassThru
            Remove-Item $tempMsi -Force -ErrorAction SilentlyContinue
            if ($p.ExitCode -eq 0) {
                $installed = $true
            } else {
                Write-Warn "msiexec returned code $($p.ExitCode)."
            }
        } catch {
            Write-Warn "Failed downloading official Node.js installer: $_"
        }
    }

    # Refresh environment PATH after installation
    Refresh-EnvironmentPath | Out-Null
    $appDataNpm = Join-Path $env:APPDATA "npm"
    $env:Path = "$($env:ProgramFiles)\nodejs;$appDataNpm;$($env:Path)"

    # Re-check for Node
    $node = Find-Node
    if ($node) {
        Write-Success "Node.js $($node.Version) installed successfully at $($node.Path)!"
        return $node
    }

    throw "Failed to install Node.js automatically. Please install Node.js LTS from https://nodejs.org."
}

function Find-Npm {
    $npmCmd = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
    if ($npmCmd -and $npmCmd.Source) {
        return $npmCmd.Source
    }
    $npm = Get-Command "npm" -ErrorAction SilentlyContinue
    if ($npm -and $npm.Source) {
        return $npm.Source
    }
    $standardNpm = Join-Path $env:ProgramFiles "nodejs\npm.cmd"
    if (Test-Path $standardNpm) {
        return $standardNpm
    }
    return "npm"
}

# ========================================================
# Main Setup Workflow
# ========================================================

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "         VAULT - One-Click Environment Setup            " -ForegroundColor Cyan
Write-Host "   Automated Requirement Verification & Installation    " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# Step 1: Detect / Install Python
Write-Step "Checking Python requirement (>= 3.10)..."
$pyInfo = Find-Python
if (-not $pyInfo) {
    $pyInfo = Install-Python
}
Write-Success "Python is ready: $($pyInfo.Path) (Version: $($pyInfo.Version))"
$GlobalPythonExe = $pyInfo.Path

# Step 2: Detect / Install Node.js & npm
Write-Step "Checking Node.js requirement (>= 18) and npm..."
$nodeInfo = Find-Node
if (-not $nodeInfo) {
    $nodeInfo = Install-Node
}
Write-Success "Node.js is ready: $($nodeInfo.Path) (Version: $($nodeInfo.Version))"
$NpmExe = Find-Npm
Write-Success "npm is ready: $NpmExe"

# Step 3: Python Virtual Environment Setup
Write-Step "Setting up Python virtual environment in backend\venv..."
$VenvDir = Join-Path $BackendDir "venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Info "Creating fresh virtualenv at $VenvDir..."
    if (Test-Path $VenvDir) {
        Remove-Item -Recurse -Force $VenvDir -ErrorAction SilentlyContinue
    }
    & $GlobalPythonExe -m venv $VenvDir
}

if (-not (Test-Path $VenvPython)) {
    throw "Failed to initialize Python virtualenv at $VenvPython"
}
Write-Success "Virtual environment Python is ready: $VenvPython"

Write-Step "Upgrading pip and installing backend dependencies..."
& $VenvPython -m pip install --upgrade pip --quiet
$ReqFile = Join-Path $BackendDir "requirements.txt"
& $VenvPython -m pip install -r $ReqFile --quiet
Write-Success "Backend Python dependencies installed successfully."

Write-Step "Ensuring Headless Chromium is installed for PDF rendering..."
& $VenvPython -m playwright install chromium
Write-Success "Playwright Chromium headless browser ready."

# Step 4: Frontend Dependencies & Production Build
Write-Step "Installing Frontend dependencies..."
Push-Location $FrontendDir
try {
    & $NpmExe install
    Write-Success "Frontend dependencies installed successfully."

    Write-Step "Compiling production frontend bundle..."
    & $NpmExe run build
    Write-Success "Frontend production assets compiled to frontend\dist."
} finally {
    Pop-Location
}

# Verify final build
$DistIndex = Join-Path $FrontendDir "dist\index.html"
if (-not (Test-Path $DistIndex)) {
    throw "Frontend build artifact dist\index.html was not generated. Please inspect build output."
}

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "       Vault One-Click Setup COMPLETED Successfully!   " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "You can now launch Vault at any time using:            " -ForegroundColor White
Write-Host "  - Windows Batch:      start.bat                      " -ForegroundColor Cyan
Write-Host "  - Windows PowerShell: .\start.ps1                    " -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Green
