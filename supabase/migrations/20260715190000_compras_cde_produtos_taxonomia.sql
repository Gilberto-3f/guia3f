-- Compras CDE — taxonomia global + evolução de produtos + WhatsApp comercial
-- Fase 1: cadastro Lojas CDE (Botão Dinâmico)

-- ---------------------------------------------------------------------------
-- Categorias principais (lista fixa)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.produto_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO
  public.produto_categorias (slug, nome, ordem)
VALUES
  ('smartphones', 'Smartphones', 1),
  ('eletrodomesticos', 'Eletrodomésticos', 2),
  ('eletronicos', 'Eletrônicos', 3),
  ('perfumaria-cosmeticos', 'Perfumaria e Cosméticos', 4),
  ('bebidas-alimentos', 'Bebidas e Alimentos', 5),
  ('vestuario-calcados', 'Vestuário e Calçados', 6),
  ('brinquedos', 'Brinquedos', 7),
  ('artigos-automotivo', 'Artigos Automotivo', 8),
  ('artigos-esportivos', 'Artigos esportivos', 9),
  ('ferramentas', 'Ferramentas', 10),
  ('produtos-farmaceuticos', 'Produtos farmacêuticos', 11),
  ('departamento-geral', 'Departamento / Geral', 12)
ON CONFLICT (slug) DO UPDATE
SET
  nome = EXCLUDED.nome,
  ordem = EXCLUDED.ordem;

-- ---------------------------------------------------------------------------
-- Subcategorias (agrupadas por categoria + nome_normalizado)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.produto_subcategorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  categoria_id UUID NOT NULL REFERENCES public.produto_categorias (id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  nome_normalizado TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (categoria_id, nome_normalizado)
);

CREATE INDEX IF NOT EXISTS idx_produto_subcategorias_categoria ON public.produto_subcategorias (categoria_id);

CREATE INDEX IF NOT EXISTS idx_produto_subcategorias_norm ON public.produto_subcategorias (nome_normalizado);

-- ---------------------------------------------------------------------------
-- Marcas (globais por nome_normalizado)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.produto_marcas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  nome TEXT NOT NULL,
  nome_normalizado TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produto_marcas_norm ON public.produto_marcas (nome_normalizado);

-- ---------------------------------------------------------------------------
-- Tabela produtos (baseline + colunas Compras CDE)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.produtos
ADD COLUMN IF NOT EXISTS descricao TEXT,
ADD COLUMN IF NOT EXISTS categoria_drena TEXT,
ADD COLUMN IF NOT EXISTS marca TEXT,
ADD COLUMN IF NOT EXISTS preco_brl DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS preco_pyg DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS preco_ars DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS preco_usd DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS preco_eur DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS foto_url TEXT,
ADD COLUMN IF NOT EXISTS fotos TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS estoque INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS percentual_desconto DECIMAL(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS site_url TEXT,
ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES public.produto_categorias (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS subcategoria_id UUID REFERENCES public.produto_subcategorias (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS marca_id UUID REFERENCES public.produto_marcas (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS palavras_chave TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_produtos_empresa ON public.produtos (empresa_id);

CREATE INDEX IF NOT EXISTS idx_produtos_categoria_id ON public.produtos (categoria_id);

CREATE INDEX IF NOT EXISTS idx_produtos_subcategoria_id ON public.produtos (subcategoria_id);

CREATE INDEX IF NOT EXISTS idx_produtos_marca_id ON public.produtos (marca_id);

CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON public.produtos (ativo);

CREATE INDEX IF NOT EXISTS idx_produtos_palavras_chave ON public.produtos USING GIN (palavras_chave);

COMMENT ON COLUMN public.produtos.preco_usd IS 'Preço cheio em USD (antes do desconto)';

COMMENT ON COLUMN public.produtos.percentual_desconto IS '0–100; preço final = preco_usd * (1 - percentual/100)';

COMMENT ON COLUMN public.produtos.fotos IS '1 a 3 URLs públicas (capa = fotos[1] ou foto_url)';

-- ---------------------------------------------------------------------------
-- WhatsApp comercial (separado do geral)
-- ---------------------------------------------------------------------------
ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS whatsapp_comercial TEXT;

COMMENT ON COLUMN public.empresas.whatsapp_comercial IS 'WhatsApp do setor comercial (Compras CDE / Botão Dinâmico Lojas CDE)';

-- ---------------------------------------------------------------------------
-- RLS taxonomia
-- ---------------------------------------------------------------------------
ALTER TABLE public.produto_categorias ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.produto_subcategorias ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.produto_marcas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "produto_categorias leitura publica" ON public.produto_categorias;
CREATE POLICY "produto_categorias leitura publica" ON public.produto_categorias FOR
SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "produto_subcategorias leitura publica" ON public.produto_subcategorias;
CREATE POLICY "produto_subcategorias leitura publica" ON public.produto_subcategorias FOR
SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "produto_subcategorias insert autenticado" ON public.produto_subcategorias;
CREATE POLICY "produto_subcategorias insert autenticado" ON public.produto_subcategorias FOR INSERT TO authenticated
WITH
  CHECK (TRUE);

DROP POLICY IF EXISTS "produto_marcas leitura publica" ON public.produto_marcas;
CREATE POLICY "produto_marcas leitura publica" ON public.produto_marcas FOR
SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "produto_marcas insert autenticado" ON public.produto_marcas;
CREATE POLICY "produto_marcas insert autenticado" ON public.produto_marcas FOR INSERT TO authenticated
WITH
  CHECK (TRUE);

-- ---------------------------------------------------------------------------
-- RLS produtos (visitação pública de ativos + dono gerencia)
-- ---------------------------------------------------------------------------
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados podem ver produtos" ON public.produtos;

DROP POLICY IF EXISTS "produtos leitura publicos ativos" ON public.produtos;
CREATE POLICY "produtos leitura publicos ativos" ON public.produtos FOR
SELECT
  USING (
    COALESCE(ativo, TRUE) = TRUE
    OR EXISTS (
      SELECT
        1
      FROM
        public.empresas e
      WHERE
        e.id = produtos.empresa_id
        AND e.usuario_id = auth.uid ()
    )
    OR EXISTS (
      SELECT
        1
      FROM
        public.usuarios u
      WHERE
        u.id = auth.uid ()
        AND u.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Dono insere produto" ON public.produtos;
CREATE POLICY "Dono insere produto" ON public.produtos FOR INSERT TO authenticated
WITH
  CHECK (
    EXISTS (
      SELECT
        1
      FROM
        public.empresas e
      WHERE
        e.id = empresa_id
        AND e.usuario_id = auth.uid ()
    )
  );

DROP POLICY IF EXISTS "Dono atualiza produto" ON public.produtos;
CREATE POLICY "Dono atualiza produto" ON public.produtos FOR
UPDATE TO authenticated USING (
  EXISTS (
    SELECT
      1
    FROM
      public.empresas e
    WHERE
      e.id = produtos.empresa_id
      AND e.usuario_id = auth.uid ()
  )
)
WITH
  CHECK (
    EXISTS (
      SELECT
        1
      FROM
        public.empresas e
      WHERE
        e.id = empresa_id
        AND e.usuario_id = auth.uid ()
    )
  );

DROP POLICY IF EXISTS "Dono deleta produto" ON public.produtos;
CREATE POLICY "Dono deleta produto" ON public.produtos FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT
      1
    FROM
      public.empresas e
    WHERE
      e.id = produtos.empresa_id
      AND e.usuario_id = auth.uid ()
  )
);

-- ---------------------------------------------------------------------------
-- Storage: pasta produtos no bucket empresas (mesmo padrão atrativos)
-- ---------------------------------------------------------------------------
-- Policies do bucket empresas já cobrem prefixo empresas/{empresaId}/...
