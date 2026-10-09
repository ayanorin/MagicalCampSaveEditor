# Regenerates data/gamedata.js from the game's Game.rgss3a.
# Usage:  powershell -ExecutionPolicy Bypass -File tools\build-data.ps1 -Game "C:\path\to\MagicalCamp_0.5_Fin_bugfix_8c"
# Only needed by the developer. End users just open index.html.
param(
  [Parameter(Mandatory = $true)][string]$Game
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$arc = Join-Path $Game 'Game.rgss3a'
if (-not (Test-Path $arc)) { throw "Game.rgss3a not found in $Game" }
$out = Join-Path $root 'data\gamedata.js'
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
Add-Type -Path (Join-Path $PSScriptRoot 'MarshalReader.cs'), (Join-Path $PSScriptRoot 'Exporter.cs') -ReferencedAssemblies System.dll
[Exporter]::Run($arc, $out)
