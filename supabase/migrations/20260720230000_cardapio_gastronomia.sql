-- Cardápio digital (gastronomia) — categorias por empresa + pratos + recomendações + favoritos

-- ---------------------------------------------------------------------------
-- Categorias / sessões do cardápio (por empresa, texto livre resolve-ou-cria)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cardapio_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  nome_normalizado TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, nome_normalizado)
);

CREATE INDEX IF NOT EXISTS idx_cardapio_categorias_empresa
  ON public.cardapio_categorias (empresa_id);

CREATE INDEX IF NOT EXISTS idx_cardapio_categorias_norm
  ON public.cardapio_categorias (empresa_id, nome_normalizado);

COMMENT ON TABLE public.cardapio_categorias IS 'Sessões do cardápio (ex.: MASSAS) por empresa';

-- ---------------------------------------------------------------------------
-- Pratos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cardapio_pratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.cardapio_categorias (id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_cardapio_pratos_empresa ON public.cardapio_pratos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_cardapio_pratos_categoria ON public.cardapio_pratos (categoria_id);
CREATE INDEX IF NOT EXISTS idx_cardapio_pratos_ativo ON public.cardapio_pratos (ativo);

COMMENT ON COLUMN public.cardapio_pratos.preco_usd IS 'Preço cheio canônico em USD (antes do desconto)';
COMMENT ON COLUMN public.cardapio_pratos.percentual_desconto IS '0–100; preço final = preco_usd * (1 - percentual/100)';
COMMENT ON COLUMN public.cardapio_pratos.fotos IS '1 a 3 URLs públicas (capa = fotos[1] ou foto_url)';
COMMENT ON COLUMN public.cardapio_pratos.ativo IS 'false = rascunho; true = publicado no cardápio público';

-- ---------------------------------------------------------------------------
-- Recomendações de prato (espelho de recomendacoes_produto)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recomendacoes_prato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  profissional_id UUID NOT NULL REFERENCES public.profissionais (id) ON DELETE CASCADE,
  prato_id UUID NOT NULL REFERENCES public.cardapio_pratos (id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.cardapio_categorias (id) ON DELETE SET NULL,
  turista_canal TEXT,
  turista_email_prefix TEXT,
  turista_whatsapp_final TEXT,
  turista_whatsapp_ddd TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rec_prato_prato ON public.recomendacoes_prato (prato_id);
CREATE INDEX IF NOT EXISTS idx_rec_prato_empresa ON public.recomendacoes_prato (empresa_id);
CREATE INDEX IF NOT EXISTS idx_rec_prato_profissional ON public.recomendacoes_prato (profissional_id);
CREATE INDEX IF NOT EXISTS idx_rec_prato_created ON public.recomendacoes_prato (created_at DESC);

-- ---------------------------------------------------------------------------
-- Favoritos: permitir alvo_tipo = prato
-- ---------------------------------------------------------------------------
-- Remover CHECK legado se existir (permite novos tipos via app)
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

-- ---------------------------------------------------------------------------
-- RLS cardapio_categorias
-- ---------------------------------------------------------------------------
ALTER TABLE public.cardapio_categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cardapio_categorias leitura" ON public.cardapio_categorias;
CREATE POLICY "cardapio_categorias leitura" ON public.cardapio_categorias FOR
SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "cardapio_categorias insert dono" ON public.cardapio_categorias;
CREATE POLICY "cardapio_categorias insert dono" ON public.cardapio_categorias FOR INSERT TO authenticated
WITH
  CHECK (
    EXISTS (
      SELECT 1
      FROM public.empresas e
      WHERE e.id = empresa_id
        AND e.usuario_id = auth.uid ()
    )
  );

DROP POLICY IF EXISTS "cardapio_categorias update dono" ON public.cardapio_categorias;
CREATE POLICY "cardapio_categorias update dono" ON public.cardapio_categorias FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.empresas e
    WHERE e.id = empresa_id
      AND e.usuario_id = auth.uid ()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.empresas e
    WHERE e.id = empresa_id
      AND e.usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "cardapio_categorias delete dono" ON public.cardapio_categorias;
CREATE POLICY "cardapio_categorias delete dono" ON public.cardapio_categorias FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.empresas e
    WHERE e.id = empresa_id
      AND e.usuario_id = auth.uid ()
  )
);

-- ---------------------------------------------------------------------------
-- RLS cardapio_pratos
-- ---------------------------------------------------------------------------
ALTER TABLE public.cardapio_pratos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cardapio_pratos leitura publicos ativos" ON public.cardapio_pratos;
CREATE POLICY "cardapio_pratos leitura publicos ativos" ON public.cardapio_pratos FOR
SELECT
  USING (
    COALESCE(ativo, FALSE) = TRUE
    OR EXISTS (
      SELECT 1
      FROM public.empresas e
      WHERE e.id = cardapio_pratos.empresa_id
        AND e.usuario_id = auth.uid ()
    )
    OR EXISTS (
      SELECT 1
      FROM public.usuarios u
      WHERE u.id = auth.uid ()
        AND u.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "cardapio_pratos insert dono" ON public.cardapio_pratos;
CREATE POLICY "cardapio_pratos insert dono" ON public.cardapio_pratos FOR INSERT TO authenticated
WITH
  CHECK (
    EXISTS (
      SELECT 1
      FROM public.empresas e
      WHERE e.id = empresa_id
        AND e.usuario_id = auth.uid ()
    )
  );

DROP POLICY IF EXISTS "cardapio_pratos update dono" ON public.cardapio_pratos;
CREATE POLICY "cardapio_pratos update dono" ON public.cardapio_pratos FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.empresas e
    WHERE e.id = empresa_id
      AND e.usuario_id = auth.uid ()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.empresas e
    WHERE e.id = empresa_id
      AND e.usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "cardapio_pratos delete dono" ON public.cardapio_pratos;
CREATE POLICY "cardapio_pratos delete dono" ON public.cardapio_pratos FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.empresas e
    WHERE e.id = empresa_id
      AND e.usuario_id = auth.uid ()
  )
);

-- ---------------------------------------------------------------------------
-- RLS recomendacoes_prato
-- ---------------------------------------------------------------------------
ALTER TABLE public.recomendacoes_prato ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recomendacoes_prato insert autenticado" ON public.recomendacoes_prato;
CREATE POLICY "recomendacoes_prato insert autenticado" ON public.recomendacoes_prato FOR INSERT TO authenticated
WITH
  CHECK (TRUE);

DROP POLICY IF EXISTS "recomendacoes_prato leitura" ON public.recomendacoes_prato;
CREATE POLICY "recomendacoes_prato leitura" ON public.recomendacoes_prato FOR
SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.empresas e
      WHERE e.id = recomendacoes_prato.empresa_id
        AND e.usuario_id = auth.uid ()
    )
    OR EXISTS (
      SELECT 1
      FROM public.profissionais p
      WHERE p.id = recomendacoes_prato.profissional_id
        AND p.usuario_id = auth.uid ()
    )
    OR EXISTS (
      SELECT 1
      FROM public.usuarios u
      WHERE u.id = auth.uid ()
        AND u.role = 'admin'
    )
  );
