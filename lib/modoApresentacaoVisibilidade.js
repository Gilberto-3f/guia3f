/**
 * Regra de visibilidade: empresas com `somente_modo_apresentacao = true` só são “reais” no UI
 * para o ADM de demonstração com **modo apresentação ativo**. Todos os outros utilizadores
 * (e o mesmo ADM com modo desligado) devem ver apenas dados sociais reais (turista/profissional/empresa real).
 */

/** Conta usada para ativar modo apresentação / empresas demo no app. */
export const EMAIL_ADMIN_DEMO_MODO_APRESENTACAO = 'pubmob.3f@gmail.com'

/**
 * @param {string | null | undefined} email
 * @returns {boolean}
 */
export function emailEhAdminDemoModoApresentacao(email) {
  if (email == null || typeof email !== 'string') return false
  return email.trim().toLowerCase() === EMAIL_ADMIN_DEMO_MODO_APRESENTACAO
}

/**
 * @param {string | null | undefined} email
 * @param {boolean} modoAtivo
 * @returns {boolean}
 */
export function podeVerConteudoEmpresaPreviewApp(email, modoAtivo) {
  return Boolean(modoAtivo && emailEhAdminDemoModoApresentacao(email))
}
