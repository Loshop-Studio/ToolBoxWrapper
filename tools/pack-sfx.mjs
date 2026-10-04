#!/usr/bin/env node
/**
 * 把便携版目录打成「单文件免安装 exe」（7-Zip 自解压包）
 *
 * 原理：7zSD.sfx  +  sfx-config.txt  +  payload.7z  →  拼接成一个 exe
 * 运行行为：解压到临时目录 → 启动 中育Toolbox.exe → 程序退出后自动清理临时目录
 *
 * 用法：
 *   node tools/pack-sfx.mjs --input <便携版目录> [选项]
 *
 * 选项：
 *   --input <dir>    要打包的目录（build-portable.mjs 的 --out 产物）
 *   --out <file>     输出的 exe 路径（默认 dist-exe/中育工具箱（新版免安装）.exe）
 *   --title <text>   自解压窗口标题（默认 中育Toolbox）
 *   --run <file>     解压后要启动的程序（默认 中育Toolbox.exe）
 *
 * 依赖：7-Zip（自动探测 C:\Program Files\7-Zip\7z.exe，或用环境变量 Z7_PATH 指定）
 * 关键约束：必须用 LZMA1（老版 7zSD.sfx 不认 LZMA2）
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

const inputDir = path.resolve(arg('input', path.join(root, 'out')))
const outFile = path.resolve(arg('out', path.join(root, 'dist-exe', '中育工具箱（新版免安装）.exe')))
const title = arg('title', '中育Toolbox')
const runProgram = arg('run', '中育Toolbox.exe')

const sfx = path.join(root, 'vendor/7zSD.sfx')
const log = m => console.log('  ' + m)

function find7z() {
  const candidates = [
    process.env.Z7_PATH,
    'C:\\Program Files\\7-Zip\\7z.exe',
    'C:\\Program Files (x86)\\7-Zip\\7z.exe',
  ].filter(Boolean)
  for (const c of candidates) if (fs.existsSync(c)) return c
  try {
    execFileSync('7z', ['i'], { stdio: 'ignore', windowsHide: true })
    return '7z'
  } catch { /* 继续 */ }
  throw new Error('找不到 7z.exe：请安装 7-Zip，或设置环境变量 Z7_PATH')
}

if (!fs.existsSync(sfx)) throw new Error('缺少自解压模块：' + sfx)
if (!fs.existsSync(path.join(inputDir, runProgram))) {
  throw new Error(`输入目录里找不到 ${runProgram}：${inputDir}`)
}

const z7 = find7z()
log('使用 7-Zip：' + z7)

const work = path.join(root, '.local')
fs.mkdirSync(work, { recursive: true })
const payload = path.join(work, 'payload.7z')
const cfg = path.join(work, 'sfx-config.txt')

// ---------- 1. 压缩载荷（必须 LZMA1） ----------
if (fs.existsSync(payload)) fs.rmSync(payload)
log('正在压缩（可能要 1~3 分钟）...')
execFileSync(z7, ['a', '-t7z', payload, '*', '-m0=lzma', '-mx=9', '-y'],
  { cwd: inputDir, stdio: 'inherit' })
log(`压缩完成：${(fs.statSync(payload).size / 1048576).toFixed(2)} MB`)

// ---------- 2. 自解压配置（UTF-8 无 BOM） ----------
fs.writeFileSync(cfg,
  ';!@Install@!UTF-8!\r\n' +
  `Title="${title}"\r\n` +
  'Progress="no"\r\n' +
  `RunProgram="${runProgram}"\r\n` +
  ';!@InstallEnd@!\r\n', 'utf8')

// ---------- 3. 拼接成单文件 ----------
const parts = [sfx, cfg, payload]
const bufs = parts.map(p => fs.readFileSync(p))
const total = bufs.reduce((n, b) => n + b.length, 0)
fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, Buffer.concat(bufs))

console.log(`\n完成：${outFile}`)
console.log(`大小：${(total / 1048576).toFixed(2)} MB`)
