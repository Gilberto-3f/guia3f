import type { SupabaseClient } from '@supabase/supabase-js'
import { aplicarFiltroEmpresasGuiaPublico } from '@/lib/empresaGuiaVisibilidade'
import { buscarIdsEmpresaEcossistema } from '@/lib/ecossistemaFiltro'
import {
  buscarIdsEmpresaPresencaPublicaVigente,
  buscarUsuarioIdsEmpresaPresencaPublicaVigente,
} from '@/lib/empresaPresencaPublica'

function usuarioIdDeRow(row: unknown): string {
  if (row == null || typeof row !== 'object') return ''
  const uid = (row as { usuario_id?: unknown }).usuario_id
  return uid != null ? String(uid) : ''
}

type EmpresasGuiaOpts = {
  /** Inclui páginas só de modo apresentação (preview ADM). */
  incluirModoApresentacao?: boolean
  /** Colunas do select Supabase (padrão: `usuario_id`). */
  select?: string
  /** Empresas globais do feed/stories/atividades: só as vinculadas a este bloco. */
  ecossistemaId?: string | null
}

async function usuarioIdsPorEmpresaIds(
  supabase: SupabaseClient,
  empIds: string[],
): Promise<string[]> {
  if (empIds.length === 0) return []
  const { data, error } = await supabase.from('empresas').select('usuario_id').in('id', empIds)
  if (error || !data?.length) return []
  return [...new Set(data.map(usuarioIdDeRow).filter(Boolean))]
}

/**
 * Empresas com presença pública vigente (assinatura, degustação ou anfitrião).
 * Ciclo vencido → fora do feed/stories/atividades.
 */
function queryEmpresasGuiaAprovadas(
  supabase: SupabaseClient,
  opts?: EmpresasGuiaOpts & { empresaIds?: string[] },
) {
  let q = supabase.from('empresas').select(opts?.select ?? 'usuario_id')
  const ids = opts?.empresaIds ?? []
  if (ids.length > 0) {
    q = q.in('id', ids)
  }

  if (!opts?.incluirModoApresentacao) {
    q = aplicarFiltroEmpresasGuiaPublico(q)
  } else {
    q = q.eq('docs_verificado', true).in('status', ['aprovado', 'ativo'])
  }

  return q
}

/**
 * `usuario_id` das empresas do guia cujo conteúdo entra no feed/stories/atividades para todos.
 * Com `ecossistemaId`, só empresas vinculadas ao bloco (seguidos entram à parte, qualquer região).
 */
export async function fetchUsuarioIdsTodasEmpresasGuia(
  supabase: SupabaseClient,
  opts?: { incluirModoApresentacao?: boolean; ecossistemaId?: string | null },
): Promise<string[]> {
  const ecoSet = opts?.ecossistemaId
    ? await buscarIdsEmpresaEcossistema(supabase, opts.ecossistemaId)
    : null

  if (!ecoSet) {
    if (opts?.incluirModoApresentacao) {
      const [vigentes, previewRes] = await Promise.all([
        buscarUsuarioIdsEmpresaPresencaPublicaVigente(supabase),
        supabase.from('empresas').select('usuario_id').eq('somente_modo_apresentacao', true),
      ])
      const ids = [
        ...vigentes,
        ...(previewRes.data ?? []).map(usuarioIdDeRow).filter(Boolean),
      ]
      return [...new Set(ids)]
    }
    return buscarUsuarioIdsEmpresaPresencaPublicaVigente(supabase)
  }

  const vigentesEmp = [...(await buscarIdsEmpresaPresencaPublicaVigente(supabase))].filter((id) =>
    ecoSet.has(id),
  )
  const vigentes = await usuarioIdsPorEmpresaIds(supabase, vigentesEmp)

  if (opts?.incluirModoApresentacao) {
    const previewRes = await supabase
      .from('empresas')
      .select('id, usuario_id')
      .eq('somente_modo_apresentacao', true)
    const previewIds = (previewRes.data ?? [])
      .filter((r) => ecoSet.has(String((r as { id?: unknown }).id ?? '')))
      .map(usuarioIdDeRow)
      .filter(Boolean)
    return [...new Set([...vigentes, ...previewIds])]
  }

  return vigentes
}

/**
 * Linhas de empresas do guia (ex.: StoriesBar), opcionalmente filtradas por `usuario_id`.
 */
export async function fetchEmpresasGuiaRows<T extends Record<string, unknown> = { usuario_id: string }>(
  supabase: SupabaseClient,
  opts?: EmpresasGuiaOpts & { usuarioIds?: string[] },
): Promise<T[]> {
  const select = opts?.select ?? 'usuario_id'
  const filterUsuarioIds = (opts?.usuarioIds ?? []).map((id) => String(id).trim()).filter(Boolean)
  const empIdsVigentesRaw = [...(await buscarIdsEmpresaPresencaPublicaVigente(supabase))]
  const ecoSet = opts?.ecossistemaId
    ? await buscarIdsEmpresaEcossistema(supabase, opts.ecossistemaId)
    : null
  const empIdsVigentes =
    ecoSet == null ? empIdsVigentesRaw : empIdsVigentesRaw.filter((id) => ecoSet.has(id))

  if (opts?.incluirModoApresentacao) {
    const aprovadasPromise =
      empIdsVigentes.length === 0
        ? Promise.resolve({ data: [] as unknown[] })
        : (() => {
            const aprovadasQ = queryEmpresasGuiaAprovadas(supabase, {
              select,
              incluirModoApresentacao: false,
              empresaIds: empIdsVigentes,
            })
            return filterUsuarioIds.length > 0
              ? aprovadasQ.in('usuario_id', filterUsuarioIds)
              : aprovadasQ
          })()

    const previewPromise =
      ecoSet && ecoSet.size === 0
        ? Promise.resolve({ data: [] as unknown[] })
        : (() => {
            let previewQ = supabase.from('empresas').select(select).eq('somente_modo_apresentacao', true)
            if (ecoSet) previewQ = previewQ.in('id', [...ecoSet])
            return filterUsuarioIds.length > 0
              ? previewQ.in('usuario_id', filterUsuarioIds)
              : previewQ
          })()

    const [aprovadasRes, previewRes] = await Promise.all([aprovadasPromise, previewPromise])
    const merged = [...(aprovadasRes.data ?? []), ...(previewRes.data ?? [])] as unknown as T[]
    const seen = new Set<string>()
    return merged.filter((row) => {
      const uid = usuarioIdDeRow(row)
      if (!uid || seen.has(uid)) return false
      seen.add(uid)
      return true
    })
  }

  if (empIdsVigentes.length === 0) return []

  let q = queryEmpresasGuiaAprovadas(supabase, { select, empresaIds: empIdsVigentes })
  if (filterUsuarioIds.length > 0) {
    q = q.in('usuario_id', filterUsuarioIds)
  }
  const { data, error } = await q
  if (error || !data?.length) return []
  return data as unknown as T[]
}

/**
 * @deprecated Mantido para Comissões (estrela de favoritos em ofertas). Não usar no feed.
 */
export async function fetchUsuarioIdsEmpresasFavoritas(
  supabase: SupabaseClient,
  meuId: string | null,
): Promise<string[]> {
  if (!meuId) return []
  const { data: favs, error } = await supabase
    .from('favoritos')
    .select('alvo_id')
    .eq('usuario_id', meuId)
    .eq('alvo_tipo', 'empresa')
  if (error || !favs?.length) return []
  const empIds = [...new Set(favs.map((f) => String((f as { alvo_id: unknown }).alvo_id)).filter(Boolean))]
  if (empIds.length === 0) return []
  const { data: emps, error: errE } = await supabase.from('empresas').select('usuario_id').in('id', empIds)
  if (errE || !emps?.length) return []
  return [...new Set(emps.map(usuarioIdDeRow).filter(Boolean))]
}

/**
 * IDs de autores cujas interações aparecem na aba Amigos de `/atividades`:
 * perfis seguidos em `redecontatos` + gestores de empresas aprovadas no guia.
 */
export async function fetchAutorIdsSeguidosAmigos(
  supabase: SupabaseClient,
  meuId: string | null,
  opts?: { incluirModoApresentacao?: boolean; ecossistemaId?: string | null },
): Promise<string[]> {
  const { rede, empresas } = await fetchSeguidosRedeEEmpresasAtividades(supabase, meuId, opts)
  return [...new Set([...rede, ...empresas])].filter((id) => Boolean(id) && id !== meuId)
}

/**
 * Seguidos em rede (sem empresas do guia) — usado na mensagem vazia da aba Seguindo.
 */
export async function fetchSeguidosRedeAtividades(
  supabase: SupabaseClient,
  meuId: string | null,
): Promise<string[]> {
  if (!meuId) return []
  const { data: segRows, error: errRede } = await supabase
    .from('redecontatos')
    .select('seguido_id')
    .eq('seguidor_id', meuId)
  if (errRede && process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.error('[Atividades] redecontatos (seguindo):', errRede)
  }
  return (segRows ?? [])
    .map((r) => String((r as { seguido_id: string }).seguido_id))
    .filter((id) => Boolean(id) && id !== meuId)
}

/** Rede + gestores de empresas do guia (critérios separados para UI e queries). */
export async function fetchSeguidosRedeEEmpresasAtividades(
  supabase: SupabaseClient,
  meuId: string | null,
  opts?: { incluirModoApresentacao?: boolean; ecossistemaId?: string | null },
): Promise<{ rede: string[]; empresas: string[] }> {
  const [rede, empresas] = await Promise.all([
    fetchSeguidosRedeAtividades(supabase, meuId),
    fetchUsuarioIdsTodasEmpresasGuia(supabase, opts),
  ])
  return { rede, empresas }
}

/**
 * Gestores de empresas anfitrião (`somente_anfitriao`): posts sociais exigem follow no feed.
 */
export async function fetchUsuarioIdsGestoresAnfitriaoGuia(
  supabase: SupabaseClient,
  opts?: { incluirModoApresentacao?: boolean; ecossistemaId?: string | null },
): Promise<string[]> {
  const rows = await fetchEmpresasGuiaRows<{ usuario_id: string; somente_anfitriao?: boolean | null }>(
    supabase,
    {
      select: 'usuario_id, somente_anfitriao',
      incluirModoApresentacao: opts?.incluirModoApresentacao,
      ecossistemaId: opts?.ecossistemaId,
    },
  )
  return [
    ...new Set(
      rows
        .filter((r) => r.somente_anfitriao === true)
        .map(usuarioIdDeRow)
        .filter(Boolean),
    ),
  ]
}
