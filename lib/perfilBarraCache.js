const STORAGE_KEY = 'guia3f_perfil_barra_v1'

/**
 * Cache leve (sessionStorage) para avatar/role na barra — exibição imediata no retorno ao app.
 * @returns {{ userId: string, role: string | null, fotoUrl: string | null, empresaId: string | null, empresaHospedagemId: string | null, empresaFotoUrl: string | null } | null}
 */
export function lerPerfilBarraCache() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw)
    const userId = o?.userId != null ? String(o.userId).trim() : ''
    if (!userId) return null
    return {
      userId,
      role: o?.role != null ? String(o.role) : null,
      fotoUrl: o?.fotoUrl != null && String(o.fotoUrl).trim() !== '' ? String(o.fotoUrl) : null,
      empresaId: o?.empresaId != null && String(o.empresaId).trim() !== '' ? String(o.empresaId) : null,
      empresaHospedagemId:
        o?.empresaHospedagemId != null && String(o.empresaHospedagemId).trim() !== ''
          ? String(o.empresaHospedagemId)
          : null,
      empresaFotoUrl:
        o?.empresaFotoUrl != null && String(o.empresaFotoUrl).trim() !== '' ? String(o.empresaFotoUrl) : null,
      fotoProfSocialUrl:
        o?.fotoProfSocialUrl != null && String(o.fotoProfSocialUrl).trim() !== ''
          ? String(o.fotoProfSocialUrl)
          : null,
    }
  } catch {
    return null
  }
}

/**
 * @param {{ userId: string, role?: string | null, fotoUrl?: string | null, fotoProfSocialUrl?: string | null, empresaId?: string | null, empresaHospedagemId?: string | null, empresaFotoUrl?: string | null }} payload
 */
export function gravarPerfilBarraCache(payload) {
  if (typeof window === 'undefined') return
  const userId = payload?.userId != null ? String(payload.userId).trim() : ''
  if (!userId) return
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        userId,
        role: payload.role ?? null,
        fotoUrl: payload.fotoUrl ?? null,
        fotoProfSocialUrl: payload.fotoProfSocialUrl ?? payload.fotoUrl ?? null,
        empresaId: payload.empresaId ?? null,
        empresaHospedagemId: payload.empresaHospedagemId ?? null,
        empresaFotoUrl: payload.empresaFotoUrl ?? null,
      }),
    )
  } catch {
    /* quota / modo privado */
  }
}
