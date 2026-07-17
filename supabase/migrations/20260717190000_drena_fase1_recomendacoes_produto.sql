-- Fase 1 Drena-Stok: intenções enriquecidas + recomendações de produto + arquivo mensal JSON

-- ---------------------------------------------------------------------------
-- buscas_produto: taxonomia + perfil + tipo impressao
-- ---------------------------------------------------------------------------
ALTER TABLE public.buscas_produto
ADD COLUMN IF NOT EXISTS subcategoria_id UUID,
ADD COLUMN IF NOT EXISTS marca_id UUID,
ADD COLUMN IF NOT EXISTS perfil TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'produto_subcategorias'
  ) THEN
    BEGIN
      ALTER TABLE public.buscas_produto
        DROP CONSTRAINT IF EXISTS buscas_produto_subcategoria_id_fkey;
      ALTER TABLE public.buscas_produto
        ADD CONSTRAINT buscas_produto_subcategoria_id_fkey
        FOREIGN KEY (subcategoria_id) REFERENCES public.produto_subcategorias (id) ON DELETE SET NULL;
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'produto_marcas'
  ) THEN
    BEGIN
      ALTER TABLE public.buscas_produto
        DROP CONSTRAINT IF EXISTS buscas_produto_marca_id_fkey;
      ALTER TABLE public.buscas_produto
        ADD CONSTRAINT buscas_produto_marca_id_fkey
        FOREIGN KEY (marca_id) REFERENCES public.produto_marcas (id) ON DELETE SET NULL;
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_buscas_produto_perfil_created
  ON public.buscas_produto (perfil, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_buscas_produto_subcategoria
  ON public.buscas_produto (subcategoria_id)
  WHERE subcategoria_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_buscas_produto_marca
  ON public.buscas_produto (marca_id)
  WHERE marca_id IS NOT NULL;

COMMENT ON COLUMN public.buscas_produto.tipo IS 'busca | filtro | tendencia | clique | impressao';
COMMENT ON COLUMN public.buscas_produto.perfil IS 'turista | profissional | empresa | anon';

-- ---------------------------------------------------------------------------
-- recomendacoes_produto (indicação indireta — NÃO entra no funil de conversão)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recomendacoes_produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  profissional_id UUID NOT NULL REFERENCES public.profissionais (id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos (id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  categoria_id UUID,
  subcategoria_id UUID,
  marca_id UUID,
  turista_canal TEXT,
  turista_email_prefix TEXT,
  turista_whatsapp_final TEXT,
  turista_whatsapp_ddd TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rec_produto_produto ON public.recomendacoes_produto (produto_id);
CREATE INDEX IF NOT EXISTS idx_rec_produto_empresa ON public.recomendacoes_produto (empresa_id);
CREATE INDEX IF NOT EXISTS idx_rec_produto_profissional ON public.recomendacoes_produto (profissional_id);
CREATE INDEX IF NOT EXISTS idx_rec_produto_created ON public.recomendacoes_produto (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rec_produto_categoria ON public.recomendacoes_produto (categoria_id)
WHERE categoria_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rec_produto_marca ON public.recomendacoes_produto (marca_id)
WHERE marca_id IS NOT NULL;

ALTER TABLE public.recomendacoes_produto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recomendacoes_produto insert profissional" ON public.recomendacoes_produto;
CREATE POLICY "recomendacoes_produto insert profissional" ON public.recomendacoes_produto FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profissionais p
    WHERE p.id = recomendacoes_produto.profissional_id
      AND p.usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "recomendacoes_produto select autenticado" ON public.recomendacoes_produto;
CREATE POLICY "recomendacoes_produto select autenticado" ON public.recomendacoes_produto FOR
SELECT
  TO authenticated USING (TRUE);

GRANT SELECT, INSERT ON public.recomendacoes_produto TO authenticated;

COMMENT ON TABLE public.recomendacoes_produto IS
  'Indicações de produtos do Compras CDE (comparador). Não alimenta o funil de conversão de empresas.';

-- ---------------------------------------------------------------------------
-- Arquivo mensal Drena (snapshot JSON por mês)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.drena_arquivo_mensal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  gerado_em TIMESTAMPTZ NOT NULL DEFAULT NOW (),
  UNIQUE (ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_drena_arquivo_mensal_periodo
  ON public.drena_arquivo_mensal (ano DESC, mes DESC);

ALTER TABLE public.drena_arquivo_mensal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drena_arquivo_mensal leitura autenticado" ON public.drena_arquivo_mensal;
CREATE POLICY "drena_arquivo_mensal leitura autenticado" ON public.drena_arquivo_mensal FOR
SELECT
  TO authenticated USING (TRUE);

GRANT SELECT ON public.drena_arquivo_mensal TO authenticated;

COMMENT ON TABLE public.drena_arquivo_mensal IS
  'Snapshot JSON mensal do Drena-Stok (Ranking 100+, recomendações, categorias, gráficos).';
