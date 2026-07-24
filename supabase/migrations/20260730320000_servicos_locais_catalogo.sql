-- Serviços Locais (botão dinâmico SERVIÇOS) — espelho do cardápio gastronomia.
-- Vocabulário: serviço (não prato). Fora do Compras CDE.

-- ---------------------------------------------------------------------------
-- Categorias / sessões (por empresa, texto livre resolve-ou-cria)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.servicos_locais_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  nome_normalizado TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, nome_normalizado)
);

CREATE INDEX IF NOT EXISTS idx_servicos_locais_categorias_empresa
  ON public.servicos_locais_categorias (empresa_id);

CREATE INDEX IF NOT EXISTS idx_servicos_locais_categorias_norm
  ON public.servicos_locais_categorias (empresa_id, nome_normalizado);

COMMENT ON TABLE public.servicos_locais_categorias IS 'Sessões do catálogo de serviços locais (ex.: CABELEIREIRO) por empresa';

-- ---------------------------------------------------------------------------
-- Itens de serviço
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.servicos_locais_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.servicos_locais_categorias (id) ON DELETE SET NULL,
  nome TEXT NOT NULL DEFAULT '',
  descricao TEXT,
  preco_usd DECIMAL(12, 2) NOT NULL DEFAULT 0,
  percentual_desconto DECIMAL(5, 2) NOT NULL DEFAULT 0,
  fotos TEXT[] NOT NULL DEFAULT '{}',
  foto_url TEXT,
  site_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_servicos_locais_itens_empresa ON public.servicos_locais_itens (empresa_id);
CREATE INDEX IF NOT EXISTS idx_servicos_locais_itens_categoria ON public.servicos_locais_itens (categoria_id);
CREATE INDEX IF NOT EXISTS idx_servicos_locais_itens_ativo ON public.servicos_locais_itens (ativo);

COMMENT ON COLUMN public.servicos_locais_itens.preco_usd IS 'Preço cheio canônico em USD (antes do desconto)';
COMMENT ON COLUMN public.servicos_locais_itens.percentual_desconto IS '0–100; preço final = preco_usd * (1 - percentual/100)';
COMMENT ON COLUMN public.servicos_locais_itens.fotos IS '1 a 3 URLs públicas (capa = fotos[1] ou foto_url)';
COMMENT ON COLUMN public.servicos_locais_itens.ativo IS 'false = rascunho; true = publicado no catálogo público';

-- ---------------------------------------------------------------------------
-- Recomendações de serviço (espelho de recomendacoes_prato)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recomendacoes_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  profissional_id UUID NOT NULL REFERENCES public.profissionais (id) ON DELETE CASCADE,
  servico_id UUID NOT NULL REFERENCES public.servicos_locais_itens (id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.servicos_locais_categorias (id) ON DELETE SET NULL,
  turista_canal TEXT,
  turista_email_prefix TEXT,
  turista_whatsapp_final TEXT,
  turista_whatsapp_ddd TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rec_servico_servico ON public.recomendacoes_servico (servico_id);
CREATE INDEX IF NOT EXISTS idx_rec_servico_empresa ON public.recomendacoes_servico (empresa_id);
CREATE INDEX IF NOT EXISTS idx_rec_servico_profissional ON public.recomendacoes_servico (profissional_id);
CREATE INDEX IF NOT EXISTS idx_rec_servico_created ON public.recomendacoes_servico (created_at DESC);

-- ---------------------------------------------------------------------------
-- Favoritos: INSERT com prato + servico
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'favoritos'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%alvo_tipo%'
  LOOP
    EXECUTE format('ALTER TABLE public.favoritos DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END
$$;

DROP POLICY IF EXISTS "Usuários podem criar favoritos" ON public.favoritos;
CREATE POLICY "Usuários podem criar favoritos" ON public.favoritos FOR INSERT TO authenticated
WITH CHECK (
  usuario_id = auth.uid ()
  AND alvo_id IS NOT NULL
  AND alvo_tipo IN (
    'empresa',
    'acomodacao',
    'produto',
    'ticket',
    'prato',
    'servico'
  )
);

-- ---------------------------------------------------------------------------
-- RLS servicos_locais_categorias
-- ---------------------------------------------------------------------------
ALTER TABLE public.servicos_locais_categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "servicos_locais_categorias leitura" ON public.servicos_locais_categorias;
CREATE POLICY "servicos_locais_categorias leitura" ON public.servicos_locais_categorias FOR
SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "servicos_locais_categorias insert dono" ON public.servicos_locais_categorias;
CREATE POLICY "servicos_locais_categorias insert dono" ON public.servicos_locais_categorias FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_id AND e.usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "servicos_locais_categorias update dono" ON public.servicos_locais_categorias;
CREATE POLICY "servicos_locais_categorias update dono" ON public.servicos_locais_categorias FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_id AND e.usuario_id = auth.uid ()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_id AND e.usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "servicos_locais_categorias delete dono" ON public.servicos_locais_categorias;
CREATE POLICY "servicos_locais_categorias delete dono" ON public.servicos_locais_categorias FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_id AND e.usuario_id = auth.uid ()
  )
);

-- ---------------------------------------------------------------------------
-- RLS servicos_locais_itens
-- ---------------------------------------------------------------------------
ALTER TABLE public.servicos_locais_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "servicos_locais_itens leitura publicos ativos" ON public.servicos_locais_itens;
CREATE POLICY "servicos_locais_itens leitura publicos ativos" ON public.servicos_locais_itens FOR
SELECT
  USING (
    COALESCE(ativo, FALSE) = TRUE
    OR EXISTS (
      SELECT 1 FROM public.empresas e
      WHERE e.id = servicos_locais_itens.empresa_id AND e.usuario_id = auth.uid ()
    )
    OR EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid () AND u.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "servicos_locais_itens insert dono" ON public.servicos_locais_itens;
CREATE POLICY "servicos_locais_itens insert dono" ON public.servicos_locais_itens FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_id AND e.usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "servicos_locais_itens update dono" ON public.servicos_locais_itens;
CREATE POLICY "servicos_locais_itens update dono" ON public.servicos_locais_itens FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_id AND e.usuario_id = auth.uid ()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_id AND e.usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "servicos_locais_itens delete dono" ON public.servicos_locais_itens;
CREATE POLICY "servicos_locais_itens delete dono" ON public.servicos_locais_itens FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_id AND e.usuario_id = auth.uid ()
  )
);

-- ---------------------------------------------------------------------------
-- RLS recomendacoes_servico
-- ---------------------------------------------------------------------------
ALTER TABLE public.recomendacoes_servico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recomendacoes_servico insert autenticado" ON public.recomendacoes_servico;
CREATE POLICY "recomendacoes_servico insert autenticado" ON public.recomendacoes_servico FOR INSERT TO authenticated
WITH CHECK (TRUE);

DROP POLICY IF EXISTS "recomendacoes_servico leitura" ON public.recomendacoes_servico;
CREATE POLICY "recomendacoes_servico leitura" ON public.recomendacoes_servico FOR
SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.empresas e
      WHERE e.id = recomendacoes_servico.empresa_id AND e.usuario_id = auth.uid ()
    )
    OR EXISTS (
      SELECT 1 FROM public.profissionais p
      WHERE p.id = recomendacoes_servico.profissional_id AND p.usuario_id = auth.uid ()
    )
    OR EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid () AND u.role = 'admin'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.servicos_locais_categorias TO authenticated;
GRANT SELECT ON public.servicos_locais_categorias TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.servicos_locais_itens TO authenticated;
GRANT SELECT ON public.servicos_locais_itens TO anon;
GRANT SELECT, INSERT ON public.recomendacoes_servico TO authenticated;
