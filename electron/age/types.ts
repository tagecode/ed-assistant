export interface AgeBinaryPaths {
  binDir: string
  agePath: string
  keygenPath: string
  batchpassPath: string | null
}

export interface RunCommandOptions {
  fd3Input?: Buffer
  extraEnv?: Record<string, string>
}
