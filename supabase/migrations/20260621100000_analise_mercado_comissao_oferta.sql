-- Análise de Mercado: média de comissão a partir de ofertas cadastradas (comissao_oferta).

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
  ofertas_vigentes AS (
    SELECT
      co.empresa_id,
      co.beneficios,
      es.segmento
    FROM public.comissao_oferta co
    JOIN empresas_seg es ON es.id = co.empresa_id
    WHERE co.status IN ('pendente', 'aprovada')
      AND (
        co.data_validade >= CURRENT_DATE
        OR co.data_validade = DATE '2099-12-31'
        OR coalesce((co.beneficios->>'por_tempo_limitado')::boolean, false) = false
      )
      AND (p_desde IS NULL OR co.created_at >= p_desde)
  ),
  comissao_vals AS (
    SELECT
      segmento,
      CASE
        WHEN coalesce((beneficios->'pax'->>'ativo')::boolean, false)
        THEN nullif((beneficios->'pax'->>'valor')::numeric, 0)
        ELSE NULL
      END AS val_pax,
      CASE
        WHEN coalesce((beneficios->'percentual'->>'ativo')::boolean, false)
        THEN nullif((beneficios->'percentual'->>'valor')::numeric, 0)
        ELSE NULL
      END AS val_percentual,
      CASE
        WHEN coalesce((beneficios->'fixo'->>'ativo')::boolean, false)
        THEN nullif((beneficios->'fixo'->>'valor')::numeric, 0)
        ELSE NULL
      END AS val_indicacao
    FROM ofertas_vigentes
  ),
  comissao_seg AS (
    SELECT
      segmento,
      ROUND(AVG(val_pax) FILTER (WHERE val_pax IS NOT NULL), 2) AS media_pax,
      ROUND(AVG(val_percentual) FILTER (WHERE val_percentual IS NOT NULL), 2) AS media_percentual,
      ROUND(AVG(val_indicacao) FILTER (WHERE val_indicacao IS NOT NULL), 2) AS media_indicacao,
      COUNT(*)::bigint AS quantidade
    FROM comissao_vals
    GROUP BY segmento
  ),
  comissao_emp_vals AS (
    SELECT
      CASE
        WHEN coalesce((beneficios->'pax'->>'ativo')::boolean, false)
        THEN nullif((beneficios->'pax'->>'valor')::numeric, 0)
        ELSE NULL
      END AS val_pax,
      CASE
        WHEN coalesce((beneficios->'percentual'->>'ativo')::boolean, false)
        THEN nullif((beneficios->'percentual'->>'valor')::numeric, 0)
        ELSE NULL
      END AS val_percentual,
      CASE
        WHEN coalesce((beneficios->'fixo'->>'ativo')::boolean, false)
        THEN nullif((beneficios->'fixo'->>'valor')::numeric, 0)
        ELSE NULL
      END AS val_indicacao
    FROM public.comissao_oferta co
    WHERE p_empresa_id IS NOT NULL
      AND co.empresa_id = p_empresa_id
      AND co.status IN ('pendente', 'aprovada')
      AND (
        co.data_validade >= CURRENT_DATE
        OR co.data_validade = DATE '2099-12-31'
        OR coalesce((co.beneficios->>'por_tempo_limitado')::boolean, false) = false
      )
      AND (p_desde IS NULL OR co.created_at >= p_desde)
  ),
  comissao_emp AS (
    SELECT
      ROUND(AVG(val_pax) FILTER (WHERE val_pax IS NOT NULL), 2) AS media_pax,
      ROUND(AVG(val_percentual) FILTER (WHERE val_percentual IS NOT NULL), 2) AS media_percentual,
      ROUND(AVG(val_indicacao) FILTER (WHERE val_indicacao IS NOT NULL), 2) AS media_indicacao,
      COUNT(*)::bigint AS quantidade
    FROM comissao_emp_vals
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
          'media_pax', coalesce(cs.media_pax, 0),
          'media_percentual', coalesce(cs.media_percentual, 0),
          'media_indicacao', coalesce(cs.media_indicacao, 0),
          'quantidade', coalesce(cs.quantidade, 0)
        ) ORDER BY coalesce(cs.quantidade, 0) DESC
      ), '[]'::jsonb)
      FROM segmentos s
      LEFT JOIN comissao_seg cs ON cs.segmento = s.segmento
    ),
    'comissao_empresa',
    (
      SELECT CASE
        WHEN p_empresa_id IS NULL THEN jsonb_build_object(
          'media_pax', 0, 'media_percentual', 0, 'media_indicacao', 0, 'quantidade', 0
        )
        ELSE coalesce(
          (
            SELECT jsonb_build_object(
              'media_pax', coalesce(media_pax, 0),
              'media_percentual', coalesce(media_percentual, 0),
              'media_indicacao', coalesce(media_indicacao, 0),
              'quantidade', coalesce(quantidade, 0)
            )
            FROM comissao_emp
          ),
          jsonb_build_object('media_pax', 0, 'media_percentual', 0, 'media_indicacao', 0, 'quantidade', 0)
        )
      END
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.rpc_analise_mercado IS
  'Agregados anônimos por segmento para Análise de Mercado (visibilidade, engajamento, recomendações, comissão via comissao_oferta).';
