import { supabase } from '@/lib/supabase'
import { normalizarTermoBusca } from '@/lib/palavrasChaveGuia'

export interface TermoBuscaGuia {
  termo: string
  total: number
}

export interface TopTermosSegmentoGuia {
  segmento_guia: string
  termos: TermoBuscaGuia[]
}

/** Registra busca no guia (segmento da página de filtros). */
export async function registrarBuscaGuia(segmentoGuia: string, termoBusca: string): Promise<void> {
  const termo = normalizarTermoBusca(termoBusca)
  if (!termo || !segmentoGuia) return

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return

  await supabase.from('buscas_guia').insert({
    termo_busca: termo,
    segmento_guia: segmentoGuia,
    usuario_id: session.user.id,
  })
}

/** Top termos por segmento (dashboard empresa). */
export async function buscarTopTermosGuia(
  dataLimite: string | null,
  limite = 10,
): Promise<TopTermosSegmentoGuia[]> {
  const { data, error } = await supabase.rpc('rpc_busca_guia_top_termos', {
    p_desde: dataLimite,
    p_limite: limite,
  })

  if (error) {
    if (
      error.code === 'PGRST202' ||
      error.message?.includes('Could not find the function') ||
      error.message?.includes('schema cache')
    ) {
      return []
    }
    throw error
  }

  if (!Array.isArray(data)) return []
  return data as TopTermosSegmentoGuia[]
}

/** Rótulo amigável do slug do guia. */
export const ROTULO_SEGMENTO_GUIA: Record<string, string> = {
  gastronomia: 'Gastronomia',
  passeios: 'Atrativos',
  lojas: 'Lojas',
  hospedagem: 'Hospedagem',
  servicos_locais: 'Serviços',
  compras: 'Compras Paraguai',
}
