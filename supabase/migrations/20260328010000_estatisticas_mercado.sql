-- FASE 3: Estatísticas de Mercado (Dashboard Empresa)

-- Tabela de logs de cliques no guia (segmentos mais usados)
CREATE TABLE IF NOT EXISTS logs_cliques_guia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios (id),
  categoria VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de logs de recomendações por segmento
CREATE TABLE IF NOT EXISTS logs_recomendacoes_segmento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID REFERENCES profissionais (id),
  empresa_id UUID REFERENCES empresas (id),
  segmento VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_logs_cliques_guia_categoria ON logs_cliques_guia (categoria);
CREATE INDEX IF NOT EXISTS idx_logs_cliques_guia_data ON logs_cliques_guia (created_at);
CREATE INDEX IF NOT EXISTS idx_logs_recomendacoes_segmento ON logs_recomendacoes_segmento (segmento, created_at);

