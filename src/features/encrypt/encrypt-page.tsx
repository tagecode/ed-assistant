import { useMemo, useState } from 'react'
import { Copy, Eye, EyeOff, FolderOpen, KeyRound, Lock, RefreshCcw, WandSparkles } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PasswordGeneratorPanel } from '@/features/password-generator/password-generator-panel'
import {
  defaultPasswordOptions,
  generatePassword,
  getPassphraseStrength,
} from '@/features/password-generator/password-utils'
import { formatDuration } from '@/lib/format'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/utils'
import type { EncryptResult } from '@/shared/electron'

type EncryptMode = 'passphrase' | 'pubkey'
const encryptModeOptions = [
  { value: 'passphrase' as const, label: '口令模式', icon: Lock },
  { value: 'pubkey' as const, label: '公钥模式', icon: KeyRound },
]

export function EncryptPage() {
  const [inputPaths, setInputPaths] = useState<string[]>([])
  const [outputDir, setOutputDir] = useState('')
  const [mode, setMode] = useState<EncryptMode>('passphrase')
  const [passphrase, setPassphrase] = useState('')
  const [showPassphrase, setShowPassphrase] = useState(false)
  const [recipientText, setRecipientText] = useState('')
  const [running, setRunning] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [result, setResult] = useState<EncryptResult | null>(null)
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [passphraseCopyMessage, setPassphraseCopyMessage] = useState('')

  const passphraseStrength = useMemo(() => getPassphraseStrength(passphrase), [passphrase])

  const recipients = useMemo(
    () => recipientText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    [recipientText],
  )

  const isDesktop = Boolean(window.electronAPI)

  async function handlePickFiles() {
    const files = await window.electronAPI?.pickInputFiles()
    if (files && files.length > 0) {
      setInputPaths(files)
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

  async function handleEncrypt() {
    if (!window.electronAPI) {
      setErrorMessage('请在 Electron 桌面环境中运行此功能。')
      return
    }

    if (inputPaths.length === 0 || !outputDir) {
      setErrorMessage('请先选择待加密文件和输出目录。')
      return
    }

    if (mode === 'passphrase' && !passphrase) {
      setErrorMessage('请输入加密口令。')
      return
    }

    if (mode === 'pubkey' && recipients.length === 0) {
      setErrorMessage('请输入至少一个 age 公钥。')
      return
    }

    setRunning(true)
    setErrorMessage('')

    try {
      const api = window.electronAPI
      const outputPaths = await Promise.all(
        inputPaths.map((p) => api.getEncryptedOutputPath(p, outputDir, mode)),
      )
      const existingPaths: string[] = []
      for (let i = 0; i < outputPaths.length; i++) {
        if (await api.checkFileExists(outputPaths[i])) {
          existingPaths.push(outputPaths[i])
        }
      }

      let outputPathOverrides: Record<string, string> | undefined
      if (existingPaths.length > 0) {
        const choice = await api.showOverwriteConfirm(existingPaths)
        if (choice === 'rename') {
          outputPathOverrides = {}
          for (let i = 0; i < outputPaths.length; i++) {
            if (await api.checkFileExists(outputPaths[i])) {
              outputPathOverrides[inputPaths[i]] = await api.getAvailableOutputPath(outputPaths[i])
            }
          }
        }
      }

      const nextResult = await api.encrypt({
        inputPaths,
        outputDir,
        mode,
        passphrase: mode === 'passphrase' ? passphrase : undefined,
        recipients: mode === 'pubkey' ? recipients : undefined,
        outputPathOverrides,
      })

      setResult(nextResult)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '加密失败')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="文件加密"
        description="使用口令或 age 公钥对文件进行加密，支持口令模式与多行公钥输入。"
      />

      {!isDesktop ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
          当前不在 Electron 环境中，文件选择和加密操作不可用。
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="min-w-0 border-border/60 bg-background/70">
          <CardHeader>
            <CardTitle>加密参数</CardTitle>
            <CardDescription>先选择文件与输出目录，再决定使用口令还是公钥模式。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={() => void handlePickFiles()} disabled={!isDesktop}>
                  <FolderOpen className="size-4" />
                  选择文件
                </Button>
                <span className="text-sm text-muted-foreground">已选 {inputPaths.length} 个文件</span>
              </div>
              <div className="space-y-2">
                {inputPaths.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
                    还没有选择文件
                  </div>
                ) : (
                  inputPaths.map((filePath) => (
                    <div
                      key={filePath}
                      className="truncate rounded-xl border border-border/60 bg-card px-4 py-3 text-sm"
                    >
                      {filePath}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {encryptModeOptions.map(({ value, label, icon: Icon }) => {
                  const isActive = mode === value

                  return (
                    <Button
                      key={value}
                      type="button"
                      variant={isActive ? 'default' : 'outline'}
                      onClick={() => setMode(value as EncryptMode)}
                    >
                      <Icon className="size-4" />
                      {label}
                    </Button>
                  )
                })}
              </div>

              {mode === 'passphrase' ? (
                <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">加密口令</span>
                    <div className="relative">
                      <Input
                        type={showPassphrase ? 'text' : 'password'}
                        value={passphrase}
                        onChange={(event) => setPassphrase(event.target.value)}
                        placeholder="输入用于加密的口令"
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
                    {passphrase.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span
                          className={cn(
                            'rounded-full border px-3 py-1 font-medium',
                            passphraseStrength.label === '弱' && 'border-destructive/40 text-destructive',
                            passphraseStrength.label === '中' && 'border-yellow-500/40 text-yellow-600',
                            passphraseStrength.label === '强' && 'border-primary/40 text-primary',
                            passphraseStrength.label === '极强' && 'border-emerald-500/40 text-emerald-600',
                          )}
                        >
                          强度：{passphraseStrength.label}
                        </span>
                        <span className="text-muted-foreground">
                          熵值估算：{passphraseStrength.entropy.toFixed(1)} bits
                        </span>
                      </div>
                    ) : null}
                  </label>
                  <div className="flex flex-wrap gap-2 pt-4 mt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        try {
                          const generated = generatePassword(defaultPasswordOptions)
                          setPassphrase(generated)
                          setShowPassphrase(true)
                          void copyText(generated).then(() => {
                            setPassphraseCopyMessage('已生成并已复制')
                            window.setTimeout(() => setPassphraseCopyMessage(''), 2000)
                          })
                        } catch {
                          setErrorMessage('自动生成口令失败')
                        }
                      }}
                    >
                      <RefreshCcw className="size-4" />
                      自动生成口令
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setGeneratorOpen(true)}>
                      <WandSparkles className="size-4" />
                      从密码生成器填入
                    </Button>
                    {passphrase && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void copyText(passphrase).then(() => {
                            setPassphraseCopyMessage('已复制')
                            window.setTimeout(() => setPassphraseCopyMessage(''), 1500)
                          })
                        }
                      >
                        <Copy className="size-4" />
                        {passphraseCopyMessage || '复制口令'}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-4">
                  <label className="text-sm font-medium">收件人公钥</label>
                  <Textarea
                    value={recipientText}
                    onChange={(event) => setRecipientText(event.target.value)}
                    placeholder="每行一个 age1... 公钥"
                    className="min-h-36 font-mono text-xs"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    当前支持 age 原生公钥（age1...）；SSH 密钥与多收件人管理将在后续版本补充。
                  </p>
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

            <Button type="button" className="w-full" onClick={() => void handleEncrypt()} disabled={running || !isDesktop}>
              {running ? '正在加密...' : '开始加密'}
            </Button>
          </CardContent>
        </Card>

        <Card className="min-w-0 border-border/60 bg-background/70">
          <CardHeader>
            <CardTitle>执行结果</CardTitle>
            <CardDescription>展示已完成输出、失败明细与本次总耗时。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result ? (
              <>
                <div
                  className={cn(
                    'rounded-xl border px-4 py-3 text-sm',
                    result.success
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700'
                      : 'border-yellow-500/30 bg-yellow-500/5 text-yellow-700',
                  )}
                >
                  完成 {result.outputs.length} 个，失败 {result.errors.length} 个，耗时 {formatDuration(result.elapsedMs)}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">输出文件</h3>
                  {result.outputs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">暂无成功输出。</p>
                  ) : (
                    result.outputs.map((item) => (
                      <div key={item.output} className="rounded-xl border border-border/60 bg-card px-4 py-3 text-sm">
                        <div className="break-all font-medium">{item.output}</div>
                        <div className="mt-1 break-all text-muted-foreground">来源：{item.input}</div>
                      </div>
                    ))
                  )}
                </div>

                {result.errors.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">失败明细</h3>
                    {                    result.errors.map((item) => (
                      <div key={item.input} className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                        <div className="break-all font-medium">{item.input}</div>
                        <div className="mt-1">{item.message}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
                尚未执行加密操作。
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={generatorOpen} onOpenChange={setGeneratorOpen}>
        <DialogContent className="flex max-h-[90vh] w-[90vw] max-w-7xl sm:max-w-7xl flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>选择口令</DialogTitle>
            <DialogDescription>生成满意的随机密码后，点击“使用此密码”自动填入加密口令框。</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <PasswordGeneratorPanel
              onUsePassword={(password) => {
                setPassphrase(password)
                setGeneratorOpen(false)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
