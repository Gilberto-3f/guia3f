-- Card/página pública: plano vencido ou degustação encerrada não conta como presença.
-- empresas.plano comercial deixava a empresa no guia mesmo após o ciclo (legado CDE).
-- Legado só vale para quem NUNCA teve linha em empresa_assinaturas.

CREATE OR REPLACE FUNCTION public.empresa_ids_plano_legado_sem_assinatura()
RETURNS TABLE (empresa_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
SET lock_timeout = '800ms'
SET statement_timeout = '1500ms'
AS $$
BEGIN
  RETURN QUERY
  SELECT e.id
  FROM public.empresas e
  WHERE e.docs_verificado = TRUE
    AND e.status IN ('aprovado', 'ativo')
    AND COALESCE(e.somente_modo_apresentacao, FALSE) = FALSE
    AND e.foto_url IS NOT NULL
    AND e.plano IS NOT NULL
    AND btrim(e.plano) <> ''
    AND lower(btrim(e.plano)) NOT IN ('gratuito', 'free', 'none', 'nenhum')
    AND COALESCE(e.somente_anfitriao, FALSE) = FALSE
    AND COALESCE(e.somente_guia, FALSE) = FALSE
    AND COALESCE(e.somente_van, FALSE) = FALSE
    AND NOT EXISTS (
      SELECT 1
      FROM public.empresa_assinaturas a
      WHERE a.empresa_id = e.id
    );
EXCEPTION
  WHEN lock_not_available THEN
    RETURN;
  WHEN query_canceled THEN
    RETURN;
  WHEN undefined_column THEN
    RETURN;
END;
$$;

COMMENT ON FUNCTION public.empresa_ids_plano_legado_sem_assinatura() IS
  'CDE/legado: plano comercial em empresas.plano e nenhuma linha em empresa_assinaturas.';

REVOKE ALL ON FUNCTION public.empresa_ids_plano_legado_sem_assinatura() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.empresa_ids_plano_legado_sem_assinatura() TO authenticated;
GRANT EXECUTE ON FUNCTION public.empresa_ids_plano_legado_sem_assinatura() TO anon;
GRANT EXECUTE ON FUNCTION public.empresa_ids_plano_legado_sem_assinatura() TO service_role;

CREATE OR REPLACE FUNCTION public.limpar_plano_empresas_sem_ciclo_vigente()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n INT := 0;
BEGIN
  UPDATE public.empresas e
  SET plano = 'gratuito'
  WHERE
    e.plano IS NOT NULL
    AND btrim(e.plano) <> ''
    AND lower(btrim(e.plano)) NOT IN ('gratuito', 'free', 'none', 'nenhum')
    AND COALESCE(e.somente_anfitriao, FALSE) = FALSE
    AND COALESCE(e.somente_guia, FALSE) = FALSE
    AND COALESCE(e.somente_van, FALSE) = FALSE
    AND EXISTS (
      SELECT 1 FROM public.empresa_assinaturas a WHERE a.empresa_id = e.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.empresa_assinaturas a
      WHERE a.empresa_id = e.id
        AND a.status = 'ativo'
        AND (a.vencimento_em IS NULL OR a.vencimento_em >= NOW())
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.empresa_degustacoes d
      WHERE d.empresa_id = e.id
        AND d.status = 'ativa'
        AND d.expira_em > NOW()
    );

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.limpar_plano_empresas_sem_ciclo_vigente() IS
  'Zera empresas.plano quando a empresa já teve assinatura e não há ciclo/degustação vigente.';

REVOKE ALL ON FUNCTION public.limpar_plano_empresas_sem_ciclo_vigente() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.limpar_plano_empresas_sem_ciclo_vigente() TO service_role;

UPDATE public.empresa_degustacoes
SET
  status = 'expirada'
WHERE
  status = 'ativa'
  AND expira_em IS NOT NULL
  AND expira_em < NOW();

DO $$
BEGIN
  PERFORM public.limpar_plano_empresas_sem_ciclo_vigente();
END;
$$;

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
  v_degustacoes INT := 0;
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

  UPDATE public.empresa_degustacoes
  SET
    status = 'expirada',
    updated_at = v_agora
  WHERE
    status = 'ativa'
    AND expira_em IS NOT NULL
    AND expira_em < v_agora;

  GET DIAGNOSTICS v_degustacoes = ROW_COUNT;

  PERFORM public.limpar_plano_empresas_sem_ciclo_vigente();

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
    'degustacoes_expiradas',
    v_degustacoes,
    'lembrete_5d',
    v_lembrete_5d,
    'lembrete_1d',
    v_lembrete_1d
  );
END;
$$;

COMMENT ON FUNCTION public.processar_ciclo_assinaturas_empresa () IS
  'Marca assinaturas e degustações vencidas, zera empresas.plano irregular e envia lembretes D-5/D-1.';

GRANT EXECUTE ON FUNCTION public.processar_ciclo_assinaturas_empresa () TO service_role;
