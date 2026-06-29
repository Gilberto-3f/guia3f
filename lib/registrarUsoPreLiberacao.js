/**
 * Registra uso na janela de 24h e dispara avisos de comissão no canal financeiro.
 * @param {{ tipo: string, descricao: string, empresaId?: string | null, profissionalUsuarioId?: string | null }} params
 */
export async function registrarUsoPreLiberacao({
  tipo,
  descricao,
  empresaId = null,
  profissionalUsuarioId = null,
}) {
  try {
    const res = await fetch('/api/turista/registrar-uso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        tipo,
        descricao,
        empresa_id: empresaId,
        profissional_usuario_id: profissionalUsuarioId,
      }),
    })
    if (res.ok && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('turista-compras-atualizado'))
    }
  } catch {
    /* não bloqueia fluxo principal */
  }
}
