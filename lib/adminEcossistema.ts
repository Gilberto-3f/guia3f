/** Níveis presos a um único bloco (Gerência escolhe). */
export function adminNivelTemBlocoFixo(nivel: number | null | undefined): boolean {
  const n = Number(nivel ?? 0)
  return n === 2 || n === 4
}

/** ADM geral e financeiro podem trocar o bloco na página de canais (etapa 3). */
export function adminPodeTrocarBlocoCanais(
  nivel: number | null | undefined,
  cargo?: string | null,
): boolean {
  const n = Number(nivel ?? 0)
  const c = String(cargo ?? '').trim().toUpperCase()
  return n === 1 || n === 3 || c === 'FINANCEIRO'
}

export function lerEcossistemaIdAdmin(row: {
  ecossistema_id?: string | null
  admin_permissoes?: unknown
} | null | undefined): string | null {
  if (!row) return null
  const col = row.ecossistema_id != null ? String(row.ecossistema_id).trim() : ''
  if (col) return col
  const perms = row.admin_permissoes
  if (perms && typeof perms === 'object' && !Array.isArray(perms)) {
    const raw = (perms as { ecossistema_id?: unknown }).ecossistema_id
    const id = raw != null ? String(raw).trim() : ''
    if (id) return id
  }
  return null
}

export function mesclarEcossistemaNasPermissoes(
  perms: Record<string, unknown> | null | undefined,
  ecoId: string | null,
): Record<string, unknown> {
  const base = perms && typeof perms === 'object' && !Array.isArray(perms) ? { ...perms } : {}
  if (ecoId) base.ecossistema_id = ecoId
  else delete base.ecossistema_id
  return base
}
