-- 1.1 Empresas: plano, publicidade e métricas
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS plano TEXT DEFAULT 'gratuito',
  ADD COLUMN IF NOT EXISTS is_publicidade BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS nota_media DECIMAL(3, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_avaliacoes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_visitas INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_empresas_categoria ON empresas (categoria);
CREATE INDEX IF NOT EXISTS idx_empresas_plano ON empresas (plano);

-- 1.2 Itens salvos (Compras Paraguai)
CREATE TABLE IF NOT EXISTS itens_salvos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  usuario_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos (id) ON DELETE CASCADE,
  salvo_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (usuario_id, produto_id)
);

CREATE INDEX IF NOT EXISTS idx_itens_salvos_usuario ON itens_salvos (usuario_id);
CREATE INDEX IF NOT EXISTS idx_itens_salvos_produto ON itens_salvos (produto_id);

-- 1.3 Publicações de publicidade
CREATE TABLE IF NOT EXISTS publicacoes_publicidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  empresa_id UUID NOT NULL REFERENCES empresas (id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  imagem_url TEXT,
  link_destino TEXT,
  posicao TEXT, -- 'topo', 'meio', 'rodape'
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publicidade_empresa ON publicacoes_publicidade (empresa_id);
CREATE INDEX IF NOT EXISTS idx_publicidade_datas ON publicacoes_publicidade (data_inicio, data_fim)
WHERE
  ativo = true;

-- 1.4 Favoritos (empresa OU produto)
CREATE TABLE IF NOT EXISTS favoritos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  usuario_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES empresas (id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos (id) ON DELETE CASCADE,
  salvo_em TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (empresa_id IS NOT NULL AND produto_id IS NULL)
    OR (empresa_id IS NULL AND produto_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_favoritos_usuario ON favoritos (usuario_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_favoritos_empresa_unique ON favoritos (usuario_id, empresa_id)
WHERE
  empresa_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_favoritos_produto_unique ON favoritos (usuario_id, produto_id)
WHERE
  produto_id IS NOT NULL;
