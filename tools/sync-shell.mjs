#!/usr/bin/env node
/**
 * 从上游仓库同步壳源码（native-windows/）到本仓库
 *
 * 用法：
 *   node tools/sync-shell.mjs --from ../ZhongYuToolBox_Web [--dry-run]
 *
 * 说明：本仓库的 native-windows/ 是上游同名目录的副本。上游改动了壳，
 *       跑一次本脚本即可同步；--dry-run 只报告差异、不写入。
 *       比较时会忽略 CRLF/LF 差异（换行风格不同不算改动）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function arg(name, fallback = null) {
  const i = process.argv.indexOf('--' + name)
  if (i === -1) return fallback
  const next = process.argv[i + 1]
  return next && !next.startsWith('--') ? next : true
}
const dryRun = process.argv.includes('--dry-run')
const from = path.resolve(arg('from', path.join(root, '..', 'ZhongYuToolBox_Web')))
const srcDir = path.join(from, 'native-windows')
const dstDir = path.join(root, 'native-windows')

if (!fs.existsSync(srcDir)) throw new Error('上游目录不存在：' + srcDir)
fs.mkdirSync(dstDir, { recursive: true })

const normalize = buf => buf.toString('utf8').replace(/\r\n/g, '\n')
const upstreamFiles = fs.readdirSync(srcDir, { withFileTypes: true })
  .filter(e => e.isFile())
  .map(e => e.name)

const added = []
const changed = []
const same = []

for (const name of upstreamFiles) {
  const srcPath = path.join(srcDir, name)
  const dstPath = path.join(dstDir, name)
  if (!fs.existsSync(dstPath)) {
    added.push(name)
    if (!dryRun) fs.copyFileSync(srcPath, dstPath)
    continue
  }
  const a = normalize(fs.readFileSync(srcPath))
  const b = normalize(fs.readFileSync(dstPath))
  if (a !== b) {
    changed.push(name)
    if (!dryRun) fs.copyFileSync(srcPath, dstPath)
  } else {
    same.push(name)
  }
}

const stale = fs.readdirSync(dstDir, { withFileTypes: true })
  .filter(e => e.isFile() && !upstreamFiles.includes(e.name))
  .map(e => e.name)

console.log(`上游：${srcDir}`)
console.log(`上游文件数：${upstreamFiles.length}`)
console.log(`  新增 ${added.length}${added.length ? '：' + added.join(', ') : ''}`)
console.log(`  更新 ${changed.length}${changed.length ? '：' + changed.join(', ') : ''}`)
console.log(`  未变 ${same.length}`)
if (stale.length) console.log(`  ⚠️ 本仓库多出（上游已无）：${stale.join(', ')}`)

if (dryRun) {
  console.log('\n--dry-run：未写入任何文件')
} else if (added.length || changed.length) {
  console.log('\n已同步，请在 GitHub Desktop 里查看 diff 并提交')
} else {
  console.log('\n已是最新，无需改动')
}
