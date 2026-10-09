# Dev-only: screenshot a page in headless Edge/Chrome.  shot.ps1 -Page ui.html -Query "save=orig&tab=1" -Out shot.png [-Dom]
param([string]$Page = 'ui.html', [string]$Query = '', [string]$Out = 'shot.png', [int]$W = 1300, [int]$H = 900, [switch]$Dom)
$e = @("C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", "C:\Program Files\Microsoft\Edge\Application\msedge.exe", "C:\Program Files\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$root = Split-Path -Parent $PSScriptRoot
$url = "file:///" + ($root -replace '\\', '/') + "/dev/$Page" + $(if ($Query) { "?$Query" } else { '' })
$tmp = Join-Path $env:TEMP ("mcse_prof_" + [guid]::NewGuid().ToString('N'))
if ($Dom) {
  & $e --headless=new --disable-gpu --user-data-dir="$tmp" --allow-file-access-from-files --virtual-time-budget=15000 --dump-dom $url 2>$null
} else {
  $outPath = Join-Path $root "dev\$Out"
  & $e --headless=new --disable-gpu --user-data-dir="$tmp" --allow-file-access-from-files --window-size=$W,$H --virtual-time-budget=15000 --screenshot="$outPath" $url 2>$null | Out-Null
  Write-Output $outPath
}
Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
