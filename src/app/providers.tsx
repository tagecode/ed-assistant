import type { PropsWithChildren } from 'react'

import { ThemeProvider } from '@/app/theme-provider'
import { PasswordGeneratorProvider } from '@/features/password-generator/password-generator-context'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <PasswordGeneratorProvider>{children}</PasswordGeneratorProvider>
    </ThemeProvider>
  )
}
