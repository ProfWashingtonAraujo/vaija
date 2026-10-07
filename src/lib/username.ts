// Regras do usuário de login (iguais às do backend): 3 a 30 caracteres, a-z, 0-9, '.', '_' e '-'.
export const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,29}$/

export const usernameHint = '3 a 30 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado (sem espaços).'

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase()
}

export function isValidUsername(value: string) {
  return usernamePattern.test(normalizeUsername(value))
}

// E-mail é só contato opcional: vazio vale; se preenchido, precisa ter '@'.
export function isValidOptionalEmail(value: string) {
  const email = value.trim()
  return !email || email.includes('@')
}

export function userErrorMessage(error: unknown, fallback: string) {
  const code = error instanceof Error ? error.message : ''
  const messages: Record<string, string> = {
    username_already_exists: 'Já existe um usuário com esse nome de login.',
    invalid_username: `Usuário inválido. Use ${usernameHint}`,
    invalid_email: 'E-mail inválido.',
  }
  return messages[code] ?? fallback
}
