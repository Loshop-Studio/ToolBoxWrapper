#!/usr/bin/env node
/**
 * 编译 C# 壳 + 组装 WebView2 便携版目录
 *
 * 用法：
 *   node tools/build-portable.mjs --dist <前端产物目录> [选项]
 *
 * 选项：
 *   --dist <dir>              前端 Vite 产物目录（必须含 index.html）
 *   --out <dir>               输出目录（默认 ./out）
 *   --licenses-from <dir>     上游 node_modules 路径，用于收集第三方许可证（可选）
 *   --icon <file>             替代图标（默认 assets/icon.ico）
 *   --webview2-version <ver>  WebView2 SDK 版本（默认 1.0.4258.31）
 *   --skip-self-test          跳过编译后的自检
 *
 * 产物：out/ 目录 = 免安装便携版的完整文件夹（中育Toolbox.exe + 依赖 + dist/）
 *
 * 注意：本脚本必须在 Windows 上运行，且需要 .NET Framework 4.x 自带的 csc.exe。
 *       在受管沙箱（禁止调用 C# 编译器）内无法执行，请在普通终端或 CI 中运行。
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function arg(name, fallback = null) {
  const i = process.argv.indexOf('--' + name)
  if (i === -1) return fallback
  const next = process.argv[i + 1]
  return next && !next.startsWith('--') ? next : true
}
const flag = name => process.argv.includes('--' + name)

const distDir = path.resolve(arg('dist', path.join(root, 'dist')))
const outDir = path.resolve(arg('out', path.join(root, 'out')))
const licensesFrom = arg('licenses-from', null)
const iconFile = path.resolve(arg('icon', path.join(root, 'assets/icon.ico')))
const sdkVersion = arg('webview2-version', '1.0.4258.31')
const skipSelfTest = flag('skip-self-test')

const log = m => console.log('  ' + m)
const fail = m => { throw new Error(m) }

if (process.platform !== 'win32') fail('编译 C# 壳只能在 Windows 上执行')
if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  fail(`前端产物不完整，找不到 index.html：${distDir}`)
}

// ---------- 1. WebView2 SDK（缓存到 .local/webview2） ----------
const sdk = path.join(root, '.local', 'webview2')
if (!fs.existsSync(path.join(sdk, 'lib/net462/Microsoft.Web.WebView2.Wpf.dll'))) {
  log(`下载 WebView2 SDK ${sdkVersion} ...`)
  fs.mkdirSync(sdk, { recursive: true })
  const nupkg = path.join(root, '.local', `webview2-${sdkVersion}.nupkg`)
  const url = `https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/${sdkVersion}/microsoft.web.webview2.${sdkVersion}.nupkg`
  const res = await fetch(url)
  if (!res.ok) fail(`WebView2 SDK 下载失败：HTTP ${res.status}`)
  fs.writeFileSync(nupkg, new Uint8Array(await res.arrayBuffer()))
  const q = v => "'" + String(v).replaceAll("'", "''") + "'"
  execFileSync('powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command',
      `Expand-Archive -LiteralPath ${q(nupkg)} -DestinationPath ${q(sdk)} -Force`],
    { stdio: 'inherit', windowsHide: true })
}
log('WebView2 SDK 就绪')

// ---------- 2. 编译 C# 壳 ----------
const framework = path.join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319')
const csc = path.join(framework, 'csc.exe')
if (!fs.existsSync(csc)) fail(`找不到 C# 编译器（需要 .NET Framework 4.x）：${csc}`)
if (!fs.existsSync(iconFile)) fail(`找不到图标文件：${iconFile}`)

fs.mkdirSync(outDir, { recursive: true })
const exe = path.join(outDir, '中育Toolbox.exe')
const refs = [
  'System.dll', 'System.Core.dll', 'System.Web.Extensions.dll', 'System.Net.Http.dll',
  'System.Xaml.dll', 'WPF/WindowsBase.dll', 'WPF/PresentationCore.dll', 'WPF/PresentationFramework.dll',
].map(f => '/reference:' + path.join(framework, f))
refs.push(...['Core', 'Wpf'].map(f => '/reference:' + path.join(sdk, `lib/net462/Microsoft.Web.WebView2.${f}.dll`)))

log('编译 native-windows/Program.cs ...')
execFileSync(csc, [
  '/nologo', '/target:winexe', '/platform:x64', '/optimize+', '/codepage:65001',
  '/out:' + exe,
  '/win32manifest:' + path.join(root, 'native-windows/app.manifest'),
  '/win32icon:' + iconFile,
  ...refs,
  path.join(root, 'native-windows/Program.cs'),
], { stdio: 'inherit' })

// ---------- 3. 组装运行所需文件 ----------
for (const name of ['Core', 'Wpf']) {
  fs.copyFileSync(path.join(sdk, `lib/net462/Microsoft.Web.WebView2.${name}.dll`),
    path.join(outDir, `Microsoft.Web.WebView2.${name}.dll`))
}
fs.copyFileSync(path.join(sdk, 'runtimes/win-x64/native/WebView2Loader.dll'),
  path.join(outDir, 'WebView2Loader.dll'))
fs.copyFileSync(path.join(root, 'native-windows/bridge.js'), path.join(outDir, 'bridge.js'))
fs.copyFileSync(path.join(root, 'native-windows/App.exe.config'), exe + '.config')
log('已组装壳运行时文件')

function copyDir(source, destination) {
  fs.mkdirSync(destination, { recursive: true })
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name)
    const to = path.join(destination, entry.name)
    if (entry.isDirectory()) copyDir(from, to)
    else fs.copyFileSync(from, to)
  }
}
copyDir(distDir, path.join(outDir, 'dist'))
log('已复制前端产物 → out/dist')

// ---------- 4. 许可证 ----------
const licDir = path.join(outDir, 'LICENSES')
fs.mkdirSync(licDir, { recursive: true })
fs.copyFileSync(path.join(sdk, 'LICENSE.txt'), path.join(licDir, 'WebView2-LICENSE.txt'))
fs.copyFileSync(path.join(sdk, 'NOTICE.txt'), path.join(licDir, 'WebView2-NOTICE.txt'))
if (licensesFrom && fs.existsSync(licensesFrom)) {
  let count = 0
  for (const name of ['vue', 'pinia', 'element-plus', 'pdf-lib', 'pdfjs-dist', 'html2canvas',
    'katex', 'crypto-js', 'jszip', 'ali-oss', 'mp4-muxer']) {
    const dir = path.join(licensesFrom, name)
    if (!fs.existsSync(dir)) continue
    for (const file of fs.readdirSync(dir).filter(f => /^(license|notice)(\.|$)/i.test(f))) {
      const full = path.join(dir, file)
      if (fs.statSync(full).isFile()) {
        fs.copyFileSync(full, path.join(licDir, `${name}-${file}`))
        count++
      }
    }
  }
  log(`已收集 ${count} 份第三方许可证`)
} else {
  log('未提供 --licenses-from，跳过第三方许可证收集（仅含 WebView2）')
}

// ---------- 5. 自检 ----------
if (skipSelfTest) {
  log('已跳过 self-test')
} else {
  log('运行 self-test ...')
  execFileSync(exe, ['--self-test'], { windowsHide: true })
  log('self-test 通过')
}

fs.mkdirSync(path.join(root, '.local'), { recursive: true })
fs.writeFileSync(path.join(root, '.local', 'latest-portable-build.json'),
  JSON.stringify({ exe, outDir, distDir, webview2: sdkVersion, builtAt: new Date().toISOString() }, null, 2))

console.log(`\n完成：${outDir}`)
