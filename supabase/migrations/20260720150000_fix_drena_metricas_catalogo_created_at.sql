-- Fix Drena Catálogo Feedback: favoritos.salvo_em não existe no remoto (usa created_at).
-- Favoritos: produtos salvos por outros usuários e mantidos > 1 minuto.
-- Repostados: só reposts de posts catalogo_produtos (sem curtidas/comentários/salvos).

CREATE OR REPLACE FUNCTION public.drena_metricas_catalogo_engajamento(
  p_empresa_id UUID,
  p_desde TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_favoritos BIGINT := 0;
  v_reposts BIGINT := 0;
  v_empresa_usuario UUID;
BEGIN
  IF p_empresa_id IS NULL THEN
    RETURN jsonb_build_object('favoritos', 0, 'repostados', 0);
  END IF;

  IF NOT (
    EXISTS (
      SELECT 1
      FROM public.empresas e
      WHERE e.id = p_empresa_id
        AND e.usuario_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.usuarios u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado às métricas do catálogo';
  END IF;

  SELECT e.usuario_id INTO v_empresa_usuario
  FROM public.empresas e
  WHERE e.id = p_empresa_id;

  -- Favoritos: produtos ainda salvos (>1 min) por outros usuários.
  -- Remoto usa created_at (coluna salvo_em não existe na tabela favoritos polimórfica).
  SELECT COUNT(*)::bigint INTO v_favoritos
  FROM public.favoritos f
  INNER JOIN public.produtos p ON p.id = f.alvo_id
  WHERE COALESCE(f.alvo_tipo, '') = 'produto'
    AND p.empresa_id = p_empresa_id
    AND (v_empresa_usuario IS NULL OR f.usuario_id IS DISTINCT FROM v_empresa_usuario)
    AND COALESCE(f.created_at, TIMESTAMPTZ '-infinity') <= (NOW() - INTERVAL '1 minute')
    AND (
      p_desde IS NULL
      OR COALESCE(f.created_at, TIMESTAMPTZ '-infinity') >= p_desde
    );

  -- Repostados: vezes que posts de catálogo da empresa foram repostados no feed.
  SELECT COUNT(*)::bigint INTO v_reposts
  FROM public.posts r
  INNER JOIN public.posts po ON po.id = r.post_original_id
  WHERE r.deleted_at IS NULL
    AND po.deleted_at IS NULL
    AND r.post_original_id IS NOT NULL
    AND lower(COALESCE(po.tipo, '')) = 'catalogo_produtos'
    AND (
      po.empresa_id = p_empresa_id
      OR (
        po.avaliacao_meta IS NOT NULL
        AND (po.avaliacao_meta->>'empresa_id') ~* '^[0-9a-f-]{36}$'
        AND (po.avaliacao_meta->>'empresa_id')::uuid = p_empresa_id
      )
    )
    AND (v_empresa_usuario IS NULL OR r.autor_id IS DISTINCT FROM v_empresa_usuario)
    AND (p_desde IS NULL OR r.created_at >= p_desde);

  RETURN jsonb_build_object(
    'favoritos', COALESCE(v_favoritos, 0),
    'repostados', COALESCE(v_reposts, 0)
  );
END;
$$;

COMMENT ON FUNCTION public.drena_metricas_catalogo_engajamento(UUID, TIMESTAMPTZ) IS
  'Drena Catálogo Feedback: favoritos de produtos (created_at >1 min, outros usuários) + reposts de catalogo_produtos.';

GRANT EXECUTE ON FUNCTION public.drena_metricas_catalogo_engajamento(UUID, TIMESTAMPTZ) TO authenticated;
