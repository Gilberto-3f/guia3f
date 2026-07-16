-- Fase 4: config cotações + snapshots mensais Drena-Stok

ALTER TABLE public.config_apis
ADD COLUMN IF NOT EXISTS cotacoes_modo TEXT DEFAULT 'api',
ADD COLUMN IF NOT EXISTS cotacoes_fonte_url TEXT DEFAULT 'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,ARS-BRL,PYG-BRL',
ADD COLUMN IF NOT EXISTS cotacoes_manual JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS cotacoes_sync_em TIMESTAMPTZ;

COMMENT ON COLUMN public.config_apis.cotacoes_modo IS 'api | manual';
COMMENT ON COLUMN public.config_apis.cotacoes_manual IS 'Override: {"USD":0.2,"EUR":0.18,...} = qtd da moeda por 1 BRL';

-- Snapshot mensal de intenções (materializado)
CREATE TABLE IF NOT EXISTS public.drena_intencao_mensal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  termo TEXT NOT NULL,
  termo_normalizado TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'busca',
  total_buscas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ano, mes, termo_normalizado, tipo)
);

CREATE INDEX IF NOT EXISTS idx_drena_intencao_mensal_periodo ON public.drena_intencao_mensal (ano DESC, mes DESC);

CREATE INDEX IF NOT EXISTS idx_drena_intencao_mensal_termo ON public.drena_intencao_mensal (termo_normalizado);

ALTER TABLE public.drena_intencao_mensal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drena_intencao_mensal leitura autenticado" ON public.drena_intencao_mensal;
CREATE POLICY "drena_intencao_mensal leitura autenticado" ON public.drena_intencao_mensal FOR
SELECT
  TO authenticated USING (TRUE);

GRANT SELECT ON public.drena_intencao_mensal TO authenticated;

-- Garantir cotacoes baseline + colunas usadas no sync
CREATE TABLE IF NOT EXISTS public.cotacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  moeda TEXT NOT NULL UNIQUE,
  valor_brl DECIMAL(12, 6) NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  fonte TEXT DEFAULT 'api'
);

ALTER TABLE public.cotacoes
ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.cotacoes
ADD COLUMN IF NOT EXISTS fonte TEXT DEFAULT 'api';

INSERT INTO
  public.cotacoes (moeda, valor_brl, fonte)
VALUES
  ('USD', 0.20, 'seed'),
  ('EUR', 0.18, 'seed'),
  ('ARS', 180.00, 'seed'),
  ('PYG', 1500.00, 'seed')
ON CONFLICT (moeda) DO NOTHING;
