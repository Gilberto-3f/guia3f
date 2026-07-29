-- Etapa 8: disponibilidade + status de agendamento (placa vermelha).

CREATE TABLE IF NOT EXISTS public.mobilidade_disponibilidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL REFERENCES public.profissionais (id) ON DELETE CASCADE,
  data DATE NOT NULL,
  hora_inicio TIME NOT NULL DEFAULT '08:00',
  hora_fim TIME NOT NULL DEFAULT '20:00',
  vagas_total INT NOT NULL CHECK (vagas_total >= 1 AND vagas_total <= 50),
  vagas_ocupadas INT NOT NULL DEFAULT 0 CHECK (vagas_ocupadas >= 0),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mobilidade_disponibilidade_vagas_ok CHECK (vagas_ocupadas <= vagas_total),
  CONSTRAINT mobilidade_disponibilidade_horas_ok CHECK (hora_fim > hora_inicio),
  CONSTRAINT mobilidade_disponibilidade_unica UNIQUE (profissional_id, data, hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_mobilidade_disp_data
  ON public.mobilidade_disponibilidade (data, ativo)
  WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_mobilidade_disp_prof
  ON public.mobilidade_disponibilidade (profissional_id, data);

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
      'sem_profissional',
      'agendada',
      'aguardando_confirmacao'
    )
  );

ALTER TABLE public.solicitacao_mobilidade
  ADD COLUMN IF NOT EXISTS disponibilidade_id UUID REFERENCES public.mobilidade_disponibilidade (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmacao_expira_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_solicitacao_mobilidade_agendada
  ON public.solicitacao_mobilidade (status, data_agendada)
  WHERE status IN ('agendada', 'aguardando_confirmacao');

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
      'reserva_hospedagem',
      'mobilidade_agendamento'
    )
  );

ALTER TABLE public.mobilidade_disponibilidade ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mobilidade_disp dono select" ON public.mobilidade_disponibilidade;
CREATE POLICY "mobilidade_disp dono select" ON public.mobilidade_disponibilidade FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profissionais p
    WHERE p.id = profissional_id AND p.usuario_id = auth.uid()
  )
  OR EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
  OR ativo = true
);

DROP POLICY IF EXISTS "mobilidade_disp dono insert" ON public.mobilidade_disponibilidade;
CREATE POLICY "mobilidade_disp dono insert" ON public.mobilidade_disponibilidade FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profissionais p
    WHERE p.id = profissional_id AND p.usuario_id = auth.uid() AND p.placa_vermelha = true
  )
);

DROP POLICY IF EXISTS "mobilidade_disp dono update" ON public.mobilidade_disponibilidade;
CREATE POLICY "mobilidade_disp dono update" ON public.mobilidade_disponibilidade FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profissionais p
    WHERE p.id = profissional_id AND p.usuario_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "mobilidade_disp dono delete" ON public.mobilidade_disponibilidade;
CREATE POLICY "mobilidade_disp dono delete" ON public.mobilidade_disponibilidade FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profissionais p
    WHERE p.id = profissional_id AND p.usuario_id = auth.uid()
  )
);

COMMENT ON TABLE public.mobilidade_disponibilidade IS
  'Janelas de agenda do profissional placa vermelha (datas + vagas).';
