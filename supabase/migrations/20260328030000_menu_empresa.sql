-- FASE 5: Menu Empresa (sub-páginas)

-- Tabela de anúncios
CREATE TABLE IF NOT EXISTS anuncios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas (id),
  tipo VARCHAR(20) NOT NULL,
  localizacao VARCHAR(20),
  imagem_url VARCHAR NOT NULL,
  link_url VARCHAR,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  impressoes_contratadas INTEGER,
  impressoes_exibidas INTEGER DEFAULT 0,
  cliques INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'ativo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de reservas de anúncios
CREATE TABLE IF NOT EXISTS reservas_anuncios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas (id),
  vaga VARCHAR(10) NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pendente',
  reservado_em TIMESTAMPTZ DEFAULT NOW(),
  confirmado_em TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ
);

-- Tabela de mensagens do chat ADM
CREATE TABLE IF NOT EXISTS mensagens_chat_adm (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas (id),
  admin_id UUID REFERENCES usuarios (id),
  mensagem TEXT NOT NULL,
  lida_empresa BOOLEAN DEFAULT false,
  lida_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_anuncios_empresa ON anuncios (empresa_id);
CREATE INDEX IF NOT EXISTS idx_anuncios_status ON anuncios (status);
CREATE INDEX IF NOT EXISTS idx_reservas_anuncios_empresa ON reservas_anuncios (empresa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_chat_adm_empresa ON mensagens_chat_adm (empresa_id);

