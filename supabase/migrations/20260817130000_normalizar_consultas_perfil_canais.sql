-- Reduz scans e custo de autorização observados no burst de carregamento do perfil.

CREATE INDEX IF NOT EXISTS idx_profissionais_usuario_id
ON public.profissionais (usuario_id);

CREATE INDEX IF NOT EXISTS idx_mensagens_canal_canal_created
ON public.mensagens_canal (canal_id, created_at DESC)
INCLUDE (remetente_id, pais);

-- A função SECURITY DEFINER já centraliza as mesmas regras atuais de acesso ao canal.
-- Evita repetir toda a árvore de RLS de canais/usuários/profissionais para cada mensagem.
DROP POLICY IF EXISTS "mensagens select se canal acessível" ON public.mensagens_canal;

CREATE POLICY "mensagens select se canal acessível"
ON public.mensagens_canal
FOR SELECT
TO authenticated
USING (public.usuario_pode_ver_canal_mensagem(canal_id));

