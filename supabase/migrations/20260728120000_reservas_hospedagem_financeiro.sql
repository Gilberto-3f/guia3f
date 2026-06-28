-- Reservas de hospedagem: canal financeiro do anfitrião + motivo de recusa

ALTER TABLE public.reservas_hospedagem
  ADD COLUMN IF NOT EXISTS motivo_recusa TEXT,
  ADD COLUMN IF NOT EXISTS respondido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canal_financeiro_id UUID REFERENCES public.canal_financeiro (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reservas_hospedagem_canal ON public.reservas_hospedagem (canal_financeiro_id);

COMMENT ON COLUMN public.reservas_hospedagem.motivo_recusa IS 'Motivo informado pelo anfitrião ao recusar a solicitação.';
COMMENT ON COLUMN public.reservas_hospedagem.respondido_em IS 'Momento da confirmação ou recusa.';
COMMENT ON COLUMN public.reservas_hospedagem.canal_financeiro_id IS 'Aviso no canal financeiro da empresa (modo hospedagem).';

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
      'lembrete_vencimento_plano',
      'comissao',
      'pagamento',
      'manifesto',
      'pre_liberacao_turista',
      'reserva_hospedagem'
    )
  );

DROP POLICY IF EXISTS "reservas_hospedagem update gestor empresa" ON public.reservas_hospedagem;

CREATE POLICY "reservas_hospedagem update gestor empresa" ON public.reservas_hospedagem FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = reservas_hospedagem.empresa_id
      AND e.usuario_id = auth.uid ()
  )
  OR EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid () AND u.role = 'admin'
  )
);
