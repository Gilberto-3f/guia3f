import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  parseMobilidadeStatus,
  profissionalTemCategoriaMobilidade,
  type ProfissionalOnlineMapa,
} from '@/lib/mobilidadeStatusProfissional'
import { normalizarCategoriasProfissional } from '@/lib/cartaoVisitaProfissional'

/** Lista profissionais online/em atendimento com GPS para o mapa. */
export async function buscarProfissionaisOnlineMapa(): Promise<{
  lista: ProfissionalOnlineMapa[]
  error: string | null
}> {
  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return { lista: [], error: 'Serviço indisponível.' }
  }

  const { data, error } = await admin
    .from('profissionais')
    .select(
      'id, usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url, categorias, placa_vermelha, mobilidade_status, mobilidade_lat, mobilidade_lng',
    )
    .in('mobilidade_status', ['online', 'em_atendimento'])
    .not('mobilidade_lat', 'is', null)
    .not('mobilidade_lng', 'is', null)

  if (error) return { lista: [], error: error.message }

  const lista: ProfissionalOnlineMapa[] = []
  for (const row of data ?? []) {
    const cats = normalizarCategoriasProfissional(
      Array.isArray(row.categorias) ? row.categorias.map(String) : [],
    )
    if (!profissionalTemCategoriaMobilidade(cats)) continue
    const lat = Number(row.mobilidade_lat)
    const lng = Number(row.mobilidade_lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    lista.push({
      id: String(row.id),
      usuario_id: String(row.usuario_id),
      nome_completo: String(row.nome_completo ?? ''),
      nome_usuario: row.nome_usuario != null ? String(row.nome_usuario) : null,
      foto_url:
        row.foto_perfil_url != null
          ? String(row.foto_perfil_url)
          : row.foto_url != null
            ? String(row.foto_url)
            : null,
      categorias: cats,
      placa_vermelha: Boolean(row.placa_vermelha),
      status: parseMobilidadeStatus(row.mobilidade_status),
      lat,
      lng,
    })
  }

  return { lista, error: null }
}
