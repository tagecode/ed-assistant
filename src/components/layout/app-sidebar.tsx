import {
  Github,
  KeyRound,
  Lock,
  LockOpen,
  Mail,
  Settings,
  Sparkles,
  User,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navigationItems = [
  { to: '/password-generator', label: '生成密码', icon: Sparkles },
  { to: '/encrypt', label: '加密文件', icon: Lock },
  { to: '/decrypt', label: '解密文件', icon: LockOpen },
  { to: '/keys', label: '密钥管理', icon: KeyRound },
  { to: '/settings', label: '设置', icon: Settings },
]

export function AppSidebar() {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-6 rounded-3xl border border-border/60 bg-card/80 p-4 shadow-lg shadow-black/5 lg:w-72">
      <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
          ED Assistant
        </p>
        <h2 className="mt-2 text-xl font-semibold">文件加解密工具</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          基于{' '}
          <a
            href="https://github.com/FiloSottile/age"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
          >
            FiloSottile/age
          </a>{' '}
          二进制驱动的跨平台文件加解密桌面应用软件。
        </p>
      </div>

      <nav className="flex flex-col gap-2">
        {navigationItems.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  buttonVariants({ variant: isActive ? 'default' : 'ghost' }),
                  'justify-start rounded-xl px-4',
                )
              }
            >
              <Icon className="size-4" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-dashed border-border/60 bg-background/60 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground/90">
          <User className="size-3.5 shrink-0 text-muted-foreground" />
          TageCode
        </p>
        <div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground">
          <a
            href="mailto:tagecode@hotmail.com"
            className="flex items-center gap-2 transition-colors hover:text-foreground"
          >
            <Mail className="size-3.5 shrink-0" />
            tagecode@hotmail.com
          </a>
          <a
            href="https://github.com/tagecode"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 transition-colors hover:text-foreground"
          >
            <Github className="size-3.5 shrink-0" />
            github.com/tagecode
          </a>
        </div>
      </div>
    </aside>
  )
}
