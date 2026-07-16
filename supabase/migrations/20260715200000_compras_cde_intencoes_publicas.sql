-- Compras CDE — garante buscas_produto + intenções públicas
-- (remoto pode não ter recebido migrations antigas de drena/produtos)

-- Baseline mínimo de produtos (FK das buscas)
CREATE TABLE IF NOT EXISTS public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de intenções / buscas (cria se não existir)
CREATE TABLE IF NOT EXISTS public.buscas_produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  termo_busca TEXT NOT NULL,
  produto_id UUID REFERENCES public.produtos (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buscas_produto_created ON public.buscas_produto (created_at);

CREATE INDEX IF NOT EXISTS idx_buscas_produto_produto ON public.buscas_produto (produto_id)
WHERE
  produto_id IS NOT NULL;

-- Metadados de evento (hub Compras CDE)
ALTER TABLE public.buscas_produto
ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'busca';

ALTER TABLE public.buscas_produto
ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES public.usuarios (id) ON DELETE SET NULL;

-- categoria_id: só com FK se produto_categorias já existir (migration taxonomia)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      information_schema.columns
    WHERE
      table_schema = 'public'
      AND table_name = 'buscas_produto'
      AND column_name = 'categoria_id'
  ) THEN
    IF EXISTS (
      SELECT
        1
      FROM
        information_schema.tables
      WHERE
        table_schema = 'public'
        AND table_name = 'produto_categorias'
    ) THEN
      ALTER TABLE public.buscas_produto
      ADD COLUMN categoria_id UUID REFERENCES public.produto_categorias (id) ON DELETE SET NULL;
    ELSE
      ALTER TABLE public.buscas_produto
      ADD COLUMN categoria_id UUID;
    END IF;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_buscas_produto_tipo_created ON public.buscas_produto (tipo, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_buscas_produto_termo ON public.buscas_produto (termo_busca);

COMMENT ON COLUMN public.buscas_produto.tipo IS 'busca | filtro | tendencia | clique';

ALTER TABLE public.buscas_produto ENABLE ROW LEVEL SECURITY;

-- Policies (idempotentes)
DROP POLICY IF EXISTS "Autenticados podem registrar buscas" ON public.buscas_produto;

DROP POLICY IF EXISTS "Autenticados podem ver buscas" ON public.buscas_produto;

DROP POLICY IF EXISTS "Qualquer um pode registrar intencoes compras cde" ON public.buscas_produto;

DROP POLICY IF EXISTS "Leitura intencoes para destaques" ON public.buscas_produto;

CREATE POLICY "Qualquer um pode registrar intencoes compras cde" ON public.buscas_produto FOR INSERT
WITH
  CHECK (TRUE);

CREATE POLICY "Leitura intencoes para destaques" ON public.buscas_produto FOR
SELECT
  USING (TRUE);

GRANT SELECT, INSERT ON public.buscas_produto TO anon, authenticated;
