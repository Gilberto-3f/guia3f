const MAX_USERNAME_LEN = 20

function stemFromEmail(email) {
  const raw = (email.split('@')[0] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'
  return raw.slice(0, MAX_USERNAME_LEN)
}

export function usernameProvisorioFromEmail(email, userId) {
  const stem = stemFromEmail(email)
  const short = stem.slice(0, Math.max(3, MAX_USERNAME_LEN - 2))
  return short.slice(0, MAX_USERNAME_LEN)
}

/** Gera candidato inicial; colisões tratadas no insert com sufixo pelo caller se necessário */
export function defaultUsernameForCadastro(email, userId) {
  const fb = `u${userId.replace(/-/g, '')}`.slice(0, MAX_USERNAME_LEN)
  const base = usernameProvisorioFromEmail(email, userId)
  return base.length >= 3 ? base : fb.length >= 3 ? fb : `u${userId.replace(/-/g, '').slice(0, 18)}`
}
