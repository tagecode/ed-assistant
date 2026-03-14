import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppProviders } from '@/app/providers'
import { AppShell } from '@/components/app-shell'
import { DecryptPage } from '@/features/decrypt/decrypt-page'
import { EncryptPage } from '@/features/encrypt/encrypt-page'
import { KeysPage } from '@/features/keys/keys-page'
import { PasswordGeneratorPage } from '@/features/password-generator/password-generator-page'
import { SettingsPage } from '@/features/settings/settings-page'

export function AppRouter() {
  return (
    <AppProviders>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/password-generator" replace />} />
            <Route path="/password-generator" element={<PasswordGeneratorPage />} />
            <Route path="/encrypt" element={<EncryptPage />} />
            <Route path="/decrypt" element={<DecryptPage />} />
            <Route path="/keys" element={<KeysPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/password-generator" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProviders>
  )
}
