-- =====================================================
-- FASE 5.3 - CONFIGURACOES FINANCEIRO (COMISSOES / PLANOS)
-- =====================================================

CREATE TABLE IF NOT EXISTS config_comissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao INTEGER NOT NULL DEFAULT 1,
  dados JSONB NOT NULL,
  criado_por UUID REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  ativo BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_config_comissoes_versao ON config_comissoes (versao);
CREATE INDEX IF NOT EXISTS idx_config_comissoes_ativo ON config_comissoes (ativo);

CREATE TABLE IF NOT EXISTS planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(20) NOT NULL UNIQUE,
  valor DECIMAL(10, 2) NOT NULL,
  recursos JSONB DEFAULT '{}'::jsonb,
  ativo BOOLEAN DEFAULT true,
  atualizado_por UUID REFERENCES usuarios(id),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO planos (nome, valor, recursos)
VALUES
  ('BASICO', 97.00, '{"fotos": 10, "publicidade": false, "estatisticas": false}'::jsonb),
  ('PREMIUM', 197.00, '{"fotos": 30, "publicidade": true, "estatisticas": true}'::jsonb),
  ('ENTERPRISE', 497.00, '{"fotos": 100, "publicidade": true, "estatisticas": true, "suporte_prioritario": true}'::jsonb)
ON CONFLICT (nome) DO NOTHING;

