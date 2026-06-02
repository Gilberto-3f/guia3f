import type { SupabaseClient } from '@supabase/supabase-js'
import { inserirNotificacaoCanalFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresa'
import { inserirNotificacaoCanalFinanceiroProfissional } from '@/lib/canalFinanceiroProfissional'

const TITULO_APROVACAO = 'Cadastro aprovado'

export function montarMensagemAprovacaoCadastro(nomeUsuario: string): string {
  const handle = nomeUsuario.trim().replace(/^@+/, '')
  const user = handle ? `@${handle}` : '@usuario'
  return `Bem-Vindo ${user},

Sua documentação foi checada e está tudo em ordem, seu cadastro em nosso ecossistema foi aprovado e os benefícios da sua categoria já estão liberados para você.

Desejamos um bom uso do aplicativo e torcemos para você fazer bons negócios com a 3F, nossa ferramenta de trabalho.

Atenciosamente, Grupo Cacique`
}

/**
 * Notifica profissional ou empresa no canal financeiro privado após liberação do cadastro.
 */
export async function enviarMensagemAprovacaoCanalFinanceiro(
  supabase: SupabaseClient,
  params: {
    tipo: 'profissional' | 'empresa'
    usuarioId: string
    nomeUsuario: string
  },
): Promise<{ ok: boolean; error?: string }> {
  const uid = params.usuarioId?.trim()
  if (!uid) return { ok: false, error: 'usuario_id_vazio' }

  const mensagem = montarMensagemAprovacaoCadastro(params.nomeUsuario)

  if (params.tipo === 'profissional') {
    const res = await inserirNotificacaoCanalFinanceiroProfissional(supabase, {
      profissionalUsuarioId: uid,
      tipo: 'mensagem_adm',
      titulo: TITULO_APROVACAO,
      mensagem,
    })
    if (!res.ok) {
      console.error('[canalFinanceiroAprovacao] profissional', res.error)
      return { ok: false, error: res.error ?? 'insert_falhou' }
    }
    return { ok: true }
  }

  const res = await inserirNotificacaoCanalFinanceiroEmpresa(supabase, {
    empresaUsuarioId: uid,
    tipo: 'mensagem_adm',
    titulo: TITULO_APROVACAO,
    mensagem,
  })
  if (!res.ok) {
    console.error('[canalFinanceiroAprovacao] empresa', res.error)
    return { ok: false, error: res.error ?? 'insert_falhou' }
  }
  return { ok: true }
}
