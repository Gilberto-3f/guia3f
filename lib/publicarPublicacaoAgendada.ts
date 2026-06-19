import type { SupabaseClient } from '@supabase/supabase-js'

export type TipoConteudoAgendado = 'story' | 'foto' | 'texto'

export type PublicacaoAgendadaRow = {
  id: string
  usuario_id: string
  empresa_id?: string | null
  tipo_conteudo: TipoConteudoAgendado
  texto?: string | null
  foto_url?: string | null
  conteudo_url?: string | null
  story_meta?: Record<string, unknown> | null
  autor_tipo?: string | null
  agendado_para: string
  status: string
}

function textoSobrepostoPadrao(legenda: string | null | undefined) {
  return {
    texto: legenda?.trim() || null,
    posicao_x: 50,
    posicao_y: 70,
    link_posicao_x: 50,
    link_posicao_y: 82,
    fundo_fit: 'contain',
    fundo_scale: 1,
    fundo_pan_x_pct: 0,
    fundo_pan_y_pct: 0,
    texto_scale: 1,
  }
}

export async function publicarPublicacaoAgendada(
  admin: SupabaseClient,
  row: PublicacaoAgendadaRow,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = row.conteudo_url ?? row.foto_url ?? null
  const texto = row.texto?.trim() || null

  try {
    if (row.tipo_conteudo === 'story') {
      if (!url) return { ok: false, error: 'Story sem arquivo de mídia.' }
      const meta = row.story_meta && typeof row.story_meta === 'object' ? row.story_meta : {}
      const expira = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      const { error } = await admin.from('stories').insert({
        autor_id: row.usuario_id,
        autor_tipo: row.autor_tipo ?? 'empresa',
        tipo: 'foto',
        conteudo_url: url,
        texto_sobreposto: meta.texto_sobreposto ?? textoSobrepostoPadrao(texto),
        link: typeof meta.link === 'string' ? meta.link : null,
        marcacoes: Array.isArray(meta.marcacoes) ? meta.marcacoes : [],
        expira_em: expira,
        duracao_segundos: 60,
        created_at: row.agendado_para,
      })
      if (error) {
        await admin
          .from('publicacoes_agendadas')
          .update({ status: 'erro', erro_msg: error.message })
          .eq('id', row.id)
        return { ok: false, error: error.message }
      }
    } else {
      const tipo = row.tipo_conteudo === 'texto' ? 'texto' : url && texto ? 'misto' : url ? 'foto' : 'texto'
      if (tipo !== 'texto' && !url) return { ok: false, error: 'Publicação de foto sem imagem.' }
      if (tipo === 'texto' && !texto) return { ok: false, error: 'Publicação de texto vazia.' }
      const { error } = await admin.from('posts').insert({
        autor_id: row.usuario_id,
        texto: tipo === 'texto' || texto ? texto : null,
        foto_url: url,
        conteudo_url: url,
        tipo,
        created_at: row.agendado_para,
      })
      if (error) {
        await admin
          .from('publicacoes_agendadas')
          .update({ status: 'erro', erro_msg: error.message })
          .eq('id', row.id)
        return { ok: false, error: error.message }
      }
    }

    const { error: updErr } = await admin
      .from('publicacoes_agendadas')
      .update({ status: 'publicado', publicado_em: new Date().toISOString(), erro_msg: null })
      .eq('id', row.id)
      .eq('status', 'pendente')

    if (updErr) return { ok: false, error: updErr.message }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro_desconhecido'
    await admin
      .from('publicacoes_agendadas')
      .update({ status: 'erro', erro_msg: msg })
      .eq('id', row.id)
    return { ok: false, error: msg }
  }
}

export async function processarPublicacoesAgendadasVencidas(
  admin: SupabaseClient,
): Promise<{ processadas: number; erros: number }> {
  const agora = new Date().toISOString()
  const { data, error } = await admin
    .from('publicacoes_agendadas')
    .select('*')
    .eq('status', 'pendente')
    .lte('agendado_para', agora)
    .order('agendado_para', { ascending: true })
    .limit(50)

  if (error) throw error

  let processadas = 0
  let erros = 0

  for (const raw of data ?? []) {
    const row = raw as PublicacaoAgendadaRow
    const res = await publicarPublicacaoAgendada(admin, row)
    if (res.ok) processadas += 1
    else erros += 1
  }

  return { processadas, erros }
}

/** Limite máximo de agendamento: 1 mês a partir de agora. */
export function limiteAgendamentoUmMes(): Date {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d
}

export function dataHoraAgendamentoValida(isoLocal: string): string | null {
  if (!isoLocal?.trim()) return null
  const dt = new Date(isoLocal)
  if (Number.isNaN(dt.getTime())) return null
  const agora = new Date()
  if (dt.getTime() < agora.getTime() - 60_000) return null
  if (dt.getTime() > limiteAgendamentoUmMes().getTime()) return null
  return dt.toISOString()
}

export function formatarInputDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function minDatetimeLocalInput(): string {
  return formatarInputDatetimeLocal(new Date())
}

export function maxDatetimeLocalInput(): string {
  return formatarInputDatetimeLocal(limiteAgendamentoUmMes())
}
