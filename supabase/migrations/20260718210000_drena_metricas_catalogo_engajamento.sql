-- Métricas de engajamento do Catálogo Drena-Stok (favoritos + reposts).
-- SECURITY DEFINER: agrega favoritos/item_salvo além do RLS do usuário logado.

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
  v_salvos_posts BIGINT := 0;
  v_reposts BIGINT := 0;
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

  -- Favoritos de produtos (página /favoritos dos turistas)
  SELECT COUNT(*)::bigint INTO v_favoritos
  FROM public.favoritos f
  WHERE COALESCE(f.alvo_tipo, '') = 'produto'
    AND f.alvo_id IN (
      SELECT p.id FROM public.produtos p WHERE p.empresa_id = p_empresa_id
    )
    AND (
      p_desde IS NULL
      OR COALESCE(f.salvo_em, TIMESTAMPTZ '-infinity') >= p_desde
    );

  -- Publicações Salvas (menu lateral) em posts de catálogo da empresa
  SELECT COUNT(*)::bigint INTO v_salvos_posts
  FROM public.item_salvo s
  INNER JOIN public.posts po ON po.id = s.post_id
  WHERE po.empresa_id = p_empresa_id
    AND po.deleted_at IS NULL
    AND lower(COALESCE(po.tipo, '')) = 'catalogo_produtos'
    AND (p_desde IS NULL OR COALESCE(s.salvo_em, TIMESTAMPTZ '-infinity') >= p_desde);

  -- Reposts no feed de posts de catálogo da empresa
  SELECT COUNT(*)::bigint INTO v_reposts
  FROM public.posts r
  WHERE r.deleted_at IS NULL
    AND r.post_original_id IN (
      SELECT po.id
      FROM public.posts po
      WHERE po.empresa_id = p_empresa_id
        AND po.deleted_at IS NULL
        AND lower(COALESCE(po.tipo, '')) = 'catalogo_produtos'
    )
    AND (p_desde IS NULL OR r.created_at >= p_desde);

  RETURN jsonb_build_object(
    'favoritos', COALESCE(v_favoritos, 0) + COALESCE(v_salvos_posts, 0),
    'repostados', COALESCE(v_reposts, 0)
  );
END;
$$;

COMMENT ON FUNCTION public.drena_metricas_catalogo_engajamento(UUID, TIMESTAMPTZ) IS
  'Drena Catálogo: soma favoritos de produtos + item_salvo de posts catalogo_produtos; e reposts desses posts.';

GRANT EXECUTE ON FUNCTION public.drena_metricas_catalogo_engajamento(UUID, TIMESTAMPTZ) TO authenticated;
