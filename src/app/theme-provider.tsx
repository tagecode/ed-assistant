/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

import type { ThemeMode } from '@/shared/electron'

interface ThemeContextValue {
  isDesktop: boolean
  ready: boolean
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const shouldUseDark = theme === 'dark' || (theme === 'system' && prefersDark)

  root.classList.toggle('dark', shouldUseDark)
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<ThemeMode>('system')
  const [ready, setReady] = useState(false)
  const isDesktop = Boolean(window.electronAPI)

  const setTheme = useCallback(
    async (nextTheme: ThemeMode) => {
      setThemeState(nextTheme)
      applyTheme(nextTheme)

      if (window.electronAPI) {
        await window.electronAPI.setTheme(nextTheme)
      }
    },
    [],
  )

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      if (!window.electronAPI) {
        applyTheme('system')
        if (mounted) {
          setReady(true)
        }
        return
      }

      const savedTheme = await window.electronAPI.getTheme()
      if (!mounted) {
        return
      }

      setThemeState(savedTheme)
      applyTheme(savedTheme)
      setReady(true)
    }

    void bootstrap()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleThemeChange = () => {
      setThemeState((current) => {
        if (current === 'system') {
          applyTheme('system')
        }

        return current
      })
    }

    mediaQuery.addEventListener('change', handleThemeChange)

    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange)
    }
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      isDesktop,
      ready,
      theme,
      setTheme,
    }),
    [isDesktop, ready, setTheme, theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme 必须在 ThemeProvider 内使用')
  }

  return context
}
