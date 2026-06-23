-- Cliques no botão dinâmico da página da empresa (analítico mensal)

CREATE TABLE IF NOT EXISTS public.empresa_botao_dinamico_cliques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  clicado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_empresa_botao_dinamico_cliques_empresa_mes
  ON public.empresa_botao_dinamico_cliques (empresa_id, clicado_em DESC);

ALTER TABLE public.empresa_botao_dinamico_cliques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono empresa vê cliques botão dinâmico"
  ON public.empresa_botao_dinamico_cliques
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.empresas e
      WHERE e.id = empresa_id
        AND e.usuario_id = auth.uid ()
    )
  );

CREATE OR REPLACE FUNCTION public.rpc_registrar_clique_botao_dinamico (p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_empresa_id IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = p_empresa_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.empresa_botao_dinamico_cliques (empresa_id)
  VALUES (p_empresa_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_cliques_botao_dinamico_mes (p_empresa_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.empresas e
      WHERE e.id = p_empresa_id
        AND e.usuario_id = auth.uid ()
    )
    THEN (
      SELECT COUNT(*)::integer
      FROM public.empresa_botao_dinamico_cliques c
      WHERE c.empresa_id = p_empresa_id
        AND c.clicado_em >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')
        AND c.clicado_em < date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 month'
    )
    ELSE 0
  END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_registrar_clique_botao_dinamico (uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cliques_botao_dinamico_mes (uuid) TO authenticated;

COMMENT ON TABLE public.empresa_botao_dinamico_cliques IS 'Registo de cliques no botão dinâmico da página pública da empresa.';
COMMENT ON FUNCTION public.rpc_registrar_clique_botao_dinamico IS 'Incrementa contagem de clique (inserção) no botão dinâmico.';
COMMENT ON FUNCTION public.rpc_cliques_botao_dinamico_mes IS 'Total de cliques no mês corrente (fuso America/Sao_Paulo) para o dono da empresa.';
