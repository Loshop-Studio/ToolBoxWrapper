<#
.SYNOPSIS
    把便携版目录打成「免安装 zip」。

.DESCRIPTION
    零外部依赖：只用 Windows 自带的 PowerShell + .NET（System.IO.Compression），
    不需要 7-Zip、不需要 Node、不需要 Python。任何 Windows 10/11 机器上都能直接跑。

    产物结构：解压后得到 `中育工具箱-免安装版\` 目录，双击里面的 中育Toolbox.exe 即用。

    为什么不再打单文件 exe：
    老版 7zSD.sfx（2010）自解压时先把整包写进 %TEMP%，在受管/学校机器上经常写不进去，
    直接弹「Extraction Failed / Can not open output file」。zip 走系统自带解压器，不吃这个。

    兼容性说明：
    文件名由 .NET 以 UTF-8 写入并置 general purpose bit 11（0x0800），
    Windows 10+ 内置解压器 / 7-Zip / WinRAR / Bandizip 全都认，中文名不会乱码。
    只写文件条目、不写目录条目 —— 解压器会按路径自动建目录，少一个可能出错的点。

.PARAMETER InputDir
    要打包的目录（build-portable.mjs 的 --out 产物，默认 out）。相对路径按当前目录解析。

.PARAMETER OutFile
    输出 zip 路径。默认 dist-exe\中育工具箱-免安装版[-vX.Y.Z].zip

.PARAMETER Name
    zip 内的顶层目录名。默认取 OutFile 的文件名去掉 .zip。

.PARAMETER Version
    追加到输出文件名，并写一份 版本.txt 进包。

.PARAMETER Run
    校验用的启动程序名，默认 中育Toolbox.exe。

.PARAMETER Level
    0 = 只打包不压缩（最快），1-9 = deflate 压缩级别，默认 6。

.EXAMPLE
    pwsh -File tools\pack-zip.ps1 -Version 0.0.8
#>
[CmdletBinding()]
param(
  [string] $InputDir = 'out',
  [string] $OutFile = '',
  [string] $Name = '',
  [string] $Version = '',
  [string] $Run = '中育Toolbox.exe',
  [ValidateRange(0, 9)]
  [int] $Level = 6
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

# ---------- 解析路径 ----------
if (-not [System.IO.Path]::IsPathRooted($InputDir)) {
  $InputDir = Join-Path (Get-Location).Path $InputDir
}
$InputDir = [System.IO.Path]::GetFullPath($InputDir).TrimEnd('\', '/')

if (-not $Version) { $Version = '' }
$suffix = ''
if ($Version) { $suffix = '-v' + ($Version -replace '^[vV]', '') }
if (-not $OutFile) { $OutFile = Join-Path 'dist-exe' ('中育工具箱-免安装版' + $suffix + '.zip') }
if (-not [System.IO.Path]::IsPathRooted($OutFile)) {
  $OutFile = Join-Path (Get-Location).Path $OutFile
}
$OutFile = [System.IO.Path]::GetFullPath($OutFile)
if (-not $Name) { $Name = [System.IO.Path]::GetFileNameWithoutExtension($OutFile) }

if (-not (Test-Path -LiteralPath $InputDir -PathType Container)) {
  throw "输入目录不存在：$InputDir"
}
$runPath = Join-Path $InputDir $Run
if (-not (Test-Path -LiteralPath $runPath -PathType Leaf)) {
  throw "输入目录里找不到 $Run ：$InputDir"
}
if ($Name -match '[\\/:*?"<>|]') {
  throw "顶层目录名含非法字符：$Name"
}

Write-Host "  输入目录：$InputDir"
Write-Host "  顶层目录名：$Name   压缩级别：$Level"

# ---------- 收集文件（排除本地残留） ----------
$skipNames = @('Thumbs.db', 'desktop.ini', '.DS_Store')
$files = @(
  Get-ChildItem -LiteralPath $InputDir -Recurse -File |
    Where-Object {
      $skipNames -notcontains $_.Name -and
      $_.Name -notlike '*.log' -and
      $_.Name -notlike '*.tmp' -and
      $_.Name -notlike '*.bak*'
    } |
    Sort-Object FullName
)
Write-Host "  共 $($files.Count) 个文件"

# ---------- 打包 ----------
Add-Type -AssemblyName 'System.IO.Compression.FileSystem'
$level = if ($Level -le 0) {
  [System.IO.Compression.CompressionLevel]::NoCompression
} else {
  [System.IO.Compression.CompressionLevel]::Optimal
}

$outDir = [System.IO.Path]::GetDirectoryName($OutFile)
if ($outDir -and -not (Test-Path -LiteralPath $outDir)) {
  New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}
if (Test-Path -LiteralPath $OutFile) { Remove-Item -LiteralPath $OutFile -Force }

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$zip = [System.IO.Compression.ZipFile]::Open($OutFile, 'Create')
try {
  foreach ($f in $files) {
    $rel = $f.FullName.Substring($InputDir.Length).TrimStart('\', '/') -replace '\\', '/'
    $entryName = "$Name/$rel"
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $entryName, $level)
  }
  if ($Version) {
    $entry = $zip.CreateEntry("$Name/版本.txt", $level)
    $text = "中育工具箱 · 免安装版`n版本：$Version`n用法：解压本压缩包，双击 $Run`n"
    $writer = New-Object System.IO.StreamWriter($entry.Open(), (New-Object System.Text.UTF8Encoding($false)))
    try { $writer.Write($text) } finally { $writer.Dispose() }
  }
}
finally {
  $zip.Dispose()
}
$sw.Stop()

# ---------- 报告 ----------
$info = Get-Item -LiteralPath $OutFile
$hash = (Get-FileHash -LiteralPath $OutFile -Algorithm SHA256).Hash
$mb = [math]::Round($info.Length / 1MB, 2)

Write-Host ''
Write-Host "完成：$OutFile"
Write-Host "大小：$mb MB（$($files.Count) 个文件，耗时 $([math]::Round($sw.Elapsed.TotalSeconds,1))s）"
Write-Host "SHA256：$hash"
Write-Host "解压后双击：$Name\$Run"
