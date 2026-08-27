export function validateRequired(value, fieldName = 'campo') {
  const trimmed = typeof value === 'string' ? value.trim() : value

  if (trimmed === '' || trimmed === null || trimmed === undefined) {
    return `${fieldName} é obrigatório.`
  }

  return ''
}

export function validateEmail(value) {
  if (!value) {
    return 'E-mail é obrigatório.'
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailPattern.test(String(value).trim()) ? '' : 'Informe um e-mail válido.'
}

export function validatePassword(value, minLength = 8) {
  if (!value) {
    return 'Senha é obrigatória.'
  }

  return value.length >= minLength ? '' : `A senha precisa ter pelo menos ${minLength} caracteres.`
}
