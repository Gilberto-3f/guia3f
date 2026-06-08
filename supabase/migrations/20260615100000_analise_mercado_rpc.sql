-- Análise de Mercado (dashboard empresa): agregações anônimas por segmento via RPC.

CREATE OR REPLACE FUNCTION public.normalizar_segmento_mercado(raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n TEXT;
BEGIN
  n := lower(trim(both FROM coalesce(raw, '')));
  n := translate(n, 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');

  IF n = '' THEN
    RETURN NULL;
  END IF;

  IF n LIKE '%gastronom%' OR n LIKE '%restaur%' OR n IN ('gastronomia', 'restaurantes') THEN
    RETURN 'gastronomia';
  END IF;
  IF n LIKE '%atrat%' OR n LIKE '%passeio%' OR n IN ('atrativos', 'passeios') THEN
    RETURN 'atrativos';
  END IF;
  IF n LIKE '%loja%' OR n LIKE '%paraguai%' OR n IN ('lojas', 'compras paraguai') THEN
    RETURN 'lojas';
  END IF;
  IF n LIKE '%hotel%' OR n LIKE '%hosped%' OR n = 'hospedagem' THEN
    RETURN 'hospedagem';
  END IF;
  IF n LIKE '%servic%' OR n LIKE '%servi%local%' OR n IN ('servicos', 'servicos_locais', 'servicos locais') THEN
    RETURN 'servicos';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.pode_acessar_analise_mercado()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresas e WHERE e.usuario_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.rpc_analise_mercado(
  p_desde TIMESTAMPTZ DEFAULT NULL,
  p_empresa_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.pode_acessar_analise_mercado() THEN
    RAISE EXCEPTION 'Acesso negado à análise de mercado';
  END IF;

  WITH
  empresas_seg AS (
    SELECT
      e.id,
      e.usuario_id,
      public.normalizar_segmento_mercado(e.categoria) AS segmento
    FROM public.empresas e
    WHERE public.normalizar_segmento_mercado(e.categoria) IS NOT NULL
  ),
  visitas_pv AS (
    SELECT es.segmento, COUNT(*)::bigint AS total
    FROM public.perfil_visitas pv
    JOIN empresas_seg es ON es.id = pv.empresa_id
    WHERE pv.tipo_alvo = 'empresa'
      AND (p_desde IS NULL OR pv.visitado_em >= p_desde)
    GROUP BY es.segmento
  ),
  visitas_log AS (
    SELECT es.segmento, COUNT(*)::bigint AS total
    FROM public.log_visita lv
    JOIN empresas_seg es ON es.id = lv.empresa_id
    WHERE p_desde IS NULL OR lv.created_at >= p_desde
    GROUP BY es.segmento
  ),
  visibilidade AS (
    SELECT segmento, SUM(total)::bigint AS total
    FROM (
      SELECT * FROM visitas_pv
      UNION ALL
      SELECT * FROM visitas_log
    ) u
    GROUP BY segmento
  ),
  posts_emp AS (
    SELECT p.id, es.segmento, coalesce(p.total_compartilhamentos, 0)::bigint AS compartilhamentos
    FROM public.posts p
    JOIN empresas_seg es ON es.usuario_id = p.autor_id
    WHERE p.deleted_at IS NULL
  ),
  eng_avaliacoes AS (
    SELECT es.segmento, COUNT(*)::bigint AS total
    FROM public.avaliacoes a
    JOIN empresas_seg es ON es.id = a.empresa_id
    WHERE p_desde IS NULL OR a.created_at >= p_desde
    GROUP BY es.segmento
  ),
  eng_curtidas AS (
    SELECT pe.segmento, COUNT(*)::bigint AS total
    FROM public.curtidas c
    JOIN posts_emp pe ON pe.id = c.post_id
    WHERE c.post_id IS NOT NULL
      AND (p_desde IS NULL OR c.created_at >= p_desde)
    GROUP BY pe.segmento
  ),
  eng_comentarios AS (
    SELECT pe.segmento, COUNT(*)::bigint AS total
    FROM public.comentarios cm
    JOIN posts_emp pe ON pe.id = cm.post_id
    WHERE p_desde IS NULL OR cm.created_at >= p_desde
    GROUP BY pe.segmento
  ),
  eng_salvos AS (
    SELECT pe.segmento, COUNT(*)::bigint AS total
    FROM public.item_salvo s
    JOIN posts_emp pe ON pe.id = s.post_id
    WHERE p_desde IS NULL OR s.salvo_em >= p_desde
    GROUP BY pe.segmento
  ),
  eng_reposts AS (
    SELECT pe.segmento, COUNT(*)::bigint AS total
    FROM public.posts rp
    JOIN posts_emp pe ON pe.id = rp.post_original_id
    WHERE rp.deleted_at IS NULL
      AND (p_desde IS NULL OR rp.created_at >= p_desde)
    GROUP BY pe.segmento
  ),
  eng_compartilhamentos AS (
    SELECT segmento, SUM(compartilhamentos)::bigint AS total
    FROM posts_emp
    GROUP BY segmento
  ),
  engajamento AS (
    SELECT segmento, SUM(total)::bigint AS total
    FROM (
      SELECT * FROM eng_avaliacoes
      UNION ALL SELECT * FROM eng_curtidas
      UNION ALL SELECT * FROM eng_comentarios
      UNION ALL SELECT * FROM eng_salvos
      UNION ALL SELECT * FROM eng_reposts
      UNION ALL SELECT * FROM eng_compartilhamentos
    ) u
    GROUP BY segmento
  ),
  recomendados AS (
    SELECT es.segmento, COUNT(*)::bigint AS total
    FROM public.recomendacoes r
    JOIN empresas_seg es ON es.id = r.empresa_id
    WHERE p_desde IS NULL OR r.created_at >= p_desde
    GROUP BY es.segmento
  ),
  comissao_seg AS (
    SELECT
      es.segmento,
      ROUND(AVG(c.valor)::numeric, 2) AS media,
      COUNT(*)::bigint AS quantidade
    FROM public.comissao c
    JOIN empresas_seg es ON es.id = c.empresa_id
    WHERE c.valor IS NOT NULL
      AND (p_desde IS NULL OR c.created_at >= p_desde)
    GROUP BY es.segmento
  ),
  comissao_emp AS (
    SELECT
      ROUND(AVG(c.valor)::numeric, 2) AS media,
      COUNT(*)::bigint AS quantidade
    FROM public.comissao c
    WHERE p_empresa_id IS NOT NULL
      AND c.empresa_id = p_empresa_id
      AND c.valor IS NOT NULL
      AND (p_desde IS NULL OR c.created_at >= p_desde)
  ),
  segmentos AS (
    SELECT unnest(ARRAY['gastronomia', 'atrativos', 'lojas', 'hospedagem', 'servicos']) AS segmento
  )
  SELECT jsonb_build_object(
    'visibilidade',
    (
      SELECT coalesce(jsonb_agg(jsonb_build_object('segmento', s.segmento, 'total', coalesce(v.total, 0)) ORDER BY coalesce(v.total, 0) DESC), '[]'::jsonb)
      FROM segmentos s
      LEFT JOIN visibilidade v ON v.segmento = s.segmento
    ),
    'engajamento',
    (
      SELECT coalesce(jsonb_agg(jsonb_build_object('segmento', s.segmento, 'total', coalesce(e.total, 0)) ORDER BY coalesce(e.total, 0) DESC), '[]'::jsonb)
      FROM segmentos s
      LEFT JOIN engajamento e ON e.segmento = s.segmento
    ),
    'recomendados',
    (
      SELECT coalesce(jsonb_agg(jsonb_build_object('segmento', s.segmento, 'total', coalesce(r.total, 0)) ORDER BY coalesce(r.total, 0) DESC), '[]'::jsonb)
      FROM segmentos s
      LEFT JOIN recomendados r ON r.segmento = s.segmento
    ),
    'comissao',
    (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'segmento', s.segmento,
          'media', coalesce(cs.media, 0),
          'quantidade', coalesce(cs.quantidade, 0)
        ) ORDER BY coalesce(cs.media, 0) DESC
      ), '[]'::jsonb)
      FROM segmentos s
      LEFT JOIN comissao_seg cs ON cs.segmento = s.segmento
    ),
    'comissao_empresa',
    (
      SELECT CASE
        WHEN p_empresa_id IS NULL THEN jsonb_build_object('media', 0, 'quantidade', 0)
        ELSE coalesce(
          (SELECT jsonb_build_object('media', coalesce(media, 0), 'quantidade', coalesce(quantidade, 0)) FROM comissao_emp),
          jsonb_build_object('media', 0, 'quantidade', 0)
        )
      END
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_analise_mercado(TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_acessar_analise_mercado() TO authenticated;

COMMENT ON FUNCTION public.rpc_analise_mercado IS
  'Agregados anônimos por segmento para Análise de Mercado (visibilidade, engajamento, recomendações, comissão).';
