-- =====================================================
-- FASE 5.X - CANAL FINANCEIRO: COMPROVANTES DETALHADOS
-- =====================================================

ALTER TABLE canal_financeiro
ADD COLUMN IF NOT EXISTS comprovante_detalhes JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS comprovantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL REFERENCES usuarios (id),
  tipo VARCHAR(30) NOT NULL,
  transacao_id UUID NOT NULL,
  valor_bruto DECIMAL(10, 2) NOT NULL,
  taxas JSONB DEFAULT '[]'::jsonb,
  valor_liquido DECIMAL(10, 2) NOT NULL,
  divisao JSONB DEFAULT '{}'::jsonb,
  cliente_nome VARCHAR(100),
  cliente_anonimo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comprovantes_profissional ON comprovantes (profissional_id);
CREATE INDEX IF NOT EXISTS idx_comprovantes_created_at ON comprovantes (created_at DESC);

