import { useEffect, useState } from 'react'
import { MonitorCog, MoonStar, SunMedium } from 'lucide-react'

import { useTheme } from '@/app/theme-provider'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { AgeBinaryInfo, AppMetadata, ThemeMode } from '@/shared/electron'

const themeOptions: Array<{ label: string; value: ThemeMode }> = [
  { label: '跟随系统', value: 'system' },
  { label: '浅色模式', value: 'light' },
  { label: '深色模式', value: 'dark' },
]

export function SettingsPage() {
  const { isDesktop, theme, setTheme } = useTheme()
  const [metadata, setMetadata] = useState<AppMetadata | null>(null)
  const [ageInfo, setAgeInfo] = useState<AgeBinaryInfo | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let mounted = true

    async function loadDesktopInfo() {
      if (!window.electronAPI) {
        return
      }

      try {
        const [nextMetadata, nextAgeInfo] = await Promise.all([
          window.electronAPI.getAppMetadata(),
          window.electronAPI.getAgeInfo(),
        ])

        if (!mounted) {
          return
        }

        setMetadata(nextMetadata)
        setAgeInfo(nextAgeInfo)
      } catch (error) {
        if (!mounted) {
          return
        }

        setErrorMessage(error instanceof Error ? error.message : '读取运行时信息失败')
      }
    }

    void loadDesktopInfo()

    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="设置"
        description="管理主题偏好，并查看当前应用版本、Electron 运行时和 age 二进制状态。"
      />

      {!isDesktop ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
          当前不在 Electron 环境中，仅可预览基础界面。
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-border/60 bg-background/70">
          <CardHeader>
            <CardTitle>主题</CardTitle>
            <CardDescription>切换亮色、暗色或跟随系统主题，并持久化到本地设置。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {themeOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={theme === option.value ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => void setTheme(option.value)}
              >
                {option.value === 'system' ? (
                  <MonitorCog className="size-4" />
                ) : option.value === 'light' ? (
                  <SunMedium className="size-4" />
                ) : (
                  <MoonStar className="size-4" />
                )}
                {option.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/70">
          <CardHeader>
            <CardTitle>运行时信息</CardTitle>
            <CardDescription>用于确认当前 Electron 环境与 age 二进制是否正确接入。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[
              { label: '应用版本', value: metadata?.version ?? '未读取' },
              { label: 'Electron', value: metadata?.electron ?? '未读取' },
              { label: 'Chromium', value: metadata?.chromium ?? '未读取' },
              { label: 'Node.js', value: metadata?.node ?? '未读取' },
              { label: '平台', value: metadata ? `${metadata.platform} / ${metadata.arch}` : '未读取' },
              { label: 'age 版本', value: ageInfo?.version ?? '未读取' },
              { label: 'batchpass 插件', value: ageInfo?.batchpassAvailable ? '已安装' : '未安装' },
              { label: 'age 路径', value: ageInfo?.agePath ?? '未读取' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border/60 bg-card px-4 py-3">
                <div className="text-sm text-muted-foreground">{item.label}</div>
                <div className="mt-1 break-all text-sm font-medium">{item.value}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
