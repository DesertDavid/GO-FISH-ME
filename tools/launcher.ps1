# Reel World launcher (run by "Play Reel World.bat"). Starts the game server hidden, opens
# the game in its own app window (no tabs or address bar), and when that window is closed,
# stops the server again.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$port = if ($env:REELWORLD_PORT) { $env:REELWORLD_PORT } else { '5200' }
$url = "http://localhost:$port"
Set-Location $root

function Test-Up {
  try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 $url | Out-Null; return $true } catch { return $false }
}

# a browser that can open an app window: Edge ships with Windows; Chrome works too
$browser = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

# start the server unless one is already running
$server = $null
if (-not (Test-Up)) {
  $server = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "npx vite --port $port --strictPort" -WorkingDirectory $root -WindowStyle Hidden -PassThru
  $deadline = (Get-Date).AddSeconds(60)
  while (-not (Test-Up)) {
    if ((Get-Date) -gt $deadline -or $server.HasExited) {
      Add-Type -AssemblyName PresentationFramework
      [System.Windows.MessageBox]::Show('Reel World could not start its game server. Try running "Play Reel World.bat" again.', 'Reel World') | Out-Null
      if (-not $server.HasExited) { & taskkill /PID $server.Id /T /F | Out-Null }
      exit 1
    }
    Start-Sleep -Milliseconds 300
  }
}

if ($browser) {
  # its own browser profile, so the game window is a separate process we can wait on (and
  # your normal browser windows are never touched). Game saves live in this profile.
  $profileDir = Join-Path $env:LOCALAPPDATA $(if ($port -eq '5200') { 'ReelWorld\window' } else { "ReelWorld\window-$port" })
  New-Item -ItemType Directory -Force $profileDir | Out-Null
  $flags = @(
    "--app=$url", "--user-data-dir=`"$profileDir`"", '--window-size=1600,900',
    '--no-first-run', '--no-default-browser-check', '--disable-features=Translate,msEdgeMouseGestureSupported,msEdgeMouseGestureDefaultEnabled',
    # a clean game window: no synced browser add-ons (ad blockers, popouts...) running inside it
    '--disable-extensions', '--disable-sync'
  )
  Start-Process -FilePath $browser -ArgumentList $flags | Out-Null
  # wait until no browser process is using the game's profile (the window was closed); the
  # first process can hand off to another, so watch the profile rather than one process
  $exe = Split-Path -Leaf $browser
  Start-Sleep -Seconds 3
  while (Get-CimInstance Win32_Process -Filter "Name='$exe'" | Where-Object { $_.CommandLine -like "*$profileDir*" }) {
    Start-Sleep -Seconds 1
  }
} else {
  # no app-window browser found: open a normal tab and keep the server until this is closed
  Start-Process $url
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show('Reel World is open in your browser. Click OK when you are done playing to stop the game.', 'Reel World') | Out-Null
}

if ($server -and -not $server.HasExited) { & taskkill /PID $server.Id /T /F | Out-Null }
