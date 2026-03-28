-- FASE 4: Drena-Stok (Dashboard Empresa)

-- Tabela de produtos
CREATE TABLE IF NOT EXISTS produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas (id),
  nome VARCHAR(200) NOT NULL,
  descricao TEXT,
  categoria_drena VARCHAR(50) NOT NULL,
  marca VARCHAR(100),
  preco_brl DECIMAL(10, 2),
  preco_pyg DECIMAL(10, 2),
  preco_ars DECIMAL(10, 2),
  preco_usd DECIMAL(10, 2),
  preco_eur DECIMAL(10, 2),
  foto_url VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de buscas de produto
CREATE TABLE IF NOT EXISTS buscas_produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES produtos (id),
  termo_busca VARCHAR(200) NOT NULL,
  usuario_id UUID REFERENCES usuarios (id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de cotações de moedas (para turistas)
CREATE TABLE IF NOT EXISTS cotacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moeda VARCHAR(3) NOT NULL,
  valor_brl DECIMAL(10, 4) NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_produtos_empresa ON produtos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos (categoria_drena);
CREATE INDEX IF NOT EXISTS idx_buscas_produto_termo ON buscas_produto (termo_busca);
CREATE INDEX IF NOT EXISTS idx_buscas_produto_data ON buscas_produto (created_at);

