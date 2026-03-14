import { contextBridge, ipcRenderer } from 'electron'

import type {
  DecryptParams,
  ElectronApi,
  EncryptParams,
  EncryptionMode,
  ThemeMode,
} from '../src/shared/electron'

const electronApi: ElectronApi = {
  getAppMetadata: () => ipcRenderer.invoke('app:get-metadata'),
  getAgeInfo: () => ipcRenderer.invoke('age:get-info'),
  getTheme: () => ipcRenderer.invoke('settings:get-theme'),
  setTheme: (theme: ThemeMode) => ipcRenderer.invoke('settings:set-theme', theme),
  pickInputFiles: () => ipcRenderer.invoke('dialog:pick-input-files'),
  pickEncryptedFile: () => ipcRenderer.invoke('dialog:pick-encrypted-file'),
  pickIdentityFile: () => ipcRenderer.invoke('dialog:pick-identity-file'),
  pickOutputDirectory: () => ipcRenderer.invoke('dialog:pick-output-directory'),
  encrypt: (params: EncryptParams) => ipcRenderer.invoke('age:encrypt', params),
  decrypt: (params: DecryptParams) => ipcRenderer.invoke('age:decrypt', params),
  generateKeypair: () => ipcRenderer.invoke('age:generate-keypair'),
  saveSecretKey: (secretKey: string, suggestedName?: string) =>
    ipcRenderer.invoke('keys:save-secret-key', secretKey, suggestedName),
  checkFileExists: (filePath: string) => ipcRenderer.invoke('fs:check-file-exists', filePath),
  getEncryptedOutputPath: (inputPath: string, outputDir: string, mode: EncryptionMode) =>
    ipcRenderer.invoke('path:get-encrypted-output', inputPath, outputDir, mode),
  getDecryptedOutputPath: (inputPath: string, outputDir: string) =>
    ipcRenderer.invoke('path:get-decrypted-output', inputPath, outputDir),
  getAvailableOutputPath: (wantedPath: string) => ipcRenderer.invoke('path:get-available-output', wantedPath),
  showOverwriteConfirm: (existingPaths: string[]) =>
    ipcRenderer.invoke('dialog:show-overwrite-confirm', existingPaths),
}

contextBridge.exposeInMainWorld('electronAPI', electronApi)
