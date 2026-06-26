-- Ciclo de assinatura (vencimento + lembretes D-5/D-1) e dados de visita (pagamento dinheiro).

ALTER TABLE public.empresa_assinaturas
  ADD COLUMN IF NOT EXISTS lembrete_5d_enviado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lembrete_1d_enviado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visita_agendada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visita_responsavel_nome TEXT,
  ADD COLUMN IF NOT EXISTS visita_responsavel_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS recusado_por UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recusado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_recusa TEXT;

COMMENT ON COLUMN public.empresa_assinaturas.lembrete_5d_enviado_em IS 'Notificação D-5 enviada ao canal financeiro da empresa.';
COMMENT ON COLUMN public.empresa_assinaturas.lembrete_1d_enviado_em IS 'Notificação D-1 (bloqueio iminente) enviada ao canal financeiro da empresa.';
COMMENT ON COLUMN public.empresa_assinaturas.visita_agendada_em IS 'Data agendada para visita (fotos 360 + pagamento em dinheiro).';

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
      'pre_liberacao_turista'
    )
  );

CREATE OR REPLACE FUNCTION public.processar_ciclo_assinaturas_empresa ()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_dias INT;
  v_expiradas INT := 0;
  v_lembrete_5d INT := 0;
  v_lembrete_1d INT := 0;
  v_agora TIMESTAMPTZ := NOW();
BEGIN
  UPDATE public.empresa_assinaturas
  SET
    status = 'inativo',
    updated_at = v_agora
  WHERE
    status = 'ativo'
    AND vencimento_em IS NOT NULL
    AND vencimento_em < v_agora;

  GET DIAGNOSTICS v_expiradas = ROW_COUNT;

  FOR r IN
    SELECT
      a.id,
      a.empresa_id,
      a.plano_titulo,
      a.vencimento_em,
      a.lembrete_5d_enviado_em,
      a.lembrete_1d_enviado_em
    FROM public.empresa_assinaturas a
    WHERE
      a.status = 'ativo'
      AND a.vencimento_em IS NOT NULL
      AND a.vencimento_em >= v_agora
  LOOP
    v_dias := (DATE (r.vencimento_em AT TIME ZONE 'UTC') - CURRENT_DATE);

    IF v_dias = 5 AND r.lembrete_5d_enviado_em IS NULL THEN
      INSERT INTO public.canal_financeiro (
        empresa_id,
        profissional_id,
        tipo,
        titulo,
        mensagem,
        metadata,
        comprovante_detalhes,
        lida_por_empresa,
        lida_por_profissional
      )
      VALUES (
        r.empresa_id,
        NULL,
        'lembrete_vencimento_plano',
        'Plano vence em 5 dias',
        'Seu plano ' || COALESCE(r.plano_titulo, '') || ' vence em 5 dias. Renove pelo canal Financeiro (aba Planos) para manter os serviços ativos.',
        jsonb_build_object('variant', 'lembrete_5d', 'assinatura_id', r.id, 'dias_restantes', 5),
        jsonb_build_object('variant', 'lembrete_5d', 'assinatura_id', r.id, 'dias_restantes', 5),
        FALSE,
        FALSE
      );

      UPDATE public.empresa_assinaturas
      SET
        lembrete_5d_enviado_em = v_agora,
        updated_at = v_agora
      WHERE
        id = r.id;

      v_lembrete_5d := v_lembrete_5d + 1;
    ELSIF v_dias = 1 AND r.lembrete_1d_enviado_em IS NULL THEN
      INSERT INTO public.canal_financeiro (
        empresa_id,
        profissional_id,
        tipo,
        titulo,
        mensagem,
        metadata,
        comprovante_detalhes,
        lida_por_empresa,
        lida_por_profissional
      )
      VALUES (
        r.empresa_id,
        NULL,
        'lembrete_vencimento_plano',
        'Plano vence amanhã — bloqueio iminente',
        'Seu plano ' || COALESCE(r.plano_titulo, '') || ' vence amanhã. Sem renovação, os serviços do plano serão bloqueados ao fim do ciclo. Regularize o pagamento na aba Planos.',
        jsonb_build_object('variant', 'lembrete_1d', 'assinatura_id', r.id, 'dias_restantes', 1),
        jsonb_build_object('variant', 'lembrete_1d', 'assinatura_id', r.id, 'dias_restantes', 1),
        FALSE,
        FALSE
      );

      UPDATE public.empresa_assinaturas
      SET
        lembrete_1d_enviado_em = v_agora,
        updated_at = v_agora
      WHERE
        id = r.id;

      v_lembrete_1d := v_lembrete_1d + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'expiradas',
    v_expiradas,
    'lembrete_5d',
    v_lembrete_5d,
    'lembrete_1d',
    v_lembrete_1d
  );
END;
$$;

COMMENT ON FUNCTION public.processar_ciclo_assinaturas_empresa () IS
  'Marca assinaturas vencidas como inativas e envia lembretes D-5/D-1 no canal financeiro da empresa.';

GRANT EXECUTE ON FUNCTION public.processar_ciclo_assinaturas_empresa () TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'processar-ciclo-assinaturas-empresa';

    PERFORM cron.schedule(
      'processar-ciclo-assinaturas-empresa',
      '0 11 * * *',
      $$SELECT public.processar_ciclo_assinaturas_empresa();$$
    );
  END IF;
END;
$$;
