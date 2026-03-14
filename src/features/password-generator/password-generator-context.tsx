/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

export interface PasswordHistoryEntry {
  value: string
  createdAt: number
}

interface PasswordGeneratorContextValue {
  history: PasswordHistoryEntry[]
  latestPassword: string
  rememberPassword: (password: string) => void
  removeHistoryItem: (createdAt: number) => void
}

const PasswordGeneratorContext = createContext<PasswordGeneratorContextValue | null>(null)

export function PasswordGeneratorProvider({ children }: PropsWithChildren) {
  const [history, setHistory] = useState<PasswordHistoryEntry[]>([])
  const [latestPassword, setLatestPassword] = useState('')

  const rememberPassword = useCallback((password: string) => {
    const entry = { value: password, createdAt: Date.now() }

    setLatestPassword(password)
    setHistory((current) => [entry, ...current.filter((item) => item.value !== password)].slice(0, 5))
  }, [])

  const removeHistoryItem = useCallback((createdAt: number) => {
    setHistory((current) => current.filter((item) => item.createdAt !== createdAt))
  }, [])

  const value = useMemo<PasswordGeneratorContextValue>(
    () => ({
      history,
      latestPassword,
      rememberPassword,
      removeHistoryItem,
    }),
    [history, latestPassword, rememberPassword, removeHistoryItem],
  )

  return (
    <PasswordGeneratorContext.Provider value={value}>
      {children}
    </PasswordGeneratorContext.Provider>
  )
}

export function usePasswordGeneratorStore() {
  const context = useContext(PasswordGeneratorContext)
  if (!context) {
    throw new Error('usePasswordGeneratorStore 必须在 PasswordGeneratorProvider 内使用')
  }

  return context
}
