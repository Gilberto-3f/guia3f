import type { SupabaseClient } from '@supabase/supabase-js'
import {
  contarMensagensNaoLidasInboxAdmin,
  contarNaoLidasPorCanalIdsAdmin,
} from '@/lib/canaisAdminVisibilidade'
import { contarAvisosFinanceiroHubNaoLidos } from '@/lib/financeiroAvisosAdmHub'
import {
  contarFinanceiroNaoLidasEmpresa,
  obterIdsCanaisMensagensEmpresa,
} from '@/lib/canaisEmpresaVisibilidade'
import {
  contarFinanceiroNaoLidasProfissional,
  obterIdsCanaisMensagensProfissional,
} from '@/lib/canaisProfissionalVisibilidade'
import {
  canalFiltraLeituraPorPaisEmpresa,
  canalFiltraLeituraPorPaisProfissional,
  empresaPaisParaAba,
  mensagemCanalVisivelNoFiltroPais,
  profissionalPaisParaAba,
} from '@/lib/canalAbasPaisColetivo'
import { buscarUsuarioCached } from '@/lib/usuarioSessionCache'

/** Janela curta — badge não precisa varrer 4 meses (causava statement timeout / 503). */
const BADGE_JANELA_DIAS = 21
/** Teto de linhas por contagem — evita saturar o pool. */
const BADGE_MSG_LIMIT = 250
/** Cache em memória entre polls da BottomBar. */
const BADGE_CACHE_MS = 50_000

type CanalPaisRow = {
  id: string
  nome?: string | null
  tipo_publico?: string | null
  categoria?: string | null
  comunidade_prof?: string | null
  empresa_id?: string | null
}

/** @type {{ userId: string; at: number; value: number } | null} */
let badgeCountCache: { userId: string; at: number; value: number } | null = null
/** @type {Promise<number> | null} */
let badgeCountInflight: Promise<number> | null = null
let badgeCountInflightUserId: string | null = null

export function invalidarCacheBadgeCanais(userId?: string | null) {
  if (!userId || badgeCountCache?.userId === userId) badgeCountCache = null
}

async function carregarMapaCanaisPorIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, CanalPaisRow>> {
  const map = new Map<string, CanalPaisRow>()
  if (ids.length === 0) return map
  const { data } = await supabase
    .from('canais')
    .select('id, nome, tipo_publico, categoria, comunidade_prof, empresa_id')
    .in('id', ids)
  for (const c of data ?? []) {
    map.set(String(c.id), c as CanalPaisRow)
  }
  return map
}

function mensagemContaParaLeituraColetiva(
  canal: CanalPaisRow | undefined,
  paisMsg: string | null | undefined,
  opts: {
    role: string
    paisTabLeitura: string
  },
): boolean {
  if (!canal) return true
  if (opts.role === 'profissional' && canalFiltraLeituraPorPaisProfissional(canal)) {
    return mensagemCanalVisivelNoFiltroPais(paisMsg, opts.paisTabLeitura, 'leitura_publico')
  }
  if (opts.role === 'empresa' && canalFiltraLeituraPorPaisEmpresa(canal)) {
    return mensagemCanalVisivelNoFiltroPais(paisMsg, opts.paisTabLeitura, 'leitura_publico')
  }
  return true
}

/**
 * `visto_em` após leitura: cobre a última mensagem visível (+ folga de 1s para relógio/Postgres).
 */
export function calcularVistoEmAposLeitura(ultimaMensagemIso?: string | null): string {
  let t = Date.now()
  if (ultimaMensagemIso) {
    const msg = new Date(ultimaMensagemIso).getTime()
    if (!Number.isNaN(msg)) t = Math.max(t, msg)
  }
  return new Date(t + 3000).toISOString()
}

/**
 * Última mensagem do canal (para marcar leitura com precisão).
 */
async function buscarUltimaMensagemCanal(
  supabase: SupabaseClient,
  canalId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('mensagens_canal')
    .select('created_at')
    .eq('canal_id', canalId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.created_at != null ? String(data.created_at) : null
}

/**
 * Marca o canal como lido para o utilizador (tabela `canal_leitura_profissional` — uso por qualquer role).
 */
export async function marcarCanalComoLido(
  supabase: SupabaseClient,
  usuarioId: string,
  canalId: string,
  ultimaMensagemIso?: string | null,
): Promise<boolean> {
  if (!usuarioId || !canalId) return false

  let ultima = ultimaMensagemIso
  if (!ultima) {
    ultima = await buscarUltimaMensagemCanal(supabase, canalId)
  }

  const visto_em = calcularVistoEmAposLeitura(ultima)
  const { data, error } = await supabase
    .from('canal_leitura_profissional')
    .upsert(
      {
        usuario_id: usuarioId,
        canal_id: canalId,
        visto_em,
      },
      { onConflict: 'usuario_id,canal_id' },
    )
    .select('visto_em')
    .maybeSingle()

  if (error) {
    console.error('marcarCanalComoLido:', error)
    return false
  }
  if (!data?.visto_em) {
    console.error('marcarCanalComoLido: nenhuma linha gravada (verifique RLS em canal_leitura_profissional)')
    return false
  }
  return true
}

/**
 * Grava leitura com `fetch(..., { keepalive: true })` para sobreviver à navegação (barra inferior / Home).
 * Complementa `marcarCanalComoLido` quando o cliente Supabase aborta o upsert no unmount.
 */
/** Marca leitura via keepalive (não bloqueia navegação). */
export function marcarCanaisLidosKeepalive(
  accessToken: string,
  usuarioId: string,
  canalIds: string[],
  ultimaMensagemIso?: string | null,
): void {
  for (const canalId of canalIds) {
    if (canalId) enviarMarcacaoLeituraKeepalive(accessToken, usuarioId, canalId, ultimaMensagemIso)
  }
}

export function enviarMarcacaoLeituraKeepalive(
  accessToken: string,
  usuarioId: string,
  canalId: string,
  ultimaMensagemIso?: string | null,
): void {
  if (!accessToken || !usuarioId || !canalId) return

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return

  const visto_em = calcularVistoEmAposLeitura(ultimaMensagemIso)

  try {
    void fetch(`${url}/rest/v1/canal_leitura_profissional?on_conflict=usuario_id,canal_id`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        usuario_id: usuarioId,
        canal_id: canalId,
        visto_em,
      }),
      keepalive: true,
    })
  } catch {
    /* navegação em curso */
  }
}

/**
 * Marca leitura e dispara keepalive (última mensagem conhecida na tela).
 */
export async function marcarCanalComoLidoResiliente(
  supabase: SupabaseClient,
  usuarioId: string,
  canalId: string,
  ultimaMensagemIso?: string | null,
  accessToken?: string | null,
): Promise<boolean> {
  if (accessToken) {
    enviarMarcacaoLeituraKeepalive(accessToken, usuarioId, canalId, ultimaMensagemIso)
  }
  return marcarCanalComoLido(supabase, usuarioId, canalId, ultimaMensagemIso)
}

/**
 * Mensagens não lidas nos canais acessíveis: só de outros remetentes e posteriores a `visto_em`.
 * Não usa a tabela `atividades` — badge separado do coração (feed social).
 */
export async function contarMensagensNaoLidasCanais(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  if (!userId) return 0

  const agora = Date.now()
  if (badgeCountCache && badgeCountCache.userId === userId && agora - badgeCountCache.at < BADGE_CACHE_MS) {
    return badgeCountCache.value
  }
  if (badgeCountInflight && badgeCountInflightUserId === userId) {
    return badgeCountInflight
  }

  badgeCountInflightUserId = userId
  badgeCountInflight = (async () => {
    try {
      const { data: userRow } = await buscarUsuarioCached(supabase, userId, 'role')
      const role = userRow?.role != null ? String(userRow.role).trim() : ''

      // Sem role (Auth/REST lento ou 503): NÃO varrer mensagens_canal — isso saturava o Postgres.
      if (!role) {
        return badgeCountCache?.userId === userId ? badgeCountCache.value : 0
      }

      const desde = new Date(Date.now() - BADGE_JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString()

      let canalIdsPermitidos: Set<string> | null = null
      let extraFinanceiro = 0
      let paisTabLeitura = 'geral'
      let canalPorId = new Map<string, CanalPaisRow>()

      if (role === 'profissional') {
        canalIdsPermitidos = await obterIdsCanaisMensagensProfissional(supabase, userId)
        extraFinanceiro = await contarFinanceiroNaoLidasProfissional(supabase, userId)
        const { data: prof } = await supabase
          .from('profissionais')
          .select('pais, cidade_atuacao')
          .eq('usuario_id', userId)
          .maybeSingle()
        paisTabLeitura = profissionalPaisParaAba(
          prof?.pais != null ? String(prof.pais) : null,
          prof?.cidade_atuacao,
        )
        canalPorId = await carregarMapaCanaisPorIds(supabase, Array.from(canalIdsPermitidos))
      } else if (role === 'empresa') {
        canalIdsPermitidos = await obterIdsCanaisMensagensEmpresa(supabase, userId)
        extraFinanceiro = await contarFinanceiroNaoLidasEmpresa(supabase, userId)
        const { data: emp } = await supabase
          .from('empresas')
          .select('cidade')
          .eq('usuario_id', userId)
          .maybeSingle()
        paisTabLeitura = empresaPaisParaAba(emp?.cidade != null ? String(emp.cidade) : null)
        canalPorId = await carregarMapaCanaisPorIds(supabase, Array.from(canalIdsPermitidos))
      } else if (role === 'admin') {
        const [inbox, { data: adminRow }] = await Promise.all([
          contarMensagensNaoLidasInboxAdmin(supabase, userId),
          buscarUsuarioCached(supabase, userId, 'admin_level, admin_permissoes'),
        ])
        const hub = await contarAvisosFinanceiroHubNaoLidos(supabase, userId, adminRow ?? {})
        const total = inbox + hub
        badgeCountCache = { userId, at: Date.now(), value: total }
        return total
      } else {
        // turista / outros — sem inbox de canais coletivos
        badgeCountCache = { userId, at: Date.now(), value: 0 }
        return 0
      }

      if (canalIdsPermitidos != null && canalIdsPermitidos.size === 0) {
        const total = extraFinanceiro
        badgeCountCache = { userId, at: Date.now(), value: total }
        return total
      }

      const ids = canalIdsPermitidos != null ? Array.from(canalIdsPermitidos) : []

      const [{ data: mensagens, error: msgErr }, { data: leituras, error: leitErr }] =
        await Promise.all([
          supabase
            .from('mensagens_canal')
            .select('remetente_id, canal_id, created_at, pais')
            .neq('remetente_id', userId)
            .gte('created_at', desde)
            .in('canal_id', ids)
            .order('created_at', { ascending: false })
            .limit(BADGE_MSG_LIMIT),
          supabase
            .from('canal_leitura_profissional')
            .select('canal_id, visto_em')
            .eq('usuario_id', userId)
            .in('canal_id', ids),
        ])

      if (msgErr) {
        console.error('contarMensagensNaoLidasCanais mensagens:', msgErr)
        return badgeCountCache?.userId === userId ? badgeCountCache.value : 0
      }
      if (leitErr) {
        console.error('contarMensagensNaoLidasCanais leituras:', leitErr)
      }

      const vistoPorCanal = new Map<string, number>()
      for (const row of leituras ?? []) {
        const cid = String(row.canal_id)
        const t = new Date(String(row.visto_em ?? 0)).getTime()
        if (!Number.isNaN(t)) vistoPorCanal.set(cid, t)
      }

      let n = 0
      for (const row of mensagens ?? []) {
        const rid = row.remetente_id != null ? String(row.remetente_id) : ''
        if (!rid || rid === userId) continue

        const cid = row.canal_id != null ? String(row.canal_id) : ''
        if (!cid) continue
        if (canalIdsPermitidos != null && !canalIdsPermitidos.has(cid)) continue

        if (
          !mensagemContaParaLeituraColetiva(
            canalPorId.get(cid),
            row.pais != null ? String(row.pais) : null,
            {
              role,
              paisTabLeitura,
            },
          )
        ) {
          continue
        }

        const created = new Date(String(row.created_at ?? 0)).getTime()
        if (Number.isNaN(created)) continue

        const visto = vistoPorCanal.get(cid) ?? 0
        if (created > visto) n += 1
      }

      const total = n + extraFinanceiro
      badgeCountCache = { userId, at: Date.now(), value: total }
      return total
    } catch (err) {
      console.error('contarMensagensNaoLidasCanais:', err)
      return badgeCountCache?.userId === userId ? badgeCountCache.value : 0
    } finally {
      badgeCountInflight = null
      badgeCountInflightUserId = null
    }
  })()

  return badgeCountInflight
}

/**
 * Contagem de mensagens não lidas por canal (mesma regra da barra inferior).
 */
export async function contarNaoLidasPorCanalIds(
  supabase: SupabaseClient,
  userId: string,
  canalIds: string[],
): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  if (!userId || canalIds.length === 0) return out

  const { data: userRow } = await buscarUsuarioCached(supabase, userId, 'role')
  const role = userRow?.role != null ? String(userRow.role) : ''
  if (role === 'admin') {
    return contarNaoLidasPorCanalIdsAdmin(supabase, userId, canalIds)
  }

  for (const id of canalIds) out[id] = 0

  let paisTabLeitura = 'geral'
  let canalPorId = new Map<string, CanalPaisRow>()

  if (role === 'profissional') {
    const { data: prof } = await supabase
      .from('profissionais')
      .select('pais, cidade_atuacao')
      .eq('usuario_id', userId)
      .maybeSingle()
    paisTabLeitura = profissionalPaisParaAba(
      prof?.pais != null ? String(prof.pais) : null,
      prof?.cidade_atuacao,
    )
    canalPorId = await carregarMapaCanaisPorIds(supabase, canalIds)
  } else if (role === 'empresa') {
    const { data: emp } = await supabase.from('empresas').select('cidade').eq('usuario_id', userId).maybeSingle()
    paisTabLeitura = empresaPaisParaAba(emp?.cidade != null ? String(emp.cidade) : null)
    canalPorId = await carregarMapaCanaisPorIds(supabase, canalIds)
  }

  const { data: leituras } = await supabase
    .from('canal_leitura_profissional')
    .select('canal_id, visto_em')
    .eq('usuario_id', userId)
    .in('canal_id', canalIds)

  const vistoPorCanal = new Map<string, number>()
  for (const row of leituras ?? []) {
    const t = new Date(String(row.visto_em ?? 0)).getTime()
    if (!Number.isNaN(t)) vistoPorCanal.set(String(row.canal_id), t)
  }

  const desde = new Date(Date.now() - BADGE_JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString()
  const { data: mensagens, error } = await supabase
    .from('mensagens_canal')
    .select('canal_id, remetente_id, created_at, pais')
    .in('canal_id', canalIds)
    .neq('remetente_id', userId)
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(BADGE_MSG_LIMIT)

  if (error) {
    console.error('contarNaoLidasPorCanalIds:', error)
    return out
  }

  for (const row of mensagens ?? []) {
    const cid = row.canal_id != null ? String(row.canal_id) : ''
    const rid = row.remetente_id != null ? String(row.remetente_id) : ''
    if (!cid || !rid || rid === userId) continue

    if (
      !mensagemContaParaLeituraColetiva(canalPorId.get(cid), row.pais != null ? String(row.pais) : null, {
        role,
        paisTabLeitura,
      })
    ) {
      continue
    }

    const created = new Date(String(row.created_at ?? 0)).getTime()
    if (Number.isNaN(created)) continue

    const visto = vistoPorCanal.get(cid) ?? 0
    if (created > visto) out[cid] = (out[cid] ?? 0) + 1
  }

  return out
}
