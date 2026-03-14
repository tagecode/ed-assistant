import { useState } from 'react'
import { Copy, Download, Eye, EyeOff, KeyRound, RefreshCcw } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { copyText } from '@/lib/clipboard'
import type { Keypair } from '@/shared/electron'

export function KeysPage() {
  const [keypair, setKeypair] = useState<Keypair | null>(null)
  const [running, setRunning] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [copyMessage, setCopyMessage] = useState<'public' | 'secret' | ''>('')
  const [saveMessage, setSaveMessage] = useState('')

  const isDesktop = Boolean(window.electronAPI)

  async function handleCopy(value: string, type: 'public' | 'secret') {
    await copyText(value)
    setCopyMessage(type)
    window.setTimeout(() => setCopyMessage(''), 1500)
  }

  async function handleGenerate() {
    if (!window.electronAPI) {
      setErrorMessage('请在 Electron 桌面环境中运行此功能。')
      return
    }

    setRunning(true)
    setErrorMessage('')
    setSaveMessage('')

    try {
      const nextKeypair = await window.electronAPI.generateKeypair()
      setKeypair(nextKeypair)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '生成密钥失败')
    } finally {
      setRunning(false)
    }
  }

  async function handleSaveSecretKey() {
    if (!window.electronAPI || !keypair) {
      return
    }

    try {
      const filePath = await window.electronAPI.saveSecretKey(keypair.secretKey, 'age-key.txt')
      setSaveMessage(filePath ? `私钥已保存到：${filePath}` : '已取消保存')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '保存私钥失败')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="密钥管理"
        description="生成 age X25519 密钥对，复制公钥，或将私钥安全地保存到本地文件。"
        actions={
          <Button type="button" onClick={() => void handleGenerate()} disabled={running || !isDesktop}>
            <RefreshCcw className="size-4" />
            {running ? '生成中...' : '生成新密钥对'}
          </Button>
        }
      />

      {!isDesktop ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
          当前不在 Electron 环境中，密钥生成与保存功能不可用。
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      {saveMessage ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
          {saveMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/60 bg-background/70">
          <CardHeader>
            <CardTitle>公钥</CardTitle>
            <CardDescription>可以发送给其他人，用于将文件加密给你。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              readOnly
              value={keypair?.publicKey ?? ''}
              placeholder="点击“生成新密钥对”后显示公钥"
              className="min-h-40 font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => keypair && void handleCopy(keypair.publicKey, 'public')}
              disabled={!keypair}
            >
              <Copy className="size-4" />
              {copyMessage === 'public' ? '已复制' : '复制公钥'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/70">
          <CardHeader>
            <CardTitle>私钥</CardTitle>
            <CardDescription>私钥请妥善保管，丢失后无法恢复已加密文件。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              readOnly
              value={
                keypair
                  ? showSecretKey
                    ? keypair.secretKey
                    : keypair.secretKey.replace(/./g, '•')
                  : ''
              }
              placeholder="点击“生成新密钥对”后显示私钥"
              className="min-h-40 font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setShowSecretKey((current) => !current)} disabled={!keypair}>
                {showSecretKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                {showSecretKey ? '隐藏私钥' : '显示私钥'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => keypair && void handleCopy(keypair.secretKey, 'secret')}
                disabled={!keypair}
              >
                <KeyRound className="size-4" />
                {copyMessage === 'secret' ? '已复制' : '复制私钥'}
              </Button>
              <Button type="button" onClick={() => void handleSaveSecretKey()} disabled={!keypair}>
                <Download className="size-4" />
                保存私钥文件
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
