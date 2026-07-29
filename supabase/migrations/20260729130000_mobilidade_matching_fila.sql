-- Matching Mobilidade: campos de fila, oferta e modalidade.

ALTER TABLE public.solicitacao_mobilidade
  DROP CONSTRAINT IF EXISTS solicitacao_mobilidade_status_check;

ALTER TABLE public.solicitacao_mobilidade
  ADD CONSTRAINT solicitacao_mobilidade_status_check CHECK (
    status IN (
      'pendente',
      'buscando',
      'oferecida',
      'aceita',
      'concluida',
      'cancelada',
      'sem_profissional'
    )
  );

ALTER TABLE public.solicitacao_mobilidade
  ADD COLUMN IF NOT EXISTS modalidade TEXT,
  ADD COLUMN IF NOT EXISTS origem_nome TEXT,
  ADD COLUMN IF NOT EXISTS destino_nome TEXT,
  ADD COLUMN IF NOT EXISTS destino_empresa_id UUID REFERENCES public.empresas (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cruzamento_fronteira BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_estimado NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS pagamento TEXT,
  ADD COLUMN IF NOT EXISTS lugares INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS acompanhamento_guia BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS oferta_profissional_id UUID REFERENCES public.profissionais (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS oferta_expira_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fila_profissional_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fila_indice INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recusados_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recomendacao_id UUID,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_solicitacao_mobilidade_oferta
  ON public.solicitacao_mobilidade (oferta_profissional_id, status)
  WHERE status = 'oferecida';

CREATE INDEX IF NOT EXISTS idx_solicitacao_mobilidade_turista_status
  ON public.solicitacao_mobilidade (turista_id, status, created_at DESC);

COMMENT ON COLUMN public.solicitacao_mobilidade.fila_profissional_ids IS
  'Fila ordenada (proximidade): índice 0 = oferta atual; 1–2 = backups ocultos.';
COMMENT ON COLUMN public.solicitacao_mobilidade.oferta_expira_em IS
  'Prazo para o profissional aceitar (30–45s).';
