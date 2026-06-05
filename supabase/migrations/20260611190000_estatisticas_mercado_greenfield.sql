-- Estatísticas de mercado (dashboard empresa): tabelas, RLS e referência taxas_comissoes.
-- Complementa 20260328010000 (nunca aplicada em produção) com RLS e tabelas faltantes.

-- ---------------------------------------------------------------------------
-- logs_cliques_guia (segmentos mais usados no guia turístico)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.logs_cliques_guia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
  categoria VARCHAR(60) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_cliques_guia_categoria ON public.logs_cliques_guia (categoria);
CREATE INDEX IF NOT EXISTS idx_logs_cliques_guia_data ON public.logs_cliques_guia (created_at);

ALTER TABLE public.logs_cliques_guia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logs_cliques_guia insert autenticado" ON public.logs_cliques_guia;
CREATE POLICY "logs_cliques_guia insert autenticado" ON public.logs_cliques_guia FOR INSERT
WITH CHECK (auth.role () = 'authenticated');

DROP POLICY IF EXISTS "logs_cliques_guia select gestor empresa" ON public.logs_cliques_guia;
CREATE POLICY "logs_cliques_guia select gestor empresa" ON public.logs_cliques_guia FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e WHERE e.usuario_id = auth.uid ()
  )
  OR EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid () AND u.role = 'admin'
  )
);

DROP POLICY IF EXISTS "logs_cliques_guia select admin" ON public.logs_cliques_guia;
CREATE POLICY "logs_cliques_guia select admin" ON public.logs_cliques_guia FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid () AND u.role = 'admin'
  )
);

-- Alias usado no painel ADM (visão geral)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'logs_cliques_categoria'
      AND c.relkind IN ('r', 'p')
  ) THEN
    NULL;
  ELSIF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'logs_cliques_categoria'
      AND c.relkind = 'v'
  ) THEN
    DROP VIEW public.logs_cliques_categoria;
    CREATE VIEW public.logs_cliques_categoria AS
    SELECT id, usuario_id, categoria, created_at FROM public.logs_cliques_guia;
    GRANT SELECT ON public.logs_cliques_categoria TO authenticated;
  ELSE
    CREATE VIEW public.logs_cliques_categoria AS
    SELECT id, usuario_id, categoria, created_at FROM public.logs_cliques_guia;
    GRANT SELECT ON public.logs_cliques_categoria TO authenticated;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- logs_recomendacoes_segmento (segmentos recomendados por profissionais)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.logs_recomendacoes_segmento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID REFERENCES public.profissionais (id) ON DELETE SET NULL,
  empresa_id UUID REFERENCES public.empresas (id) ON DELETE SET NULL,
  segmento VARCHAR(60) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_recomendacoes_segmento ON public.logs_recomendacoes_segmento (segmento, created_at);
CREATE INDEX IF NOT EXISTS idx_logs_recomendacoes_segmento_data ON public.logs_recomendacoes_segmento (created_at);

ALTER TABLE public.logs_recomendacoes_segmento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logs_recomendacoes_segmento insert profissional" ON public.logs_recomendacoes_segmento;
CREATE POLICY "logs_recomendacoes_segmento insert profissional" ON public.logs_recomendacoes_segmento FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profissionais p
    WHERE p.id = logs_recomendacoes_segmento.profissional_id
      AND p.usuario_id = auth.uid ()
  )
  OR EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid () AND u.role = 'admin'
  )
);

DROP POLICY IF EXISTS "logs_recomendacoes_segmento select gestor empresa" ON public.logs_recomendacoes_segmento;
CREATE POLICY "logs_recomendacoes_segmento select gestor empresa" ON public.logs_recomendacoes_segmento FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e WHERE e.usuario_id = auth.uid ()
  )
  OR EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid () AND u.role = 'admin'
  )
);

-- ---------------------------------------------------------------------------
-- solicitacao_mobilidade (atendimentos por categoria profissional)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.solicitacao_mobilidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turista_id UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
  profissional_id UUID REFERENCES public.profissionais (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceita', 'concluida', 'cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solicitacao_mobilidade_profissional ON public.solicitacao_mobilidade (profissional_id);
CREATE INDEX IF NOT EXISTS idx_solicitacao_mobilidade_data ON public.solicitacao_mobilidade (created_at);

ALTER TABLE public.solicitacao_mobilidade ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "solicitacao_mobilidade insert autenticado" ON public.solicitacao_mobilidade;
CREATE POLICY "solicitacao_mobilidade insert autenticado" ON public.solicitacao_mobilidade FOR INSERT
WITH CHECK (auth.role () = 'authenticated');

DROP POLICY IF EXISTS "solicitacao_mobilidade select gestor empresa" ON public.solicitacao_mobilidade;
CREATE POLICY "solicitacao_mobilidade select gestor empresa" ON public.solicitacao_mobilidade FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e WHERE e.usuario_id = auth.uid ()
  )
  OR EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid () AND u.role = 'admin'
  )
);

DROP POLICY IF EXISTS "solicitacao_mobilidade select profissional" ON public.solicitacao_mobilidade;
CREATE POLICY "solicitacao_mobilidade select profissional" ON public.solicitacao_mobilidade FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profissionais p
    WHERE p.id = solicitacao_mobilidade.profissional_id
      AND p.usuario_id = auth.uid ()
  )
);

-- ---------------------------------------------------------------------------
-- taxas_comissoes (média de comissão por ramo — referência de mercado)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.taxas_comissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria TEXT NOT NULL UNIQUE,
  taxa_percentual DECIMAL(5, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxas_comissoes_categoria ON public.taxas_comissoes (categoria);

ALTER TABLE public.taxas_comissoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "taxas_comissoes select gestor empresa" ON public.taxas_comissoes;
CREATE POLICY "taxas_comissoes select gestor empresa" ON public.taxas_comissoes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e WHERE e.usuario_id = auth.uid ()
  )
  OR EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid () AND u.role = 'admin'
  )
);

DROP POLICY IF EXISTS "taxas_comissoes admin all" ON public.taxas_comissoes;
CREATE POLICY "taxas_comissoes admin all" ON public.taxas_comissoes FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid () AND u.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid () AND u.role = 'admin'
  )
);

INSERT INTO public.taxas_comissoes (categoria, taxa_percentual)
VALUES
  ('Gastronomia', 8.00),
  ('Restaurantes', 8.00),
  ('Hospedagem', 10.00),
  ('Lojas', 12.00),
  ('Compras Paraguai', 12.00),
  ('Atrativos', 7.00),
  ('Passeios', 7.00),
  ('Mobilidade', 15.00),
  ('Serviços Locais', 9.00),
  ('Eventos', 6.00)
ON CONFLICT (categoria) DO NOTHING;

-- ---------------------------------------------------------------------------
-- reservas (ocupação hoteleira agregada — empresas de hospedagem)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas (id) ON DELETE CASCADE,
  data_checkin TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservas_checkin ON public.reservas (data_checkin);
CREATE INDEX IF NOT EXISTS idx_reservas_empresa ON public.reservas (empresa_id);

ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservas insert autenticado" ON public.reservas;
CREATE POLICY "reservas insert autenticado" ON public.reservas FOR INSERT
WITH CHECK (auth.role () = 'authenticated');

DROP POLICY IF EXISTS "reservas select gestor empresa" ON public.reservas;
CREATE POLICY "reservas select gestor empresa" ON public.reservas FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e WHERE e.usuario_id = auth.uid ()
  )
  OR EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid () AND u.role = 'admin'
  )
);

COMMENT ON TABLE public.logs_cliques_guia IS 'Cliques em categorias do guia turístico (estatísticas agregadas).';
COMMENT ON TABLE public.logs_recomendacoes_segmento IS 'Recomendações de segmento feitas por profissionais.';
COMMENT ON TABLE public.solicitacao_mobilidade IS 'Solicitações de mobilidade para estatísticas de atendimentos.';
COMMENT ON TABLE public.taxas_comissoes IS 'Taxas médias de comissão por ramo (referência de mercado).';
COMMENT ON TABLE public.reservas IS 'Reservas para métricas de ocupação hoteleira agregada.';
