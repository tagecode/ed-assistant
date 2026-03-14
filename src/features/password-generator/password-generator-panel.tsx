import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, Eye, EyeOff, RefreshCcw, WandSparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { usePasswordGeneratorStore } from '@/features/password-generator/password-generator-context'
import {
  defaultPasswordOptions,
  generatePassword,
  getEnabledCharsets,
  getPasswordStrength,
  type PasswordGeneratorOptions,
} from '@/features/password-generator/password-utils'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

interface PasswordGeneratorPanelProps {
  onUsePassword?: (password: string) => void
}

export function PasswordGeneratorPanel({ onUsePassword }: PasswordGeneratorPanelProps) {
  const { history, latestPassword, rememberPassword, removeHistoryItem } = usePasswordGeneratorStore()
  const [options, setOptions] = useState<PasswordGeneratorOptions>(defaultPasswordOptions)
  const [generatedPassword, setGeneratedPassword] = useState(() => {
    try {
      return latestPassword || generatePassword(defaultPasswordOptions)
    } catch {
      return ''
    }
  })
  const [showPassword, setShowPassword] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [copyMessage, setCopyMessage] = useState('复制密码')

  const strength = useMemo(() => getPasswordStrength(options), [options])
  const enabledCharsets = useMemo(() => getEnabledCharsets(options), [options])
  const availableCharacters = useMemo(
    () => Array.from(new Set(enabledCharsets.join('').split(''))).length,
    [enabledCharsets],
  )
  const canGenerate =
    enabledCharsets.length > 0 &&
    (!options.uniqueCharacters || options.length <= availableCharacters)

  async function handleCopy(password: string) {
    await copyText(password)
    setCopyMessage('已复制')
    window.setTimeout(() => setCopyMessage('复制密码'), 1500)
  }

  const handleGenerate = useCallback(() => {
    try {
      const nextPassword = generatePassword(options)
      setGeneratedPassword(nextPassword)
      rememberPassword(nextPassword)
      setStatusMessage('')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '生成失败')
    }
  }, [options, rememberPassword])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault()
        if (canGenerate) {
          handleGenerate()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [canGenerate, handleGenerate])

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <Card className="border-border/60 bg-background/70">
        <CardHeader>
          <CardTitle>随机密码生成器</CardTitle>
          <CardDescription>
            为加密口令或日常使用场景生成高强度随机密码，当前会话保留最近 5 条记录。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium">当前密码</label>
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Input
                  readOnly
                  value={showPassword ? generatedPassword : generatedPassword.replace(/./g, '•')}
                  className="pr-12 font-mono text-sm tracking-wide"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-muted-foreground"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <Button type="button" variant="outline" onClick={() => void handleCopy(generatedPassword)}>
                <Copy className="size-4" />
                {copyMessage}
              </Button>
              <Button type="button" onClick={handleGenerate} disabled={!canGenerate}>
                <RefreshCcw className="size-4" />
                重新生成
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span
                className={cn(
                  'rounded-full border px-3 py-1 font-medium',
                  strength.label === '弱' && 'border-destructive/40 text-destructive',
                  strength.label === '中' && 'border-yellow-500/40 text-yellow-600',
                  strength.label === '强' && 'border-primary/40 text-primary',
                  strength.label === '极强' && 'border-emerald-500/40 text-emerald-600',
                )}
              >
                强度：{strength.label}
              </span>
              <span className="text-muted-foreground">熵值估算：{strength.entropy.toFixed(1)} bits</span>
            </div>
            {statusMessage ? <p className="text-sm text-destructive">{statusMessage}</p> : null}
            {onUsePassword ? (
              <Button type="button" variant="secondary" onClick={() => onUsePassword(generatedPassword)}>
                <WandSparkles className="size-4" />
                使用此密码
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium">密码长度</span>
              <Input
                min={8}
                max={128}
                type="number"
                value={options.length}
                onChange={(event) =>
                  setOptions((current) => ({
                    ...current,
                    length: Number(event.target.value) || current.length,
                  }))
                }
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">特殊字符集</span>
              <Input
                value={options.customSymbols}
                onChange={(event) =>
                  setOptions((current) => ({ ...current, customSymbols: event.target.value }))
                }
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {[
              ['includeUppercase', '包含大写字母 A-Z'],
              ['includeLowercase', '包含小写字母 a-z'],
              ['includeNumbers', '包含数字 0-9'],
              ['includeSymbols', '包含特殊字符'],
              ['excludeAmbiguous', '排除易混淆字符'],
              ['uniqueCharacters', '排除重复字符'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={options[key as keyof PasswordGeneratorOptions] as boolean}
                  onChange={(event) =>
                    setOptions((current) => ({
                      ...current,
                      [key]: event.target.checked,
                    }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          {!canGenerate ? (
            <p className="text-sm text-destructive">
              请至少启用一类字符；若开启“排除重复字符”，密码长度不能超过当前字符池大小。
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-background/70">
        <CardHeader>
          <CardTitle>最近生成记录</CardTitle>
          <CardDescription>仅保存在当前应用会话内，关闭应用后会自动清空。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
              暂无历史记录
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.createdAt}
                className="rounded-xl border border-border/60 bg-card px-4 py-3"
              >
                <div className="break-all whitespace-pre-wrap font-mono text-sm">
                  {item.value}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void handleCopy(item.value)}>
                    复制
                  </Button>
                  {onUsePassword ? (
                    <Button type="button" size="sm" variant="secondary" onClick={() => onUsePassword(item.value)}>
                      使用
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeHistoryItem(item.createdAt)}
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
