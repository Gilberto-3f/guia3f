-- Normaliza timeouts 57014 → API Gateway 503 e Storage 544.
--
-- Sintoma 20/08/2026:
--   1) Postgres 57014 (statement timeout)
--   2) POST /rpc/contar_ecossistema_nao_lidas_membro 503
--   3) GET ecossistema_conversas / posts / posts_com_autores 503
--   4) GET usuarios / profissionais / empresas / planos 503 (lookups simples = pool saturado)
--   5) Storage GET /object/info/public/stories/... 544 (metadata do objeto no Postgres)
--
-- Causa: consulta pesada segura o pool; o restante falha. Índices nos JOINs do feed
-- + RPC que falha rápido (não derruba o pool) + leitura pública do bucket stories.

-- ========== posts / posts_com_autores ==========
-- View posts_com_autores faz LEFT JOIN em turistas/profissionais/empresas por usuario_id.
-- Sem índice em empresas.usuario_id (o único existente é PARCIAL, só preview) o join
-- vira seq scan e estoura statement_timeout — primeiro 503 do burst (15:23:03).

CREATE INDEX IF NOT EXISTS idx_empresas_usuario_id
  ON public.empresas (usuario_id);

CREATE INDEX IF NOT EXISTS idx_turistas_usuario_id
  ON public.turistas (usuario_id);

-- Aba Repostados do perfil:
-- posts?autor_id=eq.&post_original_id=not.is.null&deleted_at=is.null&order=created_at.desc
CREATE INDEX IF NOT EXISTS idx_posts_autor_reposts_ativos
  ON public.posts (autor_id, created_at DESC)
  WHERE deleted_at IS NULL
    AND post_original_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_autor_ativos_created
  ON public.posts (autor_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ========== planos (GET ?ativo=eq.true) ==========
CREATE INDEX IF NOT EXISTS idx_planos_ativos
  ON public.planos (id)
  WHERE ativo = true;

-- ========== RPC badge chat ADM (membro) ==========
-- Evita JOIN em usuarios por mensagem; filtra admins via idx_usuarios_role.
-- statement_timeout curto + swallow: badge some, o pool não trava.

CREATE OR REPLACE FUNCTION public.contar_ecossistema_nao_lidas_membro(p_membro_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
SET lock_timeout = '800ms'
SET statement_timeout = '1500ms'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_conversa UUID;
  v_visto TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  IF v_uid IS NULL OR p_membro_id IS NULL THEN
    RETURN 0;
  END IF;
  IF v_uid <> p_membro_id AND NOT public.is_admin() THEN
    RETURN 0;
  END IF;

  SELECT c.id INTO v_conversa
  FROM public.ecossistema_conversas c
  WHERE c.membro_usuario_id = p_membro_id
    AND c.status = 'aberta'
  LIMIT 1;

  IF v_conversa IS NULL THEN
    RETURN 0;
  END IF;

  SELECT l.visto_em INTO v_visto
  FROM public.ecossistema_conversa_leitura l
  WHERE l.usuario_id = p_membro_id
    AND l.conversa_id = v_conversa;

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.ecossistema_mensagens m
  WHERE m.conversa_id = v_conversa
    AND m.created_at > COALESCE(v_visto, '-infinity'::timestamptz)
    AND m.remetente_id <> p_membro_id
    AND m.remetente_id IN (
      SELECT u.id FROM public.usuarios u WHERE u.role = 'admin'
    );

  RETURN COALESCE(v_count, 0);
EXCEPTION
  WHEN lock_not_available THEN
    RETURN 0;
  WHEN query_canceled THEN
    RETURN 0;
END;
$$;

COMMENT ON FUNCTION public.contar_ecossistema_nao_lidas_membro(UUID) IS
  'Badge chat ADM (membro): mensagens de admin após última leitura. Timeout curto; em carga retorna 0.';

GRANT EXECUTE ON FUNCTION public.contar_ecossistema_nao_lidas_membro(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.contar_ecossistema_nao_lidas_adm(p_visto_em TIMESTAMPTZ DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
SET lock_timeout = '800ms'
SET statement_timeout = '1500ms'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_desde TIMESTAMPTZ := COALESCE(p_visto_em, '-infinity'::timestamptz);
  v_count INTEGER;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin() THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.ecossistema_mensagens m
  INNER JOIN public.ecossistema_conversas c ON c.id = m.conversa_id
  WHERE c.status = 'aberta'
    AND m.created_at > v_desde
    AND m.remetente_id <> v_uid
    AND m.remetente_id IN (
      SELECT u.id FROM public.usuarios u WHERE u.role IN ('turista', 'profissional', 'empresa')
    );

  RETURN COALESCE(v_count, 0);
EXCEPTION
  WHEN lock_not_available THEN
    RETURN 0;
  WHEN query_canceled THEN
    RETURN 0;
END;
$$;

COMMENT ON FUNCTION public.contar_ecossistema_nao_lidas_adm(TIMESTAMPTZ) IS
  'Badge Mensageiro ECOSSISTEMA (ADM). Timeout curto; em carga retorna 0.';

GRANT EXECUTE ON FUNCTION public.contar_ecossistema_nao_lidas_adm(TIMESTAMPTZ) TO authenticated;

-- ========== Storage stories (544 em /object/info/public/stories/...) ==========
UPDATE storage.buckets
SET public = TRUE
WHERE id = 'stories';

DROP POLICY IF EXISTS "stories storage leitura" ON storage.objects;
CREATE POLICY "stories storage leitura" ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'stories');

ANALYZE public.posts;
ANALYZE public.empresas;
ANALYZE public.turistas;
ANALYZE public.profissionais;
ANALYZE public.planos;
ANALYZE public.ecossistema_conversas;
ANALYZE public.ecossistema_mensagens;
ANALYZE public.usuarios;
