-- =====================================================
-- FASE 5.4 - GERENCIA ADM (CONVITES / PAGAMENTOS)
-- =====================================================

CREATE TABLE IF NOT EXISTS convites_admin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR NOT NULL,
  nivel INTEGER NOT NULL CHECK (nivel IN (2, 3, 4)),
  comunidade VARCHAR(20),
  permissoes JSONB DEFAULT '{}'::jsonb,
  convidado_por UUID REFERENCES usuarios(id),
  convidado_em TIMESTAMPTZ DEFAULT NOW(),
  aceito_em TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'expirado')),
  codigo VARCHAR(50) UNIQUE,
  expira_em TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_convites_admin_email ON convites_admin (email);
CREATE INDEX IF NOT EXISTS idx_convites_admin_status ON convites_admin (status);

CREATE TABLE IF NOT EXISTS pagamentos_colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES usuarios(id),
  mes_ref INTEGER NOT NULL,
  ano_ref INTEGER NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  participacao_percentual DECIMAL(5, 2) NOT NULL,
  base_calculo DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  pago_em TIMESTAMPTZ,
  pago_por UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_colaboradores ON pagamentos_colaboradores (colaborador_id, ano_ref, mes_ref);

