import { useState } from 'react'
import { Eye, EyeOff, FolderOpen, KeyRound, LockOpen } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DecryptResult } from '@/shared/electron'

type DecryptMode = 'passphrase' | 'identity'
const decryptModeOptions = [
  { value: 'passphrase' as const, label: '口令解密', icon: LockOpen },
  { value: 'identity' as const, label: '私钥解密', icon: KeyRound },
]

export function DecryptPage() {
  const [inputPath, setInputPath] = useState('')
  const [outputDir, setOutputDir] = useState('')
  const [mode, setMode] = useState<DecryptMode>('passphrase')
  const [passphrase, setPassphrase] = useState('')
  const [showPassphrase, setShowPassphrase] = useState(false)
  const [identityPath, setIdentityPath] = useState('')
  const [running, setRunning] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [result, setResult] = useState<DecryptResult | null>(null)

  const isDesktop = Boolean(window.electronAPI)

  async function handlePickFile() {
    const filePath = await window.electronAPI?.pickEncryptedFile()
    if (filePath) {
      setInputPath(filePath)
      setErrorMessage('')
    }
  }

  async function handlePickIdentity() {
    const filePath = await window.electronAPI?.pickIdentityFile()
    if (filePath) {
      setIdentityPath(filePath)
      setErrorMessage('')
    }
  }

  async function handlePickOutputDir() {
    const directory = await window.electronAPI?.pickOutputDirectory()
    if (directory) {
      setOutputDir(directory)
      setErrorMessage('')
    }
  }

  async function handleDecrypt() {
    if (!window.electronAPI) {
      setErrorMessage('请在 Electron 桌面环境中运行此功能。')
      return
    }

    if (!inputPath || !outputDir) {
      setErrorMessage('请先选择待解密文件和输出目录。')
      return
    }

    if (mode === 'passphrase' && !passphrase) {
      setErrorMessage('请输入解密口令。')
      return
    }

    if (mode === 'identity' && !identityPath) {
      setErrorMessage('请选择私钥文件。')
      return
    }

    setRunning(true)
    setErrorMessage('')

    try {
      const api = window.electronAPI
      const defaultOutputPath = await api.getDecryptedOutputPath(inputPath, outputDir)
      let outputPath: string | undefined
      if (await api.checkFileExists(defaultOutputPath)) {
        const choice = await api.showOverwriteConfirm([defaultOutputPath])
        outputPath = choice === 'rename' ? await api.getAvailableOutputPath(defaultOutputPath) : undefined
      }

      const nextResult = await api.decrypt({
        inputPath,
        outputDir,
        mode,
        passphrase: mode === 'passphrase' ? passphrase : undefined,
        identityPath: mode === 'identity' ? identityPath : undefined,
        outputPath,
      })

      setResult(nextResult)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '解密失败')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="文件解密"
        description="对 `.age` 文件进行还原，MVP 支持口令模式与 age 私钥文件模式。"
      />

      {!isDesktop ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
          当前不在 Electron 环境中，文件选择和解密操作不可用。
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/60 bg-background/70">
          <CardHeader>
            <CardTitle>解密参数</CardTitle>
            <CardDescription>选择待解密文件、解密方式与输出目录。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
              <label className="space-y-2 text-sm">
                <span className="font-medium">待解密文件</span>
                <div className="flex gap-3">
                  <Input readOnly value={inputPath} placeholder="请选择 .age 文件" />
                  <Button type="button" variant="outline" onClick={() => void handlePickFile()} disabled={!isDesktop}>
                    <FolderOpen className="size-4" />
                    浏览
                  </Button>
                </div>
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {decryptModeOptions.map(({ value, label, icon: Icon }) => {
                  const isActive = mode === value

                  return (
                    <Button
                      key={value}
                      type="button"
                      variant={isActive ? 'default' : 'outline'}
                      onClick={() => setMode(value as DecryptMode)}
                    >
                      <Icon className="size-4" />
                      {label}
                    </Button>
                  )
                })}
              </div>

              {mode === 'passphrase' ? (
                <div className="rounded-2xl border border-border/60 bg-card p-4">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">解密口令</span>
                    <div className="relative">
                      <Input
                        type={showPassphrase ? 'text' : 'password'}
                        value={passphrase}
                        onChange={(event) => setPassphrase(event.target.value)}
                        placeholder="输入对应口令"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => setShowPassphrase((v) => !v)}
                      >
                        {showPassphrase ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                      </button>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">私钥文件</span>
                    <div className="flex gap-3">
                      <Input readOnly value={identityPath} placeholder="请选择 age 私钥文件" />
                      <Button type="button" variant="outline" onClick={() => void handlePickIdentity()} disabled={!isDesktop}>
                        选择
                      </Button>
                    </div>
                  </label>
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
              <label className="space-y-2 text-sm">
                <span className="font-medium">输出目录</span>
                <div className="flex gap-3">
                  <Input readOnly value={outputDir} placeholder="请选择输出目录" />
                  <Button type="button" variant="outline" onClick={() => void handlePickOutputDir()} disabled={!isDesktop}>
                    选择目录
                  </Button>
                </div>
              </label>
            </div>

            {errorMessage ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}

            <Button type="button" className="w-full" onClick={() => void handleDecrypt()} disabled={running || !isDesktop}>
              {running ? '正在解密...' : '开始解密'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/70">
          <CardHeader>
            <CardTitle>执行结果</CardTitle>
            <CardDescription>展示输出文件路径、状态与耗时。</CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4">
                <div
                  className={cn(
                    'rounded-xl border px-4 py-3 text-sm',
                    result.success
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700'
                      : 'border-destructive/30 bg-destructive/5 text-destructive',
                  )}
                >
                  {result.success ? '解密成功' : '解密失败'}，耗时 {formatDuration(result.elapsedMs)}
                </div>
                <div className="rounded-xl border border-border/60 bg-card px-4 py-3 text-sm">
                  <div className="font-medium">{result.output}</div>
                  <div className="mt-1 text-muted-foreground">
                    {result.success ? '输出文件路径' : result.error}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
                尚未执行解密操作。
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
