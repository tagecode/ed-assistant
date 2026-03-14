import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { app } from 'electron'

import type {
  AgeBinaryInfo,
  DecryptParams,
  DecryptResult,
  EncryptParams,
  EncryptResult,
  Keypair,
} from '../../src/shared/electron'
import type { AgeBinaryPaths, RunCommandOptions } from './types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function resolveDevelopmentBinDir(): string {
  const arch = process.arch === 'x64' || process.arch === 'arm64' ? process.arch : null
  if (!arch) {
    throw new Error(`当前开发环境不支持的架构：${process.arch}`)
  }

  return path.join(__dirname, '../resources/bin', process.platform, arch)
}

function resolveBinaryPaths(): AgeBinaryPaths {
  const binDir = app.isPackaged
    ? path.join(process.resourcesPath, 'bin')
    : resolveDevelopmentBinDir()

  const suffix = process.platform === 'win32' ? '.exe' : ''

  const agePath = path.join(binDir, `age${suffix}`)
  const keygenPath = path.join(binDir, `age-keygen${suffix}`)
  const batchpassPath = path.join(binDir, `age-plugin-batchpass${suffix}`)

  return {
    binDir,
    agePath,
    keygenPath,
    batchpassPath: fs.existsSync(batchpassPath) ? batchpassPath : null,
  }
}

function ensureFileExists(filePath: string, label: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} 不存在：${filePath}`)
  }
}

function buildEnv(binDir: string, extraEnv?: Record<string, string>) {
  return {
    ...process.env,
    ...extraEnv,
    PATH: [binDir, process.env.PATH].filter(Boolean).join(path.delimiter),
  }
}

function runCommand(
  file: string,
  args: string[],
  { fd3Input, extraEnv }: RunCommandOptions = {},
) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const paths = resolveBinaryPaths()
    const stdio: Array<'ignore' | 'pipe'> = fd3Input ? ['ignore', 'pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe']
    const child = spawn(file, args, {
      env: buildEnv(paths.binDir, extraEnv),
      stdio,
      windowsHide: true,
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []

    child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk))
    child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk))

    child.on('error', (error) => reject(error))
    child.on('close', (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim()
      const stderr = Buffer.concat(stderrChunks).toString('utf8').trim()

      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }

      reject(new Error(stderr || stdout || `${path.basename(file)} exited with code ${String(code)}`))
    })

    if (fd3Input) {
      const fd3 = child.stdio[3]
      if (fd3 && 'write' in fd3 && 'end' in fd3) {
        fd3.write(fd3Input)
        fd3.end()
      }
    }
  })
}

function toPassphraseBuffer(passphrase: string) {
  return Buffer.from(`${passphrase}\n`, 'utf8')
}

export function getEncryptedOutputPath(inputPath: string, outputDir: string, mode: 'passphrase' | 'pubkey') {
  const suffix = mode === 'passphrase' ? '.pwd.age' : '.key.age'
  return path.join(outputDir, `${path.basename(inputPath)}${suffix}`)
}

export function getDecryptedOutputPath(inputPath: string, outputDir: string) {
  const fileName = path.basename(inputPath)

  const knownSuffixes = ['.pwd.age', '.key.age', '.age']
  const matched = knownSuffixes.find((s) => fileName.endsWith(s))
  const outputName = matched
    ? fileName.slice(0, -matched.length) || 'decrypted'
    : `${fileName}.decrypted`

  return path.join(outputDir, outputName)
}

function ensureBatchpassAvailable(paths: AgeBinaryPaths) {
  if (!paths.batchpassPath) {
    throw new Error(
      '当前未找到 age-plugin-batchpass，无法使用密码模式。请重新执行下载脚本以安装完整的 age 二进制。',
    )
  }
}

function parseKeygenOutput(output: string, postQuantum: boolean): Keypair {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const publicKey =
    lines.find((line) => line.startsWith('Public key: '))?.replace('Public key: ', '') ??
    lines.find((line) => line.startsWith('# public key: '))?.replace('# public key: ', '')

  const secretKey = lines.find((line) => line.startsWith('AGE-SECRET-KEY'))

  if (!publicKey || !secretKey) {
    throw new Error('无法解析 age-keygen 输出内容')
  }

  return {
    publicKey,
    secretKey,
    postQuantum,
  }
}

export async function getAgeInfo(): Promise<AgeBinaryInfo> {
  const paths = resolveBinaryPaths()
  ensureFileExists(paths.agePath, 'age 二进制')
  ensureFileExists(paths.keygenPath, 'age-keygen 二进制')

  const { stdout } = await runCommand(paths.agePath, ['--version'])

  return {
    version: stdout,
    agePath: paths.agePath,
    keygenPath: paths.keygenPath,
    batchpassPath: paths.batchpassPath,
    batchpassAvailable: Boolean(paths.batchpassPath),
  }
}

export async function generateKeypair(postQuantum = false): Promise<Keypair> {
  const paths = resolveBinaryPaths()
  ensureFileExists(paths.keygenPath, 'age-keygen 二进制')

  const args = postQuantum ? ['-pq'] : []
  const { stdout } = await runCommand(paths.keygenPath, args)

  return parseKeygenOutput(stdout, postQuantum)
}

export async function encryptFiles(params: EncryptParams): Promise<EncryptResult> {
  const startedAt = Date.now()
  const paths = resolveBinaryPaths()
  ensureFileExists(paths.agePath, 'age 二进制')

  if (params.inputPaths.length === 0) {
    throw new Error('请选择至少一个待加密文件')
  }

  if (!params.outputDir) {
    throw new Error('请选择输出目录')
  }

  if (params.mode === 'passphrase' && !params.passphrase) {
    throw new Error('请输入加密口令')
  }

  if (params.mode === 'pubkey' && (!params.recipients || params.recipients.length === 0)) {
    throw new Error('请输入至少一个收件人公钥')
  }

  if (params.mode === 'passphrase') {
    ensureBatchpassAvailable(paths)
  }

  const outputs: EncryptResult['outputs'] = []
  const errors: EncryptResult['errors'] = []

  for (const inputPath of params.inputPaths) {
    const outputPath =
      params.outputPathOverrides?.[inputPath] ??
      getEncryptedOutputPath(inputPath, params.outputDir, params.mode)

    try {
      const args = ['-e']
      if (params.armor) {
        args.push('-a')
      }

      if (params.mode === 'passphrase') {
        args.push('-j', 'batchpass', '-o', outputPath, inputPath)
        await runCommand(paths.agePath, args, {
          extraEnv: { AGE_PASSPHRASE_FD: '3' },
          fd3Input: toPassphraseBuffer(params.passphrase!),
        })
      } else {
        const recipients = params.recipients?.map((recipient) => recipient.trim()).filter(Boolean) ?? []
        for (const recipient of recipients) {
          args.push('-r', recipient)
        }
        args.push('-o', outputPath, inputPath)
        await runCommand(paths.agePath, args)
      }

      outputs.push({ input: inputPath, output: outputPath })
    } catch (error) {
      errors.push({
        input: inputPath,
        message: error instanceof Error ? error.message : '加密失败',
      })
    }
  }

  return {
    success: errors.length === 0,
    outputs,
    errors,
    elapsedMs: Date.now() - startedAt,
  }
}

export async function decryptFile(params: DecryptParams): Promise<DecryptResult> {
  const startedAt = Date.now()
  const paths = resolveBinaryPaths()
  ensureFileExists(paths.agePath, 'age 二进制')

  if (!params.inputPath) {
    throw new Error('请选择待解密文件')
  }

  if (!params.outputDir) {
    throw new Error('请选择输出目录')
  }

  if (params.mode === 'passphrase' && !params.passphrase) {
    throw new Error('请输入解密口令')
  }

  if (params.mode === 'identity' && !params.identityPath) {
    throw new Error('请选择私钥文件')
  }

  if (params.mode === 'passphrase') {
    ensureBatchpassAvailable(paths)
  }

  const outputPath =
    params.outputPath ?? getDecryptedOutputPath(params.inputPath, params.outputDir)

  try {
    if (params.mode === 'passphrase') {
      await runCommand(paths.agePath, ['-d', '-j', 'batchpass', '-o', outputPath, params.inputPath], {
        extraEnv: { AGE_PASSPHRASE_FD: '3' },
        fd3Input: toPassphraseBuffer(params.passphrase!),
      })
    } else {
      await runCommand(paths.agePath, ['-d', '-i', params.identityPath!, '-o', outputPath, params.inputPath])
    }

    return {
      success: true,
      output: outputPath,
      elapsedMs: Date.now() - startedAt,
    }
  } catch (error) {
    return {
      success: false,
      output: outputPath,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : '解密失败',
    }
  }
}
