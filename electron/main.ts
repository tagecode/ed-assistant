import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import Store from 'electron-store'

import {
  decryptFile,
  encryptFiles,
  generateKeypair,
  getAgeInfo,
  getDecryptedOutputPath,
  getEncryptedOutputPath,
} from './age/runner'
import type {
  DecryptParams,
  EncryptParams,
  ThemeMode,
} from '../src/shared/electron'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rendererDistPath = path.join(__dirname, '../dist/index.html')

const settingsStore = new Store<{ theme: ThemeMode }>({
  defaults: {
    theme: 'system',
  },
})

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1040,
    minHeight: 720,
    title: 'ED Assistant',
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#050815',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL)
    window.once('ready-to-show', () => {
      window.show()
    })
    return window
  }

  void window.loadFile(rendererDistPath)
  window.once('ready-to-show', () => {
    window.show()
  })
  return window
}

function getMainWindow() {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

async function pickInputFiles() {
  const result = await dialog.showOpenDialog(getMainWindow() ?? undefined, {
    title: '选择待加密文件',
    properties: ['openFile', 'multiSelections'],
  })

  return result.canceled ? [] : result.filePaths
}

async function pickEncryptedFile() {
  const result = await dialog.showOpenDialog(getMainWindow() ?? undefined, {
    title: '选择待解密文件',
    properties: ['openFile'],
    filters: [
      { name: 'age 加密文件', extensions: ['age'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  })

  return result.canceled ? null : result.filePaths[0] ?? null
}

async function pickIdentityFile() {
  const result = await dialog.showOpenDialog(getMainWindow() ?? undefined, {
    title: '选择私钥文件',
    properties: ['openFile'],
  })

  return result.canceled ? null : result.filePaths[0] ?? null
}

async function pickOutputDirectory() {
  const result = await dialog.showOpenDialog(getMainWindow() ?? undefined, {
    title: '选择输出目录',
    properties: ['openDirectory', 'createDirectory'],
  })

  return result.canceled ? null : result.filePaths[0] ?? null
}

async function saveSecretKey(secretKey: string, suggestedName = 'age-key.txt') {
  const result = await dialog.showSaveDialog(getMainWindow() ?? undefined, {
    title: '保存私钥文件',
    defaultPath: path.join(app.getPath('documents'), suggestedName),
    filters: [{ name: '文本文件', extensions: ['txt'] }],
  })

  if (result.canceled || !result.filePath) {
    return null
  }

  await fsp.writeFile(result.filePath, `${secretKey}\n`, 'utf8')
  if (process.platform !== 'win32') {
    await fsp.chmod(result.filePath, 0o600)
  }

  return result.filePath
}

function checkFileExists(filePath: string): boolean {
  return fs.existsSync(filePath)
}

/** 返回首个不存在的路径：原路径存在则尝试 前缀_1.后缀、前缀_2.后缀 … */
function getAvailableOutputPath(wantedPath: string): string {
  if (!fs.existsSync(wantedPath)) {
    return wantedPath
  }

  const dir = path.dirname(wantedPath)
  const base = path.basename(wantedPath)
  const lastDot = base.lastIndexOf('.')
  const ext = lastDot >= 0 ? base.slice(lastDot) : ''
  const prefix = lastDot >= 0 ? base.slice(0, lastDot) : base

  for (let n = 1; ; n++) {
    const candidate = path.join(dir, `${prefix}_${n}${ext}`)
    if (!fs.existsSync(candidate)) {
      return candidate
    }
  }
}

async function showOverwriteConfirm(existingPaths: string[]): Promise<'overwrite' | 'rename'> {
  const names = existingPaths.map((p) => path.basename(p)).join('\n')
  const result = await dialog.showMessageBox(getMainWindow() ?? undefined, {
    type: 'question',
    title: '文件已存在',
    message: '以下文件在输出目录中已存在，是否覆盖？',
    detail: names,
    buttons: ['覆盖', '自动重命名'],
    defaultId: 1,
    cancelId: 1,
  })

  return result.response === 0 ? 'overwrite' : 'rename'
}

app.whenReady().then(() => {
  ipcMain.handle('app:get-metadata', () => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
  }))

  ipcMain.handle('settings:get-theme', () => settingsStore.get('theme'))
  ipcMain.handle('settings:set-theme', (_event, theme: ThemeMode) => {
    settingsStore.set('theme', theme)
    return theme
  })
  ipcMain.handle('age:get-info', async () => getAgeInfo())
  ipcMain.handle('dialog:pick-input-files', async () => pickInputFiles())
  ipcMain.handle('dialog:pick-encrypted-file', async () => pickEncryptedFile())
  ipcMain.handle('dialog:pick-identity-file', async () => pickIdentityFile())
  ipcMain.handle('dialog:pick-output-directory', async () => pickOutputDirectory())
  ipcMain.handle('fs:check-file-exists', (_event, filePath: string) => Promise.resolve(checkFileExists(filePath)))
  ipcMain.handle('path:get-encrypted-output', (_event, inputPath: string, outputDir: string, mode: 'passphrase' | 'pubkey') =>
    Promise.resolve(getEncryptedOutputPath(inputPath, outputDir, mode)),
  )
  ipcMain.handle('path:get-decrypted-output', (_event, inputPath: string, outputDir: string) =>
    Promise.resolve(getDecryptedOutputPath(inputPath, outputDir)),
  )
  ipcMain.handle('path:get-available-output', (_event, wantedPath: string) =>
    Promise.resolve(getAvailableOutputPath(wantedPath)),
  )
  ipcMain.handle('dialog:show-overwrite-confirm', (_event, existingPaths: string[]) => showOverwriteConfirm(existingPaths))
  ipcMain.handle('age:encrypt', async (_event, params: EncryptParams) => {
    try {
      return await encryptFiles(params)
    } catch (error) {
      throw new Error(toErrorMessage(error, '加密失败'))
    }
  })
  ipcMain.handle('age:decrypt', async (_event, params: DecryptParams) => {
    try {
      return await decryptFile(params)
    } catch (error) {
      throw new Error(toErrorMessage(error, '解密失败'))
    }
  })
  ipcMain.handle('age:generate-keypair', async () => {
    try {
      return await generateKeypair()
    } catch (error) {
      throw new Error(toErrorMessage(error, '生成密钥失败'))
    }
  })
  ipcMain.handle('keys:save-secret-key', async (_event, secretKey: string, suggestedName?: string) => {
    try {
      return await saveSecretKey(secretKey, suggestedName)
    } catch (error) {
      throw new Error(toErrorMessage(error, '保存私钥失败'))
    }
  })

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
