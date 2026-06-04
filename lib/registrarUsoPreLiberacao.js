/** Registra uso durante pré-liberação (auditoria ADM). */
export async function registrarUsoPreLiberacao({ tipo, descricao, empresaId = null }) {
  try {
    await fetch('/api/turista/registrar-uso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ tipo, descricao, empresa_id: empresaId }),
    })
  } catch {
    /* não bloqueia fluxo principal */
  }
}
