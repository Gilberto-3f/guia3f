-- Inclui tipo de aviso de pré-liberação turista no canal financeiro do profissional.

ALTER TABLE public.canal_financeiro
  DROP CONSTRAINT IF EXISTS canal_financeiro_tipo_check;

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
      'comissao',
      'pagamento',
      'manifesto',
      'pre_liberacao_turista'
    )
  );
