export interface PasswordGeneratorOptions {
  length: number
  includeUppercase: boolean
  includeLowercase: boolean
  includeNumbers: boolean
  includeSymbols: boolean
  customSymbols: string
  excludeAmbiguous: boolean
  uniqueCharacters: boolean
}

export interface PasswordStrength {
  entropy: number
  label: '弱' | '中' | '强' | '极强'
}

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
const NUMBERS = '0123456789'
const DEFAULT_SYMBOLS = '!@#$%^&*()-_=+[]{}'
const AMBIGUOUS = new Set(['0', 'O', 'o', '1', 'I', 'l'])

export const defaultPasswordOptions: PasswordGeneratorOptions = {
  length: 20,
  includeUppercase: true,
  includeLowercase: true,
  includeNumbers: true,
  includeSymbols: true,
  customSymbols: DEFAULT_SYMBOLS,
  excludeAmbiguous: false,
  uniqueCharacters: false,
}

function randomIndex(max: number) {
  return crypto.getRandomValues(new Uint32Array(1))[0] % max
}

function normalizeCharset(charset: string, excludeAmbiguous: boolean) {
  const uniqueChars = Array.from(new Set(charset.split('')))
  return excludeAmbiguous
    ? uniqueChars.filter((char) => !AMBIGUOUS.has(char)).join('')
    : uniqueChars.join('')
}

export function getEnabledCharsets(options: PasswordGeneratorOptions) {
  return [
    options.includeUppercase ? normalizeCharset(UPPERCASE, options.excludeAmbiguous) : '',
    options.includeLowercase ? normalizeCharset(LOWERCASE, options.excludeAmbiguous) : '',
    options.includeNumbers ? normalizeCharset(NUMBERS, options.excludeAmbiguous) : '',
    options.includeSymbols ? normalizeCharset(options.customSymbols, options.excludeAmbiguous) : '',
  ].filter(Boolean)
}

function shuffle(items: string[]) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const nextIndex = randomIndex(index + 1)
    ;[result[index], result[nextIndex]] = [result[nextIndex], result[index]]
  }

  return result.join('')
}

export function generatePassword(options: PasswordGeneratorOptions) {
  const charsets = getEnabledCharsets(options)
  if (charsets.length === 0) {
    throw new Error('至少需要启用一种字符类型')
  }

  const allCharacters = Array.from(new Set(charsets.join('').split('')))
  if (options.uniqueCharacters && options.length > allCharacters.length) {
    throw new Error('开启“排除重复字符”后，当前字符集数量不足以生成目标长度')
  }

  const usedCharacters = new Set<string>()
  const password: string[] = []

  for (const charset of charsets) {
    const available = options.uniqueCharacters
      ? charset.split('').filter((char) => !usedCharacters.has(char))
      : charset.split('')

    if (available.length === 0) {
      continue
    }

    const char = available[randomIndex(available.length)]
    password.push(char)
    usedCharacters.add(char)
  }

  while (password.length < options.length) {
    const available = options.uniqueCharacters
      ? allCharacters.filter((char) => !usedCharacters.has(char))
      : allCharacters

    const char = available[randomIndex(available.length)]
    password.push(char)
    usedCharacters.add(char)
  }

  return shuffle(password.slice(0, options.length))
}

export function getPasswordStrength(options: PasswordGeneratorOptions): PasswordStrength {
  const poolSize = Array.from(new Set(getEnabledCharsets(options).join('').split(''))).length
  const entropy = poolSize > 0 ? options.length * Math.log2(poolSize) : 0

  return strengthFromEntropy(entropy)
}

/** 根据任意字符串（如用户输入的口令）估算强度，用于加密页等 */
export function getPassphraseStrength(passphrase: string): PasswordStrength {
  if (!passphrase.length) {
    return { entropy: 0, label: '弱' }
  }

  const hasLower = /[a-z]/.test(passphrase)
  const hasUpper = /[A-Z]/.test(passphrase)
  const hasDigit = /\d/.test(passphrase)
  const hasSymbol = /[^A-Za-z0-9]/.test(passphrase)

  let poolSize = 0
  if (hasLower) poolSize += 26
  if (hasUpper) poolSize += 26
  if (hasDigit) poolSize += 10
  if (hasSymbol) {
    const symbolCount = new Set(passphrase.replace(/[A-Za-z0-9]/g, '').split('')).size
    poolSize += Math.max(symbolCount, 10)
  }
  if (poolSize === 0) poolSize = 26

  const entropy = poolSize > 0 ? passphrase.length * Math.log2(poolSize) : 0
  return strengthFromEntropy(entropy)
}

function strengthFromEntropy(entropy: number): PasswordStrength {
  if (entropy < 50) return { entropy, label: '弱' }
  if (entropy < 72) return { entropy, label: '中' }
  if (entropy < 96) return { entropy, label: '强' }
  return { entropy, label: '极强' }
}
