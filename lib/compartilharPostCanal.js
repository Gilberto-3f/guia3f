import { toSlugComunidadeProf, COMUNIDADES_PROFISSIONAIS_SLUG } from '@/lib/canaisProfissionaisListaUi'

/** @type {Record<string, string>} */
export const ROTULO_COMUNIDADE_CANAL = {
  guia: 'Guia de Turismo',
  taxista: 'Taxista',
  van: 'Motorista de Van',
  motorista_app: 'Motorista de APP',
  anfitriao: 'Anfitrião / Hospedagem',
}

/** @type {Record<string, string>} */
export const ROTULO_PAIS_CANAL = {
  geral: 'Todos',
  BR: 'Brasil',
  AR: 'Argentina',
  PY: 'Paraguai',
}

/** @type {readonly string[]} */
export const PAISES_CANAL_COMPARTILHAR = ['geral', 'BR', 'AR', 'PY']

/** Países exibidos no seletor "Qual comunidade?" (compartilhar feed). */
export const PAISES_COMUNIDADE_COMPARTILHAR = ['BR', 'AR', 'PY']

/** Remove URLs de publicação do feed do texto exibido no canal. */
export function textoExibicaoMensagemCanal(texto) {
  if (!texto) return ''
  return String(texto)
    .split('\n')
    .filter((linha) => {
      const t = linha.trim()
      if (!t) return true
      return !/\/feed\?post=/i.test(t)
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} empresaId
 * @param {string} comunidadeSlug
 * @returns {Promise<string | null>}
 */
export async function buscarCanalEmpresaPorComunidade(supabase, empresaId, comunidadeSlug) {
  const alvo = String(comunidadeSlug ?? '').trim()
  if (!empresaId || !alvo) return null

  const { data, error } = await supabase
    .from('canais')
    .select('id, comunidade_prof')
    .eq('tipo_publico', 'empresa')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)

  if (error) throw error

  const canal = (data ?? []).find((c) => {
    const slug = toSlugComunidadeProf(c.comunidade_prof != null ? String(c.comunidade_prof) : '')
    return slug === alvo
  })

  return canal?.id != null ? String(canal.id) : null
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} usuarioId
 * @returns {Promise<{ empresaId: string | null, role: string | null }>}
 */
export async function buscarContextoEmpresaUsuario(supabase, usuarioId) {
  if (!usuarioId) return { empresaId: null, role: null }

  const [{ data: u }, { data: emp }] = await Promise.all([
    supabase.from('usuarios').select('role').eq('id', usuarioId).maybeSingle(),
    supabase.from('empresas').select('id').eq('usuario_id', usuarioId).maybeSingle(),
  ])

  return {
    role: u?.role != null ? String(u.role) : null,
    empresaId: emp?.id != null ? String(emp.id) : null,
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   usuarioId: string
 *   empresaId: string
 *   comunidadeSlug: string
 *   paisAba: string
 *   postUrl: string
 *   resumo: string
 *   imagemUrl?: string | null
 * }} params
 */
export async function enviarPostFeedNoCanalEmpresa(supabase, params) {
  const {
    usuarioId,
    empresaId,
    comunidadeSlug,
    paisAba,
    resumo,
    imagemUrl = null,
  } = params

  const slug = String(comunidadeSlug ?? '').trim()
  if (!(COMUNIDADES_PROFISSIONAIS_SLUG).includes(slug)) {
    throw new Error('Comunidade inválida.')
  }

  const canalId = await buscarCanalEmpresaPorComunidade(supabase, empresaId, slug)
  if (!canalId) {
    throw new Error('Canal da comunidade não encontrado. Verifique se o canal está ativo.')
  }

  const partes = ['📢 Publicação do feed']
  const txt = String(resumo ?? '').trim()
  if (txt) partes.push(txt)
  const texto = partes.filter(Boolean).join('\n\n')

  const pais = paisAba && paisAba !== 'geral' ? paisAba : 'geral'

  /** @type {Record<string, unknown>} */
  const payload = {
    canal_id: canalId,
    remetente_id: usuarioId,
    texto,
    pais,
  }

  const img = String(imagemUrl ?? '').trim()
  if (img) {
    payload.anexo_url = img
    payload.anexo_tipo = 'imagem'
  }

  const { error } = await supabase.from('mensagens_canal').insert(payload)
  if (error) throw error

  return { canalId }
}
