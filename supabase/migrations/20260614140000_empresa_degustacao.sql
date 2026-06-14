-- Degustação de plano para empresas verificadas

CREATE TABLE IF NOT EXISTS public.empresa_degustacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  dias INTEGER NOT NULL CHECK (dias > 0 AND dias <= 365),
  status VARCHAR(32) NOT NULL DEFAULT 'aguardando_aceite'
    CHECK (status IN ('aguardando_aceite', 'ativa', 'expirada', 'cancelada')),
  canal_financeiro_id UUID NULL REFERENCES public.canal_financeiro (id) ON DELETE SET NULL,
  concedido_por UUID NULL REFERENCES public.usuarios (id) ON DELETE SET NULL,
  aceito_em TIMESTAMPTZ NULL,
  inicio_em TIMESTAMPTZ NULL,
  expira_em TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_empresa_degustacoes_empresa ON public.empresa_degustacoes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_empresa_degustacoes_status ON public.empresa_degustacoes (empresa_id, status);

ALTER TABLE public.canal_financeiro DROP CONSTRAINT IF EXISTS canal_financeiro_tipo_check;

ALTER TABLE public.canal_financeiro
  ADD CONSTRAINT canal_financeiro_tipo_check CHECK (
    tipo IN (
      'mensagem_adm',
      'recibo_atendimento',
      'extrato_parceria',
      'extrato_comissao',
      'manifesto_indicacao',
      'comprovante_pagamento',
      'relatorio_pax',
      'relatorio_parceria',
      'extrato_comissao_paga',
      'pagamento_pendente',
      'plano_assinatura',
      'degustacao_plano',
      'comissao',
      'pagamento',
      'manifesto',
      'pre_liberacao_turista'
    )
  );

ALTER TABLE public.empresa_degustacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresa_degustacoes_select ON public.empresa_degustacoes;
CREATE POLICY empresa_degustacoes_select ON public.empresa_degustacoes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_degustacoes.empresa_id AND e.usuario_id = auth.uid()
  )
  OR EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
);

DROP POLICY IF EXISTS empresa_degustacoes_update_empresa ON public.empresa_degustacoes;
CREATE POLICY empresa_degustacoes_update_empresa ON public.empresa_degustacoes FOR UPDATE TO authenticated
USING (
  status = 'aguardando_aceite'
  AND EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_degustacoes.empresa_id AND e.usuario_id = auth.uid()
  )
)
WITH CHECK (
  status IN ('aguardando_aceite', 'ativa')
  AND EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_degustacoes.empresa_id AND e.usuario_id = auth.uid()
  )
);

GRANT SELECT, UPDATE ON public.empresa_degustacoes TO authenticated;
