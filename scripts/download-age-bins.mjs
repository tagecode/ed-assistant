#!/usr/bin/env node
/**
 * 下载 age / age-keygen 预编译二进制到 resources/bin/<platform>/<arch>/
 *
 * 用法：
 *   node scripts/download-age-bins.mjs            # 仅下载当前平台
 *   node scripts/download-age-bins.mjs --all      # 下载全部平台
 *   node scripts/download-age-bins.mjs --version v1.3.1  # 指定版本（默认 latest）
 */

import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BIN_DIR = path.join(ROOT, 'resources', 'bin')

// age 下载地址的平台/架构标识 → 本地目录结构
const TARGETS = [
  { ageOs: 'darwin', ageArch: 'arm64',  localDir: 'darwin/arm64',  ext: 'tar.gz' },
  { ageOs: 'darwin', ageArch: 'amd64',  localDir: 'darwin/x64',    ext: 'tar.gz' },
  { ageOs: 'windows', ageArch: 'amd64', localDir: 'win32/x64',     ext: 'zip'    },
  { ageOs: 'linux',  ageArch: 'amd64',  localDir: 'linux/x64',     ext: 'tar.gz' },
]

// 当前平台对应的 target
function currentTarget() {
  const p = process.platform  // darwin | win32 | linux
  const a = process.arch      // arm64 | x64
  const ageOs = p === 'win32' ? 'windows' : p
  const ageArch = a === 'x64' ? 'amd64' : a
  return TARGETS.find(t => t.ageOs === ageOs && t.ageArch === ageArch)
}

const args = process.argv.slice(2)
const downloadAll = args.includes('--all')
const versionIdx = args.indexOf('--version')
const version = versionIdx !== -1 ? args[versionIdx + 1] : 'latest'

const targets = downloadAll ? TARGETS : [currentTarget()].filter(Boolean)

if (targets.length === 0) {
  console.error('❌ 无法识别当前平台，请使用 --all 下载全部。')
  process.exit(1)
}

console.log(`\n📦 age 版本：${version}`)
console.log(`🎯 目标平台：${targets.map(t => `${t.ageOs}/${t.ageArch}`).join(', ')}\n`)

for (const target of targets) {
  await downloadTarget(target, version)
}

console.log('\n✅ 全部下载完成。\n')

// ─── 核心函数 ────────────────────────────────────────────────────────────────

async function downloadTarget(target, version) {
  const url = `https://dl.filippo.io/age/${version}?for=${target.ageOs}/${target.ageArch}`
  const outDir = path.join(BIN_DIR, target.localDir)
  const archivePath = path.join(outDir, `age.${target.ext}`)

  fs.mkdirSync(outDir, { recursive: true })

  console.log(`⬇️  ${target.ageOs}/${target.ageArch} — ${url}`)

  await download(url, archivePath)
  console.log(`   下载完成 → ${archivePath}`)

  extract(archivePath, outDir, target)

  const bins = fs.readdirSync(outDir).filter(f => f !== '.gitkeep')
  console.log(`   解压完成：${bins.join(', ')}\n`)
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)

    function get(targetUrl) {
      https.get(targetUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          get(res.headers.location)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} — ${targetUrl}`))
          return
        }
        res.pipe(file)
        file.on('finish', () => { file.close(); resolve() })
        file.on('error', reject)
      }).on('error', reject)
    }

    get(url)
  })
}

function extract(archivePath, outDir, target) {
  const isZip = target.ext === 'zip'

  if (isZip) {
    // Windows zip：使用 PowerShell 或 unzip
    try {
      execSync(
        `powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${outDir}' -Force"`,
        { stdio: 'pipe' }
      )
    } catch {
      execSync(`unzip -o "${archivePath}" -d "${outDir}"`, { stdio: 'pipe' })
    }
  } else {
    // macOS / Linux tar.gz
    execSync(`tar -xzf "${archivePath}" -C "${outDir}" --strip-components=1`, { stdio: 'pipe' })
  }

  // 先删除归档，再清理多余文件（避免归档被清理循环先删掉导致后续 rmSync ENOENT）
  fs.rmSync(archivePath, { force: true })

  // 清理 age 归档内自带的多余文件，只保留 MVP 需要的二进制
  const keep = new Set(
    target.ageOs === 'windows'
      ? ['age.exe', 'age-keygen.exe', 'age-plugin-batchpass.exe', '.gitkeep']
      : ['age', 'age-keygen', 'age-plugin-batchpass', '.gitkeep']
  )
  for (const f of fs.readdirSync(outDir)) {
    if (!keep.has(f)) {
      fs.rmSync(path.join(outDir, f), { recursive: true, force: true })
    }
  }

  // 确保 Unix 二进制有执行权限
  if (target.ageOs !== 'windows') {
    for (const bin of ['age', 'age-keygen', 'age-plugin-batchpass']) {
      const binPath = path.join(outDir, bin)
      if (fs.existsSync(binPath)) {
        fs.chmodSync(binPath, 0o755)
      }
    }
  }
}
