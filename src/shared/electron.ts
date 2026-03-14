export type ThemeMode = 'system' | 'light' | 'dark'
export type EncryptionMode = 'passphrase' | 'pubkey'
export type DecryptionMode = 'passphrase' | 'identity'

export interface AppMetadata {
  name: string
  version: string
  electron: string
  chromium: string
  node: string
  platform: string
  arch: string
}

export interface AgeBinaryInfo {
  version: string
  agePath: string
  keygenPath: string
  batchpassPath: string | null
  batchpassAvailable: boolean
}

export interface EncryptParams {
  inputPaths: string[]
  outputDir: string
  mode: EncryptionMode
  passphrase?: string
  recipients?: string[]
  armor?: boolean
  /** 可选：按输入路径指定输出路径，用于“自动重命名”时覆盖默认输出路径 */
  outputPathOverrides?: Record<string, string>
}

export interface EncryptResult {
  success: boolean
  outputs: Array<{ input: string; output: string }>
  errors: Array<{ input: string; message: string }>
  elapsedMs: number
}

export interface DecryptParams {
  inputPath: string
  outputDir: string
  mode: DecryptionMode
  passphrase?: string
  identityPath?: string
  /** 可选：指定解密输出路径，用于“自动重命名”时覆盖默认路径 */
  outputPath?: string
}

export interface DecryptResult {
  success: boolean
  output: string
  elapsedMs: number
  error?: string
}

export interface Keypair {
  publicKey: string
  secretKey: string
  postQuantum: boolean
}

export interface ElectronApi {
  getAppMetadata: () => Promise<AppMetadata>
  getAgeInfo: () => Promise<AgeBinaryInfo>
  getTheme: () => Promise<ThemeMode>
  setTheme: (theme: ThemeMode) => Promise<ThemeMode>
  pickInputFiles: () => Promise<string[]>
  pickEncryptedFile: () => Promise<string | null>
  pickIdentityFile: () => Promise<string | null>
  pickOutputDirectory: () => Promise<string | null>
  encrypt: (params: EncryptParams) => Promise<EncryptResult>
  decrypt: (params: DecryptParams) => Promise<DecryptResult>
  generateKeypair: () => Promise<Keypair>
  saveSecretKey: (secretKey: string, suggestedName?: string) => Promise<string | null>
  checkFileExists: (filePath: string) => Promise<boolean>
  getEncryptedOutputPath: (inputPath: string, outputDir: string, mode: EncryptionMode) => Promise<string>
  getDecryptedOutputPath: (inputPath: string, outputDir: string) => Promise<string>
  getAvailableOutputPath: (wantedPath: string) => Promise<string>
  showOverwriteConfirm: (existingPaths: string[]) => Promise<'overwrite' | 'rename'>
}
