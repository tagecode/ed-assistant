#!/usr/bin/env node
/**
 * 下载 age / age-keygen 预编译二进制到 resources/bin/<platform>/<arch>/
 *
 * 用法：
 *   node scripts/download-age-bins.mjs            # 仅下载当前平台
 *   node scripts/download-age-bins.mjs --all      # 下载全部平台
 *   node scripts/download-age-bins.mjs --version v1.3.1  # 指定版本（默认 latest）
 *
 * 兼容性：Windows (zip)、macOS / Linux (tar.gz)。解压后统一按「递归查找目标二进制
 * → 移到 outDir → 只保留目标文件」处理，不依赖归档内是否带顶层目录，避免误删。
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
process.exit(0)

// ─── 核心函数 ────────────────────────────────────────────────────────────────

/** 在 dir 下递归查找名为 binNames 的文件路径（兼容任意层级目录结构） */
function findBinPaths(dir, binNames) {
  const found = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isFile() && binNames.includes(e.name)) {
      found.push(full)
    } else if (e.isDirectory()) {
      found.push(...findBinPaths(full, binNames))
    }
  }
  return found
}

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
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
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
    // Windows zip：PowerShell 优先（原生），失败时回退到 unzip（Git Bash 等）
    const arc = archivePath.replace(/'/g, "''")
    const dest = outDir.replace(/'/g, "''")
    try {
      execSync(
        `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${arc}' -DestinationPath '${dest}' -Force"`,
        { stdio: 'pipe' }
      )
    } catch {
      execSync(`unzip -o "${archivePath}" -d "${outDir}"`, { stdio: 'pipe' })
    }
  } else {
    // macOS / Linux tar.gz：不假设顶层结构，解压到 outDir 后由统一逻辑处理
    execSync(`tar -xzf "${archivePath}" -C "${outDir}"`, { stdio: 'pipe' })
  }

  // 先删除归档，再统一整理与清理（避免归档被清理循环删掉导致 ENOENT）
  fs.rmSync(archivePath, { force: true })

  // 三平台统一：无论 zip/tar.gz 是「根目录即二进制」还是「带一层版本目录」，都先收集再清理，避免误删
  const expectedBinNames = target.ageOs === 'windows'
    ? ['age.exe', 'age-keygen.exe', 'age-plugin-batchpass.exe']
    : ['age', 'age-keygen', 'age-plugin-batchpass']

  // 递归收集所有目标二进制路径（兼容单层目录、多层目录、根目录即文件）。
  // 为避免 outDir/age/age 这类「目录与二进制同名」导致的自删/ENOENT，
  // 采用“两阶段搬运”：先全部挪到 staging，再清理 outDir，最后再搬回根目录。
  const binPaths = findBinPaths(outDir, expectedBinNames)
  const stageName = `.__stage_${Date.now()}`
  const stageDir = path.join(outDir, stageName)
  fs.mkdirSync(stageDir, { recursive: true })

  // 先把找到的二进制统一挪到 staging（同名覆盖）
  for (const binPath of binPaths) {
    if (!fs.existsSync(binPath)) continue
    const staged = path.join(stageDir, path.basename(binPath))
    if (fs.existsSync(staged)) fs.rmSync(staged, { recursive: true, force: true })
    fs.renameSync(binPath, staged)
  }

  // 清空 outDir（保留 .gitkeep 与 staging 目录本身）
  for (const name of fs.readdirSync(outDir)) {
    if (name === '.gitkeep' || name === stageName) continue
    fs.rmSync(path.join(outDir, name), { recursive: true, force: true })
  }

  // 再从 staging 搬回 outDir 根目录
  for (const name of fs.readdirSync(stageDir)) {
    const dest = path.join(outDir, name)
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true })
    fs.renameSync(path.join(stageDir, name), dest)
  }
  fs.rmSync(stageDir, { recursive: true, force: true })

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
