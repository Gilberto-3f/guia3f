import type { SupabaseClient } from '@supabase/supabase-js'
import { IDIOMAS_GUIA, normalizarIdiomasGuia } from '@/lib/idiomasGuia'
import {
  modalidadeDeCategoriasProfissional,
  labelModalidadeMobilidade,
  type ModalidadeMobilidadeId,
} from '@/lib/mobilidadePopupPesquisa'
import { parseMobilidadeStatus } from '@/lib/mobilidadeStatusProfissional'

export type ProfissionalDrawerParticular = {
  nome_completo: string
  nome_usuario: string | null
  foto_url: string | null
  verificado: boolean
  verificado_em: string | null
  categoria_label?: string | null
  nota_media?: number | null
}

export type ProfissionalDrawerCache = {
  snap: ProfissionalDrawerParticular
  modalidade: ModalidadeMobilidadeId | null
  idiomas: { codigo: string; label: string; bandeira: string }[]
  idiomaPreferido: string
  imediatoOk: boolean
  completo: boolean
}

const cache = new Map<string, ProfissionalDrawerCache>()
const inflight = new Map<string, Promise<ProfissionalDrawerCache | null>>()

export function peekProfissionalDrawerCache(usuarioId: string): ProfissionalDrawerCache | null {
  const uid = String(usuarioId ?? '').trim()
  if (!uid) return null
  return cache.get(uid) ?? null
}

/** Snapshot do cartão de visita — 1º paint do drawer sem “…”. */
export function seedProfissionalDrawerSnap(
  usuarioId: string,
  snap: ProfissionalDrawerParticular,
): void {
  const uid = String(usuarioId ?? '').trim()
  if (!uid) return
  const prev = cache.get(uid)
  cache.set(uid, {
    snap,
    modalidade: prev?.modalidade ?? null,
    idiomas: prev?.idiomas ?? [],
    idiomaPreferido: prev?.idiomaPreferido ?? '',
    imediatoOk: prev?.imediatoOk ?? true,
    completo: prev?.completo ?? false,
  })
}

function mapRow(
  data: Record<string, unknown>,
  prev?: ProfissionalDrawerCache | null,
): ProfissionalDrawerCache {
  const cats = Array.isArray(data.categorias) ? data.categorias.map(String) : []
  const placa = Boolean(data.placa_vermelha)
  const modalidade = modalidadeDeCategoriasProfissional(cats, placa)
  const idiomas =
    modalidade === 'guia'
      ? IDIOMAS_GUIA.filter((i) => normalizarIdiomasGuia(data.idiomas).includes(i.codigo)).map(
          (i) => ({ codigo: i.codigo, label: i.label, bandeira: i.bandeira }),
        )
      : []
  const statusMob = parseMobilidadeStatus(data.mobilidade_status)
  const foto =
    (data.foto_perfil_url != null && String(data.foto_perfil_url).trim()) ||
    (data.foto_url != null && String(data.foto_url).trim()) ||
    null
  return {
    snap: {
      nome_completo: String(data.nome_completo ?? 'Profissional'),
      nome_usuario: data.nome_usuario != null ? String(data.nome_usuario) : null,
      foto_url: foto,
      verificado: String(data.status ?? '') === 'aprovado' || Boolean(data.docs_verificado),
      verificado_em:
        data.docs_verificado_em != null
          ? String(data.docs_verificado_em)
          : data.created_at != null
            ? String(data.created_at)
            : null,
      categoria_label:
        labelModalidadeMobilidade(cats, placa) ?? prev?.snap.categoria_label ?? null,
      nota_media: prev?.snap.nota_media ?? null,
    },
    modalidade,
    idiomas,
    idiomaPreferido: idiomas[0]?.codigo ?? '',
    imediatoOk: statusMob === 'online',
    completo: true,
  }
}

export async function carregarProfissionalDrawerParticular(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<ProfissionalDrawerCache | null> {
  const uid = String(usuarioId ?? '').trim()
  if (!uid) return null
  const hit = cache.get(uid)
  if (hit?.completo) return hit
  const pending = inflight.get(uid)
  if (pending) return pending

  const job = (async () => {
    const { data, error } = await supabase
      .from('profissionais')
      .select(
        'nome_completo, nome_usuario, foto_url, foto_perfil_url, categorias, placa_vermelha, docs_verificado, docs_verificado_em, created_at, status, mobilidade_status, idiomas',
      )
      .eq('usuario_id', uid)
      .maybeSingle()
    if (error || !data) return hit ?? null
    const next = mapRow(data as Record<string, unknown>, hit)
    cache.set(uid, next)
    return next
  })()

  inflight.set(uid, job)
  try {
    return await job
  } finally {
    inflight.delete(uid)
  }
}
