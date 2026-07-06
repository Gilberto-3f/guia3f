-- Garante funções usadas pelos triggers de atividades (curtida, comentário, repost).
-- Idempotente: corrige prod onde 20260729130000 foi aplicada sem 20260516100000.

CREATE OR REPLACE FUNCTION public.usuario_tem_role_empresa (p_usuario_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = p_usuario_id
      AND lower(coalesce(u.role::text, '')) = 'empresa'
  );
$$;

CREATE OR REPLACE FUNCTION public.deve_bloquear_atividade_entre_empresas (
  p_autor_conteudo UUID,
  p_interator_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.usuario_tem_role_empresa(p_autor_conteudo)
    AND public.usuario_tem_role_empresa(p_interator_id);
$$;

COMMENT ON FUNCTION public.deve_bloquear_atividade_entre_empresas (UUID, UUID) IS
'Bloqueia notificação de atividade quando autor do conteúdo e interator são ambos role empresa.';

ALTER FUNCTION public.usuario_tem_role_empresa (UUID) OWNER TO postgres;
ALTER FUNCTION public.deve_bloquear_atividade_entre_empresas (UUID, UUID) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.usuario_tem_role_empresa (UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deve_bloquear_atividade_entre_empresas (UUID, UUID) TO authenticated;
