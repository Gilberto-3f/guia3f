-- Assinaturas de planos (empresa): solicitações e assinantes.

CREATE TABLE IF NOT EXISTS public.empresa_assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  plano_id UUID REFERENCES public.planos (id) ON DELETE SET NULL,
  plano_nome TEXT NOT NULL,
  plano_titulo TEXT NOT NULL,
  modalidade TEXT NOT NULL CHECK (modalidade IN ('mensal', 'trimestral', 'anual')),
  forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('cartao', 'pix', 'dinheiro')),
  valor NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'ativo', 'inativo', 'cancelado')),
  vencimento_em TIMESTAMPTZ,
  assinado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validado_por UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
  validado_em TIMESTAMPTZ,
  lembrete_vencimento_enviado BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_empresa_assinaturas_empresa ON public.empresa_assinaturas (empresa_id);

CREATE INDEX IF NOT EXISTS idx_empresa_assinaturas_status ON public.empresa_assinaturas (status, assinado_em DESC);

CREATE INDEX IF NOT EXISTS idx_empresa_assinaturas_pendentes ON public.empresa_assinaturas (assinado_em DESC)
WHERE
  status = 'pendente';

COMMENT ON TABLE public.empresa_assinaturas IS 'Contratações de plano por empresas (solicitações dinheiro + assinantes PIX/cartão/validados).';

ALTER TABLE public.empresa_assinaturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresa_assinaturas_select ON public.empresa_assinaturas;

CREATE POLICY empresa_assinaturas_select ON public.empresa_assinaturas FOR
SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.empresas e
      WHERE
        e.id = empresa_assinaturas.empresa_id
        AND e.usuario_id = auth.uid ()
    )
    OR EXISTS (
      SELECT 1
      FROM public.usuarios u
      WHERE
        u.id = auth.uid ()
        AND u.role = 'admin'
    )
  );

GRANT SELECT ON public.empresa_assinaturas TO authenticated;
