import type { SupabaseClient } from '@supabase/supabase-js'
import { buscarConfigComissoesAtiva } from '@/lib/configComissoesRuntime'
import { joinSupabaseRow } from '@/lib/supabaseJoinRow'

export type ParceiroRecomendacaoOferta = {
  nome: string
  username: string | null
  foto_url: string | null
  percentual_bonificacao: number
}

/** Carrega o profissional indicador + % de bonificação (config atual). */
export async function carregarParceiroRecomendacaoOferta(
  admin: SupabaseClient,
  recomendacaoId: string | null | undefined,
): Promise<ParceiroRecomendacaoOferta | null> {
  const rid = String(recomendacaoId ?? '').trim()
  if (!rid) return null

  const { data: rec } = await admin
    .from('recomendacoes_profissional')
    .select(
      `
      id,
      profissional_indicador:profissional_indicador_id (
        nome_completo, nome_usuario, foto_url, foto_perfil_url
      )
    `,
    )
    .eq('id', rid)
    .maybeSingle()

  if (!rec) return null
  const ind = joinSupabaseRow(rec.profissional_indicador)
  if (!ind) return null

  const cfg = await buscarConfigComissoesAtiva(admin)
  const pctTabelada = Number(cfg?.mobilidade_tabelada?.indicador)
  const pctSplit = Number(cfg?.empresa_split?.indicador)
  const percentual =
    Number.isFinite(pctTabelada)
      ? Math.min(100, Math.max(0, pctTabelada))
      : Number.isFinite(pctSplit)
        ? Math.min(100, Math.max(0, pctSplit))
        : 30

  const foto =
    (ind.foto_perfil_url != null && String(ind.foto_perfil_url).trim()) ||
    (ind.foto_url != null && String(ind.foto_url).trim()) ||
    null

  return {
    nome: String(ind.nome_completo ?? 'Profissional'),
    username: ind.nome_usuario != null ? String(ind.nome_usuario) : null,
    foto_url: foto,
    percentual_bonificacao: percentual,
  }
}

/** Guia / van usam manifesto; taxista não. */
export function modalidadeUsaManifesto(modalidade: string | null | undefined): boolean {
  const m = String(modalidade ?? '').trim().toLowerCase()
  return m === 'guia' || m === 'van'
}

/** Data curta: 04/08 às 14:30 */
export function formatDataHoraAtendimentoCurta(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const hora = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dia}/${mes} às ${hora}:${min}`
}

export function handleUsuarioAtendimento(username: string | null | undefined): string {
  const u = String(username ?? '').replace(/^@+/, '').trim()
  return u ? `@${u}` : '@usuario'
}
