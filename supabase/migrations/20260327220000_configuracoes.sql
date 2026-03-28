-- =====================================================
-- CONFIGURAÇÕES (APIs + Geral)
-- =====================================================

CREATE TABLE IF NOT EXISTS config_apis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  gateway VARCHAR(20) DEFAULT 'stripe',
  chave_publica TEXT,
  chave_secreta TEXT,
  webhook_secret TEXT,
  ambiente VARCHAR(10) DEFAULT 'teste',
  moedas JSONB DEFAULT '["BRL", "PYG", "ARS"]'::jsonb,
  api_mobilidade_url TEXT,
  api_mobilidade_key TEXT,
  atualizado_por UUID REFERENCES usuarios (id),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS config_geral (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  politicas_privacidade TEXT,
  termos_uso TEXT,
  regras_ecossistema TEXT,
  prazo_pre_aprovacao_turista INTEGER DEFAULT 48,
  prazo_verificacao_documentos INTEGER DEFAULT 24,
  limite_fotos_empresa INTEGER DEFAULT 20,
  limite_reservas_ativas INTEGER DEFAULT 3,
  tempo_pagamento_reserva INTEGER DEFAULT 15,
  atualizado_por UUID REFERENCES usuarios (id),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW ()
);

INSERT INTO config_apis (gateway, ambiente, moedas)
SELECT
  'stripe',
  'teste',
  '["BRL", "PYG", "ARS"]'::jsonb
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      config_apis
    LIMIT
      1
  );

INSERT INTO config_geral (
  politicas_privacidade,
  termos_uso,
  regras_ecossistema,
  prazo_pre_aprovacao_turista,
  prazo_verificacao_documentos,
  limite_fotos_empresa,
  limite_reservas_ativas,
  tempo_pagamento_reserva
)
SELECT
  '## Políticas de Privacidade' || chr(10) || chr(10) || 'Em construção...',
  '## Termos de Uso' || chr(10) || chr(10) || 'Em construção...',
  '## Regras do Ecossistema' || chr(10) || chr(10) || 'Em construção...',
  48,
  24,
  20,
  3,
  15
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      config_geral
    LIMIT
      1
  );

CREATE INDEX IF NOT EXISTS idx_config_apis_atualizado ON config_apis (atualizado_em);

CREATE INDEX IF NOT EXISTS idx_config_geral_atualizado ON config_geral (atualizado_em);
