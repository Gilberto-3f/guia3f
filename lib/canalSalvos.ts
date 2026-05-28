import type { SupabaseClient } from '@supabase/supabase-js'

export async function listarIdsMensagensSalvasCanal(
  supabase: SupabaseClient,
  usuarioId: string,
  canalId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('mensagens_canal_salvas')
    .select('mensagem_id')
    .eq('usuario_id', usuarioId)
    .eq('canal_id', canalId)

  if (error) {
    console.error('listarIdsMensagensSalvasCanal:', error)
    return new Set()
  }

  return new Set((data ?? []).map((r) => String(r.mensagem_id)))
}

export async function toggleSalvarMensagemCanal(
  supabase: SupabaseClient,
  usuarioId: string,
  canalId: string,
  mensagemId: string,
  salvoAtual: boolean,
): Promise<boolean> {
  if (salvoAtual) {
    const { error } = await supabase
      .from('mensagens_canal_salvas')
      .delete()
      .eq('usuario_id', usuarioId)
      .eq('mensagem_id', mensagemId)
    if (error) throw error
    return false
  }

  const { error } = await supabase.from('mensagens_canal_salvas').insert({
    usuario_id: usuarioId,
    mensagem_id: mensagemId,
    canal_id: canalId,
  })
  if (error) throw error
  return true
}
