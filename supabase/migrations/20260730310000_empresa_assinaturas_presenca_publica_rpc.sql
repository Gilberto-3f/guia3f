-- Presença pública no guia: turista/profissional/empresa precisam saber quais
-- assinaturas estão no ciclo (ativo + não vencido), sem ler colunas financeiras.
-- RLS de empresa_assinaturas só libera dono/admin — por isso a listagem do guia
-- sumia para não-admins. Espelha o precedente de degustação (leitura restrita ao vigente).

CREATE OR REPLACE FUNCTION public.empresa_assinaturas_presenca_publica (
  p_empresa_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  empresa_id UUID,
  plano_id UUID,
  status TEXT,
  vencimento_em TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (a.empresa_id)
    a.empresa_id,
    a.plano_id,
    a.status,
    a.vencimento_em
  FROM public.empresa_assinaturas a
  WHERE
    a.status = 'ativo'
    AND (
      a.vencimento_em IS NULL
      OR a.vencimento_em >= NOW()
    )
    AND (
      p_empresa_ids IS NULL
      OR cardinality(p_empresa_ids) = 0
      OR a.empresa_id = ANY (p_empresa_ids)
    )
  ORDER BY
    a.empresa_id,
    a.vencimento_em DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.empresa_assinaturas_presenca_publica (UUID[]) IS
  'Assinaturas ativas no ciclo — só empresa_id/plano_id/status/vencimento. Para listagem do guia e presença pública (bypass RLS de dono/admin).';

REVOKE ALL ON FUNCTION public.empresa_assinaturas_presenca_publica (UUID[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.empresa_assinaturas_presenca_publica (UUID[]) TO authenticated;

GRANT EXECUTE ON FUNCTION public.empresa_assinaturas_presenca_publica (UUID[]) TO anon;
