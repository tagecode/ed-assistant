import { Outlet } from 'react-router-dom'

import { AppSidebar } from '@/components/layout/app-sidebar'
import { useTheme } from '@/app/theme-provider'

export function AppShell() {
  const { ready } = useTheme()

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-sm text-muted-foreground">
        正在加载应用设置...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-6 px-4 py-4 lg:flex-row lg:px-6 lg:py-6">
        <AppSidebar />
        <main className="min-w-0 flex-1 rounded-3xl border border-border/60 bg-card/80 p-6 shadow-lg shadow-black/5 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
