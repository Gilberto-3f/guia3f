-- FASE 2: Funil de Conversão (Dashboard Empresa)

-- Tabela de log de visitas (se não existir)
CREATE TABLE IF NOT EXISTS log_visita (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas (id),
  usuario_id UUID REFERENCES usuarios (id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de recomendações (se não existir)
CREATE TABLE IF NOT EXISTS recomendacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL REFERENCES profissionais (id),
  empresa_id UUID NOT NULL REFERENCES empresas (id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_log_visita_empresa ON log_visita (empresa_id);
CREATE INDEX IF NOT EXISTS idx_log_visita_data ON log_visita (created_at);
CREATE INDEX IF NOT EXISTS idx_recomendacoes_empresa ON recomendacoes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_recomendacoes_data ON recomendacoes (created_at);

