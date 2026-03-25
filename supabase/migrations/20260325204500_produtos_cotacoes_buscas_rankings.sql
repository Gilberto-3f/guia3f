-- =====================================================
-- Produtos (baseline se ainda não existir), buscas, cotações, rankings
-- =====================================================

-- Tabela produtos (referenciada por favoritos/itens_salvos em migrações anteriores)
CREATE TABLE IF NOT EXISTS produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  empresa_id UUID NOT NULL REFERENCES empresas (id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  foto_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE produtos
ADD COLUMN IF NOT EXISTS categoria_drena TEXT,
ADD COLUMN IF NOT EXISTS marca TEXT,
ADD COLUMN IF NOT EXISTS preco_brl DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS preco_pyg DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS preco_ars DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS preco_usd DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS preco_eur DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS estoque INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos (nome);

CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos (categoria_drena);

CREATE INDEX IF NOT EXISTS idx_produtos_marca ON produtos (marca);

CREATE INDEX IF NOT EXISTS idx_produtos_empresa ON produtos (empresa_id);

COMMENT ON COLUMN produtos.categoria_drena IS 'Segmento do produto (smartphones, perfumaria, eletronicos, etc)';

COMMENT ON COLUMN produtos.marca IS 'Marca do produto';

COMMENT ON COLUMN produtos.preco_brl IS 'Preço em Real Brasileiro';

COMMENT ON COLUMN produtos.preco_pyg IS 'Preço em Guarani Paraguaio';

COMMENT ON COLUMN produtos.preco_ars IS 'Preço em Peso Argentino';

COMMENT ON COLUMN produtos.preco_usd IS 'Preço em Dólar Americano';

COMMENT ON COLUMN produtos.preco_eur IS 'Preço em Euro';

-- Buscas (termo livre ou produto escolhido)
CREATE TABLE IF NOT EXISTS buscas_produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  termo_busca TEXT NOT NULL,
  produto_id UUID REFERENCES produtos (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buscas_produto_created ON buscas_produto (created_at);

CREATE INDEX IF NOT EXISTS idx_buscas_produto_produto ON buscas_produto (produto_id)
WHERE
  produto_id IS NOT NULL;

-- Cotações
CREATE TABLE IF NOT EXISTS cotacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  moeda TEXT NOT NULL,
  valor_brl DECIMAL(10, 4) NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  fonte TEXT DEFAULT 'api',
  UNIQUE (moeda)
);

INSERT INTO
  cotacoes (moeda, valor_brl)
VALUES
  ('USD', 0.20),
  ('EUR', 0.18),
  ('ARS', 180.00),
  ('PYG', 1500.00)
ON CONFLICT (moeda) DO UPDATE
SET
  valor_brl = EXCLUDED.valor_brl,
  atualizado_em = NOW();

CREATE INDEX IF NOT EXISTS idx_cotacoes_moeda ON cotacoes (moeda);

COMMENT ON TABLE cotacoes IS 'Cotações: quantidade da moeda estrangeira por 1 BRL';

COMMENT ON COLUMN cotacoes.valor_brl IS 'Quantidade da moeda por 1 Real Brasileiro';

-- Correspondência busca ↔ produto: por produto_id OU por termo ilike em nome/marca/segmento
CREATE OR REPLACE VIEW produtos_mais_buscados AS
SELECT
  p.id,
  p.nome,
  p.marca,
  p.categoria_drena,
  p.foto_url,
  COUNT(b.id) AS total_buscas
FROM
  produtos p
  LEFT JOIN buscas_produto b ON (
    b.produto_id = p.id
    OR (
      b.produto_id IS NULL
      AND b.termo_busca IS NOT NULL
      AND TRIM(b.termo_busca) != ''
      AND (
        p.nome ILIKE '%' || b.termo_busca || '%'
        OR COALESCE(p.marca, '') ILIKE '%' || b.termo_busca || '%'
        OR COALESCE(p.categoria_drena, '') ILIKE '%' || b.termo_busca || '%'
      )
    )
  )
WHERE
  COALESCE(p.ativo, TRUE) = TRUE
GROUP BY
  p.id,
  p.nome,
  p.marca,
  p.categoria_drena,
  p.foto_url
ORDER BY
  total_buscas DESC
LIMIT
  10;

CREATE OR REPLACE VIEW marcas_mais_pesquisadas AS
SELECT
  p.marca,
  COUNT(b.id) AS total_buscas
FROM
  produtos p
  INNER JOIN buscas_produto b ON (
    b.produto_id = p.id
    OR (
      b.produto_id IS NULL
      AND (
        COALESCE(p.marca, '') ILIKE '%' || b.termo_busca || '%'
        OR p.nome ILIKE '%' || b.termo_busca || '%'
        OR COALESCE(p.categoria_drena, '') ILIKE '%' || b.termo_busca || '%'
      )
    )
  )
WHERE
  COALESCE(p.ativo, TRUE) = TRUE
  AND p.marca IS NOT NULL
  AND TRIM(p.marca) != ''
GROUP BY
  p.marca
ORDER BY
  total_buscas DESC
LIMIT
  10;

CREATE OR REPLACE VIEW segmentos_em_alta AS
SELECT
  p.categoria_drena,
  COUNT(b.id) AS total_buscas
FROM
  produtos p
  INNER JOIN buscas_produto b ON (
    b.produto_id = p.id
    OR (
      b.produto_id IS NULL
      AND (
        COALESCE(p.categoria_drena, '') ILIKE '%' || b.termo_busca || '%'
        OR p.nome ILIKE '%' || b.termo_busca || '%'
        OR COALESCE(p.marca, '') ILIKE '%' || b.termo_busca || '%'
      )
    )
  )
WHERE
  COALESCE(p.ativo, TRUE) = TRUE
  AND p.categoria_drena IS NOT NULL
  AND TRIM(p.categoria_drena) != ''
GROUP BY
  p.categoria_drena
ORDER BY
  total_buscas DESC
LIMIT
  10;

CREATE OR REPLACE VIEW tendencias_24h AS
SELECT
  p.id,
  p.nome,
  p.marca,
  p.categoria_drena,
  p.foto_url,
  COUNT(b.id) AS buscas_24h
FROM
  produtos p
  INNER JOIN buscas_produto b ON b.created_at >= NOW() - INTERVAL '24 hours'
  AND (
    b.produto_id = p.id
    OR (
      b.produto_id IS NULL
      AND (
        p.nome ILIKE '%' || b.termo_busca || '%'
        OR COALESCE(p.marca, '') ILIKE '%' || b.termo_busca || '%'
        OR COALESCE(p.categoria_drena, '') ILIKE '%' || b.termo_busca || '%'
      )
    )
  )
WHERE
  COALESCE(p.ativo, TRUE) = TRUE
GROUP BY
  p.id,
  p.nome,
  p.marca,
  p.categoria_drena,
  p.foto_url
ORDER BY
  buscas_24h DESC
LIMIT
  10;

-- RLS
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

ALTER TABLE buscas_produto ENABLE ROW LEVEL SECURITY;

ALTER TABLE cotacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados podem ver produtos" ON produtos;

DROP POLICY IF EXISTS "Dono da empresa pode gerir produtos" ON produtos;

DROP POLICY IF EXISTS "Dono insere produto" ON produtos;

DROP POLICY IF EXISTS "Dono atualiza produto" ON produtos;

DROP POLICY IF EXISTS "Dono deleta produto" ON produtos;

CREATE POLICY "Autenticados podem ver produtos" ON produtos FOR
SELECT
  USING (auth.role () = 'authenticated');

CREATE POLICY "Dono insere produto" ON produtos FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT
      1
    FROM
      empresas e
    WHERE
      e.id = produtos.empresa_id
      AND e.usuario_id = auth.uid ()
  )
);

CREATE POLICY "Dono atualiza produto" ON produtos FOR
UPDATE
  USING (
    EXISTS (
      SELECT
        1
      FROM
        empresas e
      WHERE
        e.id = produtos.empresa_id
        AND e.usuario_id = auth.uid ()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT
        1
      FROM
        empresas e
      WHERE
        e.id = produtos.empresa_id
        AND e.usuario_id = auth.uid ()
    )
  );

CREATE POLICY "Dono deleta produto" ON produtos FOR DELETE USING (
  EXISTS (
    SELECT
      1
    FROM
      empresas e
    WHERE
      e.id = produtos.empresa_id
      AND e.usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "Autenticados podem registrar buscas" ON buscas_produto;

DROP POLICY IF EXISTS "Autenticados podem ver buscas" ON buscas_produto;

CREATE POLICY "Autenticados podem registrar buscas" ON buscas_produto FOR INSERT
WITH CHECK (auth.role () = 'authenticated');

CREATE POLICY "Autenticados podem ver buscas" ON buscas_produto FOR
SELECT
  USING (auth.role () = 'authenticated');

DROP POLICY IF EXISTS "Cotações leitura autenticados" ON cotacoes;

CREATE POLICY "Cotações leitura autenticados" ON cotacoes FOR
SELECT
  USING (auth.role () = 'authenticated');

GRANT SELECT ON cotacoes TO authenticated;

GRANT SELECT, INSERT ON buscas_produto TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON produtos TO authenticated;

GRANT SELECT ON produtos_mais_buscados TO authenticated;

GRANT SELECT ON marcas_mais_pesquisadas TO authenticated;

GRANT SELECT ON segmentos_em_alta TO authenticated;

GRANT SELECT ON tendencias_24h TO authenticated;
