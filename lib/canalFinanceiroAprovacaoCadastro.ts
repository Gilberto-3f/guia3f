import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ASSUNTO_CONVERSA_APROVACAO_CADASTRO,
  abrirConversaFinanceiroAdm,
  buscarConversaAbertaParaAlvo,
  conversaFinanceiroSomenteLeitura,
  encerrarConversaFinanceiro,
  enviarMensagemConversaFinanceiro,
} from '@/lib/financeiroConversas'

export function montarMensagemAprovacaoCadastro(nomeUsuario: string): string {
  const handle = nomeUsuario.trim().replace(/^@+/, '')
  const user = handle ? `@${handle}` : '@usuario'
  return `Bem-Vindo ${user},

Sua documentação foi checada e está tudo em ordem, seu cadastro em nosso ecossistema foi aprovado e os benefícios da sua categoria já estão liberados para você.

Desejamos um bom uso do aplicativo e torcemos para você fazer bons negócios com a 3F, nossa ferramenta de trabalho.

Atenciosamente, Grupo Cacique`
}

/**
 * Envia mensagem de boas-vindas na aba Mensagens ADM (financeiro_conversas + financeiro_mensagens)
 * após liberação do cadastro de profissional ou empresa.
 */
export async function enviarMensagemAprovacaoCanalFinanceiro(
  supabase: SupabaseClient,
  params: {
    tipo: 'profissional' | 'empresa'
    usuarioId: string
    nomeUsuario: string
    admUsuarioId: string
  },
): Promise<{ ok: boolean; error?: string }> {
  const uid = params.usuarioId?.trim()
  const admId = params.admUsuarioId?.trim()
  if (!uid || !admId) return { ok: false, error: 'ids_vazios' }

  const mensagem = montarMensagemAprovacaoCadastro(params.nomeUsuario)

  let conversa = await buscarConversaAbertaParaAlvo(supabase, uid)
  if (!conversa) {
    const res = await abrirConversaFinanceiroAdm(supabase, {
      admUsuarioId: admId,
      alvoUsuarioId: uid,
      alvoTipo: params.tipo,
      assunto: ASSUNTO_CONVERSA_APROVACAO_CADASTRO,
    })
    if (!res.ok || !res.conversa?.id) {
      console.error('[canalFinanceiroAprovacao] abrir conversa', res.error)
      return { ok: false, error: res.error ?? 'conversa_falhou' }
    }
    conversa = res.conversa
  }

  const { count } = await supabase
    .from('financeiro_mensagens')
    .select('id', { count: 'exact', head: true })
    .eq('conversa_id', conversa.id)
    .ilike('texto', 'Bem-Vindo%')

  if (count && count > 0) {
    if (conversa.status === 'aberta' && conversaFinanceiroSomenteLeitura(conversa)) {
      await encerrarConversaFinanceiro(supabase, conversa.id, {
        admUsuarioId: conversa.adm_usuario_id || admId,
      })
    }
    return { ok: true }
  }

  const remetenteId = conversa.adm_usuario_id || admId
  const msg = await enviarMensagemConversaFinanceiro(supabase, {
    conversaId: conversa.id,
    remetenteId,
    texto: mensagem,
  })

  if (!msg.ok) {
    console.error('[canalFinanceiroAprovacao] enviar mensagem', msg.error)
    return { ok: false, error: msg.error ?? 'mensagem_falhou' }
  }

  await encerrarConversaFinanceiro(supabase, conversa.id, { admUsuarioId: remetenteId })

  return { ok: true }
}
