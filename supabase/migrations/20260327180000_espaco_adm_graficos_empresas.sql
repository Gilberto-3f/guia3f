-- =====================================================
-- FASE 5 - ESPACO ADM GRAFICOS / EMPRESAS
-- =====================================================

CREATE TABLE IF NOT EXISTS logs_atendimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID REFERENCES profissionais(id),
  empresa_id UUID REFERENCES empresas(id),
  tipo_servico VARCHAR(30) NOT NULL,
  valor DECIMAL(10, 2),
  data_atendimento TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_atendimentos_profissional ON logs_atendimentos (profissional_id);
CREATE INDEX IF NOT EXISTS idx_logs_atendimentos_data ON logs_atendimentos (data_atendimento);

CREATE TABLE IF NOT EXISTS logs_rotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origem VARCHAR(100) NOT NULL,
  destino VARCHAR(100) NOT NULL,
  profissional_id UUID REFERENCES profissionais(id),
  data_corrida TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_rotas_origem_destino ON logs_rotas (origem, destino);
CREATE INDEX IF NOT EXISTS idx_logs_rotas_data ON logs_rotas (data_corrida);

