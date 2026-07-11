-- Ocupação pública das acomodações: turistas veem datas bloqueadas (pendente/confirmada)
-- sem expor turista_usuario_id nem outros dados sensíveis.

CREATE OR REPLACE FUNCTION public.periodos_ocupacao_acomodacao(p_acomodacao_id UUID)
RETURNS TABLE (
  id UUID,
  data_checkin DATE,
  data_checkout DATE,
  status TEXT,
  origem TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_acomodacao_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.data_checkin,
    r.data_checkout,
    r.status,
    'reserva'::TEXT AS origem
  FROM public.reservas_hospedagem r
  WHERE r.acomodacao_id = p_acomodacao_id
    AND r.status IN ('pendente', 'confirmada');

  RETURN QUERY
  SELECT
    b.id,
    b.data_inicio AS data_checkin,
    (b.data_fim + 1)::DATE AS data_checkout,
    'bloqueio'::TEXT AS status,
    'bloqueio'::TEXT AS origem
  FROM public.hospedagem_bloqueios_calendario b
  WHERE b.acomodacao_id = p_acomodacao_id;
END;
$$;

COMMENT ON FUNCTION public.periodos_ocupacao_acomodacao(UUID) IS
  'Datas ocupadas de uma acomodação (reservas pendente/confirmada + bloqueios manuais). Sem PII.';

GRANT EXECUTE ON FUNCTION public.periodos_ocupacao_acomodacao(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.periodos_ocupacao_acomodacao(UUID) TO anon;
