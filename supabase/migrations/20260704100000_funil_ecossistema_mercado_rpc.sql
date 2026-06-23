-- Funil do ecossistema (Estatísticas de Mercado): agregados globais via RPC + leitura ampliada para gestores.

CREATE OR REPLACE FUNCTION public.rpc_funil_ecossistema_mercado(p_desde TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recomendacoes BIGINT := 0;
  v_pax BIGINT := 0;
  v_vendas BIGINT := 0;
BEGIN
  IF NOT public.pode_acessar_analise_mercado() THEN
    RAISE EXCEPTION 'Acesso negado ao funil do ecossistema';
  END IF;

  SELECT COUNT(*)::bigint
  INTO v_recomendacoes
  FROM public.recomendacoes r
  WHERE p_desde IS NULL OR r.created_at >= p_desde;

  SELECT
    COALESCE(
      (
        SELECT SUM(GREATEST(m.pax_qtd, 1))::bigint
        FROM public.manifesto m
        WHERE m.status = 'confirmado'
          AND (p_desde IS NULL OR m.created_at >= p_desde)
      ),
      0
    )
    + COALESCE(
      (
        SELECT COUNT(*)::bigint
        FROM public.manifesto_passageiros mp
        INNER JOIN public.manifesto_diario md ON md.id = mp.manifesto_id
        WHERE md.status IN ('confirmado', 'em_andamento', 'concluido')
          AND (p_desde IS NULL OR mp.entrou_em >= p_desde)
      ),
      0
    )
  INTO v_pax;

  SELECT
    COALESCE(
      (
        SELECT COUNT(*)::bigint
        FROM public.comissao c
        WHERE c.tipo = 'venda_direta'
          AND (p_desde IS NULL OR c.created_at >= p_desde)
      ),
      0
    )
    + COALESCE(
      (
        SELECT COUNT(*)::bigint
        FROM public.reservas res
        WHERE p_desde IS NULL OR res.created_at >= p_desde
      ),
      0
    )
  INTO v_vendas;

  RETURN jsonb_build_object(
    'recomendacoes', v_recomendacoes,
    'pax', v_pax,
    'vendas', v_vendas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_funil_ecossistema_mercado(TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.rpc_funil_ecossistema_mercado IS
  'Totais agregados do funil do ecossistema (recomendações, PAX, vendas) para dashboard Estatísticas de Mercado.';

-- Fallback: leitura global para gestores de empresa (políticas OR com as existentes por empresa).
DROP POLICY IF EXISTS "recomendacoes select estatisticas mercado" ON public.recomendacoes;
CREATE POLICY "recomendacoes select estatisticas mercado" ON public.recomendacoes FOR SELECT TO authenticated
USING (public.pode_acessar_analise_mercado());

DROP POLICY IF EXISTS "manifesto select estatisticas mercado" ON public.manifesto;
CREATE POLICY "manifesto select estatisticas mercado" ON public.manifesto FOR SELECT TO authenticated
USING (public.pode_acessar_analise_mercado());

DROP POLICY IF EXISTS "comissao select estatisticas mercado" ON public.comissao;
CREATE POLICY "comissao select estatisticas mercado" ON public.comissao FOR SELECT TO authenticated
USING (public.pode_acessar_analise_mercado());

DROP POLICY IF EXISTS "manifesto_diario select estatisticas mercado" ON public.manifesto_diario;
CREATE POLICY "manifesto_diario select estatisticas mercado" ON public.manifesto_diario FOR SELECT TO authenticated
USING (public.pode_acessar_analise_mercado());

DROP POLICY IF EXISTS "manifesto_passageiros select estatisticas mercado" ON public.manifesto_passageiros;
CREATE POLICY "manifesto_passageiros select estatisticas mercado" ON public.manifesto_passageiros FOR SELECT TO authenticated
USING (public.pode_acessar_analise_mercado());
